"""
Redis Session Manager
Redis 기반 채팅 세션 및 대화 이력 관리

정책 4. 세션 & 대화이력 관리 구현
- chat_session_id (UUID v4) 기준으로 모든 대화 관리
- Redis Key: chat:{session_id}:context → JSON 형태로 저장
"""

import os
import json
import uuid
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum

try:
    import redis.asyncio as redis
except ImportError:
    import redis

logger = logging.getLogger(__name__)


class UserType(str, Enum):
    """사용자 유형"""
    GUEST = "guest"
    USER = "user"
    ADMIN = "admin"


class ProfileType(str, Enum):
    """프로필 유형"""
    GENERAL = "general"      # 일반인/간병인
    PATIENT = "patient"      # 질환자/경험자
    RESEARCHER = "researcher"  # 연구자/전문가


class DiseaseStage(str, Enum):
    """질환 단계"""
    CKD1 = "CKD1"
    CKD2 = "CKD2"
    CKD3 = "CKD3"
    CKD4 = "CKD4"
    CKD5 = "CKD5"
    DKD_C = "DKD-C"       # 당뇨성 신장병
    CKD_T = "CKD_T"       # 이식환자
    AKI = "AKI"           # 급성신손상
    NONE = "None"


class DialysisType(str, Enum):
    """투석 유형"""
    PD = "PD"   # 복막투석
    HD = "HD"   # 혈액투석
    NONE = "None"


class AgentType(str, Enum):
    """에이전트 유형"""
    MEDICAL_WELFARE = "Medical_Welfare"
    NUTRITION = "Nutrition"
    RESEARCH_PAPER = "Research_Paper"
    QUIZ = "Quiz"


class IntentType(str, Enum):
    """의도 유형"""
    NUTRITION = "nutrition"
    MEDICAL = "medical"
    PAPER = "paper"
    QUIZ = "quiz"
    MIXED = "mixed"


# Agent별 환영 메시지 상수 정의
AGENT_WELCOME_MESSAGES = {
    "medical_welfare": "안녕하세요! 의료/복지 정보 도우미입니다.\n만성콩팥병 환자분들을 위한 의료 정보와 복지 혜택 안내를 도와드립니다.\n궁금하신 내용을 자유롭게 질문해주세요.",
    "nutrition": "안녕하세요! 식이/영양 관리 도우미입니다.\n만성콩팥병 환자분들의 건강한 식단 관리를 도와드립니다.\n식품 영양 분석, 맞춤 레시피, 식이 요법 등을 안내해드릴게요.",
    "research_paper": "안녕하세요! 연구 논문 검색 도우미입니다.\n만성콩팥병 관련 최신 연구 논문과 학술 정보를 찾아드립니다.\n관심 있는 연구 주제나 키워드를 말씀해주세요."
}


