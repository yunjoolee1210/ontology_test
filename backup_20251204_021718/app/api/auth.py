"""
인증 API 라우터
회원가입, 로그인, 로그아웃, 토큰 갱신, 회원탈퇴, 이메일 인증, OAuth 등
"""
from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import RedirectResponse
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
import secrets
import logging
import os

from app.models.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    SignOutRequest
)
from app.services.auth import (
    hash_password,
    verify_password,
    create_tokens,
    verify_refresh_token,
    get_token_expiry,
    generate_password_reset_token,
    verify_password_reset_token
)
from app.services.email_service import (
    send_verification_email,
    send_password_reset_email,
    send_welcome_email
)
from app.services.oauth_service import (
    get_oauth_provider,
    is_oauth_configured,
    FRONTEND_URL
)
from app.db.user_manager import user_db_manager
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ==================== 추가 모델 ====================
class PasswordResetConfirm(BaseModel):
    """비밀번호 재설정 확인"""
    token: str
    new_password: str


class EmailVerificationRequest(BaseModel):
    """이메일 인증 요청"""
    token: str


# ==================== 회원가입 ====================
@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, request: Request):
    """
    회원가입 API

    - 이메일 중복 확인
    - 비밀번호 해싱
    - 사용자 생성
    - 이메일 인증 메일 발송
    - 세션 로그 기록
    """
    await user_db_manager.connect()

    # 이메일 중복 확인
    if await user_db_manager.check_email_exists(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 이메일입니다"
        )

    # 이메일 인증 토큰 생성
    verification_token = secrets.token_urlsafe(32)

    # 약관 동의 정보 처리
    terms_agreement_data = None
    if user.terms_agreement:
        terms_agreement_data = {
            **user.terms_agreement.model_dump(),
            "agreed_at": datetime.utcnow()
        }

    # 사용자 생성
    user_doc = {
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "nickname": user.nickname or user.name,
        "phone": user.phone,
        "profile": user.profile.value if hasattr(user.profile, 'value') else user.profile,
        "verification_token": verification_token,
        "is_verified": False,
        "personal_info": user.personal_info.model_dump() if user.personal_info else None,
        "disease_info": user.disease_info.model_dump() if user.disease_info else None,
        "terms_agreement": terms_agreement_data
    }

    try:
        user_id = await user_db_manager.create_user(user_doc)

        # 관리자 여부 확인
        role = "admin" if user_db_manager.is_admin_email(user.email) else "user"

        # 세션 로그 기록
        await user_db_manager.create_session_log(
            action="signup",
            role=role,
            user_id=user_id,
            email=user.email,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"profile": user_doc.get("profile")}
        )

        # === 신규 회원 알림 생성 ===
        # 1. 환영 알림 (즉시 발송)
        await user_db_manager.create_notification(
            user_id=user_id,
            title="회원가입을 축하합니다!",
            message="회원 가입을 축하합니다. 신규 사용자께는 1500 토큰을 무료로 드립니다. AI챗봇, 식단케어 메뉴에서 토큰을 사용해 맞춤 정보를 받아 보세요.",
            notification_type="welcome"
        )

        # 2. 퀴즈 미션 알림 (3분 후 예약 발송)
        scheduled_time = datetime.utcnow() + timedelta(minutes=3)
        await user_db_manager.create_notification(
            user_id=user_id,
            title="퀴즈 미션 도전!",
            message="퀴즈미션을 풀고 100P 받아 보세요! 100P는 토큰수로 교환해 사용할 수 있습니다.",
            notification_type="quiz",
            scheduled_at=scheduled_time
        )

        logger.info(f"✅ Welcome notifications created for user: {user_id}")

        # 이메일 인증 메일 발송
        await send_verification_email(user.email, verification_token)

        logger.info(f"✅ User signed up: {user.email} (role: {role})")

        return {
            "success": True,
            "message": "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해 주세요.",
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="회원가입 처리 중 오류가 발생했습니다"
        )


