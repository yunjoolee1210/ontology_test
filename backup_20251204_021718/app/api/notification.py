"""
알림 관련 API 엔드포인트
user_db_manager의 알림 기능 사용
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from app.api.dependencies import get_current_user, require_admin
from app.db.user_manager import user_db_manager

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    unread_only: bool = Query(False, description="읽지 않은 알림만"),
    user_id: str = Depends(get_current_user)
):
    """
    현재 사용자의 알림 목록 조회 (페이지네이션)

    Args:
        page: 페이지 번호 (1부터 시작)
        page_size: 페이지당 항목 수 (최대 100)
        unread_only: 읽지 않은 알림만 조회
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        dict: 알림 목록과 페이지 정보
    """
    await user_db_manager.connect()

    skip = (page - 1) * page_size
    notifications = await user_db_manager.get_user_notifications(
        user_id,
        include_unread_only=unread_only,
        limit=page_size,
        skip=skip
    )

    # 알림 데이터 변환
    result = []
    for notif in notifications:
        result.append({
            "id": str(notif["_id"]),
            "title": notif.get("title", ""),
            "message": notif.get("message", ""),
            "type": notif.get("type", "system"),
            "is_read": notif.get("is_read", False),
            "created_at": notif.get("created_at"),
            "scheduled_at": notif.get("scheduled_at"),
            "sent_at": notif.get("sent_at"),
            "metadata": notif.get("metadata", {})
        })

    return {
        "success": True,
        "data": result,
        "page": page,
        "page_size": page_size
    }


@router.get("/unread-count")
async def get_unread_count(user_id: str = Depends(get_current_user)):
    """
    현재 사용자의 읽지 않은 알림 개수 조회

    Args:
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        dict: 읽지 않은 알림 개수
    """
    await user_db_manager.connect()

    count = await user_db_manager.get_unread_notification_count(user_id)

    return {
        "success": True,
        "unread_count": count
    }


@router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    알림을 읽음으로 표시

    Args:
        notification_id: 알림 ID
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        dict: 성공 메시지
    """
    await user_db_manager.connect()

    success = await user_db_manager.mark_notification_as_read(notification_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")

    return {
        "success": True,
        "message": "알림이 읽음 처리되었습니다"
    }


@router.put("/read-all")
async def mark_all_notifications_as_read(user_id: str = Depends(get_current_user)):
    """
    모든 알림을 읽음으로 표시

    Args:
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        dict: 읽음 처리된 알림 개수
    """
    await user_db_manager.connect()

    count = await user_db_manager.mark_all_notifications_as_read(user_id)

    return {
        "success": True,
        "read_count": count,
        "message": f"{count}개의 알림이 읽음 처리되었습니다"
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    알림 삭제

    Args:
        notification_id: 알림 ID
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        dict: 성공 메시지
    """
    await user_db_manager.connect()

    success = await user_db_manager.delete_notification(notification_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")

    return {
        "success": True,
        "message": "알림이 삭제되었습니다"
    }


@router.post("/admin/create")
async def create_notification_admin(
    user_id_target: str,
    title: str,
    message: str,
    notification_type: str = "system",
    admin_id: str = Depends(require_admin)
):
    """
    새 알림 생성 (관리자 전용)

    Args:
        user_id_target: 대상 사용자 ID
        title: 알림 제목
        message: 알림 내용
        notification_type: 알림 타입
        admin_id: 관리자 ID

    Returns:
        dict: 생성된 알림 ID
    """
    await user_db_manager.connect()

    notification_id = await user_db_manager.create_notification(
        user_id=user_id_target,
        title=title,
        message=message,
        notification_type=notification_type
    )

    return {
        "success": True,
        "notification_id": notification_id,
        "message": "알림이 생성되었습니다"
    }


@router.post("/admin/create-global")
async def create_global_notification_admin(
    title: str,
    message: str,
    notification_type: str = "announcement",
    admin_id: str = Depends(require_admin)
):
    """
    전체 공지 알림 생성 (관리자 전용)

    Args:
        title: 알림 제목
        message: 알림 내용
        notification_type: 알림 타입 (기본: announcement)
        admin_id: 관리자 ID

    Returns:
        dict: 생성된 알림 ID
    """
    await user_db_manager.connect()

    notification_id = await user_db_manager.create_global_notification(
        title=title,
        message=message,
        notification_type=notification_type
    )

    return {
        "success": True,
        "notification_id": notification_id,
        "message": "전체 공지가 생성되었습니다"
    }