class ChatSessionContext:
    """채팅 세션 컨텍스트 데이터 구조"""

    def __init__(
        self,
        session_id: str,
        user_type: UserType = UserType.GUEST,
        profile_type: ProfileType = ProfileType.GENERAL,
        disease_stage: DiseaseStage = DiseaseStage.NONE,
        dialysis_type: DialysisType = DialysisType.NONE,
        latest_intent: Optional[IntentType] = None,
        recent_agent: Optional[AgentType] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        agent_histories: Optional[Dict[str, List[Dict[str, Any]]]] = None,
        context_keywords: Optional[List[str]] = None,
        user_preferences: Optional[Dict[str, Any]] = None,
        is_active: bool = True,
        inactivity_warning_sent: bool = False,
        created_at: Optional[str] = None,
        last_active: Optional[str] = None
    ):
        self.session_id = session_id
        self.user_type = user_type
        self.profile_type = profile_type
        self.disease_stage = disease_stage
        self.dialysis_type = dialysis_type
        self.latest_intent = latest_intent
        self.recent_agent = recent_agent
        self.history = history or []
        # Agent별 대화 이력 분리 저장
        self.agent_histories = agent_histories or {
            "medical_welfare": [],
            "nutrition": [],
            "research_paper": [],
            "trend_visualization": []
        }
        self.context_keywords = context_keywords or []
        self.user_preferences = user_preferences or {
            "liked_foods": [],
            "disliked_foods": [],
            "allergies": []
        }
        self.is_active = is_active
        self.inactivity_warning_sent = inactivity_warning_sent

        now = datetime.utcnow().isoformat() + "Z"
        self.created_at = created_at or now
        self.last_active = last_active or now

    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "user_type": self.user_type.value if isinstance(self.user_type, Enum) else self.user_type,
            "profile_type": self.profile_type.value if isinstance(self.profile_type, Enum) else self.profile_type,
            "disease_stage": self.disease_stage.value if isinstance(self.disease_stage, Enum) else self.disease_stage,
            "dialysis_type": self.dialysis_type.value if isinstance(self.dialysis_type, Enum) else self.dialysis_type,
            "latest_intent": self.latest_intent.value if isinstance(self.latest_intent, Enum) else self.latest_intent,
            "recent_agent": self.recent_agent.value if isinstance(self.recent_agent, Enum) else self.recent_agent,
            "history": self.history,
            "agent_histories": self.agent_histories,
            "context_keywords": self.context_keywords,
            "user_preferences": self.user_preferences,
            "is_active": self.is_active,
            "inactivity_warning_sent": self.inactivity_warning_sent,
            "created_at": self.created_at,
            "last_active": self.last_active
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatSessionContext":
        """딕셔너리에서 생성"""
        return cls(
            session_id=data.get("session_id", str(uuid.uuid4())),
            user_type=UserType(data.get("user_type", "guest")),
            profile_type=ProfileType(data.get("profile_type", "general")),
            disease_stage=DiseaseStage(data.get("disease_stage", "None")),
            dialysis_type=DialysisType(data.get("dialysis_type", "None")),
            latest_intent=IntentType(data["latest_intent"]) if data.get("latest_intent") else None,
            recent_agent=AgentType(data["recent_agent"]) if data.get("recent_agent") else None,
            history=data.get("history", []),
            agent_histories=data.get("agent_histories", {
                "medical_welfare": [],
                "nutrition": [],
                "research_paper": [],
                "trend_visualization": []
            }),
            context_keywords=data.get("context_keywords", []),
            user_preferences=data.get("user_preferences", {}),
            is_active=data.get("is_active", True),
            inactivity_warning_sent=data.get("inactivity_warning_sent", False),
            created_at=data.get("created_at"),
            last_active=data.get("last_active")
        )


