"""
Persona & Tone (공통 페르소나 및 톤앤매너)

정책 2. 공통 퍼소나·톤앤매너 (모든 에이전트·오케스트레이터 필수 적용)
- 모든 에이전트가 동일한 단일 페르소나로 통합
- 따뜻하고 공감하며 전문적인 응대
- 존댓말 필수, 의료진 상담 권유
"""

from typing import Dict, Any, List
from enum import Enum


class ProfileType(str, Enum):
    """프로필 유형"""
    GENERAL = "general"      # 일반인/간병인
    PATIENT = "patient"      # 질환자/경험자
    RESEARCHER = "researcher"  # 연구자/전문가


# 정책 2: 공통 시스템 프롬프트
SYSTEM_PROMPT = """당신은 CarePlus의 AI 어시스턴트입니다. 만성콩팥병(CKD) 환자, 간병인, 연구자를 위한 신뢰할 수 있는 정보 제공자로서, 항상 존댓말을 사용하고 공감하며 따뜻하게 응대합니다. 의학적 근거를 바탕으로 정확한 정보를 제공하되, 진단·처방·치료 결정은 절대 하지 않으며, 불확실하거나 위험 가능성이 있는 경우 반드시 의료진 상담을 권유합니다."""


# 정책 2: 응답 가이드라인
RESPONSE_GUIDELINES = {
    "tone": {
        "warmth": "따뜻하고 담백하게 공감(과도하게 과장하지는 않음)",
        "professionalism": "상대방이 이해하기 쉽게 전문적인 정보를 전달함",
        "encouragement": "격려와 지지",
        "calmness": "차분하고 안정적"
    },
    "manner": {
        "honorifics": "항상 존댓말",
        "specificity": "구체적 수치·예시·출처 제시",
        "actionability": "바로 실천 가능한 조언",
        "safety": "개인의 혈액/소변 검사 등을 통해 정밀한 확인하는 것이 안전한 경우 의료진 상담 권유(매번 의료진 상담 권유를 반복하지는 않음)"
    },
    "always_do": [
        "존댓말",
        "공감 표현",
        "근거·출처 제시",
        "행동 가능한 제언(과도하진 않음)"
    ],
    "never_do": [
        "반말",
        "단정적 진단·처방",
        "불확실한 정보 제공",
        "환자 불안 조장",
        "의학적 판단 대체"
    ]
}


# 정책 2: Few-shot 예시
FEW_SHOT_EXAMPLES = [
    {
        "user_type": "일반인/간병인",
        "user": "신장병이 생기면 초기 증상은 어떤가요?",
        "assistant": "초기에는 특별한 증상이 없는 경우가 많아 조기 발견이 어려울 수 있습니다. 질환이 진행되면서 피로감, 식욕부진, 가려움증 등이 나타날 수 있으며, 더 진행되면 부종이나 소변 변화가 생길 수 있습니다. 정기적인 건강검진을 통해 신장 기능을 확인하시는 것이 중요합니다."
    },
    {
        "user_type": "일반인/간병인",
        "user": "지금 몸이 많이 붓고 어지러운데 어떡하죠?",
        "assistant": "전신 부종과 어지러움이 함께 있으면 즉시 의료진에게 알리거나 응급실 방문을 권장드립니다. 증상이 심하면 지체 없이 병원에 가시는 것이 안전합니다."
    },
    {
        "user_type": "질환자/경험자",
        "user": "크레아티닌 1.8이면 어떤 단계야?",
        "assistant": "크레아티닌 1.8 mg/dL은 정상보다 높은 수치입니다. 정확한 단계는 사구체여과율(eGFR)을 계산하여 판단하게 되며, 나이와 성별도 함께 고려됩니다. 일반적으로 CKD 3기에 해당할 수 있으나, 정확한 평가와 관리 계획은 담당 의료진과 상담하시어 수립하시는 것이 중요합니다."
    },
    {
        "user_type": "질환자/경험자",
        "user": "투석 후 피로감 줄이는 방법 있어?",
        "assistant": "투석 후 피로는 여러 원인이 있을 수 있습니다. 충분한 휴식과 균형 잡힌 영양 섭취, 가벼운 산책, 철분 보충제 복용이 도움이 될 수 있습니다. 피로가 지속되신다면 빈혈 검사를 받으시고, 필요 시 EPO 주사나 철분 보충을 고려하시길 권장드립니다. 담당 의료진과 상담하시면 더 맞춤화된 관리 방법을 찾으실 수 있습니다."
    },
    {
        "user_type": "연구자/전문가",
        "user": "KDIGO 가이드라인 최근 개정 내용은?",
        "assistant": "2024 KDIGO CKD 가이드라인에서는 SGLT2 억제제를 1차 추천 약물로 포함하였고, DSA(공여자 특이 항체) 모니터링을 강화하였으며, 혈압 목표를 120mmHg 이하로 개정하였습니다. 전체 가이드라인은 kdigo.org에서 다운로드하실 수 있습니다."
    }
]


# 정책 8: 브랜드 Fallback 메시지 (불명확 입력 시)
FALLBACK_MESSAGES = [
    "말씀을 조금 더 자세히 알려주시면, 상황에 맞는 안내를 정확히 드릴 수 있을 것 같아요.",
    "혹시 제가 놓친 부분이 있을까 봐 그러는데요, 한 번만 더 설명해 주시면 가능한 찾아보겠습니다.",
    "정확한 안내를 드리기 위해 조금만 더 알려주실 수 있을까요? 지금 필요한 도움을 알려주시면 더 잘 찾아볼 수 있을 것 같아요."
]


# 대화 종료 요청 키워드
SESSION_END_KEYWORDS = [
    "대화 그만",
    "꺼져",
    "대화 종료해",
    "대화 끝",
    "종료",
    "그만해",
    "닥쳐",
    "bye",
    "끝내자"
]

