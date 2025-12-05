"""
Response Merger (응답 병합기)

정책 7-7: 응답 병합 (중복 제거 → 우선순위 정렬 → 단일 응답 생성)
정책 7-8: 최종 응답에 공통 퍼소나·톤앤매너 + 의료 안전 로직 재적용

여러 에이전트의 응답을 하나의 따뜻한 목소리로 통합
"""

import re
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum

from .persona import PersonaManager, ProfileType
from .medical_safety_filter import MedicalSafetyFilter, RiskLevel

logger = logging.getLogger(__name__)


class AgentPriority(Enum):
    """에이전트 우선순위 (응급 상황 기준)"""
    MEDICAL_WELFARE = 1    # 의료 안전 최우선
    NUTRITION = 2          # 식이 관련 두 번째
    RESEARCH_PAPER = 3     # 연구 정보 세 번째
    QUIZ = 4               # 퀴즈 가장 낮음


@dataclass
class MergedResponse:
    """병합된 응답"""
    response: str
    agents_used: List[str]
    sources: List[Dict[str, Any]]
    has_safety_warning: bool
    risk_level: RiskLevel
    tokens_used: int


class ResponseMerger:
    """응답 병합기"""

    # 에이전트별 응답 섹션 포맷
    SECTION_FORMATS = {
        "Medical_Welfare": "🏥 {content}",
        "medical_welfare": "🏥 {content}",
        "Nutrition": "🥗 {content}",
        "nutrition": "🥗 {content}",
        "Research_Paper": "📚 {content}",
        "research_paper": "📚 {content}",
        "Quiz": "❓ {content}",
        "quiz": "❓ {content}",
        "trend_visualization": "📊 {content}"
    }

    # 중복 제거 기준 문구
    DUPLICATE_PATTERNS = [
        r"의료진과 상담하시[기는]?",
        r"담당 의사와",
        r"병원에 방문하시",
        r"전문가와 상담"
    ]

    def __init__(self):
        """응답 병합기 초기화"""
        self.persona_manager = PersonaManager()
        self.safety_filter = MedicalSafetyFilter()
        self._compile_duplicate_patterns()

    def _compile_duplicate_patterns(self):
        """중복 패턴 컴파일"""
        self.compiled_duplicates = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.DUPLICATE_PATTERNS
        ]

    def merge_responses(
        self,
        agent_results: Dict[str, Dict[str, Any]],
        user_input: str,
        profile_type: ProfileType = ProfileType.GENERAL,
        safety_result: Optional[Any] = None
    ) -> MergedResponse:
        """
        여러 에이전트 응답을 하나로 병합

        정책 7-7: 응답 병합
        - 중복 제거
        - 우선순위 정렬
        - 단일 응답 생성

        정책 7-8: 최종 응답에 공통 퍼소나·톤앤매너 + 의료 안전 로직 재적용

        Args:
            agent_results: 에이전트별 응답 결과
            user_input: 사용자 입력 (위험도 판단용)
            profile_type: 프로필 유형
            safety_result: 사전 안전 검사 결과

        Returns:
            MergedResponse: 병합된 응답
        """
        if not agent_results:
            return MergedResponse(
                response=self.persona_manager.get_fallback_message(),
                agents_used=[],
                sources=[],
                has_safety_warning=False,
                risk_level=RiskLevel.LOW,
                tokens_used=0
            )

        # 1. 우선순위별 정렬
        sorted_agents = self._sort_by_priority(agent_results.keys())

        # 2. 응답 수집 및 중복 제거
        response_parts: List[str] = []
        all_sources: List[Dict[str, Any]] = []
        total_tokens = 0
        used_phrases: set = set()

        for agent_type in sorted_agents:
            result = agent_results.get(agent_type, {})

            # 응답 텍스트 추출
            response_text = (
                result.get("response") or
                result.get("answer") or
                result.get("content", "")
            )

            if not response_text:
                continue

            # 중복 문구 제거
            cleaned_response = self._remove_duplicates(
                response_text,
                used_phrases
            )

            if cleaned_response.strip():
                # 섹션 포맷 적용 (여러 에이전트인 경우만)
                if len(sorted_agents) > 1:
                    formatted = self.SECTION_FORMATS.get(
                        agent_type,
                        "{content}"
                    ).format(content=cleaned_response)
                else:
                    formatted = cleaned_response

                response_parts.append(formatted)

            # 출처 수집
            sources = result.get("sources", [])
            papers = result.get("papers", [])
            all_sources.extend(sources)
            all_sources.extend(papers)

            # 토큰 수 합산
            total_tokens += result.get("tokens_used", 0)

        # 3. 응답 통합
        if len(response_parts) > 1:
            combined_response = "\n\n".join(response_parts)
        elif response_parts:
            combined_response = response_parts[0]
        else:
            combined_response = self.persona_manager.get_fallback_message()

        # 4. 의료 안전 필터 적용
        risk_level = RiskLevel.LOW
        has_safety_warning = False

        if safety_result:
            risk_level = safety_result.risk_level
            has_safety_warning = safety_result.should_refer_to_doctor
        else:
            # 입력과 응답 모두 안전 체크
            input_check = self.safety_filter.check_input_safety(user_input)
            risk_level = input_check.risk_level
            has_safety_warning = input_check.should_refer_to_doctor

        # 안전 필터 적용
        combined_response = self.safety_filter.filter_response(
            combined_response,
            risk_level
        )

        # 5. 페르소나 톤앤매너 최종 적용
        final_response = self.persona_manager.format_response_with_persona(
            combined_response,
            profile_type
        )

        # 6. 의료 면책 조항 (필요시 추가)
        if risk_level in [RiskLevel.LOW, RiskLevel.MEDIUM]:
            final_response = self.safety_filter.add_medical_disclaimer(
                final_response,
                add_disclaimer=self._needs_disclaimer(combined_response)
            )

        return MergedResponse(
            response=final_response,
            agents_used=sorted_agents,
            sources=self._deduplicate_sources(all_sources),
            has_safety_warning=has_safety_warning,
            risk_level=risk_level,
            tokens_used=total_tokens
        )

    def _sort_by_priority(self, agents: List[str]) -> List[str]:
        """
        에이전트를 우선순위별로 정렬

        Args:
            agents: 에이전트 목록

        Returns:
            List[str]: 정렬된 에이전트 목록
        """
        priority_map = {
            "Medical_Welfare": 1,
            "medical_welfare": 1,
            "Nutrition": 2,
            "nutrition": 2,
            "Research_Paper": 3,
            "research_paper": 3,
            "Quiz": 4,
            "quiz": 4,
            "trend_visualization": 5
        }

        return sorted(
            agents,
            key=lambda x: priority_map.get(x, 99)
        )

    def _remove_duplicates(
        self,
        text: str,
        used_phrases: set
    ) -> str:
        """
        중복 문구 제거

        Args:
            text: 원본 텍스트
            used_phrases: 이미 사용된 문구 집합

        Returns:
            str: 중복 제거된 텍스트
        """
        result = text

        # 컴파일된 패턴으로 중복 체크
        for pattern in self.compiled_duplicates:
            matches = pattern.findall(result)
            for match in matches:
                if match in used_phrases:
                    # 이미 사용된 문구면 제거
                    result = result.replace(match, "", 1)
                else:
                    used_phrases.add(match)

        # 연속 공백/줄바꿈 정리
        result = re.sub(r'\n\s*\n\s*\n', '\n\n', result)
        result = re.sub(r'  +', ' ', result)

        return result.strip()

    def _deduplicate_sources(
        self,
        sources: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        출처 중복 제거

        Args:
            sources: 출처 목록

        Returns:
            List[Dict]: 중복 제거된 출처
        """
        seen = set()
        unique_sources = []

        for source in sources:
            # 제목 또는 URL 기준 중복 체크
            key = source.get("title") or source.get("url") or str(source)
            if key not in seen:
                seen.add(key)
                unique_sources.append(source)

        return unique_sources

    def _needs_disclaimer(self, response: str) -> bool:
        """
        면책 조항 필요 여부 판단

        Args:
            response: 응답 텍스트

        Returns:
            bool: 면책 조항 필요 여부
        """
        # 이미 의료진 언급이 있으면 스킵
        doctor_keywords = ["의료진", "담당 의사", "병원", "전문의", "상담"]
        if any(kw in response for kw in doctor_keywords):
            return False

        # 의학적 내용이 포함된 경우 면책 필요
        medical_keywords = [
            "약", "치료", "증상", "수치", "검사", "진단",
            "복용", "섭취", "권장", "주의"
        ]
        return any(kw in response for kw in medical_keywords)

    def format_single_agent_response(
        self,
        agent_type: str,
        result: Dict[str, Any],
        profile_type: ProfileType = ProfileType.GENERAL,
        safety_result: Optional[Any] = None
    ) -> MergedResponse:
        """
        단일 에이전트 응답 포맷팅

        Args:
            agent_type: 에이전트 유형
            result: 응답 결과
            profile_type: 프로필 유형
            safety_result: 안전 검사 결과

        Returns:
            MergedResponse: 포맷팅된 응답
        """
        return self.merge_responses(
            {agent_type: result},
            user_input="",
            profile_type=profile_type,
            safety_result=safety_result
        )


# 싱글톤 인스턴스
response_merger = ResponseMerger()
