"""
관리자(Admin) API 라우터
세션 로그, 사용자 관리, 통계 등 Backoffice용 API
"""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging

from app.db.user_manager import user_db_manager
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ==================== 모델 ====================
class SessionLogResponse(BaseModel):
    """세션 로그 응답"""
    id: str
    action: str
    role: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime


class SessionStatsResponse(BaseModel):
    """세션 통계 응답"""
    total_sessions: int
    by_role: dict
    by_action: dict


# ==================== 관리자 권한 확인 ====================
async def verify_admin(user_id: str = Depends(get_current_user)) -> str:
    """관리자 권한 확인"""
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )

    return user_id


# ==================== 세션 로그 조회 ====================
@router.get("/session-logs", response_model=dict)
async def get_session_logs(
    role: Optional[str] = Query(None, description="역할 필터 (admin, user, guest)"),
    action: Optional[str] = Query(None, description="액션 필터 (login, logout, signup, etc.)"),
    user_id: Optional[str] = Query(None, description="사용자 ID 필터"),
    days: Optional[int] = Query(7, description="조회 기간 (일)"),
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    admin_id: str = Depends(verify_admin)
):
    """
    세션 로그 조회 API (관리자 전용)

    - role: admin, user, guest 중 선택
    - action: login, logout, signup, page_view, chat 등
    - days: 최근 N일간의 로그 조회
    """
    await user_db_manager.connect()

    # 날짜 범위 설정
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days) if days else None

    logs = await user_db_manager.get_session_logs(
        role=role,
        action=action,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        skip=skip
    )

    # 응답 형식 변환
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "id": str(log["_id"]),
            "action": log.get("action"),
            "role": log.get("role"),
            "user_id": str(log["user_id"]) if log.get("user_id") else None,
            "email": log.get("email"),
            "ip_address": log.get("ip_address"),
            "user_agent": log.get("user_agent"),
            "metadata": log.get("metadata"),
            "created_at": log.get("created_at")
        })

    return {
        "success": True,
        "total": len(formatted_logs),
        "logs": formatted_logs
    }


# ==================== 세션 통계 ====================
@router.get("/session-stats", response_model=dict)
async def get_session_stats(
    days: Optional[int] = Query(7, description="통계 기간 (일)"),
    admin_id: str = Depends(verify_admin)
):
    """
    세션 통계 조회 API (관리자 전용)

    - 역할별 세션 수 (admin, user, guest)
    - 액션별 세션 수 (login, logout, signup 등)
    """
    await user_db_manager.connect()

    # 날짜 범위 설정
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days) if days else None

    stats = await user_db_manager.get_session_stats(
        start_date=start_date,
        end_date=end_date
    )

    return {
        "success": True,
        "period_days": days,
        "stats": stats
    }


# ==================== 사용자 통계 ====================
@router.get("/user-stats", response_model=dict)
async def get_user_stats(admin_id: str = Depends(verify_admin)):
    """
    사용자 통계 조회 API (관리자 전용)
    """
    await user_db_manager.connect()

    stats = await user_db_manager.get_user_stats()

    return {
        "success": True,
        "stats": stats
    }


# ==================== 사용자 목록 조회 ====================
@router.get("/users", response_model=dict)
async def get_users(
    role: Optional[str] = Query(None, description="역할 필터"),
    is_active: Optional[bool] = Query(True, description="활성 사용자만"),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    admin_id: str = Depends(verify_admin)
):
    """
    사용자 목록 조회 API (관리자 전용)
    """
    await user_db_manager.connect()

    query = {}
    if role:
        query["role"] = role
    if is_active is not None:
        query["is_active"] = is_active
        if is_active:
            query["deleted_at"] = None

    cursor = user_db_manager.db.users.find(query).sort(
        "created_at", -1
    ).skip(skip).limit(limit)

    users = await cursor.to_list(length=limit)

    # 응답 형식 변환
    formatted_users = []
    for user in users:
        formatted_users.append({
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "name": user.get("name"),
            "nickname": user.get("nickname"),
            "role": user.get("role", "user"),
            "profile": user.get("profile"),
            "is_active": user.get("is_active"),
            "is_verified": user.get("is_verified"),
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login")
        })

    total = await user_db_manager.db.users.count_documents(query)

    return {
        "success": True,
        "total": total,
        "users": formatted_users
    }


# ==================== 게스트 세션 로그 기록 (공개) ====================
@router.post("/log-guest-session", response_model=dict)
async def log_guest_session(
    action: str = Query(..., description="액션 (page_view, chat, etc.)"),
    page: Optional[str] = Query(None, description="페이지 경로"),
):
    """
    게스트(비로그인) 세션 로그 기록 API

    프론트엔드에서 비로그인 사용자의 활동을 기록할 때 사용
    """
    await user_db_manager.connect()

    await user_db_manager.create_session_log(
        action=action,
        role="guest",
        metadata={"page": page} if page else None
    )

    return {
        "success": True,
        "message": "세션 로그가 기록되었습니다"
    }
