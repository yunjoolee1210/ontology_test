"""
PII Detector (개인정보 탐지기)

정책 6. 개인정보·민감정보 처리 정책 (대한민국 법 준수)
- 주민번호, 의료보험 번호, 전화번호, 주소, 카드번호, 은행 결제정보 등 민감정보 탐지
- 로그·세션·DB에 민감정보 절대 저장 금지
- 이미지 업로드 시 얼굴 감지 → 전체 거부
- 위반 시 세션 강제 종료 + 사용자 안내 메시지 출력
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class PIIType(str, Enum):
    """개인정보 유형"""
    RESIDENT_ID = "resident_id"           # 주민등록번호
    HEALTH_INSURANCE = "health_insurance"  # 의료보험번호
    PHONE_NUMBER = "phone_number"         # 전화번호
    ADDRESS = "address"                   # 상세 주소
    CREDIT_CARD = "credit_card"           # 신용카드 번호
    BANK_ACCOUNT = "bank_account"         # 은행 계좌번호
    EMAIL = "email"                       # 이메일 (특정 조건)
    PASSWORD = "password"                 # 비밀번호 패턴
    PASSPORT = "passport"                 # 여권번호
    DRIVER_LICENSE = "driver_license"     # 운전면허번호


@dataclass
class PIIDetectionResult:
    """PII 탐지 결과"""
    has_pii: bool
    detected_types: List[PIIType]
    masked_text: str
    warning_message: Optional[str]
    should_block: bool


class PIIDetector:
    """개인정보 탐지 및 마스킹"""

    # 정책 6: 탐지 및 차단해야 할 민감정보 패턴
    PII_PATTERNS = {
        # 주민등록번호: YYMMDD-1234567 또는 YYMMDD 1234567
        PIIType.RESIDENT_ID: [
            r'\d{6}[-\s]?[1-4]\d{6}',  # 주민번호 전체
            r'\d{2}[01]\d[0-3]\d[-\s]?[1-4]',  # 주민번호 앞자리-뒷자리 첫글자
        ],

        # 의료보험번호 (건강보험증 기호/번호)
        PIIType.HEALTH_INSURANCE: [
            r'\d{10,12}',  # 10-12자리 숫자 (문맥상 보험번호)
        ],

        # 전화번호
        PIIType.PHONE_NUMBER: [
            r'01[0-9][-\s]?\d{3,4}[-\s]?\d{4}',  # 휴대폰
            r'0[2-6][0-5]?[-\s]?\d{3,4}[-\s]?\d{4}',  # 지역번호
            r'\+82[-\s]?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}',  # 국제번호
        ],

        # 신용카드 번호 (16자리)
        PIIType.CREDIT_CARD: [
            r'\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}',  # 16자리
            r'\d{16}',  # 연속 16자리
        ],

        # 은행 계좌번호
        PIIType.BANK_ACCOUNT: [
            r'\d{3,4}[-\s]?\d{2,4}[-\s]?\d{4,6}',  # 일반 계좌
            r'\d{11,14}',  # 11-14자리 연속 숫자
        ],

        # 여권번호 (영문 + 8자리)
        PIIType.PASSPORT: [
            r'[A-Z]{1,2}\d{7,8}',
        ],

        # 운전면허번호 (지역-연도-일련번호-확인번호)
        PIIType.DRIVER_LICENSE: [
            r'\d{2}[-\s]?\d{2}[-\s]?\d{6}[-\s]?\d{2}',
        ],
    }

    # 민감 키워드 (문맥 분석용)
    SENSITIVE_KEYWORDS = {
        "주민번호", "주민등록번호", "보험번호", "건강보험", "의료보험",
        "카드번호", "신용카드", "체크카드", "계좌번호", "통장번호",
        "비밀번호", "암호", "PIN", "핀번호", "여권번호", "면허번호"
    }

    # 주소 키워드 (상세 주소 탐지용)
    ADDRESS_KEYWORDS = [
        r'[\w가-힣]+시\s+[\w가-힣]+구\s+[\w가-힣]+동',  # OO시 OO구 OO동
        r'[\w가-힣]+도\s+[\w가-힣]+시\s+[\w가-힣]+',  # OO도 OO시
        r'아파트|빌라|오피스텔|주공|래미안|자이|푸르지오',  # 건물 유형
        r'\d+동\s*\d+호',  # 동/호수
    ]

    # 안내 메시지
    PII_WARNING_MESSAGE = (
        "소중한 개인 정보(주민번호, 전화번호, 카드번호 등)를 입력하지 말아주세요. "
        "입력하신 내용은 채팅 대화에 적용하거나 저장하지 않습니다."
    )

    FACE_DETECTION_WARNING = (
        "얼굴이 포함된 이미지는 업로드할 수 없습니다. "
        "개인정보 보호를 위해 음식 이미지만 업로드해 주세요."
    )

    def __init__(self):
        """PII 탐지기 초기화"""
        # 컴파일된 패턴 캐시
        self._compiled_patterns: Dict[PIIType, List[re.Pattern]] = {}
        for pii_type, patterns in self.PII_PATTERNS.items():
            self._compiled_patterns[pii_type] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]

        self._address_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.ADDRESS_KEYWORDS
        ]

    def detect_pii(self, text: str) -> PIIDetectionResult:
        """
        텍스트에서 PII 탐지

        Args:
            text: 검사할 텍스트

        Returns:
            PIIDetectionResult: 탐지 결과
        """
        detected_types: List[PIIType] = []
        masked_text = text

        # 1. 패턴 기반 탐지
        for pii_type, patterns in self._compiled_patterns.items():
            for pattern in patterns:
                matches = pattern.findall(text)
                if matches:
                    detected_types.append(pii_type)
                    # 마스킹 처리
                    masked_text = pattern.sub(self._get_mask(pii_type), masked_text)

        # 2. 주소 패턴 탐지
        for pattern in self._address_patterns:
            if pattern.search(text):
                if PIIType.ADDRESS not in detected_types:
                    detected_types.append(PIIType.ADDRESS)
                masked_text = pattern.sub("[주소 정보 삭제]", masked_text)

        # 3. 민감 키워드 + 숫자 조합 탐지
        text_lower = text.lower()
        for keyword in self.SENSITIVE_KEYWORDS:
            if keyword.lower() in text_lower:
                # 키워드 주변에 숫자가 있는지 확인
                keyword_pattern = re.compile(
                    rf'{keyword}\s*[:：]?\s*[\d\-\s]+',
                    re.IGNORECASE
                )
                if keyword_pattern.search(text):
                    # 해당 유형 추가
                    if "주민" in keyword and PIIType.RESIDENT_ID not in detected_types:
                        detected_types.append(PIIType.RESIDENT_ID)
                    elif "보험" in keyword and PIIType.HEALTH_INSURANCE not in detected_types:
                        detected_types.append(PIIType.HEALTH_INSURANCE)
                    elif ("카드" in keyword or "계좌" in keyword) and PIIType.CREDIT_CARD not in detected_types:
                        detected_types.append(PIIType.CREDIT_CARD)

        # 4. 결과 생성
        has_pii = len(detected_types) > 0
        should_block = has_pii and any(
            t in [PIIType.RESIDENT_ID, PIIType.CREDIT_CARD, PIIType.BANK_ACCOUNT]
            for t in detected_types
        )

        return PIIDetectionResult(
            has_pii=has_pii,
            detected_types=list(set(detected_types)),
            masked_text=masked_text,
            warning_message=self.PII_WARNING_MESSAGE if has_pii else None,
            should_block=should_block
        )

    def _get_mask(self, pii_type: PIIType) -> str:
        """PII 타입별 마스킹 문자열"""
        masks = {
            PIIType.RESIDENT_ID: "[주민번호 삭제]",
            PIIType.HEALTH_INSURANCE: "[보험번호 삭제]",
            PIIType.PHONE_NUMBER: "[전화번호 삭제]",
            PIIType.ADDRESS: "[주소 삭제]",
            PIIType.CREDIT_CARD: "[카드번호 삭제]",
            PIIType.BANK_ACCOUNT: "[계좌번호 삭제]",
            PIIType.EMAIL: "[이메일 삭제]",
            PIIType.PASSWORD: "[비밀번호 삭제]",
            PIIType.PASSPORT: "[여권번호 삭제]",
            PIIType.DRIVER_LICENSE: "[면허번호 삭제]",
        }
        return masks.get(pii_type, "[개인정보 삭제]")

    def detect_face_in_image(self, image_data: bytes) -> Tuple[bool, Optional[str]]:
        """
        이미지에서 얼굴 감지

        Args:
            image_data: 이미지 바이트 데이터

        Returns:
            Tuple[bool, Optional[str]]: (얼굴 감지 여부, 경고 메시지)
        """
        try:
            # OpenCV 또는 기타 얼굴 감지 라이브러리 사용
            # 여기서는 기본 구현 - 실제로는 CV 라이브러리 필요
            import cv2
            import numpy as np

            # 바이트를 이미지로 변환
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return False, None

            # 얼굴 감지 (Haar Cascade 사용)
            face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            face_cascade = cv2.CascadeClassifier(face_cascade_path)

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )

            if len(faces) > 0:
                logger.warning(f"얼굴 감지됨: {len(faces)}개")
                return True, self.FACE_DETECTION_WARNING

            return False, None

        except ImportError:
            # OpenCV 없으면 스킵
            logger.warning("OpenCV 미설치 - 얼굴 감지 스킵")
            return False, None
        except Exception as e:
            logger.error(f"얼굴 감지 오류: {e}")
            return False, None

    def check_image_safety(
        self,
        image_data: bytes
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        이미지 안전성 검사 (얼굴 + OCR)

        Args:
            image_data: 이미지 바이트 데이터

        Returns:
            Tuple[bool, Optional[str], Optional[str]]:
                (안전 여부, 경고 메시지, OCR 텍스트)
        """
        # 1. 얼굴 감지
        has_face, face_warning = self.detect_face_in_image(image_data)
        if has_face:
            return False, face_warning, None

        # 2. OCR로 텍스트 추출 후 PII 검사
        ocr_text = self._extract_text_from_image(image_data)
        if ocr_text:
            pii_result = self.detect_pii(ocr_text)
            if pii_result.should_block:
                return False, pii_result.warning_message, ocr_text

        return True, None, ocr_text

    def _extract_text_from_image(self, image_data: bytes) -> Optional[str]:
        """
        이미지에서 텍스트 추출 (OCR)

        Args:
            image_data: 이미지 바이트 데이터

        Returns:
            Optional[str]: 추출된 텍스트
        """
        try:
            import pytesseract
            from PIL import Image
            import io

            image = Image.open(io.BytesIO(image_data))
            text = pytesseract.image_to_string(image, lang='kor+eng')
            return text.strip() if text else None

        except ImportError:
            logger.warning("pytesseract 미설치 - OCR 스킵")
            return None
        except Exception as e:
            logger.error(f"OCR 오류: {e}")
            return None


# 싱글톤 인스턴스
pii_detector = PIIDetector()
