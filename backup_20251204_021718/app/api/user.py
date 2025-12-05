"""
사용자 프로필 API 라우터
프로필 조회/수정, 프로필 이미지 업로드
"""
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from typing import Optional
import logging

from app.models.user import (
    UserResponse,
    UserProfileUpdate,
    PersonalInfo,
    DiseaseInfo,
    TermsAgreement
)
from app.db.user_manager import user_db_manager
from app.api.dependencies import get_current_user, require_admin
from app.services.file_service import (
    validate_image_file,
    save_profile_image,
    delete_profile_image
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["user"])


# ==================== 프로필 조회 ====================
@router.get("/profile", response_model=UserResponse)
async def get_profile(user_id: str = Depends(get_current_user)):
    """
    현재 로그인한 사용자의 프로필 정보를 조회합니다.

    Args:
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        UserResponse: 사용자 프로필 정보
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # personal_info 변환
    personal_info_data = user.get("personal_info")
    personal_info = PersonalInfo(**personal_info_data) if personal_info_data else None

    # disease_info 변환
    disease_info_data = user.get("disease_info")
    disease_info = DiseaseInfo(**disease_info_data) if disease_info_data else None

    # 토큰 정보 계산
    role = user.get("role", "user")
    tokens = user.get("tokens", 1500 if role == "user" else -1)
    tokens_used = user.get("tokens_used", 0)

    # terms_agreement 변환
    terms_agreement_data = user.get("terms_agreement")
    terms_agreement = TermsAgreement(**terms_agreement_data) if terms_agreement_data else None

    return UserResponse(
        user_id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        nickname=user.get("nickname"),
        profile=user["profile"],
        role=role,
        phone=user.get("phone"),
        profile_image=user.get("profile_image"),
        personal_info=personal_info,
        disease_info=disease_info,
        created_at=user.get("created_at"),
        last_login=user.get("last_login"),
        is_active=user.get("is_active", True),
        # 신규 필드
        points=user.get("points", 0),
        knowledge_level=user.get("knowledge_level", 0),
        tokens=tokens,
        tokens_used=tokens_used,
        subscription=user.get("subscription"),
        terms_agreement=terms_agreement
    )


# ==================== 프로필 수정 ====================
@router.put("/profile", response_model=UserResponse)
async def update_profile(
    update_data: UserProfileUpdate,
    user_id: str = Depends(get_current_user)
):
    """
    현재 로그인한 사용자의 프로필을 수정합니다.

    Args:
        update_data: 수정할 프로필 정보
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        UserResponse: 수정된 프로필 정보
    """
    await user_db_manager.connect()

    # None이 아닌 필드만 업데이트
    update_dict = {
        k: (v.value if hasattr(v, 'value') else v)
        for k, v in update_data.model_dump().items()
        if v is not None
    }

    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업데이트할 내용이 없습니다"
        )

    success = await user_db_manager.update_user(user_id, update_dict)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="프로필 업데이트에 실패했습니다"
        )

    # 업데이트된 사용자 정보 조회
    user = await user_db_manager.get_user_by_id(user_id)

    logger.info(f"✅ Profile updated for user: {user_id}")

    # personal_info 변환
    personal_info_data = user.get("personal_info")
    personal_info = PersonalInfo(**personal_info_data) if personal_info_data else None

    # disease_info 변환
    disease_info_data = user.get("disease_info")
    disease_info = DiseaseInfo(**disease_info_data) if disease_info_data else None

    # 토큰 정보 계산
    role = user.get("role", "user")
    tokens = user.get("tokens", 1500 if role == "user" else -1)
    tokens_used = user.get("tokens_used", 0)

    # terms_agreement 변환
    terms_agreement_data = user.get("terms_agreement")
    terms_agreement = TermsAgreement(**terms_agreement_data) if terms_agreement_data else None

    return UserResponse(
        user_id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        nickname=user.get("nickname"),
        profile=user["profile"],
        role=role,
        phone=user.get("phone"),
        profile_image=user.get("profile_image"),
        personal_info=personal_info,
        disease_info=disease_info,
        created_at=user.get("created_at"),
        last_login=user.get("last_login"),
        is_active=user.get("is_active", True),
        # 신규 필드
        points=user.get("points", 0),
        knowledge_level=user.get("knowledge_level", 0),
        tokens=tokens,
        tokens_used=tokens_used,
        subscription=user.get("subscription"),
        terms_agreement=terms_agreement
    )


# ==================== 프로필 이미지 업로드 ====================
@router.post("/profile/image", response_model=dict)
async def upload_profile_image(
    image: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    """
    프로필 이미지 업로드 API

    - 최대 5MB
    - 허용 형식: JPG, PNG, GIF, WebP
    """
    await user_db_manager.connect()

    # 파일 읽기
    content = await image.read()
    file_size = len(content)

    # 유효성 검사
    is_valid, message = validate_image_file(
        image.filename,
        image.content_type,
        file_size
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    # 기존 이미지 삭제
    user = await user_db_manager.get_user_by_id(user_id)
    if user and user.get("profile_image"):
        await delete_profile_image(user["profile_image"])

    # 새 이미지 저장
    file_url = await save_profile_image(content, image.filename, user_id)

    # DB 업데이트
    await user_db_manager.update_user(user_id, {"profile_image": file_url})

    logger.info(f"✅ Profile image uploaded for user: {user_id}")

    return {
        "success": True,
        "profile_image": file_url,
        "message": "프로필 이미지가 업로드되었습니다"
    }


# ==================== 프로필 이미지 삭제 ====================
@router.delete("/profile/image", response_model=dict)
async def remove_profile_image(user_id: str = Depends(get_current_user)):
    """
    프로필 이미지 삭제 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)

    if not user or not user.get("profile_image"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="삭제할 프로필 이미지가 없습니다"
        )

    # 파일 삭제
    await delete_profile_image(user["profile_image"])

    # DB 업데이트
    await user_db_manager.update_user(user_id, {"profile_image": None})

    logger.info(f"✅ Profile image deleted for user: {user_id}")

    return {
        "success": True,
        "message": "프로필 이미지가 삭제되었습니다"
    }


# ==================== 관리자: 사용자 통계 ====================
@router.get("/admin/stats", response_model=dict)
async def get_user_stats(admin_id: str = Depends(require_admin)):
    """
    사용자 통계 조회 (관리자 전용)

    - 전체 사용자 수
    - 활성 사용자 수
    - 프로필별 사용자 수
    """
    await user_db_manager.connect()

    stats = await user_db_manager.get_user_stats()

    return {
        "success": True,
        "stats": stats
    }
