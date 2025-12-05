"""
API 의존성 모듈
JWT 인증 및 권한 확인
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional
import os
import logging

from app.db.user_manager import user_db_manager

logger = logging.getLogger(__name__)

security = HTTPBearer()

# SECRET_KEY는 auth 서비스와 동일해야 함
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    JWT 토큰을 검증하고 사용자 ID를 반환합니다.

    Args:
        credentials: Bearer 토큰

    Returns:
        str: 사용자 ID (MongoDB _id)

    Raises:
        HTTPException: 토큰이 유효하지 않은 경우
    """
    token = credentials.credentials

    try:
        # JWT 토큰 디코딩
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id: str = payload.get("user_id")
        token_type: str = payload.get("type")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 인증 토큰입니다",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Access Token인지 확인
        if token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰 타입입니다",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # 토큰 블랙리스트 확인
        await user_db_manager.connect()
        if await user_db_manager.is_token_blacklisted(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="만료된 토큰입니다",
                headers={"WWW-Authenticate": "Bearer"}
            )

        return user_id

    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 검증에 실패했습니다",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[str]:
    """
    선택적 사용자 인증

    토큰이 없으면 None 반환, 있으면 사용자 ID 반환

    Args:
        credentials: Bearer 토큰 (선택적)

    Returns:
        Optional[str]: 사용자 ID 또는 None
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def require_admin(user_id: str = Depends(get_current_user)) -> str:
    """
    관리자 권한을 확인합니다.

    Args:
        user_id: JWT 토큰에서 추출한 사용자 ID

    Returns:
        str: 관리자 사용자 ID

    Raises:
        HTTPException: 관리자가 아닌 경우
    """
    await user_db_manager.connect()

    user = await user_db_manager.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # role이 없는 기존 사용자는 일반 사용자로 간주
    if user.get("role", "user") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )

    return user_id
