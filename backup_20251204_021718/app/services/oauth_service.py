"""
OAuth 서비스 모듈
Google, Kakao, Naver 소셜 로그인 처리
"""
import httpx
from typing import Optional, Dict, Any
import os
import logging
from dotenv import load_dotenv
from urllib.parse import urlencode

load_dotenv()

logger = logging.getLogger(__name__)

# ==================== OAuth 설정 ====================
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = f"{BACKEND_URL}/api/auth/oauth/google/callback"

# Kakao OAuth
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
KAKAO_REDIRECT_URI = f"{BACKEND_URL}/api/auth/oauth/kakao/callback"

# Naver OAuth
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
NAVER_REDIRECT_URI = f"{BACKEND_URL}/api/auth/oauth/naver/callback"


class OAuthProvider:
    """OAuth 제공자 기본 클래스"""

    def __init__(self, name: str):
        self.name = name

    def get_authorization_url(self, state: str) -> str:
        """인증 URL 생성"""
        raise NotImplementedError

    async def get_access_token(self, code: str) -> Optional[str]:
        """인증 코드로 액세스 토큰 획득"""
        raise NotImplementedError

    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """사용자 정보 조회"""
        raise NotImplementedError


class GoogleOAuth(OAuthProvider):
    """Google OAuth 처리"""

    def __init__(self):
        super().__init__("google")
        self.client_id = GOOGLE_CLIENT_ID
        self.client_secret = GOOGLE_CLIENT_SECRET
        self.redirect_uri = GOOGLE_REDIRECT_URI

    def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent"
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    async def get_access_token(self, code: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "redirect_uri": self.redirect_uri,
                        "grant_type": "authorization_code"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("access_token")
                else:
                    logger.error(f"Google token error: {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Google OAuth error: {e}")
            return None

    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "provider": "google",
                        "provider_id": data.get("id"),
                        "email": data.get("email"),
                        "name": data.get("name"),
                        "profile_image": data.get("picture")
                    }
                return None
        except Exception as e:
            logger.error(f"Google user info error: {e}")
            return None


class KakaoOAuth(OAuthProvider):
    """Kakao OAuth 처리"""

    def __init__(self):
        super().__init__("kakao")
        self.client_id = KAKAO_CLIENT_ID
        self.client_secret = KAKAO_CLIENT_SECRET
        self.redirect_uri = KAKAO_REDIRECT_URI

    def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "state": state,
            "scope": "profile_nickname profile_image account_email"
        }
        return f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"

    async def get_access_token(self, code: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://kauth.kakao.com/oauth/token",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "grant_type": "authorization_code",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "redirect_uri": self.redirect_uri,
                        "code": code
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("access_token")
                else:
                    logger.error(f"Kakao token error: {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Kakao OAuth error: {e}")
            return None

    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://kapi.kakao.com/v2/user/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if response.status_code == 200:
                    data = response.json()
                    kakao_account = data.get("kakao_account", {})
                    profile = kakao_account.get("profile", {})

                    return {
                        "provider": "kakao",
                        "provider_id": str(data.get("id")),
                        "email": kakao_account.get("email"),
                        "name": profile.get("nickname"),
                        "profile_image": profile.get("profile_image_url")
                    }
                return None
        except Exception as e:
            logger.error(f"Kakao user info error: {e}")
            return None


class NaverOAuth(OAuthProvider):
    """Naver OAuth 처리"""

    def __init__(self):
        super().__init__("naver")
        self.client_id = NAVER_CLIENT_ID
        self.client_secret = NAVER_CLIENT_SECRET
        self.redirect_uri = NAVER_REDIRECT_URI

    def get_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "state": state
        }
        return f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"

    async def get_access_token(self, code: str, state: str = None) -> Optional[str]:
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code
                }
                if state:
                    params["state"] = state

                response = await client.post(
                    "https://nid.naver.com/oauth2.0/token",
                    params=params
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("access_token")
                else:
                    logger.error(f"Naver token error: {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Naver OAuth error: {e}")
            return None

    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://openapi.naver.com/v1/nid/me",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if response.status_code == 200:
                    data = response.json()
                    result = data.get("response", {})

                    return {
                        "provider": "naver",
                        "provider_id": result.get("id"),
                        "email": result.get("email"),
                        "name": result.get("name") or result.get("nickname"),
                        "profile_image": result.get("profile_image")
                    }
                return None
        except Exception as e:
            logger.error(f"Naver user info error: {e}")
            return None


# OAuth 제공자 인스턴스
oauth_providers = {
    "google": GoogleOAuth(),
    "kakao": KakaoOAuth(),
    "naver": NaverOAuth()
}


def get_oauth_provider(provider: str) -> Optional[OAuthProvider]:
    """OAuth 제공자 인스턴스 반환"""
    return oauth_providers.get(provider)


def is_oauth_configured(provider: str) -> bool:
    """OAuth 제공자가 설정되어 있는지 확인"""
    if provider == "google":
        return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    elif provider == "kakao":
        return bool(KAKAO_CLIENT_ID)
    elif provider == "naver":
        return bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET)
    return False
