"""
인증 서비스 모듈
JWT 토큰 생성/검증, 비밀번호 해싱 등
"""
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
import os
import secrets
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1시간
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7일


def hash_password(password: str) -> str:
    """비밀번호 해싱"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Access Token 생성

    Args:
        data: 토큰에 포함할 데이터
        expires_delta: 만료 시간 (기본: 1시간)

    Returns:
        str: JWT 토큰
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Refresh Token 생성

    Args:
        data: 토큰에 포함할 데이터
        expires_delta: 만료 시간 (기본: 7일)

    Returns:
        str: JWT 토큰
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
        "jti": secrets.token_urlsafe(16)  # 고유 토큰 ID
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_tokens(user_id: str, email: str) -> Tuple[str, str, int]:
    """
    Access Token과 Refresh Token 쌍 생성

    Args:
        user_id: 사용자 ID
        email: 사용자 이메일

    Returns:
        Tuple[str, str, int]: (access_token, refresh_token, expires_in_seconds)
    """
    token_data = {
        "user_id": user_id,
        "email": email
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # 초 단위

    return access_token, refresh_token, expires_in


def decode_token(token: str) -> Optional[Dict]:
    """
    토큰 디코딩 및 검증

    Args:
        token: JWT 토큰

    Returns:
        Optional[Dict]: 토큰 페이로드 또는 None (검증 실패시)
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"Token decode error: {e}")
        return None


def verify_access_token(token: str) -> Optional[Dict]:
    """
    Access Token 검증

    Args:
        token: JWT 토큰

    Returns:
        Optional[Dict]: 토큰 페이로드 또는 None
    """
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None


def verify_refresh_token(token: str) -> Optional[Dict]:
    """
    Refresh Token 검증

    Args:
        token: JWT 토큰

    Returns:
        Optional[Dict]: 토큰 페이로드 또는 None
    """
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None


def get_token_expiry(token: str) -> Optional[datetime]:
    """
    토큰 만료 시간 조회

    Args:
        token: JWT 토큰

    Returns:
        Optional[datetime]: 만료 시간 또는 None
    """
    payload = decode_token(token)
    if payload and "exp" in payload:
        return datetime.fromtimestamp(payload["exp"])
    return None


def is_token_expired(token: str) -> bool:
    """
    토큰 만료 여부 확인

    Args:
        token: JWT 토큰

    Returns:
        bool: 만료 여부
    """
    expiry = get_token_expiry(token)
    if expiry:
        return datetime.utcnow() > expiry
    return True


def generate_password_reset_token(email: str) -> str:
    """
    비밀번호 재설정 토큰 생성 (15분 유효)

    Args:
        email: 사용자 이메일

    Returns:
        str: 재설정 토큰
    """
    data = {
        "email": email,
        "type": "password_reset"
    }
    expire = datetime.utcnow() + timedelta(minutes=15)
    data["exp"] = expire

    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[str]:
    """
    비밀번호 재설정 토큰 검증

    Args:
        token: 재설정 토큰

    Returns:
        Optional[str]: 이메일 또는 None
    """
    payload = decode_token(token)
    if payload and payload.get("type") == "password_reset":
        return payload.get("email")
    return None
