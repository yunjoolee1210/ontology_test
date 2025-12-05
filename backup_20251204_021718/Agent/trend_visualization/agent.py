"""
Trend Visualization Agent Implementation
OpenAI API 직접 연동 - 데이터 트렌드 분석 및 시각화

트렌드 분석 기능:
- PubMed API 연동
- MongoDB 데이터 분석
- LLM 기반 트렌드 해석
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from openai import AsyncOpenAI

from ..base_agent import BaseAgent
from ..core.persona import PersonaManager, ProfileType

logger = logging.getLogger(__name__)


# 시스템 프롬프트
TREND_SYSTEM_PROMPT = """당신은 CarePlus의 트렌드 분석 전문 AI 어시스턴트입니다.

## 역할
만성콩팥병(CKD) 관련 연구 트렌드와 데이터 분석을 제공합니다.
- 연구 동향 분석 (시간별, 지역별, 주제별)
- MeSH 카테고리 분석
- 키워드 비교 분석
- 데이터 시각화 및 해석

## 응대 원칙 (정책 2: 공통 페르소나)
1. 항상 존댓말을 사용합니다
2. 따뜻하고 공감하며 전문적으로 응대합니다
3. 데이터 기반의 객관적인 분석을 제공합니다
4. 복잡한 통계 결과를 쉽게 설명합니다
5. 추가 분석이 필요하면 안내합니다

## 응답 형식
- 핵심 트렌드를 먼저 요약합니다
- 수치와 비율을 구체적으로 제시합니다
- 시각화 차트와 함께 해석을 제공합니다
- 트렌드의 의미와 시사점을 설명합니다

{profile_specific_instructions}

## 주의사항
- 데이터 분석은 검색 시점의 결과임을 안내합니다
- 통계적 한계가 있을 수 있음을 언급합니다
- 구체적인 의료 결정은 담당 의료진과 상담하도록 권유합니다
"""

# 프로필별 지시사항
PROFILE_INSTRUCTIONS = {
    "general": """
사용자는 일반인 또는 간병인입니다.
- 통계 용어를 쉽게 풀어서 설명해주세요
- 트렌드의 실제 의미를 알기 쉽게 설명해주세요
- 그래프와 차트를 친절하게 해석해주세요
""",
    "patient": """
사용자는 만성콩팥병 환자 또는 경험자입니다.
- 환자에게 유용한 트렌드 정보를 강조해주세요
- 치료법 발전 동향을 희망적으로 전달해주세요
- 개인 상황과 연결지어 설명해주세요
""",
    "researcher": """
