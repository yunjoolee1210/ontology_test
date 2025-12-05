"""
Agent API Router
정책 7: 오케스트레이션 플로우 구현

Handles:
- 정책 4: Redis 기반 세션 관리
- 정책 6: PII 탐지 및 차단
- 정책 3: 의료 안전 필터
- 정책 7: Agent 라우팅 및 응답 처리
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import sys
import os

# Add Agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

from Agent.agent_manager import AgentManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])

# Initialize Agent Manager (Redis 기반)
agent_manager = AgentManager()

# Agent type mapping (프론트엔드 → 백엔드)
AGENT_TYPE_MAP = {
    "medical": "medical_welfare",
    "nutrition": "nutrition",
    "research": "research_paper",
    "trend": "trend_visualization"
}


# ========== Request/Response Models ==========

class SessionCreateRequest(BaseModel):
    """세션 생성 요청"""
    user_id: Optional[str] = None
    user_type: str = Field(default="guest", description="guest, user, admin")
    profile_type: str = Field(default="general", description="general, patient, researcher")
    disease_stage: str = Field(default="None", description="CKD1-5, DKD-C, CKD_T, AKI, None")
    dialysis_type: str = Field(default="None", description="PD, HD, None")
    initial_agent: str = Field(default="medical_welfare", description="초기 선택 에이전트: medical_welfare, nutrition, research_paper")


class SessionResponse(BaseModel):
    """세션 응답"""
    session_id: str
    user_type: str
    profile_type: str
    disease_stage: str
    dialysis_type: str
    is_active: bool
    created_at: str
    initial_agent: Optional[str] = None
    agent_histories: Optional[Dict[str, List[Dict[str, Any]]]] = None


class ChatRequest(BaseModel):
    """채팅 요청 모델"""
    message: str
    agent_type: str  # 'medical', 'nutrition', 'research', 'trend'
    session_id: str
    context: Optional[Dict[str, Any]] = None


class LoadingInfo(BaseModel):
    """정책 9: UX 최적화 - 대기 안내 메시지"""
    loading_message: str
    data_source: str
    requires_loading: bool = True


class ChatResponse(BaseModel):
    """채팅 응답 모델"""
    success: bool
    message: Optional[str] = None
    agent_type: Optional[str] = None
    session_id: str
    context_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    fallback_type: Optional[str] = None
    # 추가 필드
    intent_info: Optional[Dict[str, Any]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    has_safety_warning: Optional[bool] = None
    risk_level: Optional[str] = None
    session_deactivated: Optional[bool] = None
    # 연구 논문 관련 필드
    papers: Optional[List[Dict[str, Any]]] = None
    summary: Optional[str] = None
    # 정책 9: UX 최적화 - 대기 안내 메시지
    loading_info: Optional[LoadingInfo] = None


class FeedbackRequest(BaseModel):
    """피드백 요청 (admin용)"""
    session_id: str
    message_index: int
    thumbs_up: Optional[bool] = None
    thumbs_down: Optional[bool] = None
    feedback_text: Optional[str] = None


class UserPreferencesRequest(BaseModel):
    """사용자 선호도 요청 (Nutrition용)"""
    session_id: str
    liked_foods: Optional[List[str]] = None
    disliked_foods: Optional[List[str]] = None
    allergies: Optional[List[str]] = None


# ========== Fallback Messages ==========

def get_fallback_message(error_type: str, error_details: Optional[Dict] = None) -> Dict[str, Any]:
    """정책 8: 브랜드 Fallback 메시지"""
    fallback_messages = {
        "intent_classification_failed": {
            "message": "죄송해요, 질문을 이해하지 못했어요. 다른 방식으로 질문해 주시겠어요?",
            "type": "INTENT_CLASSIFICATION_FAILED"
        },
        "non_medical_domain": {
            "message": "저는 만성신장병 관련 정보만 도와드릴 수 있어요. 콩팥 건강이나 식이 영양 관리, 복지에 대해 물어봐 주세요!",
            "type": "NON_MEDICAL_DOMAIN"
        },
        "response_generation_failed": {
            "message": "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
            "type": "RESPONSE_GENERATION_FAILED"
        },
        "context_limit_exceeded": {
            "message": "대화가 너무 길어졌어요. 새로운 세션을 시작해 주세요.",
            "type": "CONTEXT_LIMIT_EXCEEDED"
        },
        "invalid_session": {
            "message": "세션이 만료되었어요. 새로고침 후 다시 시도해 주세요.",
            "type": "INVALID_SESSION"
        },
        "unknown_agent": {
            "message": "요청하신 기능을 찾을 수 없어요. 다시 시도해 주세요.",
            "type": "UNKNOWN_AGENT"
        },
        "pii_detected": {
            "message": "소중한 개인 정보를 입력하지 말아주세요. 입력하신 내용은 채팅 대화에 적용하거나 저장하지 않습니다.",
            "type": "PII_DETECTED"
        }
    }
    return fallback_messages.get(error_type, fallback_messages["response_generation_failed"])


# ========== Session Endpoints ==========

@router.post("/session/create", response_model=SessionResponse)
async def create_session(request: SessionCreateRequest):
    """
    정책 4: 새 채팅 세션 생성 (Redis 기반)

    Returns:
        SessionResponse: 생성된 세션 정보
    """
    try:
        session_id = await agent_manager.create_user_session(
            user_id=request.user_id,
            user_type=request.user_type,
            profile_type=request.profile_type,
            disease_stage=request.disease_stage,
            dialysis_type=request.dialysis_type,
            initial_agent=request.initial_agent
        )

        session = await agent_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create session")

        return SessionResponse(
            session_id=session_id,
            user_type=session.user_type.value if hasattr(session.user_type, 'value') else session.user_type,
            profile_type=session.profile_type.value if hasattr(session.profile_type, 'value') else session.profile_type,
            disease_stage=session.disease_stage.value if hasattr(session.disease_stage, 'value') else session.disease_stage,
            dialysis_type=session.dialysis_type.value if hasattr(session.dialysis_type, 'value') else session.dialysis_type,
            is_active=session.is_active,
            created_at=session.created_at,
            initial_agent=request.initial_agent,
            agent_histories=session.agent_histories
        )

    except Exception as e:
        logger.error(f"Error creating session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """세션 정보 조회"""
    try:
        session_info = await agent_manager.get_session_info(session_id)

        if not session_info:
            raise HTTPException(status_code=404, detail="Session not found")

        return session_info

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str, limit: Optional[int] = None):
    """대화 히스토리 조회 (admin용)"""
    try:
        history = await agent_manager.get_conversation_history(session_id, limit)
        return {
            "session_id": session_id,
            "history": history,
            "count": len(history)
        }

    except Exception as e:
        logger.error(f"Error getting history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def deactivate_session(session_id: str):
    """세션 비활성화 (대화 종료)"""
    try:
        result = await agent_manager.deactivate_session(session_id)
        return {
            "success": result,
            "session_id": session_id,
            "message": "세션이 비활성화되었습니다." if result else "세션을 찾을 수 없습니다."
        }

    except Exception as e:
        logger.error(f"Error deactivating session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ========== Chat Endpoint ==========

@router.post("/chat", response_model=ChatResponse)
async def agent_chat(request: ChatRequest):
    """
    정책 7: 오케스트레이션 플로우

    1. session_id 확인/생성
    2. PII Detector → 민감정보 차단
    3. Intent/Category 분류
    4. 라우팅 규칙 적용
    5. 에이전트 처리
    6. 응답 병합 + 안전 필터
    7. 대화이력 저장
    """
    try:
        # 프론트엔드 agent type → 백엔드 agent type 변환
        backend_agent_type = AGENT_TYPE_MAP.get(request.agent_type)

        if not backend_agent_type:
            fallback = get_fallback_message("unknown_agent")
            return ChatResponse(
                success=False,
                message=fallback["message"],
                session_id=request.session_id,
                fallback_type=fallback["type"],
                error=f"Unknown agent type: {request.agent_type}"
            )

        # 컨텍스트 초기화
        if not request.context:
            request.context = {}

        request.context["selected_agent"] = backend_agent_type

        logger.info(
            f"Processing chat - Session: {request.session_id}, "
            f"Agent: {backend_agent_type}, Message: {request.message[:50]}..."
        )

        # 정책 7: AgentManager.route_request 호출 (모든 정책 적용)
        result = await agent_manager.route_request(
            agent_type=backend_agent_type,
            user_input=request.message,
            session_id=request.session_id,
            context=request.context
        )

        # 성공 응답
        if result.get("success"):
            # OrchestratorResult.to_dict() 형식: response가 최상위에 있음
            # 또는 기존 형식: result["result"]["response"]
            if "response" in result:
                response_data = result
            else:
                response_data = result.get("result", {})
            context_info = result.get("context_info", {})

            # 연구 논문 agent인 경우 papers, summary 추출
            papers = response_data.get("papers", [])
            summary = response_data.get("summary", "")

            # 정책 9: 대기 안내 메시지 정보
            loading_info_data = result.get("loading_info")
            loading_info = None
            if loading_info_data:
                loading_info = LoadingInfo(
                    loading_message=loading_info_data.get("loading_message", ""),
                    data_source=loading_info_data.get("data_source", ""),
                    requires_loading=loading_info_data.get("requires_loading", True)
                )

            return ChatResponse(
                success=True,
                message=response_data.get("response", "응답을 생성할 수 없습니다."),
                agent_type=request.agent_type,
                session_id=result.get("session_id", request.session_id),
                context_info=context_info,
                intent_info=result.get("intent_info"),
                sources=response_data.get("sources", []),
                has_safety_warning=response_data.get("has_safety_warning", False),
                risk_level=response_data.get("risk_level"),
                session_deactivated=response_data.get("session_deactivated", False),
                papers=papers if papers else None,
                summary=summary if summary else None,
                loading_info=loading_info  # 정책 9: UX 최적화
            )

        # 에러 처리
        error = result.get("error", "")

        # PII 감지
        if error == "pii_detected":
            fallback = get_fallback_message("pii_detected")
            return ChatResponse(
                success=False,
                message=result.get("message", fallback["message"]),
                session_id=result.get("session_id", request.session_id),
                fallback_type=fallback["type"]
            )

        # 컨텍스트 제한 초과
        if "Context limit exceeded" in error:
            fallback = get_fallback_message("context_limit_exceeded")
            return ChatResponse(
                success=False,
                message=fallback["message"],
                session_id=request.session_id,
                fallback_type=fallback["type"],
                context_info=result.get("limit_info")
            )

        # 세션 만료
        if "Invalid" in error or "expired" in error.lower():
            fallback = get_fallback_message("invalid_session")
            return ChatResponse(
                success=False,
                message=fallback["message"],
                session_id=request.session_id,
                fallback_type=fallback["type"],
                error=error
            )

        # 알 수 없는 에이전트
        if "Unknown agent" in error:
            fallback = get_fallback_message("unknown_agent")
            return ChatResponse(
                success=False,
                message=fallback["message"],
                session_id=request.session_id,
                fallback_type=fallback["type"],
                error=error
            )

        # 기본 에러
        fallback = get_fallback_message("response_generation_failed")
        return ChatResponse(
            success=False,
            message=fallback["message"],
            session_id=request.session_id,
            fallback_type=fallback["type"],
            error=error
        )

    except Exception as e:
        logger.error(f"Error in agent_chat: {str(e)}", exc_info=True)

        fallback = get_fallback_message("response_generation_failed")
        return ChatResponse(
            success=False,
            message=fallback["message"],
            session_id=request.session_id,
            fallback_type=fallback["type"],
            error=str(e)
        )


# ========== Admin/Feedback Endpoints ==========

@router.post("/feedback")
async def add_feedback(request: FeedbackRequest):
    """정책 7-6: admin 관리자용 피드백 추가"""
    try:
        result = await agent_manager.add_feedback(
            session_id=request.session_id,
            message_index=request.message_index,
            thumbs_up=request.thumbs_up,
            thumbs_down=request.thumbs_down,
            feedback_text=request.feedback_text
        )

        return {
            "success": result,
            "session_id": request.session_id,
            "message_index": request.message_index
        }

    except Exception as e:
        logger.error(f"Error adding feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preferences")
async def update_preferences(request: UserPreferencesRequest):
    """Nutrition 에이전트용: 사용자 선호도 업데이트"""
    try:
        result = await agent_manager.update_user_preferences(
            session_id=request.session_id,
            liked_foods=request.liked_foods,
            disliked_foods=request.disliked_foods,
            allergies=request.allergies
        )

        return {
            "success": result,
            "session_id": request.session_id
        }

    except Exception as e:
        logger.error(f"Error updating preferences: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ========== Agent Switch & History Endpoints ==========

@router.get("/session/{session_id}/agent/{agent_type}/history")
async def get_agent_history(session_id: str, agent_type: str):
    """
    Agent 전환 시 해당 Agent의 대화 이력 반환

    사용 시나리오:
    - 의료 복지 → 식이 영양 전환: 식이 영양의 이전 대화 이력 반환
    - 식이 영양 → 의료 복지 전환: 의료 복지의 이전 대화 이력 반환

    Returns:
        {
            "session_id": str,
            "agent_type": str,
            "history": List[Dict],  # 해당 agent의 대화 이력
            "greeting": str,        # 해당 agent의 인사말
            "fewshot_examples": List[str]  # 예시 질문
        }
    """
    try:
        # 백엔드 agent type으로 변환
        backend_agent_type = AGENT_TYPE_MAP.get(agent_type, agent_type)
        normalized = backend_agent_type.lower().replace("-", "_")

        # 세션 확인
        session = await agent_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # 해당 agent의 대화 이력 조회
        from Agent.core.redis_session_manager import redis_session_manager
        history = await redis_session_manager.get_agent_history(session_id, normalized)

        # 프로필에 따른 인사말
        profile_type = session.profile_type.value if hasattr(session.profile_type, 'value') else session.profile_type

        # Agent별 인사말 및 fewshot 예시
        agent_greetings = {
            "medical_welfare": {
                "general": "안녕하세요! 만성콩팥병 관련 의료·복지 정보를 안내해 드려요. 의료비 지원, 장애 등록, 산정특례 등 궁금한 점을 물어봐 주세요.",
                "patient": "안녕하세요! 치료 과정에서 도움이 필요하신 부분이 있으시면 말씀해 주세요. 의료비 지원, 복지 혜택 등을 안내해 드릴게요.",
                "researcher": "안녕하세요! CKD 관련 의료 정책, 복지 제도 정보를 안내해 드립니다."
            },
            "nutrition": {
                "general": "안녕하세요! 만성콩팥병 환자분들을 위한 식이·영양 정보를 안내해 드려요. 나트륨, 칼륨, 단백질 조절 식단에 대해 물어봐 주세요.",
                "patient": "안녕하세요! 식단 관리에 도움이 필요하시면 말씀해 주세요. 투석 전후 식이 조절, 맞춤 레시피 등을 안내해 드릴게요.",
                "researcher": "안녕하세요! CKD 환자 영양 관리 가이드라인 및 식이 정보를 안내해 드립니다."
            },
            "research_paper": {
                "general": "안녕하세요! CKD 관련 최신 연구 논문을 검색해 드려요. KDIGO 가이드라인, PubMed 논문 등을 찾아보실 수 있어요.",
                "patient": "안녕하세요! 치료법 관련 연구 정보가 궁금하시면 물어봐 주세요. 이해하기 쉽게 설명해 드릴게요.",
                "researcher": "안녕하세요! PubMed 논문 검색, KDIGO 가이드라인, 임상시험 정보 등을 제공합니다. 어떤 연구가 필요하신가요?"
            },
            "trend_visualization": {
                "general": "안녕하세요! CKD 관련 트렌드와 데이터를 시각화하여 보여드려요.",
                "patient": "안녕하세요! 건강 데이터 트렌드가 궁금하시면 물어봐 주세요.",
                "researcher": "안녕하세요! CKD 관련 통계 및 트렌드 분석 정보를 제공합니다."
            }
        }

        agent_fewshots = {
            "medical_welfare": [
                "투석 환자 의료비 지원 제도 알려줘",
                "산정특례 신청 방법이 뭐야?",
                "장애 등록은 어떻게 해?"
            ],
            "nutrition": [
                "CKD 3기에 좋은 음식이 뭐야?",
                "칼륨 낮은 식단 추천해줘",
                "투석 후 단백질 섭취량은?"
            ],
            "research_paper": [
                "KDIGO 가이드라인 검색해줘",
                "CKD 진행 억제 최신 논문 찾아줘",
                "당뇨병성 신장병 연구 있어?"
            ],
            "trend_visualization": [
                "CKD 환자 현황 보여줘",
                "투석 환자 증가 추이는?",
                "지역별 만성콩팥병 통계"
            ]
        }

        greeting = agent_greetings.get(normalized, {}).get(profile_type, agent_greetings.get(normalized, {}).get("general", "안녕하세요!"))
        fewshots = agent_fewshots.get(normalized, [])

        return {
            "session_id": session_id,
            "agent_type": agent_type,
            "backend_agent_type": normalized,
            "history": history,
            "has_previous_history": len(history) > 0,
            "greeting": greeting,
            "fewshot_examples": fewshots,
            "profile_type": profile_type
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/inactivity")
async def check_session_inactivity(session_id: str):
    """
    세션 비활성 상태 체크

    프론트엔드에서 주기적으로 호출하여 inactivity 경고/종료 처리

    Returns:
        {
            "should_warn": bool,       # 경고 메시지 표시 필요
            "should_terminate": bool,  # 세션 종료 필요
            "warning_message": str,    # "응답이 없으신 경우, 챗봇 세션이 3분 후 종료됩니다."
            "termination_message": str,# "네, AI챗봇 대화 세션을 종료하겠습니다."
            "inactive_seconds": int    # 비활성 시간(초)
        }
    """
    try:
        from Agent.core.redis_session_manager import redis_session_manager
        result = await redis_session_manager.check_inactivity(session_id)
        return result

    except Exception as e:
        logger.error(f"Error checking inactivity: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ========== Info Endpoints ==========

@router.get("/agents")
async def list_agents():
    """사용 가능한 에이전트 목록"""
    return {
        "agents": AGENT_TYPE_MAP,
        "descriptions": {
            "medical": "의료 복지 정보 제공",
            "nutrition": "식이 영양 관리",
            "research": "연구 논문 검색",
            "trend": "트렌드 시각화"
        }
    }


# ========== Translation Endpoints ==========

class TranslatePapersRequest(BaseModel):
    """논문 번역 요청"""
    papers: List[Dict[str, Any]]
    summary: Optional[str] = None


@router.post("/translate/papers")
async def translate_papers(request: TranslatePapersRequest):
    """
    연구 논문 정보를 한국어로 번역

    번역 대상:
    - 논문 제목 (title → title_ko)
    - 초록 요약 (abstract → abstract_ko)
    - 요약문 (summary → summary_ko)

    Returns:
        {
            "papers": List[Dict],  # title_ko, abstract_ko 추가된 논문 목록
            "summary_ko": str      # 번역된 요약문
        }
    """
    try:
        from openai import AsyncOpenAI
        import os

        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        translated_papers = []

        for paper in request.papers:
            # 제목 및 초록 번역
            title = paper.get("title", "")
            abstract = paper.get("abstract", "")

            if title or abstract:
                translate_prompt = f"""다음 영어 연구 논문 정보를 자연스러운 한국어로 번역해주세요.