# ==================== 이메일 인증 ====================
@router.post("/verify-email", response_model=dict)
async def verify_email(request: EmailVerificationRequest):
    """
    이메일 인증 API
    """
    await user_db_manager.connect()

    # 토큰으로 사용자 찾기
    user = await user_db_manager.db.users.find_one({
        "verification_token": request.token,
        "is_verified": False
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 인증 토큰입니다"
        )

    # 인증 완료 처리
    await user_db_manager.db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True},
            "$unset": {"verification_token": ""}
        }
    )

    # 환영 이메일 발송
    await send_welcome_email(user["email"], user["name"])

    logger.info(f"✅ Email verified: {user['email']}")

    return {
        "success": True,
        "message": "이메일 인증이 완료되었습니다"
    }


# ==================== 인증 이메일 재발송 ====================
@router.post("/resend-verification", response_model=dict)
async def resend_verification(email: EmailStr):
    """
    인증 이메일 재발송 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.db.users.find_one({
        "email": email,
        "is_verified": False
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 인증되었거나 존재하지 않는 이메일입니다"
        )

    # 새 토큰 생성
    verification_token = secrets.token_urlsafe(32)

    await user_db_manager.db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"verification_token": verification_token}}
    )

    await send_verification_email(email, verification_token)

    return {
        "success": True,
        "message": "인증 이메일이 재발송되었습니다"
    }


# ==================== 로그인 ====================
@router.post("/login", response_model=dict)
async def login(credentials: UserLogin, request: Request):
    """
    로그인 API (세션 로그 기록 포함)
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_email(credentials.email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다"
        )

    # 소셜 로그인 사용자 체크
    if user.get("oauth_provider") and not user.get("password"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{user['oauth_provider']} 계정으로 로그인해 주세요"
        )

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다"
        )

    # 이메일 인증 확인 (선택적)
    # if not user.get("is_verified", True):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="이메일 인증을 완료해 주세요"
    #     )

    user_id = str(user["_id"])
    role = user.get("role", "user")
    access_token, refresh_token, expires_in = create_tokens(user_id, user["email"])

    await user_db_manager.update_last_login(user_id)

    # 세션 로그 기록
    await user_db_manager.create_session_log(
        action="login",
        role=role,
        user_id=user_id,
        email=user["email"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    logger.info(f"✅ User logged in: {credentials.email} (role: {role})")

    return {
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "user_id": user_id,
            "email": user["email"],
            "name": user["name"],
            "nickname": user.get("nickname"),
            "profile": user["profile"],
            "role": role,
            "profile_image": user.get("profile_image"),
            "is_verified": user.get("is_verified", True)
        }
    }


# ==================== 비밀번호 찾기 ====================
@router.post("/forgot-password", response_model=dict)
async def forgot_password(request: PasswordResetRequest):
    """
    비밀번호 재설정 이메일 발송 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_email(request.email)

    # 보안을 위해 사용자 존재 여부와 관계없이 동일한 응답
    if user and not user.get("oauth_provider"):
        reset_token = generate_password_reset_token(request.email)
        await send_password_reset_email(request.email, reset_token)
        logger.info(f"✅ Password reset email sent: {request.email}")

    return {
        "success": True,
        "message": "비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해 주세요."
    }


# ==================== 비밀번호 재설정 ====================
@router.post("/reset-password", response_model=dict)
async def reset_password(request: PasswordResetConfirm):
    """
    비밀번호 재설정 API
    """
    await user_db_manager.connect()

    email = verify_password_reset_token(request.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 토큰입니다"
        )

    user = await user_db_manager.get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="사용자를 찾을 수 없습니다"
        )

    # 비밀번호 업데이트
    hashed = hash_password(request.new_password)
    await user_db_manager.update_password(str(user["_id"]), hashed)

    logger.info(f"✅ Password reset for: {email}")

    return {
        "success": True,
        "message": "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요."
    }


# ==================== OAuth: 인증 URL ====================
@router.get("/oauth/{provider}", response_model=dict)
async def oauth_login(provider: str):
    """
    OAuth 인증 URL 반환
    """
    if provider not in ["google", "kakao", "naver"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 OAuth 제공자입니다"
        )

    if not is_oauth_configured(provider):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider} 로그인이 설정되지 않았습니다"
        )

    oauth = get_oauth_provider(provider)
    state = secrets.token_urlsafe(16)

    # state를 세션이나 DB에 저장해야 함 (CSRF 방지)
    # 여기서는 간단히 처리

    auth_url = oauth.get_authorization_url(state)

    return {
        "auth_url": auth_url,
        "state": state
    }


# ==================== OAuth: 콜백 ====================
@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(None)
):
    """
    OAuth 콜백 처리
    """
    if provider not in ["google", "kakao", "naver"]:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=invalid_provider")

    oauth = get_oauth_provider(provider)

    # 액세스 토큰 획득
    if provider == "naver":
        access_token = await oauth.get_access_token(code, state)
    else:
        access_token = await oauth.get_access_token(code)

    if not access_token:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=token_failed")

    # 사용자 정보 조회
    user_info = await oauth.get_user_info(access_token)

    if not user_info:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=user_info_failed")

    await user_db_manager.connect()

    # 기존 사용자 확인 (이메일 또는 provider_id로)
    existing_user = None

    if user_info.get("email"):
        existing_user = await user_db_manager.get_user_by_email(user_info["email"])

    if not existing_user:
        # OAuth ID로 찾기
        existing_user = await user_db_manager.db.users.find_one({
            "oauth_provider": provider,
            "oauth_provider_id": user_info["provider_id"]
        })

    if existing_user:
        # 기존 사용자 로그인
        user_id = str(existing_user["_id"])

        # OAuth 정보 업데이트
        await user_db_manager.db.users.update_one(
            {"_id": existing_user["_id"]},
            {"$set": {
                "oauth_provider": provider,
                "oauth_provider_id": user_info["provider_id"],
                "profile_image": user_info.get("profile_image") or existing_user.get("profile_image")
            }}
        )
    else:
        # 새 사용자 생성
        user_doc = {
            "email": user_info.get("email") or f"{provider}_{user_info['provider_id']}@oauth.local",
            "name": user_info.get("name") or f"{provider} 사용자",
            "nickname": user_info.get("name"),
            "profile": "general",
            "profile_image": user_info.get("profile_image"),
            "oauth_provider": provider,
            "oauth_provider_id": user_info["provider_id"],
            "is_verified": True  # OAuth는 이메일 인증 불필요
        }

        user_id = await user_db_manager.create_user(user_doc)
        logger.info(f"✅ OAuth user created: {provider} - {user_info.get('email')}")

    # 토큰 생성
    user = await user_db_manager.get_user_by_id(user_id)
    access_token, refresh_token, expires_in = create_tokens(user_id, user["email"])

    await user_db_manager.update_last_login(user_id)

    # 프론트엔드로 리다이렉트 (토큰 전달)
    redirect_url = f"{FRONTEND_URL}/oauth/callback?access_token={access_token}&refresh_token={refresh_token}"

    return RedirectResponse(redirect_url)


# ==================== 토큰 갱신 ====================
@router.post("/refresh", response_model=dict)
async def refresh_token(request: RefreshTokenRequest):
    """
    Access Token 갱신 API
    """
    await user_db_manager.connect()

    payload = verify_refresh_token(request.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token입니다"
        )

    if await user_db_manager.is_token_blacklisted(request.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="만료된 Refresh Token입니다"
        )

    user_id = payload.get("user_id")
    email = payload.get("email")

    user = await user_db_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다"
        )

    expiry = get_token_expiry(request.refresh_token)
    if expiry:
        await user_db_manager.blacklist_token(request.refresh_token, user_id, expiry)

    access_token, refresh_token, expires_in = create_tokens(user_id, email)

    logger.info(f"✅ Token refreshed for user: {email}")

    return {
        "success": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in
    }


# ==================== 로그아웃 ====================
@router.post("/logout", response_model=dict)
async def logout(
    token_request: RefreshTokenRequest,
    request: Request,
    user_id: str = Depends(get_current_user)
):
    """
    로그아웃 API (세션 로그 기록 포함)
    """
    await user_db_manager.connect()

    # 사용자 정보 조회
    user = await user_db_manager.get_user_by_id(user_id)
    role = user.get("role", "user") if user else "user"
    email = user.get("email") if user else None

    expiry = get_token_expiry(token_request.refresh_token)
    if expiry:
        await user_db_manager.blacklist_token(token_request.refresh_token, user_id, expiry)

    # 세션 로그 기록
    await user_db_manager.create_session_log(
        action="logout",
        role=role,
        user_id=user_id,
        email=email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    logger.info(f"✅ User logged out: {user_id} (role: {role})")

    return {
        "success": True,
        "message": "로그아웃되었습니다"
    }


# ==================== 비밀번호 변경 ====================
@router.post("/change-password", response_model=dict)
async def change_password(
    request: PasswordChangeRequest,
    user_id: str = Depends(get_current_user)
):
    """
    비밀번호 변경 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # OAuth 사용자는 비밀번호 변경 불가
    if user.get("oauth_provider") and not user.get("password"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소셜 로그인 계정은 비밀번호를 변경할 수 없습니다"
        )

    if not verify_password(request.current_password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 일치하지 않습니다"
        )

    hashed = hash_password(request.new_password)
    success = await user_db_manager.update_password(user_id, hashed)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="비밀번호 변경에 실패했습니다"
        )

    logger.info(f"✅ Password changed for user: {user_id}")

    return {
        "success": True,
        "message": "비밀번호가 변경되었습니다"
    }


