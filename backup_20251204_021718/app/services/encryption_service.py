"""
AES-256 암호화 서비스
개인정보 보호를 위한 암호화/복호화 유틸리티
"""
import os
import base64
import hashlib
import secrets
from typing import Optional, Union, Dict, Any, List
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from dotenv import load_dotenv
import logging
import json

load_dotenv()

logger = logging.getLogger(__name__)


class AES256Encryption:
    """
    AES-256-GCM 암호화 서비스

    - GCM 모드 사용 (인증된 암호화, 무결성 검증 포함)
    - 각 암호화마다 고유한 IV(Nonce) 생성
    - 환경변수에서 마스터 키 로드
    """

    # 상수 정의
    KEY_SIZE = 32  # 256 bits
    NONCE_SIZE = 12  # 96 bits (GCM 권장)
    TAG_SIZE = 16  # 128 bits

    def __init__(self, master_key: Optional[str] = None):
        """
        암호화 서비스 초기화

        Args:
            master_key: 32바이트 마스터 키 (없으면 환경변수에서 로드)
        """
        self._master_key = self._load_or_generate_key(master_key)
        logger.info("AES-256 Encryption service initialized")

    def _load_or_generate_key(self, master_key: Optional[str]) -> bytes:
        """마스터 키 로드 또는 생성"""
        if master_key:
            # 제공된 키 사용
            key_bytes = master_key.encode('utf-8')
        else:
            # 환경변수에서 로드
            env_key = os.getenv("ENCRYPTION_MASTER_KEY")
            if env_key:
                key_bytes = env_key.encode('utf-8')
            else:
                # 키가 없으면 경고 후 임시 키 생성 (개발용)
                logger.warning(
                    "⚠️ ENCRYPTION_MASTER_KEY not found in environment. "
                    "Using derived key from SECRET_KEY. "
                    "Set ENCRYPTION_MASTER_KEY in production!"
                )
                secret_key = os.getenv("SECRET_KEY", "careguide-default-secret-key-change-me")
                key_bytes = secret_key.encode('utf-8')

        # SHA-256으로 32바이트 키 파생
        return hashlib.sha256(key_bytes).digest()

    def encrypt(self, plaintext: str) -> str:
        """
        문자열 암호화

        Args:
            plaintext: 암호화할 평문

        Returns:
            str: Base64 인코딩된 암호문 (nonce + ciphertext + tag)
        """
        if not plaintext:
            return ""

        try:
            # 랜덤 nonce 생성
            nonce = secrets.token_bytes(self.NONCE_SIZE)

            # AES-256-GCM 암호화
            cipher = Cipher(
                algorithms.AES(self._master_key),
                modes.GCM(nonce),
                backend=default_backend()
            )
            encryptor = cipher.encryptor()

            # 암호화
            ciphertext = encryptor.update(plaintext.encode('utf-8')) + encryptor.finalize()

            # nonce + ciphertext + tag 결합
            encrypted_data = nonce + ciphertext + encryptor.tag

            # Base64 인코딩
            return base64.b64encode(encrypted_data).decode('utf-8')

        except Exception as e:
            logger.error(f"Encryption error: {e}")
            raise ValueError(f"Encryption failed: {e}")

    def decrypt(self, ciphertext: str) -> str:
        """
        암호문 복호화

        Args:
            ciphertext: Base64 인코딩된 암호문

        Returns:
            str: 복호화된 평문
        """
        if not ciphertext:
            return ""

        try:
            # Base64 디코딩
            encrypted_data = base64.b64decode(ciphertext.encode('utf-8'))

            # nonce, ciphertext, tag 분리
            nonce = encrypted_data[:self.NONCE_SIZE]
            tag = encrypted_data[-self.TAG_SIZE:]
            actual_ciphertext = encrypted_data[self.NONCE_SIZE:-self.TAG_SIZE]

            # AES-256-GCM 복호화
            cipher = Cipher(
                algorithms.AES(self._master_key),
                modes.GCM(nonce, tag),
                backend=default_backend()
            )
            decryptor = cipher.decryptor()

            # 복호화
            plaintext = decryptor.update(actual_ciphertext) + decryptor.finalize()

            return plaintext.decode('utf-8')

        except Exception as e:
            logger.error(f"Decryption error: {e}")
            raise ValueError(f"Decryption failed: {e}")

    def encrypt_dict(self, data: Dict[str, Any], fields_to_encrypt: List[str]) -> Dict[str, Any]:
        """
        딕셔너리의 특정 필드들을 암호화

        Args:
            data: 원본 딕셔너리
            fields_to_encrypt: 암호화할 필드명 리스트

        Returns:
            Dict: 암호화된 필드가 포함된 딕셔너리
        """
        result = data.copy()

        for field in fields_to_encrypt:
            if field in result and result[field] is not None:
                value = result[field]
                # 리스트나 딕셔너리면 JSON 문자열로 변환
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                elif not isinstance(value, str):
                    value = str(value)
                result[field] = self.encrypt(value)

        return result

    def decrypt_dict(self, data: Dict[str, Any], fields_to_decrypt: List[str]) -> Dict[str, Any]:
        """
        딕셔너리의 특정 필드들을 복호화

        Args:
            data: 암호화된 딕셔너리
            fields_to_decrypt: 복호화할 필드명 리스트

        Returns:
            Dict: 복호화된 필드가 포함된 딕셔너리
        """
        result = data.copy()

        for field in fields_to_decrypt:
            if field in result and result[field] is not None:
                try:
                    decrypted = self.decrypt(result[field])
                    # JSON 파싱 시도
                    try:
                        result[field] = json.loads(decrypted)
                    except json.JSONDecodeError:
                        result[field] = decrypted
                except Exception as e:
                    logger.warning(f"Failed to decrypt field '{field}': {e}")
                    # 복호화 실패 시 원본 유지 (암호화되지 않은 레거시 데이터일 수 있음)

        return result

    def encrypt_if_not_encrypted(self, value: str) -> str:
        """
        이미 암호화되지 않은 경우에만 암호화
        (마이그레이션 시 유용)
        """
        if not value:
            return ""

        # 이미 암호화된 데이터인지 확인 (Base64 + 특정 길이)
        try:
            decoded = base64.b64decode(value)
            if len(decoded) > self.NONCE_SIZE + self.TAG_SIZE:
                # 복호화 시도
                self.decrypt(value)
                return value  # 이미 암호화됨
        except Exception:
            pass  # 암호화되지 않은 데이터

        return self.encrypt(value)

    @staticmethod
    def generate_master_key() -> str:
        """
        새로운 마스터 키 생성 (설정용)

        Returns:
            str: 32바이트 랜덤 키 (hex 인코딩)
        """
        return secrets.token_hex(32)

    @staticmethod
    def hash_for_search(plaintext: str) -> str:
        """
        검색용 해시 생성 (암호화된 데이터 검색 시 사용)

        Args:
            plaintext: 해시할 평문

        Returns:
            str: SHA-256 해시 (hex)
        """
        if not plaintext:
            return ""
        return hashlib.sha256(plaintext.encode('utf-8')).hexdigest()


