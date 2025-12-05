"""
Agent Manager - 멀티에이전트 오케스트레이터

CareGuide의 핵심 오케스트레이터이자 최종 응답 생성자입니다.
만성콩팥병(CKD) 환자·간병인·연구자를 위한 멀티에이전트 AI 챗봇

정책 1: 전체 시스템 개요
- 3개의 서브 에이전트: Medical_Welfare, Nutrition, Research_Paper
- /chat 페이지: 위 3개 에이전트 비동기·병렬 호출 가능
- /quiz 페이지: Quiz 에이전트 단독 운영

정책 7: 오케스트레이션 플로우
1. 사용자가 AI챗봇 agent 선택, 입력창 등록 → 채팅 대화 시작 → chat_session_id 확인/생성
2. PII Detector → 민감정보 있으면 안내
3. 이미지 있으면 face-detect → OCR → safety 체크 (병렬)
4. Intent/Category 분류 + 세션 컨텍스트 로드
5. 라우팅 규칙 적용 → 필요 에이전트 리스트 생성 (병렬/순차)
6. 각 에이전트에 (대화이력 + 컨텍스트 키워드) 전달 → 응답 수집
7. 응답 병합 (중복 제거 → 우선순위 정렬 → 단일 응답 생성)
8. 최종 응답에 공통 퍼소나·톤앤매너 + 의료 안전 로직 재적용
9. 대화이력 저장 → 세션 업데이트 → 클라이언트 전달
"""

import asyncio
import logging
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum

from .base_agent import BaseAgent
from .context_tracker import ContextTracker
from .session_manager import SessionManager  # 레거시 호환용

# 핵심 모듈 임포트
from .core.redis_session_manager import (
    RedisSessionManager,
    ChatSessionContext,
    UserType,
    ProfileType as SessionProfileType,
    DiseaseStage,
    DialysisType,
    AgentType as SessionAgentType,
    IntentType as SessionIntentType,
    redis_session_manager
)
from .core.pii_detector import pii_detector, PIIDetectionResult
from .core.medical_safety_filter import (
    medical_safety_filter,
    RiskLevel,
    SafetyCheckResult
)
from .core.nutrition_guidelines import nutrition_guidelines_manager
from .core.persona import (
    persona_manager,
    ProfileType,
    SESSION_END_RESPONSE
)
from .core.intent_classifier import (
    intent_classifier,
    IntentType,
    AgentType,
    IntentClassificationResult
)
from .core.response_merger import response_merger, MergedResponse

# 에이전트 임포트
from .medical_welfare.agent import MedicalWelfareAgent
from .nutrition.agent import NutritionAgent
from .research_paper.agent import ResearchPaperAgent
from .trend_visualization.agent import TrendVisualizationAgent

logger = logging.getLogger(__name__)

# 프론트엔드 한국어 프로필 타입 → 백엔드 enum 매핑
PROFILE_TYPE_MAP = {
    "신장병 환우": "patient",
    "간병인": "general",
    "일반인": "general",
    "연구자": "researcher",
    "전문가": "researcher",
    "general": "general",
    "patient": "patient",
    "researcher": "researcher",
}


class QueryIntent(Enum):
    """쿼리 의도 분류 (레거시 호환용)"""
    RESEARCH = "research"
    NUTRITION = "nutrition"
    WELFARE = "welfare"
    TREND = "trend"
    GENERAL = "general"
    MULTI = "multi"


class OrchestratorResult:
    """오케스트레이터 결과"""

    def __init__(
        self,
        success: bool,
        session_id: str,
        response: str,
        agents_used: List[str],
        intent: str,
        sources: List[Dict[str, Any]] = None,
        tokens_used: int = 0,
        risk_level: RiskLevel = RiskLevel.LOW,
        has_safety_warning: bool = False,
        is_session_ended: bool = False,
        pii_warning: Optional[str] = None,
        error: Optional[str] = None,
        context_info: Optional[Dict[str, Any]] = None
    ):
        self.success = success
        self.session_id = session_id
        self.response = response
        self.agents_used = agents_used
        self.intent = intent
        self.sources = sources or []
        self.tokens_used = tokens_used
        self.risk_level = risk_level
        self.has_safety_warning = has_safety_warning
        self.is_session_ended = is_session_ended
        self.pii_warning = pii_warning
        self.error = error
        self.context_info = context_info

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "success": self.success,
            "session_id": self.session_id,
            "response": self.response,
            "combined_answer": self.response,  # 호환성
            "agents_used": self.agents_used,
            "intent": self.intent,
            "sources": self.sources,
            "tokens_used": self.tokens_used,
            "total_tokens_used": self.tokens_used,  # 호환성
            "risk_level": self.risk_level.value,
            "has_safety_warning": self.has_safety_warning,
            "is_session_ended": self.is_session_ended,
            "pii_warning": self.pii_warning,
            "error": self.error,
            "context_info": self.context_info
        }