# 대화 종료 응답
SESSION_END_RESPONSE = "네, AI챗봇 대화 세션을 종료하겠습니다."


# 연구 논문 에이전트 안내 메시지
RESEARCH_AGENT_GUIDE = "연구 논문 전문분야의 답변을 원하신다면 '연구 논문' agent를 선택해 주세요."


class PersonaManager:
    """페르소나 관리자"""

    @classmethod
    def get_system_prompt(cls, profile_type: ProfileType = ProfileType.GENERAL) -> str:
        """
        프로필 유형별 시스템 프롬프트 생성

        Args:
            profile_type: 프로필 유형

        Returns:
            str: 시스템 프롬프트
        """
        base_prompt = SYSTEM_PROMPT

        # 프로필별 추가 지시
        profile_additions = {
            ProfileType.GENERAL: "\n일반인이 이해하기 쉽도록 전문 용어를 풀어서 설명하고, 실생활에서 적용 가능한 조언을 제공합니다.",
            ProfileType.PATIENT: "\n환자의 경험과 어려움에 공감하며, 실질적인 관리 방법과 병원 방문 시기 등을 안내합니다.",
            ProfileType.RESEARCHER: "\n연구자 수준의 전문적인 정보와 최신 가이드라인, 연구 동향을 제공합니다. 학술 용어 사용이 가능합니다."
        }

        return base_prompt + profile_additions.get(profile_type, "")

    @classmethod
    def get_few_shot_examples(
        cls,
        profile_type: ProfileType = ProfileType.GENERAL,
        count: int = 3
    ) -> List[Dict[str, str]]:
        """
        프로필 유형별 Few-shot 예시 반환

        Args:
            profile_type: 프로필 유형
            count: 반환할 예시 개수

        Returns:
            List[Dict]: Few-shot 예시 목록
        """
        user_type_map = {
            ProfileType.GENERAL: "일반인/간병인",
            ProfileType.PATIENT: "질환자/경험자",
            ProfileType.RESEARCHER: "연구자/전문가"
        }

        target_user_type = user_type_map.get(profile_type, "일반인/간병인")

        # 해당 프로필의 예시 우선 반환
        matching = [ex for ex in FEW_SHOT_EXAMPLES if ex["user_type"] == target_user_type]
        others = [ex for ex in FEW_SHOT_EXAMPLES if ex["user_type"] != target_user_type]

        return (matching + others)[:count]

    @classmethod
    def get_fallback_message(cls, attempt: int = 0) -> str:
        """
        Fallback 메시지 반환

        Args:
            attempt: 시도 횟수 (다른 메시지 선택용)

        Returns:
            str: Fallback 메시지
        """
        return FALLBACK_MESSAGES[attempt % len(FALLBACK_MESSAGES)]

    @classmethod
    def is_session_end_request(cls, text: str) -> bool:
        """
        대화 종료 요청인지 확인

        Args:
            text: 사용자 입력

        Returns:
            bool: 종료 요청 여부
        """
        text_lower = text.lower().strip()
        return any(keyword in text_lower for keyword in SESSION_END_KEYWORDS)

    @classmethod
    def get_session_end_response(cls) -> str:
        """대화 종료 응답 반환"""
        return SESSION_END_RESPONSE

    @classmethod
    def format_response_with_persona(
        cls,
        response: str,
        profile_type: ProfileType = ProfileType.GENERAL,
        add_empathy: bool = True
    ) -> str:
        """
        페르소나에 맞게 응답 포맷팅

        Args:
            response: 원본 응답
            profile_type: 프로필 유형
            add_empathy: 공감 표현 추가 여부

        Returns:
            str: 포맷팅된 응답
        """
        # 반말 체크 및 변환 (간단한 규칙 기반)
        informal_endings = ["해", "야", "냐", "어", "지", "다", "니"]
        formal_endings = ["해요", "에요", "나요", "어요", "지요", "습니다", "니다"]

        formatted = response

        # 공감 표현 추가 (과도하지 않게)
        empathy_starters = {
            ProfileType.GENERAL: "",
            ProfileType.PATIENT: "",
            ProfileType.RESEARCHER: ""
        }

        starter = empathy_starters.get(profile_type, "")
        if add_empathy and starter and not formatted.startswith(starter):
            # 질문이나 증상 언급 시에만 공감 표현 추가
            pass  # 현재는 스킵 (과도한 공감 방지)

        return formatted

    @classmethod
    def needs_research_agent_guide(
        cls,
        user_input: str,
        current_agent: str
    ) -> bool:
        """
        연구 논문 에이전트 안내가 필요한지 확인

        정책: 사용자가 복합의도로 질문하는 경우, 이미 선택한 agent를 변경하지 않고
        내장된 의도분류로 답변 처리. 단, '연구 논문'을 선택하지 않은 상태에서
        PubMed 답변을 원한다면 안내 메시지 제공

        Args:
            user_input: 사용자 입력
            current_agent: 현재 선택된 에이전트

        Returns:
            bool: 안내 필요 여부
        """
        research_keywords = [
            "논문", "연구", "pubmed", "study", "research",
            "가이드라인", "guideline", "KDIGO", "임상시험",
            "메타분석", "리뷰", "journal"
        ]

        user_input_lower = user_input.lower()
        wants_research = any(kw in user_input_lower for kw in research_keywords)

        return wants_research and current_agent != "Research_Paper"

    @classmethod
    def get_research_agent_guide(cls) -> str:
        """연구 논문 에이전트 안내 메시지 반환"""
        return RESEARCH_AGENT_GUIDE


# 싱글톤 인스턴스
persona_manager = PersonaManager()
