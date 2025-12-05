"""
CareGuide API - FastAPI 메인 애플리케이션
만성콩팥병 환자를 위한 AI 기반 건강관리 플랫폼
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from typing import Optional
import sys
from pathlib import Path
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add backend directory to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.db.connection import check_connection
from app.db.user_manager import user_db_manager
from app.api.trends import router as trends_router
from app.api.chat import router as chat_router, close_chat_resources
from app.api.quiz import router as quiz_router
from app.api.agent import router as agent_router
from app.api.community import router as community_router
from app.api.header import router as header_router
from app.api.footer import router as footer_router
from app.api.notification import router as notification_router
from app.api.clinical_trials import router as clinical_trials_router
from app.api.terms import router as terms_router
from app.api.error_handlers import (
    not_found_handler,
    internal_server_error_handler,
    validation_error_handler
)
from app.api import auth, user, admin
from app.api.health_record import router as health_record_router
from app.api.diet_log import router as diet_log_router
from app.api.test_results import router as test_results_router

# Import NutritionAgent
from Agent.nutrition.agent import NutritionAgent
from Agent.session_manager import SessionManager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Application starting up...")

    # Initialize User DB Manager
    await user_db_manager.connect()
    logger.info("✅ User DB Manager initialized")

    yield

    # Cleanup on shutdown
    await close_chat_resources()
    await user_db_manager.close()
    logger.info("Application shutting down...")


app = FastAPI(
    title="CareGuide API",
    description="만성콩팥병(CKD) 환자를 위한 AI 기반 건강관리 플랫폼",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 개발 서버 (localhost)
        "http://127.0.0.1:5173",
        "http://192.168.129.32:5173",  # Vite 개발 서버 (네트워크 IP)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances for nutrition agent
nutrition_agent = NutritionAgent()
session_manager = SessionManager()

# ==================== Routers ====================
# 인증 및 사용자 관리
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(health_record_router)
app.include_router(admin.router)  # 관리자 API (Backoffice용)

# 채팅 및 에이전트
app.include_router(chat_router)
app.include_router(quiz_router)
app.include_router(agent_router)

# 기능별 라우터
app.include_router(trends_router)
app.include_router(clinical_trials_router)
app.include_router(terms_router)
app.include_router(community_router, prefix="/api/community", tags=["community"])

# UI 컴포넌트
app.include_router(header_router)
app.include_router(footer_router)
app.include_router(notification_router)
app.include_router(diet_log_router)  # 식단 기록 API
app.include_router(test_results_router)  # 검진결과 OCR API

# 정적 파일 서빙 (프로필 이미지 등)
uploads_dir = Path(__file__).parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Error handlers (UTI-005)
app.add_exception_handler(StarletteHTTPException, not_found_handler)
app.add_exception_handler(Exception, internal_server_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


# ==================== Root Endpoints ====================
@app.get("/")
def root():
    """API 루트 엔드포인트"""
    return {
        "message": "CareGuide API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "healthy"}


@app.get("/db-check")
def database_check():
    """MongoDB 연결 상태 확인"""
    return check_connection()


@app.get("/test/error/500")
def test_server_error():
    """500 에러 테스트용 엔드포인트"""
    raise Exception("의도적인 500 에러 테스트")


# ==================== Session Management ====================
@app.post("/api/session/create")
async def create_session(user_id: str = "default_user"):
    """새로운 세션 생성"""
    session_id = session_manager.create_session(user_id)
    session = session_manager.get_session(session_id)
    return {
        "session_id": session_id,
        "user_id": user_id,
        "status": "created",
        "created_at": session["created_at"].isoformat() if session else None
    }


# ==================== Nutrition Analysis ====================
@app.post("/api/nutrition/analyze")
async def analyze_nutrition(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    session_id: str = Form(...),
    user_profile: str = Form("general")
):
    """
    영양 분석 API - 텍스트 또는 이미지 분석

    Args:
        text: 분석할 텍스트 (선택)
        image: 음식 이미지 (선택)
        session_id: 세션 ID
        user_profile: 사용자 프로필 (general, patient, researcher)
    """
    logger.info(f"📝 Nutrition analysis request: session={session_id}, profile={user_profile}, has_text={bool(text)}, has_image={bool(image)}")

    if not text and not image:
        raise HTTPException(status_code=400, detail="Either text or image is required")

    # Check session
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # 이미지가 있으면 base64로 인코딩
    image_data = None
    if image:
        import base64
        contents = await image.read()
        image_data = base64.b64encode(contents).decode('utf-8')
        logger.info(f"🖼️ Image uploaded: {len(image_data)} bytes (base64)")

    context = {
        "image_data": image_data,
        "has_image": image is not None,
        "user_profile": user_profile
    }

    user_input = text or "음식 이미지 분석 요청"

    try:
        # Call nutrition agent
        result = await nutrition_agent.process(
            user_input=user_input,
            session_id=session_id,
            context=context
        )

        logger.info(f"✅ Nutrition analysis complete: {result.get('status')}")

        return {
            "success": True,
            "agent_type": "nutrition",
            "result": result
        }

    except Exception as e:
        logger.error(f"❌ Nutrition analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
# Diet log API added