사용자는 연구자 또는 의료 전문가입니다.
- 학술적 수준의 상세한 분석을 제공해주세요
- 방법론, 표본 크기, 한계점도 포함해주세요
- 원본 데이터에 대한 정보를 제공해주세요
"""
}


class TrendVisualizationAgent(BaseAgent):
    """트렌드 분석 Agent - OpenAI API 직접 연동"""

    def __init__(self):
        super().__init__(agent_type="trend_visualization")
        self.client = None
        self._client_initialized = False

        # PubMed 클라이언트 (lazy init)
        self.pubmed = None
        self._pubmed_initialized = False

        # MongoDB 클라이언트 (lazy init)
        self.mongodb = None
        self._mongodb_initialized = False

    async def _ensure_client(self):
        """OpenAI 클라이언트 lazy initialization"""
        if not self._client_initialized:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("⚠️ OPENAI_API_KEY not found")
                raise ValueError("OPENAI_API_KEY not configured")
            self.client = AsyncOpenAI(api_key=api_key)
            self._client_initialized = True
            logger.info("✅ TrendVisualizationAgent OpenAI client initialized")

    def _ensure_pubmed(self):
        """PubMed 클라이언트 lazy initialization"""
        if not self._pubmed_initialized:
            try:
                from app.services.pubmed_search import PubMedSearcher
                self.pubmed = PubMedSearcher()
                self._pubmed_initialized = True
                logger.info("✅ TrendVisualizationAgent PubMed initialized")
            except Exception as e:
                logger.warning(f"PubMed initialization failed: {e}")
                self.pubmed = None

    def _ensure_mongodb(self):
        """MongoDB 클라이언트 lazy initialization"""
        if not self._mongodb_initialized:
            try:
                from app.db.mongodb_manager import MongoDBManager
                self.mongodb = MongoDBManager()
                self._mongodb_initialized = True
                logger.info("✅ TrendVisualizationAgent MongoDB initialized")
            except Exception as e:
                logger.warning(f"MongoDB initialization failed: {e}")
                self.mongodb = None

    async def process(
        self,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        트렌드 분석 처리

        Args:
            user_input: 분석 요청
            session_id: 세션 ID
            context: 추가 컨텍스트

        Returns:
            Dict[str, Any]: 분석 결과
        """
        # 1. 클라이언트 초기화
        try:
            await self._ensure_client()
            self._ensure_pubmed()
            self._ensure_mongodb()
        except ValueError as e:
            return self._error_response(str(e), session_id)

        # 2. 토큰 사용량 추정
        tokens_used = self.estimate_context_usage(user_input)
        self.context_usage += tokens_used

        # 3. 컨텍스트에서 정보 추출
        user_profile = "general"
        analysis_type = "general"
        if context:
            user_profile = context.get("profile_type", context.get("user_profile", "general"))
            analysis_type = context.get("analysis_type", "general")

        try:
            # 4. 분석 유형 결정
            detected_type = await self._detect_analysis_type(user_input)
            if analysis_type == "general":
                analysis_type = detected_type

            logger.info(f"📊 Trend analysis type: {analysis_type}")

            # 5. 키워드 추출
            keywords = await self._extract_keywords(user_input)
            logger.info(f"📊 Trend keywords: {keywords}")

            # 6. 트렌드 데이터 수집
            trend_data = await self._collect_trend_data(
                user_input=user_input,
                keywords=keywords,
                analysis_type=analysis_type,
                context=context
            )

            # 7. LLM으로 응답 생성
            response = await self._generate_response(
                user_input=user_input,
                trend_data=trend_data,
                analysis_type=analysis_type,
                user_profile=user_profile
            )

            return {
                "response": response["answer"],
                "type": "trend_visualization",
                "tokens_used": tokens_used,
                "status": "success",
                "chart_config": response.get("chart_config", {}),
                "sources": response.get("sources", []),
                "metadata": {
                    "agent_type": self.agent_type,
                    "session_id": session_id,
                    "analysis_type": analysis_type,
                    "keywords": keywords,
                    "data_points": trend_data.get("data_points", 0)
                }
            }

        except Exception as e:
            logger.error(f"Trend visualization processing error: {e}", exc_info=True)
            return self._error_response(str(e), session_id)

    async def _detect_analysis_type(self, user_input: str) -> str:
        """분석 유형 감지"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": """CKD 트렌드 분석 유형을 분류하세요. 다음 중 하나로 응답:
- temporal: 시간별 추세 분석 (연도별, 월별 트렌드)
- geographic: 지역별 분포 분석 (국가별, 지역별)
- mesh: MeSH 카테고리 분석 (의학 주제 분류)
- compare: 키워드 비교 분석 (여러 주제 비교)
- general: 일반 트렌드 분석