# ==================== 회원탈퇴 ====================
@router.post("/signout", response_model=dict)
async def signout(
    request: SignOutRequest,
    user_id: str = Depends(get_current_user)
):
    """
    회원탈퇴 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # OAuth 사용자도 비밀번호 있으면 확인, 없으면 통과
    if user.get("password"):
        if not verify_password(request.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="비밀번호가 일치하지 않습니다"
            )

    success = await user_db_manager.soft_delete_user(
        user_id=user_id,
        reason=request.reason,
        feedback=request.feedback
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="회원탈퇴 처리에 실패했습니다"
        )

    logger.info(f"✅ User signed out: {user_id}")

    return {
        "success": True,
        "message": "회원탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다."
    }


# ==================== 이메일 중복 확인 ====================
@router.get("/check-email", response_model=dict)
async def check_email(email: str):
    """
    이메일 중복 확인 API
    """
    await user_db_manager.connect()

    exists = await user_db_manager.check_email_exists(email)

    return {
        "available": not exists,
        "message": "사용 가능한 이메일입니다" if not exists else "이미 사용 중인 이메일입니다"
    }


# ==================== 현재 사용자 정보 ====================
@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user_id: str = Depends(get_current_user)):
    """
    현재 로그인한 사용자 정보 조회 API
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    return UserResponse(
        user_id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        nickname=user.get("nickname"),
        profile=user["profile"],
        role=user.get("role", "user"),
        phone=user.get("phone"),
        profile_image=user.get("profile_image"),
        created_at=user.get("created_at"),
        last_login=user.get("last_login"),
        is_active=user.get("is_active", True)
    )


# ==================== OAuth 상태 확인 ====================
@router.get("/oauth/status", response_model=dict)
async def oauth_status():
    """
    OAuth 제공자 설정 상태 확인
    """
    return {
        "google": is_oauth_configured("google"),
        "kakao": is_oauth_configured("kakao"),
        "naver": is_oauth_configured("naver")
    }
