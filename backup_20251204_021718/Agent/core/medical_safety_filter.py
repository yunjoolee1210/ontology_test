"""
Medical Safety Filter (의료 안전 필터)

정책 3. 의료 안전 로직 (False Negative 방지)
- 사용자가 증상·수치·약물 관련 질문을 하면 절대 "괜찮다", "문제없다" 같은 단정적 안심 표현 금지
- 위험 가능성이 있다면 즉시 의료진 상담 권유
- 위험 키워드: 부종, 어지러움, 호흡곤란, 가슴통증, 크레아티닌 급상승, 고칼륨혈증 의심, 투석 후 심한 피로 등
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class RiskLevel(str, Enum):
    """위험 수준"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EMERGENCY = "emergency"


@dataclass
class SafetyCheckResult:
    """안전 검사 결과"""
    is_safe: bool
    risk_level: RiskLevel
    detected_keywords: List[str]
    recommendation: Optional[str]
    should_refer_to_doctor: bool
    emergency_warning: Optional[str]


class MedicalSafetyFilter:
    """의료 안전 필터"""

    # 응급 상황 키워드 (즉시 응급실 권유)
    EMERGENCY_KEYWORDS = {
        # 심혈관계
        "가슴통증", "가슴 통증", "흉통", "심장마비", "심근경색",
        "가슴이 조여", "가슴이 아파", "심장이 두근",

        # 호흡계
        "호흡곤란", "숨이 안 쉬어", "숨을 못 쉬", "호흡 곤란",
        "숨이 차", "숨 쉬기 힘들",

        # 신경계
        "의식 잃", "기절", "의식불명", "쓰러졌", "실신",
        "경련", "발작", "마비",

        # 급성 신장
        "소변이 안 나", "무뇨", "핍뇨", "급성신부전",
    }

    # 고위험 키워드 (즉시 의료진 상담 권유)
    HIGH_RISK_KEYWORDS = {
        # 신장 관련 증상
        "부종", "붓", "부어", "몸이 붓", "다리가 붓", "얼굴이 붓",
        "어지러움", "어지럽", "현기증", "빈혈 증상",
        "구역질", "구토", "메스꺼움",
        "피로감", "심한 피로", "탈진",

        # 검사 수치 이상
        "크레아티닌 급상승", "크레아티닌 상승", "신기능 저하",
        "고칼륨혈증", "칼륨 높", "고인산혈증", "인 수치 높",
        "BUN 높", "요소질소 높",

        # 투석 관련
        "투석 후 피로", "투석후 어지러움", "투석 합병증",
        "저혈압", "혈압 낮",

        # 약물 부작용
        "약 부작용", "두드러기", "알러지 반응", "알레르기",
        "출혈", "피가 나", "피 섞인",
    }

    # 중위험 키워드 (주의 관찰 + 의료진 상담 권고)
    MEDIUM_RISK_KEYWORDS = {
        # 일반 증상
        "피로", "무기력", "식욕부진", "식욕 없", "입맛 없",
        "가려움", "피부 가려움", "건조함",
        "수면 장애", "불면", "잠을 못",

        # 소화기 증상
        "소화 불량", "변비", "설사",
        "복통", "배가 아파",

        # 근골격계
        "근육 경련", "쥐", "다리 저림", "손발 저림",
        "뼈 통증", "관절통",

        # 검사 관련 질문
        "검사 결과", "수치가", "정상 범위",
    }

    # 단정적 표현 금지 (응답에서 제거해야 할 표현)
    PROHIBITED_PHRASES = [
        "괜찮습니다",
        "괜찮아요",
        "문제없습니다",
        "문제 없습니다",
        "문제없어요",
        "걱정 마세요",
        "걱정하지 마세요",
        "걱정 안 하셔도",
        "안심하세요",
        "정상입니다",
        "정상이에요",
        "이상 없습니다",
        "이상없어요",
    ]

    # 안전 권고 메시지
    SAFETY_RECOMMENDATIONS = {
        RiskLevel.EMERGENCY: (
            "지금 말씀하신 증상은 응급 상황일 수 있습니다. "
            "즉시 가까운 응급실을 방문하시거나 119에 연락해 주세요."
        ),
        RiskLevel.HIGH: (
            "말씀하신 증상에 대해 정확한 판단을 위해 담당 의료진께 꼭 말씀해 주세요. "
            "가능하면 빠른 시일 내에 병원에 가서 확인하시는 것이 안전합니다."
        ),
        RiskLevel.MEDIUM: (
            "증상이 지속되거나 심해지면 담당 의료진과 상담하시는 것을 권장드립니다."
        ),
        RiskLevel.LOW: None
    }

    def __init__(self):
        """의료 안전 필터 초기화"""
        self._compile_patterns()

    def _compile_patterns(self):
        """패턴 컴파일"""
        # 숫자 + 단위 패턴 (검사 수치 감지용)
        self.value_pattern = re.compile(
            r'(\d+(?:\.\d+)?)\s*(mg/dL|mg\/dl|mg|mmol/L|mEq/L|%|g/dL)',
            re.IGNORECASE
        )

        # 크레아티닌 수치 패턴
        self.creatinine_pattern = re.compile(
            r'크레아티닌\s*(?:수치)?\s*[:：]?\s*(\d+(?:\.\d+)?)',
            re.IGNORECASE
        )

        # 칼륨 수치 패턴
        self.potassium_pattern = re.compile(
            r'칼륨\s*(?:수치)?\s*[:：]?\s*(\d+(?:\.\d+)?)',
            re.IGNORECASE
        )

        # GFR 패턴
        self.gfr_pattern = re.compile(
            r'(?:eGFR|GFR|사구체여과율)\s*[:：]?\s*(\d+(?:\.\d+)?)',
            re.IGNORECASE
        )

    def check_input_safety(self, text: str) -> SafetyCheckResult:
        """
        사용자 입력 안전 검사

        Args:
            text: 사용자 입력 텍스트

        Returns:
            SafetyCheckResult: 안전 검사 결과
        """
        text_lower = text.lower()
        detected_keywords: List[str] = []
        risk_level = RiskLevel.LOW

        # 1. 응급 키워드 검사
        for keyword in self.EMERGENCY_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                detected_keywords.append(keyword)
                risk_level = RiskLevel.EMERGENCY

        if risk_level == RiskLevel.EMERGENCY:
            return SafetyCheckResult(
                is_safe=False,
                risk_level=RiskLevel.EMERGENCY,
                detected_keywords=detected_keywords,
                recommendation=self.SAFETY_RECOMMENDATIONS[RiskLevel.EMERGENCY],
                should_refer_to_doctor=True,
                emergency_warning=self.SAFETY_RECOMMENDATIONS[RiskLevel.EMERGENCY]
            )

        # 2. 고위험 키워드 검사
        for keyword in self.HIGH_RISK_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                detected_keywords.append(keyword)
                if risk_level.value < RiskLevel.HIGH.value:
                    risk_level = RiskLevel.HIGH

        # 3. 중위험 키워드 검사
        for keyword in self.MEDIUM_RISK_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                detected_keywords.append(keyword)
                if risk_level == RiskLevel.LOW:
                    risk_level = RiskLevel.MEDIUM

        # 4. 검사 수치 분석
        lab_risk = self._analyze_lab_values(text)
        if lab_risk:
            detected_keywords.extend(lab_risk["keywords"])
            if lab_risk["risk_level"].value > risk_level.value:
                risk_level = lab_risk["risk_level"]

        return SafetyCheckResult(
            is_safe=risk_level == RiskLevel.LOW,
            risk_level=risk_level,
            detected_keywords=list(set(detected_keywords)),
            recommendation=self.SAFETY_RECOMMENDATIONS.get(risk_level),
            should_refer_to_doctor=risk_level in [RiskLevel.HIGH, RiskLevel.EMERGENCY],
            emergency_warning=self.SAFETY_RECOMMENDATIONS[RiskLevel.EMERGENCY] if risk_level == RiskLevel.EMERGENCY else None
        )

    def _analyze_lab_values(self, text: str) -> Optional[Dict[str, Any]]:
        """
        검사 수치 분석

        Args:
            text: 텍스트

        Returns:
            Optional[Dict]: 분석 결과 (risk_level, keywords)
        """
        keywords = []
        risk_level = RiskLevel.LOW

        # 크레아티닌 분석 (정상: 0.7-1.3 mg/dL)
        cr_match = self.creatinine_pattern.search(text)
        if cr_match:
            value = float(cr_match.group(1))
            if value > 3.0:
                keywords.append(f"크레아티닌 {value}")
                risk_level = RiskLevel.HIGH
            elif value > 1.5:
                keywords.append(f"크레아티닌 {value}")
                risk_level = RiskLevel.MEDIUM

        # 칼륨 분석 (정상: 3.5-5.0 mEq/L)
        k_match = self.potassium_pattern.search(text)
        if k_match:
            value = float(k_match.group(1))
            if value > 6.0:
                keywords.append(f"칼륨 {value} (고칼륨혈증 의심)")
                risk_level = RiskLevel.EMERGENCY
            elif value > 5.5:
                keywords.append(f"칼륨 {value}")
                risk_level = RiskLevel.HIGH
            elif value < 3.0:
                keywords.append(f"칼륨 {value} (저칼륨혈증 의심)")
                risk_level = RiskLevel.HIGH

        # GFR 분석
        gfr_match = self.gfr_pattern.search(text)
        if gfr_match:
            value = float(gfr_match.group(1))
            if value < 15:
                keywords.append(f"eGFR {value} (CKD 5단계)")
                risk_level = RiskLevel.HIGH
            elif value < 30:
                keywords.append(f"eGFR {value} (CKD 4단계)")
                risk_level = RiskLevel.MEDIUM

        if keywords:
            return {
                "keywords": keywords,
                "risk_level": risk_level
            }
        return None

    def filter_response(self, response: str, risk_level: RiskLevel) -> str:
        """
        AI 응답에서 위험한 표현 필터링

        Args:
            response: AI 응답
            risk_level: 감지된 위험 수준

        Returns:
            str: 필터링된 응답
        """
        filtered = response

        # 1. 금지된 단정적 표현 제거/수정
        for phrase in self.PROHIBITED_PHRASES:
            if phrase in filtered:
                # 맥락에 맞는 대체 표현으로 변경
                filtered = filtered.replace(
                    phrase,
                    "정확한 판단을 위해 담당 의료진과 상담하시는 것이 좋겠습니다"
                )

        # 2. 위험 수준에 따른 권고 추가
        if risk_level in [RiskLevel.HIGH, RiskLevel.EMERGENCY]:
            recommendation = self.SAFETY_RECOMMENDATIONS[risk_level]
            if recommendation and recommendation not in filtered:
                filtered = filtered + f"\n\n{recommendation}"

        return filtered

    def add_medical_disclaimer(
        self,
        response: str,
        add_disclaimer: bool = True
    ) -> str:
        """
        의료 면책 조항 추가

        Args:
            response: 응답
            add_disclaimer: 면책 조항 추가 여부

        Returns:
            str: 면책 조항이 추가된 응답
        """
        if not add_disclaimer:
            return response

        # 이미 의료진 상담 권유가 있는지 확인
        has_doctor_reference = any(
            phrase in response for phrase in [
                "의료진", "담당 의사", "병원", "전문의", "응급실"
            ]
        )

        if not has_doctor_reference:
            disclaimer = (
                "\n\n※ 위 내용은 일반적인 정보 제공 목적이며, "
                "개인의 건강 상태에 따라 다를 수 있습니다. "
                "정확한 진단과 치료는 담당 의료진과 상담해 주세요."
            )
            return response + disclaimer

        return response


# 싱글톤 인스턴스
medical_safety_filter = MedicalSafetyFilter()