# 개인정보 필드 정의
PERSONAL_DATA_FIELDS = [
    "email",
    "name",
    "nickname",
    "phone",
    "birth_year",
    "birthDate",
    "ip_address",
]

# 건강정보 필드 정의 (민감도 높음)
HEALTH_DATA_FIELDS = [
    "diagnosis_name",
    "diagnosis_code",
    "diagnosing_hospital",
    "attending_physician",
    "gfr",
    "creatinine",
    "other_conditions",
]

# 대화 이력 필드 정의
CHAT_DATA_FIELDS = [
    "user_message",
    "assistant_message",
    "context",
    "feedback_text",
]

# 식단 기록 필드 정의
MEAL_DATA_FIELDS = [
    "food_name",
    "meal_description",
    "nutrition_analysis",
]

# 싱글톤 인스턴스
encryption_service = AES256Encryption()


# 편의 함수
def encrypt(plaintext: str) -> str:
    """문자열 암호화"""
    return encryption_service.encrypt(plaintext)


def decrypt(ciphertext: str) -> str:
    """문자열 복호화"""
    return encryption_service.decrypt(ciphertext)


def encrypt_personal_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """개인정보 필드 암호화"""
    return encryption_service.encrypt_dict(data, PERSONAL_DATA_FIELDS)


def decrypt_personal_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """개인정보 필드 복호화"""
    return encryption_service.decrypt_dict(data, PERSONAL_DATA_FIELDS)


def encrypt_health_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """건강정보 필드 암호화"""
    return encryption_service.encrypt_dict(data, HEALTH_DATA_FIELDS)


def decrypt_health_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """건강정보 필드 복호화"""
    return encryption_service.decrypt_dict(data, HEALTH_DATA_FIELDS)


def encrypt_chat_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """대화 이력 필드 암호화"""
    return encryption_service.encrypt_dict(data, CHAT_DATA_FIELDS)


def decrypt_chat_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """대화 이력 필드 복호화"""
    return encryption_service.decrypt_dict(data, CHAT_DATA_FIELDS)