class AgentManager:
    """
    멀티에이전트 오케스트레이터

    정책 1: 하나의 챗봇 안에 3개의 서브 에이전트 존재
    - Medical_Welfare: 의료·복지·병원·의약·질환 정보
    - Nutrition: 영양/식이/레시피 분석 및 추천
    - Research_Paper: PubMed·KDIGO 논문 검색
    """

    def __init__(self):
        """오케스트레이터 초기화"""
        # 레거시 호환성
        self.context_tracker = ContextTracker()
        self.session_manager = SessionManager()

        # 에이전트 인스턴스 초기화
        self.agents: Dict[str, BaseAgent] = {
            "Medical_Welfare": MedicalWelfareAgent(),
            "Nutrition": NutritionAgent(),
            "Research_Paper": ResearchPaperAgent(),
            "trend_visualization": TrendVisualizationAgent(),
            # 레거시 호환 매핑
            "medical_welfare": MedicalWelfareAgent(),
            "nutrition": NutritionAgent(),
            "research_paper": ResearchPaperAgent(),
        }

        # 핵심 모듈
        self.redis_session = redis_session_manager
        self.pii_detector = pii_detector
        self.safety_filter = medical_safety_filter
        self.persona_manager = persona_manager
        self.intent_classifier = intent_classifier
        self.response_merger = response_merger
        self.nutrition_guidelines = nutrition_guidelines_manager

        logger.info("✅ AgentManager initialized with full orchestration support")

    # ========================
    # 정책 7: 오케스트레이션 플로우
    # ========================

    async def orchestrate(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        selected_agent: Optional[str] = None,
        profile_type: str = "general",
        disease_stage: str = "None",
        dialysis_type: str = "None",
        image_data: Optional[bytes] = None,
        language: str = "ko"
    ) -> OrchestratorResult:
        """
        전체 오케스트레이션 플로우 실행

        정책 7: 오케스트레이션 플로우
        1. 세션 확인/생성
        2. PII 검사
        3. 이미지 안전 검사 (있는 경우)
        4. 의도 분류 + 세션 컨텍스트 로드
        5. 라우팅 및 에이전트 호출
        6. 응답 병합
        7. 안전 필터 적용
        8. 대화 이력 저장

        Args:
            user_input: 사용자 입력
            session_id: 세션 ID (없으면 생성)
            selected_agent: 사용자가 선택한 에이전트
            profile_type: 프로필 유형 (general/patient/researcher)
            disease_stage: 질환 단계
            dialysis_type: 투석 유형
            image_data: 이미지 데이터 (바이트)
            language: 언어

        Returns:
            OrchestratorResult: 오케스트레이션 결과
        """
        try:
            # ========================================
            # 프로필 타입 정규화 (한국어 → enum 값)
            # ========================================
            normalized_profile = PROFILE_TYPE_MAP.get(profile_type, "general")

            # ========================================
            # 정책 7-1: 세션 확인/생성
            # ========================================
            if not session_id:
                session_id = await self.redis_session.create_session(
                    user_type=UserType.GUEST,
                    profile_type=SessionProfileType(normalized_profile),
                    disease_stage=DiseaseStage(disease_stage) if disease_stage != "None" else DiseaseStage.NONE,
                    dialysis_type=DialysisType(dialysis_type) if dialysis_type != "None" else DialysisType.NONE
                )
                logger.info(f"✅ 새 세션 생성: {session_id}")
            else:
                # 기존 세션 확인
                session = await self.redis_session.get_session(session_id)
                if not session:
                    # 세션 만료 - 재활성화 시도
                    new_session_id = await self.redis_session.reactivate_session(session_id)
                    if new_session_id:
                        session_id = new_session_id
                        logger.info(f"✅ 세션 재활성화: {session_id}")
                    else:
                        # 새 세션 생성
                        session_id = await self.redis_session.create_session(
                            user_type=UserType.GUEST,
                            profile_type=SessionProfileType(normalized_profile)
                        )
                elif not session.is_active:
                    # 비활성 세션 - 새 세션 생성
                    session_id = await self.redis_session.create_session(
                        user_type=UserType.GUEST,
                        profile_type=SessionProfileType(session.profile_type)
                    )

            # ========================================
            # 정책 1: 대화 종료 요청 체크
            # ========================================
            if self.persona_manager.is_session_end_request(user_input):
                await self.redis_session.deactivate_session(session_id)
                return OrchestratorResult(
                    success=True,
                    session_id=session_id,
                    response=SESSION_END_RESPONSE,
                    agents_used=[],
                    intent="farewell",
                    is_session_ended=True
                )

            # ========================================
            # 정책 7-2: PII 검사
            # ========================================
            pii_result = self.pii_detector.detect_pii(user_input)
            if pii_result.has_pii:
                logger.warning(f"⚠️ PII 감지: {pii_result.detected_types}")
                if pii_result.should_block:
                    return OrchestratorResult(
                        success=False,
                        session_id=session_id,
                        response=pii_result.warning_message,
                        agents_used=[],
                        intent="blocked",
                        pii_warning=pii_result.warning_message
                    )
                # 마스킹된 텍스트로 대체
                user_input = pii_result.masked_text

            # ========================================
            # 정책 7-3: 이미지 안전 검사 (병렬)
            # ========================================
            ocr_text = None
            if image_data:
                is_safe, warning, ocr_text = self.pii_detector.check_image_safety(image_data)
                if not is_safe:
                    return OrchestratorResult(
                        success=False,
                        session_id=session_id,
                        response=warning,
                        agents_used=[],
                        intent="blocked",
                        pii_warning=warning
                    )

            # ========================================
            # 정책 7-4: 의도 분류 + 세션 컨텍스트 로드
            # ========================================
            intent_result = self.intent_classifier.classify(user_input, selected_agent)
            logger.info(f"🎯 의도 분류: {intent_result.primary_intent.value}, "
                       f"confidence={intent_result.confidence:.2f}")

            # 세션 컨텍스트 로드
            session_context = await self.redis_session.get_session(session_id)
            conversation_history = []
            if session_context:
                conversation_history = session_context.history[-10:]  # 최근 10개

            # 컨텍스트 키워드 추출 및 저장
            context_keywords = self.intent_classifier.extract_context_keywords(user_input)
            for keyword in context_keywords:
                await self.redis_session.add_context_keyword(session_id, keyword)

            # ========================================
            # 정책 3: 의료 안전 검사
            # ========================================
            safety_result = self.safety_filter.check_input_safety(user_input)
            if safety_result.risk_level == RiskLevel.EMERGENCY:
                # 응급 상황 즉시 응답
                return OrchestratorResult(
                    success=True,
                    session_id=session_id,
                    response=safety_result.emergency_warning,
                    agents_used=[],
                    intent="emergency",
                    risk_level=RiskLevel.EMERGENCY,
                    has_safety_warning=True
                )

            # ========================================
            # 정책 7-5: 라우팅 및 에이전트 호출
            # ========================================
            # 에이전트 결정
            if selected_agent:
                agents_to_call = [selected_agent]
            else:
                agents_to_call = [
                    agent.value for agent in intent_result.recommended_agents
                ]

            # 연구 논문 에이전트 안내 체크
            research_guide = None
            if selected_agent and self.persona_manager.needs_research_agent_guide(user_input, selected_agent):
                research_guide = self.persona_manager.get_research_agent_guide()

            # ========================================
            # 정책 7-6: 에이전트 병렬 호출
            # ========================================
            # 이미지 데이터를 base64 문자열로 변환 (nutrition agent용)
            import base64
            image_data_b64 = None
            if image_data:
                image_data_b64 = base64.b64encode(image_data).decode("utf-8")

            context = {
                "profile": profile_type,
                "user_profile": profile_type,  # nutrition agent 호환
                "language": language,
                "disease_stage": disease_stage,
                "dialysis_type": dialysis_type,
                "conversation_history": conversation_history,
                "context_keywords": context_keywords,
                "image_data": image_data_b64,  # base64 문자열로 전달
                "ocr_text": ocr_text,
                "has_image": image_data is not None
            }

            # 영양 가이드라인 추가 (Nutrition 에이전트용)
            if "Nutrition" in agents_to_call or "nutrition" in agents_to_call:
                context["nutrition_guidelines"] = self.nutrition_guidelines.format_guideline_text(
                    disease_stage,
                    dialysis_type
                )
                if session_context:
                    context["user_preferences"] = session_context.user_preferences

            agent_results = await self._call_agents_parallel(
                agents_to_call,
                user_input,
                session_id,
                context
            )

            # ========================================
            # 정책 7-7, 7-8: 응답 병합 및 안전 필터
            # ========================================
            merged = self.response_merger.merge_responses(
                agent_results,
                user_input,
                ProfileType(normalized_profile),
                safety_result
            )

            # 연구 논문 안내 추가
            final_response = merged.response
            if research_guide:
                final_response = f"{final_response}\n\n{research_guide}"

            # ========================================
            # 정책 7-9: 대화 이력 저장
            # ========================================
            # 사용자 메시지 저장
            await self.redis_session.add_message_to_history(
                session_id,
                role="user",
                content=user_input
            )

            # 어시스턴트 응답 저장
            await self.redis_session.add_message_to_history(
                session_id,
                role="assistant",
                content=final_response,
                agent_type=",".join(merged.agents_used)
            )

            # 세션 업데이트
            await self.redis_session.update_session(
                session_id,
                latest_intent=SessionIntentType(intent_result.primary_intent.value)
                if intent_result.primary_intent.value in [e.value for e in SessionIntentType]
                else None,
                recent_agent=SessionAgentType(merged.agents_used[0])
                if merged.agents_used and merged.agents_used[0] in [e.value for e in SessionAgentType]
                else None
            )

            return OrchestratorResult(
                success=True,
                session_id=session_id,
                response=final_response,
                agents_used=merged.agents_used,
                intent=intent_result.primary_intent.value,
                sources=merged.sources,
                tokens_used=merged.tokens_used,
                risk_level=merged.risk_level,
                has_safety_warning=merged.has_safety_warning,
                pii_warning=pii_result.warning_message if pii_result.has_pii else None,
                context_info=self.context_tracker.check_limit(session_id)
            )

        except Exception as e:
            logger.error(f"❌ 오케스트레이션 오류: {e}", exc_info=True)
            return OrchestratorResult(
                success=False,
                session_id=session_id or str(uuid.uuid4()),
                response=self.persona_manager.get_fallback_message(),
                agents_used=[],
                intent="error",
                error=str(e)
            )

    async def _call_agents_parallel(
        self,
        agent_types: List[str],
        user_input: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """
        여러 에이전트 병렬 호출

        Args:
            agent_types: 호출할 에이전트 목록
            user_input: 사용자 입력
            session_id: 세션 ID
            context: 컨텍스트 정보

        Returns:
            Dict: 에이전트별 응답 결과
        """
        tasks = []
        valid_agents = []

        for agent_type in agent_types:
            if agent_type in self.agents:
                task = self._process_single_agent(
                    agent_type,
                    user_input,
                    session_id,
                    context
                )
                tasks.append(task)
                valid_agents.append(agent_type)

        if not tasks:
            return {}

        logger.info(f"🚀 {len(tasks)}개 에이전트 병렬 호출: {valid_agents}")
        results = await asyncio.gather(*tasks, return_exceptions=True)

        agent_results = {}
        for i, result in enumerate(results):
            agent_type = valid_agents[i]
            if isinstance(result, Exception):
                logger.error(f"❌ {agent_type} 오류: {result}")
            elif result and result.get("success"):
                agent_result = result.get("result", {})
                agent_results[agent_type] = agent_result
                logger.info(f"✅ {agent_type} 완료, response 길이: {len(agent_result.get('response', ''))}")
            else:
                logger.warning(f"⚠️ {agent_type} 실패: {result}")

        logger.info(f"📊 agent_results 키: {list(agent_results.keys())}")
        return agent_results

    async def _process_single_agent(
        self,
        agent_type: str,
        user_input: str,
        session_id: str,
        context: Dict[str, Any],
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        단일 에이전트 처리 (타임아웃 포함)

        Args:
            agent_type: 에이전트 타입
            user_input: 사용자 입력
            session_id: 세션 ID
            context: 컨텍스트
            timeout: 타임아웃 (초)

        Returns:
            Dict: 에이전트 응답
        """
        try:
            agent = self.agents.get(agent_type)
            if not agent:
                return {"success": False, "error": f"Unknown agent: {agent_type}"}

            result = await asyncio.wait_for(
                agent.process(user_input, session_id, context),
                timeout=timeout
            )

            return {
                "success": True,
                "agent_type": agent_type,
                "result": result
            }

        except asyncio.TimeoutError:
            logger.warning(f"⏰ {agent_type} 타임아웃 ({timeout}초)")
            return {
                "success": False,
                "agent_type": agent_type,
                "error": "Timeout"
            }
        except Exception as e:
            logger.error(f"❌ {agent_type} 처리 오류: {e}")
            return {
                "success": False,
                "agent_type": agent_type,
                "error": str(e)
            }

    # ========================
    # 레거시 호환 메서드
    # ========================

    async def route_request(
        self,
        agent_type: str,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        단일 에이전트로 요청 라우팅 (레거시 호환)
        """
        # context에서 이미지 데이터 추출
        image_data = None
        if context and context.get("has_image") and context.get("image_data"):
            import base64
            try:
                image_data = base64.b64decode(context["image_data"])
            except Exception as e:
                logger.warning(f"Failed to decode image data: {e}")

        result = await self.orchestrate(
            user_input=user_input,
            session_id=session_id,
            selected_agent=agent_type,
            profile_type=context.get("user_profile", context.get("profile", "general")) if context else "general",
            image_data=image_data
        )
        return result.to_dict()

    async def orchestrate_async(
        self,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None,
        agent_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        비동기 병렬 처리 (레거시 호환)
        """
        result = await self.orchestrate(
            user_input=user_input,
            session_id=session_id,
            selected_agent=agent_types[0] if agent_types and len(agent_types) == 1 else None,
            profile_type=context.get("profile", "general") if context else "general",
            language=context.get("language", "ko") if context else "ko"
        )
        return result.to_dict()

    async def chat(
        self,
        message: str,
        session_id: Optional[str] = None,
        profile: str = "general",
        language: str = "ko",
        parallel: bool = True
    ) -> Dict[str, Any]:
        """
        통합 채팅 인터페이스 (레거시 호환)
        """
        result = await self.orchestrate(
            user_input=message,
            session_id=session_id,
            profile_type=profile,
            language=language
        )
        return result.to_dict()

    def create_user_session(self, user_id: str) -> str:
        """
        사용자 세션 생성 (레거시 호환 - 동기 버전)
        """
        return self.session_manager.create_session(user_id)

    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        세션 정보 조회 (레거시 호환)
        """
        session = self.session_manager.get_session(session_id)
        if not session:
            return None

        return {
            "session": session,
            "context": self.context_tracker.get_session_summary(session_id)
        }

    def reset_session_context(self, session_id: str) -> bool:
        """
        세션 컨텍스트 초기화 (레거시 호환)
        """
        session = self.session_manager.get_session(session_id)
        if not session:
            return False

        self.context_tracker.reset_session(session_id)
        return True

    def get_available_agents(self) -> Dict[str, Dict[str, Any]]:
        """
        사용 가능한 에이전트 목록 반환
        """
        return {
            agent_type: agent.get_agent_info()
            for agent_type, agent in self.agents.items()
            if not agent_type.startswith("_")
        }

    def _classify_intent(self, user_input: str) -> QueryIntent:
        """
        의도 분류 (레거시 호환)
        """
        result = self.intent_classifier.classify(user_input)

        intent_mapping = {
            IntentType.RESEARCH: QueryIntent.RESEARCH,
            IntentType.NUTRITION: QueryIntent.NUTRITION,
            IntentType.MEDICAL: QueryIntent.WELFARE,
            IntentType.MIXED: QueryIntent.MULTI,
            IntentType.UNKNOWN: QueryIntent.GENERAL
        }

        return intent_mapping.get(result.primary_intent, QueryIntent.GENERAL)

    def _get_agents_for_intent(self, intent: QueryIntent) -> List[str]:
        """
        의도에 따른 에이전트 목록 (레거시 호환)
        """
        mapping = {
            QueryIntent.RESEARCH: ["Research_Paper"],
            QueryIntent.NUTRITION: ["Nutrition"],
            QueryIntent.WELFARE: ["Medical_Welfare"],
            QueryIntent.TREND: ["trend_visualization"],
            QueryIntent.GENERAL: ["Medical_Welfare"],
            QueryIntent.MULTI: ["Medical_Welfare", "Nutrition", "Research_Paper"]
        }
        return mapping.get(intent, ["Medical_Welfare"])

    def _combine_responses(
        self,
        agent_results: Dict[str, Dict[str, Any]],
        user_input: str
    ) -> str:
        """
        응답 병합 (레거시 호환)
        """
        merged = self.response_merger.merge_responses(
            agent_results,
            user_input
        )
        return merged.response