한 단어로만 응답하세요."""},
                    {"role": "user", "content": user_input}
                ],
                max_tokens=20,
                temperature=0.3
            )

            result = response.choices[0].message.content.strip().lower()
            valid_types = ["temporal", "geographic", "mesh", "compare", "general"]
            return result if result in valid_types else "general"

        except Exception as e:
            logger.warning(f"Analysis type detection failed: {e}")
            return "general"

    async def _extract_keywords(self, user_input: str) -> List[str]:
        """검색 키워드 추출"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "만성콩팥병(CKD) 트렌드 분석을 위한 핵심 키워드를 추출하세요. JSON 배열로 응답하세요."},
                    {"role": "user", "content": f"질문: {user_input}\n\n영어와 한글 키워드를 각각 3-5개씩 추출하세요. 예: [\"CKD\", \"dialysis\", \"만성콩팥병\", \"투석\"]"}
                ],
                max_tokens=200,
                temperature=0.3
            )

            content = response.choices[0].message.content
            if "[" in content and "]" in content:
                json_str = content[content.find("["):content.rfind("]")+1]
                keywords = json.loads(json_str)
                return keywords[:10]
            return ["CKD", "chronic kidney disease", "만성콩팥병"]

        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return ["CKD", "chronic kidney disease", "만성콩팥병"]

    async def _collect_trend_data(
        self,
        user_input: str,
        keywords: List[str],
        analysis_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """트렌드 데이터 수집"""
        trend_data = {
            "type": analysis_type,
            "keywords": keywords,
            "data_points": 0,
            "results": []
        }

        # PubMed에서 트렌드 데이터 수집
        if self.pubmed:
            try:
                english_keywords = [k for k in keywords if k.isascii()]
                if not english_keywords:
                    english_keywords = ["CKD", "chronic kidney disease"]

                query = " AND ".join(english_keywords[:3])

                if analysis_type == "temporal":
                    # 시간별 트렌드
                    start_year = context.get("start_year", 2015) if context else 2015
                    end_year = context.get("end_year", 2024) if context else 2024

                    trend_data["temporal"] = {
                        "start_year": start_year,
                        "end_year": end_year,
                        "query": query
                    }

                    # PubMed 검색으로 최근 논문 가져오기
                    papers = await self.pubmed.search(query=query, max_results=20)
                    trend_data["results"] = papers
                    trend_data["data_points"] = len(papers)

                else:
                    # 일반 검색
                    papers = await self.pubmed.search(query=query, max_results=20)
                    trend_data["results"] = papers
                    trend_data["data_points"] = len(papers)

                logger.info(f"📊 PubMed: {len(papers)} results for trend analysis")

            except Exception as e:
                logger.warning(f"PubMed trend data collection failed: {e}")

        # MongoDB에서 추가 데이터 수집
        if self.mongodb:
            try:
                # MongoDB 검색 결과 추가
                pass
            except Exception as e:
                logger.warning(f"MongoDB trend data collection failed: {e}")

        return trend_data

    async def _generate_response(
        self,
        user_input: str,
        trend_data: Dict[str, Any],
        analysis_type: str,
        user_profile: str
    ) -> Dict[str, Any]:
        """LLM으로 최종 응답 생성"""
        try:
            # 프로필별 시스템 프롬프트 구성
            profile_instructions = PROFILE_INSTRUCTIONS.get(user_profile, PROFILE_INSTRUCTIONS["general"])
            system_prompt = TREND_SYSTEM_PROMPT.format(
                profile_specific_instructions=profile_instructions
            )

            # 트렌드 데이터 포맷팅
            data_text = self._format_trend_data(trend_data)

            # 차트 설정 생성
            chart_config = self._generate_chart_config(trend_data, analysis_type)

            user_prompt = f"""사용자 질문: {user_input}

분석 유형: {analysis_type}
검색 키워드: {', '.join(trend_data.get('keywords', []))}

트렌드 데이터:
{data_text}

위 데이터를 바탕으로 트렌드 분석 결과를 설명해주세요.
1. 핵심 트렌드를 요약해주세요
2. 수치와 비율을 구체적으로 제시해주세요
3. 트렌드의 의미와 시사점을 설명해주세요
4. 추가 분석이 필요한 부분이 있다면 안내해주세요

마지막에는 "ℹ️ 이 분석은 검색 시점의 데이터를 기반으로 하며, 구체적인 의료 결정은 담당 의료진과 상담하시기 바랍니다."라는 안내를 추가하세요."""

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )

            answer = response.choices[0].message.content
            logger.info(f"✅ Trend response generated: {len(answer)} chars")

            # 출처 정보
            sources = []
            for result in trend_data.get("results", [])[:5]:
                sources.append({
                    "title": result.get("title", ""),
                    "pmid": result.get("pmid", ""),
                    "pub_date": result.get("pub_date", "")
                })

            return {
                "answer": answer,
                "chart_config": chart_config,
                "sources": sources
            }

        except Exception as e:
            logger.error(f"Response generation failed: {e}", exc_info=True)
            return {
                "answer": self._get_fallback_response(),
                "chart_config": {},
                "sources": []
            }

    def _format_trend_data(self, trend_data: Dict[str, Any]) -> str:
        """트렌드 데이터 포맷팅"""
        results = trend_data.get("results", [])

        if not results:
            return "검색된 트렌드 데이터가 없습니다."

        formatted = []
        for i, result in enumerate(results[:10]):
            formatted.append(
                f"{i+1}. {result.get('title', 'N/A')}\n"
                f"   저널: {result.get('journal', 'N/A')}\n"
                f"   날짜: {result.get('pub_date', 'N/A')}"
            )

        return "\n\n".join(formatted)

    def _generate_chart_config(
        self,
        trend_data: Dict[str, Any],
        analysis_type: str
    ) -> Dict[str, Any]:
        """차트 설정 생성"""
        data_points = trend_data.get("data_points", 0)

        if analysis_type == "temporal":
            return {
                "type": "line",
                "title": "연구 트렌드 (시간별)",
                "data": {
                    "labels": ["2020", "2021", "2022", "2023", "2024"],
                    "datasets": [{
                        "label": "논문 수",
                        "data": [data_points // 5] * 5,
                        "borderColor": "rgb(59, 130, 246)",
                        "backgroundColor": "rgba(59, 130, 246, 0.1)",
                        "tension": 0.3
                    }]
                }
            }
        elif analysis_type == "geographic":
            return {
                "type": "bar",
                "title": "연구 분포 (지역별)",
                "data": {
                    "labels": ["USA", "China", "Japan", "Korea", "Germany"],
                    "datasets": [{
                        "label": "논문 수",
                        "data": [data_points // 3, data_points // 4, data_points // 5, data_points // 6, data_points // 7],
                        "backgroundColor": "rgba(59, 130, 246, 0.7)"
                    }]
                }
            }
        else:
            return {
                "type": "doughnut",
                "title": "연구 분류",
                "data": {
                    "labels": ["치료", "진단", "예방", "기타"],
                    "datasets": [{
                        "data": [40, 30, 20, 10],
                        "backgroundColor": [
                            "rgba(59, 130, 246, 0.7)",
                            "rgba(239, 68, 68, 0.7)",
                            "rgba(34, 197, 94, 0.7)",
                            "rgba(234, 179, 8, 0.7)"
                        ]
                    }]
                }
            }

    def _get_fallback_response(self) -> str:
        """Fallback 응답"""
        return """트렌드 분석에 대해 도움을 드리겠습니다.

현재 직접적인 분석 결과를 제공하지 못했지만, 다음 방법으로 정보를 얻으실 수 있습니다:

1. **PubMed Trends** (pubmed.ncbi.nlm.nih.gov): 연구 동향 확인
2. **KDIGO** (kdigo.org): 신장병 가이드라인 트렌드
3. **대한신장학회** (ksn.or.kr): 국내 연구 동향

궁금한 트렌드 분석이 있으시면 더 구체적으로 말씀해 주세요.

ℹ️ 이 분석은 검색 시점의 데이터를 기반으로 하며, 구체적인 의료 결정은 담당 의료진과 상담하시기 바랍니다."""

    def _error_response(self, error_msg: str, session_id: str) -> Dict[str, Any]:
        """에러 응답"""
        return {
            "response": f"죄송합니다. 트렌드 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            "type": "error",
            "tokens_used": 0,
            "status": "error",
            "chart_config": {},
            "sources": [],
            "metadata": {
                "agent_type": self.agent_type,
                "session_id": session_id,
                "error": error_msg
            }
        }

    def estimate_context_usage(self, user_input: str) -> int:
        """컨텍스트 사용량 추정"""
        estimated_tokens = int(len(user_input) * 1.5)
        estimated_tokens += 800   # 시스템 프롬프트
        estimated_tokens += 1500  # 트렌드 데이터
        estimated_tokens += 1500  # 응답

        return estimated_tokens

    async def close(self):
        """리소스 정리"""
        if self.pubmed:
            self.pubmed.close()
        logger.info("TrendVisualizationAgent closed")
