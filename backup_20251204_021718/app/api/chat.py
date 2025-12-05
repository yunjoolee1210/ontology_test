"""
Chat API Router - 멀티에이전트 오케스트레이션

CareGuide AI 챗봇 API 엔드포인트
- /chat 페이지: Medical_Welfare, Nutrition, Research_Paper 3개 에이전트 지원
- 비동기 병렬 호출 및 응답 병합
- Redis 기반 세션 관리
- PII 탐지 및 의료 안전 필터 적용
"""

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import sys
import base64
from pathlib import Path

# Add backend path for imports
backend_path = Path(__file__).parent.parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from Agent.agent_manager import AgentManager
from Agent.core.redis_session_manager import (
    redis_session_manager,
    UserType,
    ProfileType,
    DiseaseStage,
    DialysisType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Global instances
_agent_manager: Optional[AgentManager] = None


def get_agent_manager() -> AgentManager:
    """Get or create agent manager singleton"""
    global _agent_manager
    if _agent_manager is None:
        _agent_manager = AgentManager()
    return _agent_manager


async def close_chat_resources():
    """Close chat resources on shutdown"""
    global _agent_manager
    # Disconnect Redis
    await redis_session_manager.disconnect()
    _agent_manager = None
    logger.info("Chat resources closed")


# ========================
# Request/Response Models
# ========================

class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    message: str = Field(..., description="사용자 메시지")
    session_id: Optional[str] = Field(None, description="세션 ID (없으면 자동 생성)")
    agent_type: Optional[str] = Field(
        None,
        description="선택한 에이전트 (Medical_Welfare, Nutrition, Research_Paper)"
    )
    profile: str = Field("general", description="프로필 유형 (general, patient, researcher)")
    disease_stage: str = Field("None", description="질환 단계 (CKD1-5, DKD-C, CKD_T, AKI)")
    dialysis_type: str = Field("None", description="투석 유형 (PD, HD, None)")
    language: str = Field("ko", description="언어")


class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    success: bool
    session_id: str
    response: str
    agents_used: List[str] = []
    intent: str = "unknown"
    sources: List[Dict[str, Any]] = []
    tokens_used: int = 0
    risk_level: str = "low"
    has_safety_warning: bool = False
    is_session_ended: bool = False
    pii_warning: Optional[str] = None
    error: Optional[str] = None


class SessionCreateRequest(BaseModel):
    """세션 생성 요청"""
    user_id: str = "anonymous"
    profile: str = "general"
    disease_stage: str = "None"
    dialysis_type: str = "None"


class SessionResponse(BaseModel):
    """세션 응답"""
    success: bool
    session_id: str
    message: Optional[str] = None


class FeedbackRequest(BaseModel):
    """피드백 요청"""
    session_id: str
    message_index: int
    thumbs_up: Optional[bool] = None
    thumbs_down: Optional[bool] = None
    feedback_text: Optional[str] = None


# ========================
# 정보 엔드포인트
# ========================

@router.get("/info")
async def chat_info():
    """
    채팅 서비스 정보 조회

    사용 가능한 에이전트 및 기능 정보 반환
    """
    agent_manager = get_agent_manager()
    available_agents = agent_manager.get_available_agents()

    return {
        "service": "CareGuide Chat API",
        "version": "4.0.0",
        "description": "멀티에이전트 오케스트레이션 기반 CKD 환자 지원 챗봇",
        "agents": {
            "Medical_Welfare": "의료·복지·병원·의약·질환 정보",
            "Nutrition": "영양/식이/레시피 분석 및 추천",
            "Research_Paper": "PubMed·KDIGO 논문 검색"
        },
        "features": [
            "자동 의도 분류",
            "비동기 병렬 에이전트 처리",
            "Redis 기반 세션 관리",
            "개인정보 탐지 및 보호",
            "의료 안전 필터",
            "프로필 기반 응답 최적화"
        ],
        "profiles": ["general", "patient", "researcher"],
        "disease_stages": ["CKD1", "CKD2", "CKD3", "CKD4", "CKD5", "DKD-C", "CKD_T", "AKI"],
        "dialysis_types": ["PD", "HD", "None"],
        "status": "active"
    }


# ========================
# 메인 채팅 엔드포인트
# ========================

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    채팅 메시지 전송

    정책 7: 오케스트레이션 플로우 실행
    1. 세션 확인/생성
    2. PII 검사
    3. 의도 분류
    4. 에이전트 호출
    5. 응답 병합
    6. 안전 필터 적용
    7. 대화 이력 저장

    Args:
        request: ChatRequest - 채팅 요청

    Returns:
        ChatResponse: 처리된 응답
    """
    try:
        agent_manager = get_agent_manager()

        # 오케스트레이션 실행
        result = await agent_manager.orchestrate(
            user_input=request.message,
            session_id=request.session_id,
            selected_agent=request.agent_type,
            profile_type=request.profile,
            disease_stage=request.disease_stage,
            dialysis_type=request.dialysis_type,
            language=request.language
        )

        return ChatResponse(
            success=result.success,
            session_id=result.session_id,
            response=result.response,
            agents_used=result.agents_used,
            intent=result.intent,
            sources=result.sources,
            tokens_used=result.tokens_used,
            risk_level=result.risk_level.value,
            has_safety_warning=result.has_safety_warning,
            is_session_ended=result.is_session_ended,
            pii_warning=result.pii_warning,
            error=result.error
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/image")
async def send_message_with_image(
    message: str = Form(...),
    session_id: Optional[str] = Form(None),
    agent_type: Optional[str] = Form(None),
    profile: str = Form("general"),
    disease_stage: str = Form("None"),
    dialysis_type: str = Form("None"),
    language: str = Form("ko"),
    image: Optional[UploadFile] = File(None)
):
    """
    이미지 포함 채팅 메시지 전송

    Nutrition 에이전트의 음식 이미지 분석 지원
    - 이미지 안전 검사 (얼굴 감지, OCR 기반 PII 검사)
    - 음식 분석 및 영양 정보 제공

    Args:
        message: 사용자 메시지
        session_id: 세션 ID
        agent_type: 선택한 에이전트
        profile: 프로필 유형
        disease_stage: 질환 단계
        dialysis_type: 투석 유형
        language: 언어
        image: 음식 이미지 파일

    Returns:
        ChatResponse: 처리된 응답
    """
    try:
        agent_manager = get_agent_manager()

        # 이미지 데이터 처리
        image_data = None
        if image:
            contents = await image.read()
            image_data = contents
            logger.info(f"Image received: {len(contents)} bytes")

        # 오케스트레이션 실행
        result = await agent_manager.orchestrate(
            user_input=message,
            session_id=session_id,
            selected_agent=agent_type or "Nutrition",  # 이미지 분석은 기본적으로 Nutrition
            profile_type=profile,
            disease_stage=disease_stage,
            dialysis_type=dialysis_type,
            image_data=image_data,
            language=language
        )

        return ChatResponse(
            success=result.success,
            session_id=result.session_id,
            response=result.response,
            agents_used=result.agents_used,
            intent=result.intent,
            sources=result.sources,
            tokens_used=result.tokens_used,
            risk_level=result.risk_level.value,
            has_safety_warning=result.has_safety_warning,
            is_session_ended=result.is_session_ended,
            pii_warning=result.pii_warning,
            error=result.error
        )

    except Exception as e:
        logger.error(f"Chat with image error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# 레거시 호환 엔드포인트
# ========================

@router.post("/orchestrate")
async def orchestrated_chat(request: ChatRequest):
    """
    멀티에이전트 오케스트레이션 (레거시 호환)

    여러 에이전트를 병렬로 호출하고 응답 병합
    """
    return await send_message(request)


# ========================
# 세션 관리 엔드포인트
# ========================

@router.post("/session/create", response_model=SessionResponse)
async def create_chat_session(request: SessionCreateRequest):
    """
    새 채팅 세션 생성

    Args:
        request: SessionCreateRequest

    Returns:
        SessionResponse: 생성된 세션 정보
    """
    try:
        session_id = await redis_session_manager.create_session(
            user_type=UserType.GUEST,
            profile_type=ProfileType(request.profile),
            disease_stage=DiseaseStage(request.disease_stage) if request.disease_stage != "None" else DiseaseStage.NONE,
            dialysis_type=DialysisType(request.dialysis_type) if request.dialysis_type != "None" else DialysisType.NONE
        )

        return SessionResponse(
            success=True,
            session_id=session_id,
            message="Session created successfully"
        )

    except Exception as e:
        logger.error(f"Session creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session_info(session_id: str):
    """
    세션 정보 조회

    Args:
        session_id: 세션 ID

    Returns:
        세션 상세 정보
    """
    session = await redis_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    return {
        "success": True,
        "session_id": session_id,
        "profile_type": session.profile_type,
        "disease_stage": session.disease_stage,
        "dialysis_type": session.dialysis_type,
        "is_active": session.is_active,
        "context_keywords": session.context_keywords,
        "user_preferences": session.user_preferences,
        "history_count": len(session.history),
        "created_at": session.created_at,
        "last_active": session.last_active
    }


@router.get("/session/{session_id}/history")
async def get_conversation_history(session_id: str, limit: int = 50):
    """
    대화 히스토리 조회

    Args:
        session_id: 세션 ID
        limit: 최대 조회 개수

    Returns:
        대화 히스토리 목록
    """
    history = await redis_session_manager.get_conversation_history(
        session_id,
        limit=limit
    )

    if not history:
        raise HTTPException(status_code=404, detail="Session not found or no history")

    return {
        "success": True,
        "session_id": session_id,
        "history": history,
        "count": len(history)
    }


@router.post("/session/{session_id}/end")
async def end_session(session_id: str):
    """
    세션 종료 (비활성화)

    정책: 사용자가 "대화 그만", "종료" 요청 시 세션 비활성화
    10분 내 재활성화 가능

    Args:
        session_id: 세션 ID

    Returns:
        종료 확인
    """
    success = await redis_session_manager.deactivate_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "session_id": session_id,
        "message": "Session ended. You can reactivate within 10 minutes."
    }


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    세션 완전 삭제

    Args:
        session_id: 세션 ID

    Returns:
        삭제 확인
    """
    success = await redis_session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "session_id": session_id,
        "message": "Session deleted"
    }


