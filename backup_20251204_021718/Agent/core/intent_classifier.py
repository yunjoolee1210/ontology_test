"""
Intent Classifier (의도 분류기)

사용자 입력에서 의도를 분류하여 적절한 에이전트로 라우팅
- Medical_Welfare: 의료·복지·병원·의약·질환 정보
- Nutrition: 식이/영양/레시피/식단 관련
- Research_Paper: 연구 논문/PubMed/KDIGO 검색
- Quiz: 퀴즈 관련
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class IntentType(str, Enum):
    """의도 유형"""
    MEDICAL = "medical"         # 의료/복지/질환
    NUTRITION = "nutrition"     # 영양/식이
    RESEARCH = "research"       # 연구 논문
    QUIZ = "quiz"              # 퀴즈
    MIXED = "mixed"            # 복합 의도
    GREETING = "greeting"      # 인사
    FAREWELL = "farewell"      # 작별/종료
    UNKNOWN = "unknown"        # 불명확


class AgentType(str, Enum):
    """에이전트 유형"""
    MEDICAL_WELFARE = "Medical_Welfare"
    NUTRITION = "Nutrition"
    RESEARCH_PAPER = "Research_Paper"
    QUIZ = "Quiz"


@dataclass
class IntentClassificationResult:
    """의도 분류 결과"""
    primary_intent: IntentType
    confidence: float
    secondary_intents: List[IntentType]
    detected_keywords: List[str]
    recommended_agents: List[AgentType]
    is_compound: bool  # 복합 의도 여부


class IntentClassifier:
    """의도 분류기"""

    # 의료/복지 키워드
    MEDICAL_KEYWORDS = {
        # 질환 관련
        "만성신장병", "CKD", "신부전", "투석", "혈액투석", "복막투석",
        "급성신손상", "AKI", "당뇨병성신증", "사구체신염",
        "고혈압", "당뇨", "빈혈", "골다공증",

        # 증상 관련
        "부종", "피로", "어지러움", "구토", "메스꺼움", "가려움",
        "호흡곤란", "부기", "붓기", "통증",

        # 검사/수치 관련
        "크레아티닌", "GFR", "eGFR", "BUN", "요소질소",
        "칼륨", "나트륨", "인", "칼슘", "헤모글로빈",
        "단백뇨", "혈뇨", "검사 결과", "수치",

        # 치료/약물 관련
        "약", "처방", "치료", "주사", "EPO", "에리스로포이에틴",
        "인결합제", "혈압약", "당뇨약", "면역억제제",

        # 의료 시스템 관련
        "병원", "의사", "진료", "입원", "외래", "응급실",
        "의료비", "건강보험", "산정특례", "장애등급",

        # 복지 관련
        "복지", "지원금", "보조금", "혜택", "정부지원",
        "장애인", "요양", "간병", "돌봄"
    }

    # 영양/식이 키워드
    NUTRITION_KEYWORDS = {
        # 영양소 관련
        "영양", "단백질", "칼로리", "열량", "탄수화물",
        "지방", "비타민", "미네랄", "수분",

        # 식이 제한
        "저염", "저단백", "저칼륨", "저인", "저지방",
        "나트륨 제한", "칼륨 제한", "인 제한",

        # 음식 관련
        "음식", "식사", "식단", "레시피", "요리", "메뉴",
        "먹어도", "먹을 수", "섭취", "식품",
        "과일", "채소", "고기", "생선", "유제품",

        # 식단 계획
        "일주일 식단", "주간 식단", "식단 추천", "식단 계획",
        "아침", "점심", "저녁", "간식",

        # 특정 음식
        "바나나", "감자", "토마토", "우유", "치즈",
        "김치", "라면", "햄", "소시지",

        # 이미지 분석 관련
        "사진", "이미지", "분석해", "어떤 음식"
    }

    # 연구/논문 키워드
    RESEARCH_KEYWORDS = {
        # 연구 관련
        "논문", "연구", "study", "paper", "research",
        "학술", "저널", "journal", "article",

        # 데이터베이스
        "pubmed", "펍메드", "KDIGO", "가이드라인", "guideline",
        "KDOQI", "ADA", "NKF",

        # 연구 유형
        "임상시험", "메타분석", "리뷰", "review",
        "코호트", "RCT", "무작위대조시험",

        # 최신 연구
        "최신", "최근", "신약", "신기술", "개정",
        "업데이트", "새로운 치료"
    }

    # 퀴즈 키워드
    QUIZ_KEYWORDS = {
        "퀴즈", "quiz", "문제", "테스트", "test",
        "시험", "점수", "맞추기", "정답"
    }

    # 인사 키워드
    GREETING_KEYWORDS = {
        "안녕", "반가워", "반갑습니다", "하이", "hello", "hi",
        "처음 뵙겠습니다", "만나서 반가워"
    }

    # 종료 키워드
    FAREWELL_KEYWORDS = {
        "대화 그만", "꺼져", "대화 종료해", "대화 끝",
        "종료", "그만해", "닥쳐", "bye", "끝내자",
        "안녕히", "다음에", "나중에"
    }

    def __init__(self):
        """의도 분류기 초기화"""
        self._compile_patterns()

    def _compile_patterns(self):
        """정규식 패턴 컴파일"""
        # 질문 패턴
        self.question_patterns = [
            re.compile(r'어떻게|어떤|무엇|뭐|왜|언제|어디|누구|몇'),
            re.compile(r'\?$'),
            re.compile(r'알려|설명|찾아|검색')
        ]

    def classify(
        self,
        text: str,
        selected_agent: Optional[str] = None
    ) -> IntentClassificationResult:
        """
        사용자 입력 의도 분류

        Args:
            text: 사용자 입력 텍스트
            selected_agent: 사용자가 선택한 에이전트 (있으면 우선)

        Returns:
            IntentClassificationResult: 분류 결과
        """
        text_lower = text.lower()
        detected_keywords: List[str] = []
        intent_scores: Dict[IntentType, float] = {
            IntentType.MEDICAL: 0,
            IntentType.NUTRITION: 0,
            IntentType.RESEARCH: 0,
            IntentType.QUIZ: 0,
            IntentType.GREETING: 0,
            IntentType.FAREWELL: 0
        }

        # 1. 종료 요청 체크 (최우선)
        for keyword in self.FAREWELL_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                return IntentClassificationResult(
                    primary_intent=IntentType.FAREWELL,
                    confidence=1.0,
                    secondary_intents=[],
                    detected_keywords=[keyword],
                    recommended_agents=[],
                    is_compound=False
                )

        # 2. 인사 체크
        for keyword in self.GREETING_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                intent_scores[IntentType.GREETING] += 1
                detected_keywords.append(keyword)

        # 3. 의료/복지 키워드 체크
        for keyword in self.MEDICAL_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                intent_scores[IntentType.MEDICAL] += 1
                detected_keywords.append(keyword)

        # 4. 영양 키워드 체크
        for keyword in self.NUTRITION_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                intent_scores[IntentType.NUTRITION] += 1
                detected_keywords.append(keyword)

        # 5. 연구 키워드 체크
        for keyword in self.RESEARCH_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                intent_scores[IntentType.RESEARCH] += 1
                detected_keywords.append(keyword)

        # 6. 퀴즈 키워드 체크
        for keyword in self.QUIZ_KEYWORDS:
            if keyword in text or keyword.lower() in text_lower:
                intent_scores[IntentType.QUIZ] += 1
                detected_keywords.append(keyword)

        # 7. 점수 기반 분류
        max_score = max(intent_scores.values())
        if max_score == 0:
            primary_intent = IntentType.UNKNOWN
            confidence = 0.0
        else:
            # 가장 높은 점수의 의도 선택
            primary_intent = max(intent_scores, key=intent_scores.get)
            total_score = sum(intent_scores.values())
            confidence = max_score / total_score if total_score > 0 else 0

        # 8. 복합 의도 판단
        secondary_intents = [
            intent for intent, score in intent_scores.items()
            if score > 0 and intent != primary_intent
        ]
        is_compound = len(secondary_intents) > 0 and confidence < 0.7

        if is_compound:
            primary_intent = IntentType.MIXED

        # 9. 에이전트 추천
        recommended_agents = self._get_recommended_agents(
            primary_intent,
            secondary_intents,
            selected_agent
        )

        return IntentClassificationResult(
            primary_intent=primary_intent,
            confidence=confidence,
            secondary_intents=secondary_intents,
            detected_keywords=list(set(detected_keywords)),
            recommended_agents=recommended_agents,
            is_compound=is_compound
        )

    def _get_recommended_agents(
        self,
        primary_intent: IntentType,
        secondary_intents: List[IntentType],
        selected_agent: Optional[str]
    ) -> List[AgentType]:
        """
        의도에 따른 에이전트 추천

        Args:
            primary_intent: 주요 의도
            secondary_intents: 보조 의도들
            selected_agent: 사용자 선택 에이전트

        Returns:
            List[AgentType]: 추천 에이전트 목록
        """
        intent_to_agent = {
            IntentType.MEDICAL: AgentType.MEDICAL_WELFARE,
            IntentType.NUTRITION: AgentType.NUTRITION,
            IntentType.RESEARCH: AgentType.RESEARCH_PAPER,
            IntentType.QUIZ: AgentType.QUIZ
        }

        agents = []

        # 사용자가 에이전트를 선택한 경우 해당 에이전트 우선
        if selected_agent:
            try:
                agents.append(AgentType(selected_agent))
            except ValueError:
                pass

        # 주요 의도에 해당하는 에이전트
        if primary_intent in intent_to_agent:
            agent = intent_to_agent[primary_intent]
            if agent not in agents:
                agents.append(agent)

        # 복합 의도인 경우 추가 에이전트
        if primary_intent == IntentType.MIXED:
            for intent in secondary_intents:
                if intent in intent_to_agent:
                    agent = intent_to_agent[intent]
                    if agent not in agents:
                        agents.append(agent)

        # 기본값: Medical_Welfare
        if not agents:
            agents.append(AgentType.MEDICAL_WELFARE)

        return agents

    def extract_context_keywords(self, text: str) -> List[str]:
        """
        컨텍스트 키워드 추출 (세션 저장용)

        Args:
            text: 사용자 입력

        Returns:
            List[str]: 추출된 키워드
        """
        keywords = []
        text_lower = text.lower()

        # 질환 관련 키워드
        disease_keywords = [
            "CKD", "만성신장병", "투석", "혈액투석", "복막투석",
            "당뇨", "고혈압", "신부전"
        ]
        for kw in disease_keywords:
            if kw.lower() in text_lower or kw in text:
                keywords.append(kw)

        # 영양 관련 키워드
        nutrition_keywords = [
            "저염", "저단백", "저칼륨", "식단", "영양"
        ]
        for kw in nutrition_keywords:
            if kw in text:
                keywords.append(kw)

        # 관심사 키워드
        interest_keywords = [
            "이식", "transplant", "약물", "부작용", "합병증"
        ]
        for kw in interest_keywords:
            if kw.lower() in text_lower or kw in text:
                keywords.append(kw)

        return list(set(keywords))

    def is_image_analysis_request(self, text: str) -> bool:
        """
        이미지 분석 요청인지 확인

        Args:
            text: 사용자 입력

        Returns:
            bool: 이미지 분석 요청 여부
        """
        image_keywords = [
            "사진", "이미지", "분석", "어떤 음식", "뭐가 들어",
            "영양 분석", "칼로리", "이거 먹어도"
        ]
        text_lower = text.lower()
        return any(kw in text_lower or kw in text for kw in image_keywords)


# 싱글톤 인스턴스
intent_classifier = IntentClassifier()
