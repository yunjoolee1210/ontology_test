"""
Medical Welfare Agent Implementation
의료복지 검색 기능 구현 - OpenAI API 연동

정책:
- LLM 기반 의도 분류
- 사용자 프로필 컨텍스트 적용
- RAG 연동 (의료복지 데이터)
- 페르소나 적용 (따뜻하고 전문적인 응대)
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from openai import AsyncOpenAI

from ..base_agent import BaseAgent
from ..core.persona import PersonaManager, ProfileType, SYSTEM_PROMPT
from .prompts import (
    MEDICAL_WELFARE_SYSTEM_PROMPT,
    INTENT_CLASSIFICATION_PROMPT,
    RESPONSE_GENERATION_PROMPT,
    FALLBACK_RESPONSE_PROMPT,
    FACILITY_SEARCH_PROMPT,
    get_profile_instructions,
    get_empathy_expression
)

# MongoDB 의료기관 조회 (lazy import)
try:
    from app.db.mongodb_manager import MongoDBManager
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False

logger = logging.getLogger(__name__)


class MedicalWelfareAgent(BaseAgent):
    """의료복지 정보 검색 Agent - OpenAI API 연동"""

    def __init__(self):
        super().__init__(agent_type="medical_welfare")
        self.client = None
        self._client_initialized = False

        # MongoDB 클라이언트 (lazy init)
        self.db_manager = None
        self._db_initialized = False

        # 대화 상태 저장
        self.conversation_states = {}

    async def _ensure_client(self):
        """OpenAI 클라이언트 lazy initialization"""
        if not self._client_initialized:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("⚠️ OPENAI_API_KEY not found")
                raise ValueError("OPENAI_API_KEY not configured")
            self.client = AsyncOpenAI(api_key=api_key)
            self._client_initialized = True
            logger.info("✅ MedicalWelfareAgent OpenAI client initialized")

    def _ensure_db(self):
        """MongoDB 클라이언트 lazy initialization"""
        if not self._db_initialized and MONGODB_AVAILABLE:
            try:
                self.db_manager = MongoDBManager()
                self._db_initialized = True
                logger.info("✅ MedicalWelfareAgent MongoDB initialized")
            except Exception as e:
                logger.warning(f"MongoDB initialization failed: {e}")
                self.db_manager = None

    async def process(
        self,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        의료복지 검색 처리

        Args:
            user_input: 사용자 질문
            session_id: 세션 ID
            context: 추가 컨텍스트 (user_profile, intent_result, context_keywords 등)

        Returns:
            Dict[str, Any]: 검색 결과
        """
        # 1. 클라이언트 초기화
        try:
            await self._ensure_client()
            self._ensure_db()
        except ValueError as e:
            return self._error_response(str(e), session_id)

        # 2. 토큰 사용량 추정
        tokens_used = self.estimate_context_usage(user_input)
        self.context_usage += tokens_used

        # 3. 컨텍스트에서 정보 추출
        user_profile = "general"
        intent_result = None
        context_keywords = []
        conversation_history = []

        if context:
            user_profile = context.get("profile_type", context.get("user_profile", "general"))
            intent_result = context.get("intent_result")
            context_keywords = context.get("context_keywords", [])
            conversation_history = context.get("conversation_history", [])

        try:
            # 4. 의도 분류 (AgentManager에서 이미 분류한 경우 재사용)
            if intent_result:
                intent = intent_result.get("primary_intent", "general_inquiry")
                keywords = intent_result.get("keywords", [])
            else:
                # 자체 의도 분류
                intent_data = await self._classify_intent(user_input)
                intent = intent_data.get("intent", "general_inquiry")
                keywords = intent_data.get("keywords", [])

            logger.info(f"🏥 Medical Welfare Intent: {intent}, Keywords: {keywords}")

            # 5. 의료기관 검색 의도인 경우 특별 처리
            if intent == "facility_info":
                result = await self._handle_facility_search(user_input, user_profile, context)
            else:
                # 6. RAG 검색 (의료복지 데이터베이스)
                search_results = await self._search_medical_welfare_data(user_input, keywords)

                # 7. LLM으로 응답 생성
                result = await self._generate_response(
                    user_input=user_input,
                    intent=intent,
                    search_results=search_results,
                    user_profile=user_profile,
                    context_keywords=context_keywords,
                    conversation_history=conversation_history
                )

            return {
                "response": result["response"],
                "type": "medical_welfare",
                "tokens_used": tokens_used,
                "status": "success",
                "data": result.get("data", {}),
                "sources": result.get("sources", []),
                "metadata": {
                    "agent_type": self.agent_type,
                    "session_id": session_id,
                    "intent": intent,
                    "keywords": keywords
                }
            }

        except Exception as e:
            logger.error(f"Medical welfare processing error: {e}", exc_info=True)
            return self._error_response(str(e), session_id)

    async def _classify_intent(self, user_input: str) -> Dict[str, Any]:
        """
        의도 분류 (LLM 기반)

        Args:
            user_input: 사용자 입력

        Returns:
            Dict: 분류 결과
        """
        try:
            prompt = INTENT_CLASSIFICATION_PROMPT.format(user_input=user_input)

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "의료복지 질문의 의도를 분류하세요. JSON으로 응답하세요."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )

            content = response.choices[0].message.content
            return self._extract_json(content)

        except Exception as e:
            logger.error(f"Intent classification failed: {e}")
            return {"intent": "general_inquiry", "keywords": [], "confidence": 0.5}

    async def _search_medical_welfare_data(
        self,
        user_input: str,
        keywords: List[str]
    ) -> List[Dict[str, Any]]:
        """
        의료복지 데이터 검색 (RAG)

        Args:
            user_input: 사용자 입력
            keywords: 추출된 키워드

        Returns:
            List[Dict]: 검색 결과
        """
        results = []

        # MongoDB에서 의료복지 정보 검색
        if self.db_manager:
            try:
                # 의료복지 컬렉션 검색
                welfare_results = await self._search_welfare_collection(keywords)
                results.extend(welfare_results)
            except Exception as e:
                logger.warning(f"Welfare search failed: {e}")

        # 내장 의료복지 정보 (fallback)
        if not results:
            results = self._get_builtin_welfare_info(keywords)

        return results[:5]  # 최대 5개 결과

    async def _search_welfare_collection(self, keywords: List[str]) -> List[Dict[str, Any]]:
        """MongoDB에서 복지 정보 검색"""
        results = []

        if not self.db_manager:
            return results

        try:
            # 텍스트 검색
            search_query = " ".join(keywords)
            # 실제 구현 시 MongoDB 컬렉션에서 검색
            # welfare_docs = self.db_manager.search_welfare(search_query)
            pass
        except Exception as e:
            logger.warning(f"Welfare collection search failed: {e}")

        return results

    def _get_builtin_welfare_info(self, keywords: List[str]) -> List[Dict[str, Any]]:
        """내장 의료복지 정보 반환"""
        builtin_info = [
            {
                "title": "산정특례 제도",
                "content": "만성신부전으로 투석을 받는 환자는 산정특례를 신청하면 본인부담금이 10%로 줄어듭니다. 신청은 해당 병원에서 가능합니다.",
                "category": "medical_cost_support",
                "keywords": ["산정특례", "투석", "본인부담금", "의료비"]
            },
            {
                "title": "본인부담상한제",
                "content": "연간 의료비 본인부담금이 일정 금액을 초과하면 초과분을 환급받을 수 있습니다. 소득에 따라 상한액이 다르며, 건강보험공단(1577-1000)에서 신청 가능합니다.",
                "category": "medical_cost_support",
                "keywords": ["본인부담상한제", "환급", "의료비", "건강보험"]
            },
            {
                "title": "장애인 등록",
                "content": "투석 치료를 3개월 이상 받으면 신장장애 등록이 가능합니다. 장애등급 판정 후 다양한 복지 혜택을 받을 수 있습니다. 주민센터에서 신청하세요.",
                "category": "insurance_benefits",
                "keywords": ["장애인", "장애등록", "투석", "복지혜택"]
            },
            {
                "title": "투석 환자 교통비 지원",
                "content": "일부 지자체에서는 투석 환자의 병원 방문 교통비를 지원합니다. 관할 주민센터에 문의하세요.",
                "category": "dialysis_support",
                "keywords": ["교통비", "투석", "지원", "지자체"]
            },
            {
                "title": "긴급복지 지원",
                "content": "갑작스러운 위기 상황(실직, 질병 등)으로 생계가 어려운 경우 긴급복지 지원을 받을 수 있습니다. 129(정부 민원상담) 또는 주민센터에 신청하세요.",
                "category": "general_welfare",
                "keywords": ["긴급복지", "지원", "생계", "위기"]
            }
        ]

        # 키워드 매칭으로 관련 정보 필터링
        if not keywords:
            return builtin_info[:3]

        matched = []
        for info in builtin_info:
            score = sum(1 for kw in keywords if kw in " ".join(info["keywords"]))
            if score > 0:
                info["relevance_score"] = score
                matched.append(info)

        # 관련성 높은 순으로 정렬
        matched.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        return matched if matched else builtin_info[:2]

    async def _handle_facility_search(
        self,
        user_input: str,
        user_profile: str,
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        의료기관 검색 처리

        Args:
            user_input: 사용자 입력
            user_profile: 사용자 프로필
            context: 추가 컨텍스트

        Returns:
            Dict: 검색 결과
        """
        try:
            # 검색 파라미터 추출
            search_params = await self._extract_facility_params(user_input)
            logger.info(f"🏥 Facility search params: {search_params}")

            facilities = []

            # MongoDB에서 의료기관 검색
            if self.db_manager and MONGODB_AVAILABLE:
                try:
                    # 실제 구현 시 healthcare_facilities 컬렉션에서 검색
                    # facilities = await self.db_manager.search_facilities(search_params)
                    pass
                except Exception as e:
                    logger.warning(f"Facility search failed: {e}")

            # 검색 결과가 없으면 안내 메시지
            if not facilities:
                response = self._generate_facility_guidance(search_params, user_profile)
            else:
                response = self._format_facility_results(facilities, user_profile)

            return {
                "response": response,
                "data": {"facilities": facilities, "search_params": search_params},
                "sources": []
            }

        except Exception as e:
            logger.error(f"Facility search error: {e}")
            return {
                "response": "의료기관 검색 중 오류가 발생했습니다. 건강보험공단(1577-1000)에 문의하시면 가까운 투석 가능 병원을 안내받으실 수 있습니다.",
                "data": {},
                "sources": []
            }

    async def _extract_facility_params(self, user_input: str) -> Dict[str, Any]:
        """의료기관 검색 파라미터 추출"""
        try:
            prompt = FACILITY_SEARCH_PROMPT.format(
                user_input=user_input,
                location="사용자 위치 정보 없음"
            )

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "의료기관 검색 파라미터를 추출하세요. JSON으로 응답하세요."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.3
            )

            content = response.choices[0].message.content
            return self._extract_json(content)

        except Exception as e:
            logger.error(f"Facility params extraction failed: {e}")
            return {"search_type": "hospital", "region": None, "requirements": []}

    def _generate_facility_guidance(
        self,
        search_params: Dict[str, Any],
        user_profile: str
    ) -> str:
        """의료기관 안내 메시지 생성"""
        region = search_params.get("region", "")
        requirements = search_params.get("requirements", [])

        if region:
            location_text = f"{region} 지역의"
        else:
            location_text = "가까운"

        if "야간투석" in requirements:
            feature_text = "야간 투석이 가능한 "
        elif "주말투석" in requirements:
            feature_text = "주말 투석이 가능한 "
        else:
            feature_text = ""

        response = f"""의료기관 정보를 찾고 계시군요.

{location_text} {feature_text}투석 가능 병원을 찾으시려면:

1. **건강보험공단** (1577-1000)에 전화하시면 가까운 투석 병원 목록을 안내받으실 수 있습니다.

2. **대한신장학회 홈페이지** (www.ksn.or.kr)에서도 투석 기관을 검색하실 수 있습니다.

3. **현재 다니시는 병원**에서 다른 투석 기관으로 전원이 필요하시면 담당 의료진께 상담해 주세요.

혹시 특정 지역이나 조건(야간투석, 복막투석 등)이 있으시면 말씀해 주세요."""

        return response

    def _format_facility_results(
        self,
        facilities: List[Dict[str, Any]],
        user_profile: str
    ) -> str:
        """의료기관 검색 결과 포맷팅"""
        if not facilities:
            return "검색 조건에 맞는 의료기관을 찾지 못했습니다."

        lines = ["찾으신 조건에 맞는 의료기관 목록입니다:\n"]

        for i, facility in enumerate(facilities[:5], 1):
            name = facility.get("name", "이름 없음")
            address = facility.get("address", "주소 정보 없음")
            phone = facility.get("phone", "전화번호 정보 없음")
            features = facility.get("features", [])

            lines.append(f"**{i}. {name}**")
            lines.append(f"   📍 {address}")
            lines.append(f"   📞 {phone}")
            if features:
                lines.append(f"   ✅ {', '.join(features)}")
            lines.append("")

        lines.append("방문 전 전화로 예약 및 진료 가능 여부를 확인하시는 것이 좋습니다.")

        return "\n".join(lines)

    async def _generate_response(
        self,
        user_input: str,
        intent: str,
        search_results: List[Dict[str, Any]],
        user_profile: str,
        context_keywords: List[str],
        conversation_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        LLM으로 최종 응답 생성

        Args:
            user_input: 사용자 입력
            intent: 분류된 의도
            search_results: 검색 결과
            user_profile: 사용자 프로필
            context_keywords: 컨텍스트 키워드
            conversation_history: 대화 히스토리

        Returns:
            Dict: 응답 결과
        """
        try:
            # 프로필별 시스템 프롬프트 구성
            profile_instructions = get_profile_instructions(user_profile)
            system_prompt = MEDICAL_WELFARE_SYSTEM_PROMPT.format(
                profile_specific_instructions=profile_instructions
            )

            # 검색 결과 포맷팅
            if search_results:
                search_text = "\n\n".join([
                    f"**{r.get('title', '정보')}**\n{r.get('content', '')}"
                    for r in search_results
                ])
            else:
                search_text = "관련 정보를 찾지 못했습니다."

            # 공감 표현 추가
            empathy = get_empathy_expression(intent)

            # 응답 생성 프롬프트
            if search_results:
                user_prompt = RESPONSE_GENERATION_PROMPT.format(
                    user_input=user_input,
                    intent=intent,
                    search_results=search_text
                )
            else:
                user_prompt = FALLBACK_RESPONSE_PROMPT.format(
                    user_input=user_input,
                    intent=intent
                )

            # 대화 히스토리 포함
            messages = [{"role": "system", "content": system_prompt}]

            # 최근 대화 2개만 포함
            for hist in conversation_history[-2:]:
                messages.append({"role": "user", "content": hist.get("user_input", "")})
                messages.append({"role": "assistant", "content": hist.get("agent_response", "")})

            messages.append({"role": "user", "content": user_prompt})

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=1500,
                temperature=0.7
            )

            answer = response.choices[0].message.content
            logger.info(f"✅ Medical welfare response generated: {len(answer)} chars")

            # 출처 정보 추출
            sources = [
                {"title": r.get("title", ""), "category": r.get("category", "")}
                for r in search_results if r.get("title")
            ]

            return {
                "response": answer,
                "data": {"intent": intent, "matched_info": len(search_results)},
                "sources": sources
            }

        except Exception as e:
            logger.error(f"Response generation failed: {e}", exc_info=True)
            # Fallback 응답
            return {
                "response": self._get_fallback_response(intent),
                "data": {},
                "sources": []
            }

    def _get_fallback_response(self, intent: str) -> str:
        """Fallback 응답 생성"""
        fallback_messages = {
            "medical_cost_support": """의료비 지원에 대해 궁금하신 거군요.

투석 환자분이시라면 **산정특례 제도**를 통해 본인부담금을 10%로 줄일 수 있습니다.
자세한 내용은 현재 다니시는 병원 원무과나 건강보험공단(1577-1000)에 문의해 주세요.""",

            "insurance_benefits": """건강보험 혜택에 대해 알려드릴게요.

투석 치료를 3개월 이상 받으시면 **신장장애 등록**이 가능하며, 다양한 복지 혜택을 받으실 수 있습니다.
관할 주민센터에서 신청하실 수 있습니다.""",

            "dialysis_support": """투석 관련 지원 제도를 안내해 드릴게요.

- 산정특례: 본인부담금 10% 감면
- 교통비 지원: 일부 지자체에서 지원 (주민센터 문의)
- 장애인 등록: 투석 3개월 이상 시 신청 가능

더 자세한 내용이 궁금하시면 말씀해 주세요.""",

            "general_inquiry": """궁금하신 점이 있으시군요.

저는 만성콩팥병 환자분들을 위한 의료복지 정보를 안내해 드리고 있습니다.
의료비 지원, 건강보험 혜택, 투석 관련 지원 등에 대해 도움을 드릴 수 있어요.

어떤 정보가 필요하신가요?"""
        }

        return fallback_messages.get(intent, fallback_messages["general_inquiry"])

    def _extract_json(self, content: str) -> Dict[str, Any]:
        """JSON 추출"""
        try:
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
            else:
                json_str = content.strip()
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"JSON extraction failed: {e}")
            return {}

    def _error_response(self, error_msg: str, session_id: str) -> Dict[str, Any]:
        """에러 응답 생성"""
        return {
            "response": f"죄송합니다. 의료복지 정보 검색 중 오류가 발생했습니다. 건강보험공단(1577-1000)에 직접 문의하시면 도움을 받으실 수 있습니다.",
            "type": "error",
            "tokens_used": 0,
            "status": "error",
            "data": {},
            "metadata": {
                "agent_type": self.agent_type,
                "session_id": session_id,
                "error": error_msg
            }
        }

    def estimate_context_usage(self, user_input: str) -> int:
        """
        컨텍스트 사용량 추정

        Args:
            user_input: 사용자 입력

        Returns:
            int: 예상 토큰 수
        """
        # 한글 1글자 = 약 1.5 토큰
        estimated_tokens = int(len(user_input) * 1.5)
        estimated_tokens += 800  # 시스템 프롬프트
        estimated_tokens += 1200  # 예상 응답
        estimated_tokens += 500   # 검색 결과

        return estimated_tokens