# ========================
# 피드백 엔드포인트 (Admin용)
# ========================

@router.post("/feedback")
async def add_feedback(request: FeedbackRequest):
    """
    메시지에 피드백 추가

    정책 7-6: admin 관리자 사이트에서 대화세션별로
    컨텍스트 키워드, 대화 만족도 확인 가능

    Args:
        request: FeedbackRequest

    Returns:
        피드백 저장 확인
    """
    success = await redis_session_manager.add_feedback(
        session_id=request.session_id,
        message_index=request.message_index,
        thumbs_up=request.thumbs_up,
        thumbs_down=request.thumbs_down,
        feedback_text=request.feedback_text
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Session or message not found"
        )

    return {
        "success": True,
        "message": "Feedback saved"
    }


# ========================
# 사용자 선호도 엔드포인트
# ========================

@router.post("/session/{session_id}/preferences")
async def update_user_preferences(
    session_id: str,
    liked_foods: Optional[List[str]] = None,
    disliked_foods: Optional[List[str]] = None,
    allergies: Optional[List[str]] = None
):
    """
    사용자 음식 선호도 업데이트

    정책 1: Nutrition 에이전트가 사용자 선호도 기억
    - 좋아하는 음식
    - 싫어하는 음식
    - 알러지

    Args:
        session_id: 세션 ID
        liked_foods: 좋아하는 음식 목록
        disliked_foods: 싫어하는 음식 목록
        allergies: 알러지 목록

    Returns:
        업데이트 확인
    """
    success = await redis_session_manager.update_user_preferences(
        session_id=session_id,
        liked_foods=liked_foods,
        disliked_foods=disliked_foods,
        allergies=allergies
    )

    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "message": "Preferences updated"
    }