제목: {title}

초록: {abstract[:500] if abstract else "없음"}

JSON 형식으로 응답하세요:
{{"title_ko": "번역된 제목", "abstract_ko": "번역된 초록 (300자 이내로 요약)"}}
"""
                response = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "당신은 의학 논문 전문 번역가입니다. 정확하고 자연스러운 한국어로 번역해주세요."},
                        {"role": "user", "content": translate_prompt}
                    ],
                    max_tokens=500,
                    temperature=0.3
                )

                content = response.choices[0].message.content
                try:
                    import json
                    # JSON 추출
                    if "{" in content and "}" in content:
                        json_str = content[content.find("{"):content.rfind("}")+1]
                        translation = json.loads(json_str)
                        paper["title_ko"] = translation.get("title_ko", title)
                        paper["abstract_ko"] = translation.get("abstract_ko", abstract[:300])
                    else:
                        paper["title_ko"] = title
                        paper["abstract_ko"] = abstract[:300] if abstract else ""
                except json.JSONDecodeError:
                    paper["title_ko"] = title
                    paper["abstract_ko"] = abstract[:300] if abstract else ""

            translated_papers.append(paper)

        # 요약문 번역
        summary_ko = None
        if request.summary:
            summary_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "다음 요약문을 자연스러운 한국어로 번역해주세요."},
                    {"role": "user", "content": request.summary}
                ],
                max_tokens=200,
                temperature=0.3
            )
            summary_ko = summary_response.choices[0].message.content.strip()

        logger.info(f"✅ Translated {len(translated_papers)} papers to Korean")

        return {
            "papers": translated_papers,
            "summary_ko": summary_ko
        }

    except Exception as e:
        logger.error(f"Translation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
