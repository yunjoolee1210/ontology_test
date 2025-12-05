"""
파일 업로드 서비스 모듈
프로필 이미지 등 파일 저장 및 관리
"""
import os
import uuid
import aiofiles
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# 파일 저장 설정
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 5 * 1024 * 1024))  # 5MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# 업로드 경로 생성
PROFILE_IMAGES_DIR = Path(UPLOAD_DIR) / "profile_images"
PROFILE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def validate_image_file(filename: str, content_type: str, file_size: int) -> Tuple[bool, str]:
    """
    이미지 파일 유효성 검사

    Args:
        filename: 파일명
        content_type: MIME 타입
        file_size: 파일 크기 (bytes)

    Returns:
        Tuple[bool, str]: (유효 여부, 메시지)
    """
    # 파일 크기 검사
    if file_size > MAX_FILE_SIZE:
        return False, f"파일 크기는 {MAX_FILE_SIZE // (1024 * 1024)}MB 이하여야 합니다"

    # MIME 타입 검사
    if content_type not in ALLOWED_IMAGE_TYPES:
        return False, "허용된 이미지 형식: JPG, PNG, GIF, WebP"

    # 확장자 검사
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, "허용된 확장자: jpg, jpeg, png, gif, webp"

    return True, "OK"


def generate_unique_filename(original_filename: str, user_id: str) -> str:
    """
    고유한 파일명 생성

    Args:
        original_filename: 원본 파일명
        user_id: 사용자 ID

    Returns:
        str: 고유 파일명
    """
    ext = Path(original_filename).suffix.lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]

    return f"{user_id}_{timestamp}_{unique_id}{ext}"


async def save_profile_image(
    file_content: bytes,
    original_filename: str,
    user_id: str
) -> str:
    """
    프로필 이미지 저장

    Args:
        file_content: 파일 내용
        original_filename: 원본 파일명
        user_id: 사용자 ID

    Returns:
        str: 저장된 파일 경로 (URL용)
    """
    # 고유 파일명 생성
    filename = generate_unique_filename(original_filename, user_id)
    file_path = PROFILE_IMAGES_DIR / filename

    # 파일 저장
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_content)

    logger.info(f"✅ Profile image saved: {filename}")

    # URL 경로 반환
    return f"/uploads/profile_images/{filename}"


async def delete_profile_image(file_url: str) -> bool:
    """
    프로필 이미지 삭제

    Args:
        file_url: 파일 URL 경로

    Returns:
        bool: 삭제 성공 여부
    """
    if not file_url or not file_url.startswith("/uploads/profile_images/"):
        return False

    filename = file_url.split("/")[-1]
    file_path = PROFILE_IMAGES_DIR / filename

    try:
        if file_path.exists():
            os.remove(file_path)
            logger.info(f"✅ Profile image deleted: {filename}")
            return True
        return False
    except Exception as e:
        logger.error(f"❌ Failed to delete profile image: {e}")
        return False


def get_file_url(file_path: str) -> str:
    """
    파일 URL 반환

    Args:
        file_path: 파일 경로

    Returns:
        str: 접근 가능한 URL
    """
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    return f"{backend_url}{file_path}"