class RedisSessionManager:
    """Redis 기반 세션 관리자"""

    # 정책 4: 세션 타임아웃 30분, 비활성 후 10분 내 재활성화 가능
    SESSION_TIMEOUT_MINUTES = 30
    REACTIVATION_WINDOW_MINUTES = 10

    def __init__(
        self,
        redis_url: Optional[str] = None,
        session_timeout: int = SESSION_TIMEOUT_MINUTES
    ):
        """
        Redis 세션 관리자 초기화

        Args:
            redis_url: Redis 연결 URL
            session_timeout: 세션 타임아웃 (분)
        """
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.session_timeout = timedelta(minutes=session_timeout)
        self.reactivation_window = timedelta(minutes=self.REACTIVATION_WINDOW_MINUTES)
        self._redis: Optional[redis.Redis] = None

    async def connect(self) -> None:
        """Redis 연결"""
        if self._redis is None:
            self._redis = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            logger.info(f"✅ Redis 연결 성공: {self.redis_url}")

    async def disconnect(self) -> None:
        """Redis 연결 해제"""
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("Redis 연결 해제")

    def _get_session_key(self, session_id: str) -> str:
        """세션 키 생성"""
        return f"chat:{session_id}:context"

    async def create_session(
        self,
        user_id: Optional[str] = None,
        user_type: UserType = UserType.GUEST,
        profile_type: ProfileType = ProfileType.GENERAL,
        disease_stage: DiseaseStage = DiseaseStage.NONE,
        dialysis_type: DialysisType = DialysisType.NONE,
        initial_agent: str = "medical_welfare"
    ) -> str:
        """
        새 채팅 세션 생성

        Args:
            user_id: 사용자 ID
            user_type: 사용자 유형
            profile_type: 프로필 유형
            disease_stage: 질환 단계
            dialysis_type: 투석 유형
            initial_agent: 초기 선택 에이전트 (기본: medical_welfare)

        Returns:
            str: 생성된 session_id (UUID v4)
        """
        await self.connect()

        session_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # 각 agent별로 환영 메시지 초기화
        agent_histories = {}
        for agent_key, welcome_msg in AGENT_WELCOME_MESSAGES.items():
            welcome_message = {
                "role": "assistant",
                "content": welcome_msg,
                "timestamp": now,
                "agent_type": agent_key,
                "is_welcome": True
            }
            agent_histories[agent_key] = [welcome_message]

        # trend_visualization은 빈 이력으로 초기화
        agent_histories["trend_visualization"] = []

        context = ChatSessionContext(
            session_id=session_id,
            user_type=user_type,
            profile_type=profile_type,
            disease_stage=disease_stage,
            dialysis_type=dialysis_type,
            agent_histories=agent_histories
        )

        # 전체 history에도 초기 에이전트의 환영 메시지 추가
        if initial_agent in AGENT_WELCOME_MESSAGES:
            context.history.append({
                "role": "assistant",
                "content": AGENT_WELCOME_MESSAGES[initial_agent],
                "timestamp": now,
                "agent_type": initial_agent,
                "is_welcome": True
            })

        key = self._get_session_key(session_id)
        await self._redis.setex(
            key,
            int(self.session_timeout.total_seconds()),
            json.dumps(context.to_dict(), ensure_ascii=False)
        )

        logger.info(f"✅ 세션 생성: {session_id}, user_type={user_type.value}, initial_agent={initial_agent}")
        return session_id

    async def get_session(self, session_id: str) -> Optional[ChatSessionContext]:
        """
        세션 정보 조회

        Args:
            session_id: 세션 ID

        Returns:
            Optional[ChatSessionContext]: 세션 컨텍스트 또는 None
        """
        await self.connect()

        key = self._get_session_key(session_id)
        data = await self._redis.get(key)

        if not data:
            return None

        try:
            context_dict = json.loads(data)
            return ChatSessionContext.from_dict(context_dict)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"세션 파싱 오류: {e}")
            return None

    async def update_session(
        self,
        session_id: str,
        **kwargs
    ) -> bool:
        """
        세션 정보 업데이트

        Args:
            session_id: 세션 ID
            **kwargs: 업데이트할 필드들

        Returns:
            bool: 업데이트 성공 여부
        """
        context = await self.get_session(session_id)
        if not context:
            return False

        # 업데이트 가능한 필드들
        for key, value in kwargs.items():
            if hasattr(context, key):
                setattr(context, key, value)

        # 마지막 활동 시간 업데이트
        context.last_active = datetime.utcnow().isoformat() + "Z"

        key = self._get_session_key(session_id)
        await self._redis.setex(
            key,
            int(self.session_timeout.total_seconds()),
            json.dumps(context.to_dict(), ensure_ascii=False)
        )

        return True

    async def add_message_to_history(
        self,
        session_id: str,
        role: str,  # "user" or "assistant"
        content: str,
        agent_type: Optional[str] = None,
        feedback: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        대화 히스토리에 메시지 추가 (agent별로 분리 저장)

        Args:
            session_id: 세션 ID
            role: 역할 (user/assistant)
            content: 메시지 내용
            agent_type: 에이전트 타입 (필수 - agent별 이력 분리용)
            feedback: 피드백 정보 (thumbs_up, thumbs_down, text)

        Returns:
            bool: 추가 성공 여부
        """
        context = await self.get_session(session_id)
        if not context:
            return False

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        if agent_type:
            message["agent_type"] = agent_type

        if feedback:
            message["feedback"] = feedback

        # 전체 히스토리에 추가 (호환성 유지)
        context.history.append(message)

        # Agent별 히스토리에도 추가
        if agent_type:
            normalized_agent = agent_type.lower().replace("-", "_")
            if normalized_agent not in context.agent_histories:
                context.agent_histories[normalized_agent] = []
            context.agent_histories[normalized_agent].append(message)

        context.last_active = datetime.utcnow().isoformat() + "Z"
        # 메시지가 오면 inactivity 경고 리셋
        context.inactivity_warning_sent = False

        key = self._get_session_key(session_id)
        await self._redis.setex(
            key,
            int(self.session_timeout.total_seconds()),
            json.dumps(context.to_dict(), ensure_ascii=False)
        )

        return True

    async def add_context_keyword(
        self,
        session_id: str,
        keyword: str
    ) -> bool:
        """
        컨텍스트 키워드 추가 (비동기 업데이트)

        Args:
            session_id: 세션 ID
            keyword: 키워드

        Returns:
            bool: 추가 성공 여부
        """
        context = await self.get_session(session_id)
        if not context:
            return False

        if keyword not in context.context_keywords:
            context.context_keywords.append(keyword)
            # 최근 20개만 유지
            context.context_keywords = context.context_keywords[-20:]

        return await self.update_session(
            session_id,
            context_keywords=context.context_keywords
        )

    async def update_user_preferences(
        self,
        session_id: str,
        liked_foods: Optional[List[str]] = None,
        disliked_foods: Optional[List[str]] = None,
        allergies: Optional[List[str]] = None
    ) -> bool:
        """
        사용자 선호도 업데이트 (Nutrition 에이전트용)

        Args:
            session_id: 세션 ID
            liked_foods: 좋아하는 음식 목록
            disliked_foods: 싫어하는 음식 목록
            allergies: 알러지 목록

        Returns:
            bool: 업데이트 성공 여부
        """
        context = await self.get_session(session_id)
        if not context:
            return False

        if liked_foods is not None:
            context.user_preferences["liked_foods"] = liked_foods
        if disliked_foods is not None:
            context.user_preferences["disliked_foods"] = disliked_foods
        if allergies is not None:
            context.user_preferences["allergies"] = allergies

        return await self.update_session(
            session_id,
            user_preferences=context.user_preferences
        )

    async def deactivate_session(self, session_id: str) -> bool:
        """
        세션 비활성화 (대화 종료 요청 시)

        정책: "대화 그만", "꺼져", "대화 종료해" 발화 시
        세션을 비활성화하고 입력창 비활성화
        10분 내 재활성화 가능

        Args:
            session_id: 세션 ID

        Returns:
            bool: 비활성화 성공 여부
        """
        context = await self.get_session(session_id)
        if not context:
            return False

        context.is_active = False

        # 10분 동안 유지 (재활성화 가능)
        key = self._get_session_key(session_id)
        await self._redis.setex(
            key,
            int(self.reactivation_window.total_seconds()),
            json.dumps(context.to_dict(), ensure_ascii=False)
        )

        logger.info(f"세션 비활성화: {session_id}")
        return True

    async def reactivate_session(self, session_id: str) -> Optional[str]:
        """
        세션 재활성화 또는 새 세션 생성

        정책: 종료 후 10분 내에 다시 대화 시도 시
        새로운 chat session 시작

        Args:
            session_id: 기존 세션 ID

        Returns:
            Optional[str]: 새 세션 ID 또는 None
        """
        context = await self.get_session(session_id)

        if context and not context.is_active:
            # 비활성 세션 발견 - 새 세션 생성
            new_session_id = await self.create_session(
                user_type=UserType(context.user_type) if isinstance(context.user_type, str) else context.user_type,
                profile_type=ProfileType(context.profile_type) if isinstance(context.profile_type, str) else context.profile_type,
                disease_stage=DiseaseStage(context.disease_stage) if isinstance(context.disease_stage, str) else context.disease_stage,
                dialysis_type=DialysisType(context.dialysis_type) if isinstance(context.dialysis_type, str) else context.dialysis_type
            )

            # 사용자 선호도 복사
            new_context = await self.get_session(new_session_id)
            if new_context:
                new_context.user_preferences = context.user_preferences
                await self.update_session(
                    new_session_id,
                    user_preferences=new_context.user_preferences
                )

            logger.info(f"세션 재활성화: {session_id} → {new_session_id}")
            return new_session_id

        return None

    async def delete_session(self, session_id: str) -> bool:
        """
        세션 삭제

        Args:
            session_id: 세션 ID

        Returns:
            bool: 삭제 성공 여부
        """
        await self.connect()

        key = self._get_session_key(session_id)
        result = await self._redis.delete(key)

        if result:
            logger.info(f"세션 삭제: {session_id}")

        return bool(result)

    async def get_conversation_history(
        self,
        session_id: str,
        limit: Optional[int] = None,
        agent_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        대화 히스토리 조회

        Args:
            session_id: 세션 ID
            limit: 최대 개수
            agent_type: 특정 agent의 이력만 조회 (선택)

        Returns:
            List[Dict]: 대화 히스토리
        """
        context = await self.get_session(session_id)
        if not context:
            return []

        # Agent별 이력 조회
        if agent_type:
            normalized_agent = agent_type.lower().replace("-", "_")
            history = context.agent_histories.get(normalized_agent, [])
        else:
            history = context.history

        if limit:
            return history[-limit:]
        return history

    async def get_agent_history(
        self,
        session_id: str,
        agent_type: str
    ) -> List[Dict[str, Any]]:
        """
        특정 Agent의 대화 히스토리 조회

        Args:
            session_id: 세션 ID
            agent_type: 에이전트 타입

        Returns:
            List[Dict]: 해당 Agent의 대화 히스토리
        """
        context = await self.get_session(session_id)
        if not context:
            return []

        normalized_agent = agent_type.lower().replace("-", "_")
        return context.agent_histories.get(normalized_agent, [])

    async def check_inactivity(
        self,
        session_id: str
    ) -> Dict[str, Any]:
        """
        세션 비활성 상태 체크 및 경고 메시지 처리

        정책:
        - 10분 비활성: "응답이 없으신 경우, 챗봇 세션이 3분 후 종료됩니다." 경고
        - 13분 비활성 (경고 후 3분): 자동 세션 종료

        Args:
            session_id: 세션 ID

        Returns:
            Dict: {
                "should_warn": bool,
                "should_terminate": bool,
                "warning_message": Optional[str],
                "termination_message": Optional[str],
                "inactive_seconds": int
            }
        """
        context = await self.get_session(session_id)
        if not context or not context.is_active:
            return {
                "should_warn": False,
                "should_terminate": False,
                "warning_message": None,
                "termination_message": None,
                "inactive_seconds": 0
            }

        last_active = datetime.fromisoformat(context.last_active.replace("Z", "+00:00"))
        now = datetime.utcnow().replace(tzinfo=last_active.tzinfo)
        inactive_seconds = (now - last_active).total_seconds()

        INACTIVITY_WARNING_SECONDS = 10 * 60  # 10분
        INACTIVITY_TERMINATION_SECONDS = 13 * 60  # 13분 (경고 후 3분)

        result = {
            "should_warn": False,
            "should_terminate": False,
            "warning_message": None,
            "termination_message": None,
            "inactive_seconds": int(inactive_seconds)
        }

        # 13분 이상 비활성 → 세션 종료
        if inactive_seconds >= INACTIVITY_TERMINATION_SECONDS:
            result["should_terminate"] = True
            result["termination_message"] = "네, AI챗봇 대화 세션을 종료하겠습니다."
            # 세션 비활성화
            await self.deactivate_session(session_id)

        # 10분 이상 비활성 & 아직 경고 안 보냄 → 경고 메시지
        elif inactive_seconds >= INACTIVITY_WARNING_SECONDS and not context.inactivity_warning_sent:
            result["should_warn"] = True
            result["warning_message"] = "응답이 없으신 경우, 챗봇 세션이 3분 후 종료됩니다."
            # 경고 보냈음 표시
            await self.update_session(session_id, inactivity_warning_sent=True)

        return result

    async def add_feedback(
        self,
        session_id: str,
        message_index: int,
        thumbs_up: Optional[bool] = None,
        thumbs_down: Optional[bool] = None,
        feedback_text: Optional[str] = None
    ) -> bool:
        """
        메시지에 피드백 추가 (admin 관리자용)

        Args:
            session_id: 세션 ID
            message_index: 메시지 인덱스
            thumbs_up: 좋아요
            thumbs_down: 싫어요
            feedback_text: 피드백 텍스트

        Returns:
            bool: 추가 성공 여부
        """
        context = await self.get_session(session_id)
        if not context or message_index >= len(context.history):
            return False

        feedback = context.history[message_index].get("feedback", {})

        if thumbs_up is not None:
            feedback["thumbs_up"] = thumbs_up
        if thumbs_down is not None:
            feedback["thumbs_down"] = thumbs_down
        if feedback_text is not None:
            feedback["text"] = feedback_text

        context.history[message_index]["feedback"] = feedback

        key = self._get_session_key(session_id)
        await self._redis.setex(
            key,
            int(self.session_timeout.total_seconds()),
            json.dumps(context.to_dict(), ensure_ascii=False)
        )

        return True


# 싱글톤 인스턴스
redis_session_manager = RedisSessionManager()
