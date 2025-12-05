"""
HuggingFace PubMed Dataset Search Service

HuggingFace Datasets API를 통해 ncbi/pubmed 데이터셋 조회
- Dataset: https://huggingface.co/datasets/ncbi/pubmed
- API: https://huggingface.co/api/datasets/ncbi/pubmed/rows

연구/논문 검색 챗봇의 PubMed 논문 조회에 사용
"""

import os
import asyncio
import httpx
import logging
import re
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from functools import lru_cache

logger = logging.getLogger(__name__)

# HuggingFace API 설정
HF_API_BASE = "https://huggingface.co/api/datasets/ncbi/pubmed"
HF_ROWS_ENDPOINT = f"{HF_API_BASE}/rows"

# 연구/논문 관련 키워드 카테고리
RESEARCH_KEYWORDS = {
    "질환": [
        "만성콩팥병", "CKD", "chronic kidney disease", "신부전", "renal failure",
        "당뇨병", "diabetes", "고혈압", "hypertension", "심혈관", "cardiovascular",
        "투석", "dialysis", "신장이식", "kidney transplant", "사구체신염", "glomerulonephritis",
        "단백뇨", "proteinuria", "신증후군", "nephrotic syndrome"
    ],
    "치료": [
        "치료", "treatment", "therapy", "약물", "drug", "medication",
        "수술", "surgery", "intervention", "관리", "management",
        "예방", "prevention", "재활", "rehabilitation"
    ],
    "영양": [
        "영양", "nutrition", "식이", "diet", "dietary",
        "단백질", "protein", "나트륨", "sodium", "칼륨", "potassium",
        "인", "phosphorus", "칼로리", "calorie", "식단", "meal"
    ],
    "연구": [
        "연구", "research", "study", "trial", "clinical",
        "논문", "paper", "article", "review", "meta-analysis",
        "가이드라인", "guideline", "evidence", "outcome"
    ]
}


@dataclass
class PubMedArticle:
    """PubMed 논문 데이터 구조"""
    pmid: str
    title: str
    abstract: str
    authors: List[str]
    journal: str
    pub_date: str
    doi: str
    mesh_terms: List[str]
    relevance_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "title": self.title,
            "abstract": self.abstract,
            "authors": self.authors,
            "journal": self.journal,
            "pub_date": self.pub_date,
            "doi": self.doi,
            "mesh_terms": self.mesh_terms,
            "relevance_score": self.relevance_score,
            "source": "HuggingFace PubMed"
        }


class HuggingFacePubMedSearcher:
    """
    HuggingFace PubMed Dataset 검색 서비스

    사용자 발화에서 질환, 치료, 영양 등 연구 관련 키워드를 추출하고
    HuggingFace API를 통해 PubMed 데이터셋을 조회합니다.
    """

    def __init__(self, api_token: Optional[str] = None):
        """
        초기화

        Args:
            api_token: HuggingFace API 토큰 (환경변수 HF_API_TOKEN에서도 읽음)
        """
        self.api_token = api_token or os.getenv("HF_API_TOKEN")
        if not self.api_token:
            logger.warning("HF_API_TOKEN not found. API calls may be rate-limited.")

        self.timeout = httpx.Timeout(30.0, connect=10.0)

    def _get_headers(self) -> Dict[str, str]:
        """API 요청 헤더 생성"""
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    def extract_keywords(self, user_input: str) -> Dict[str, List[str]]:
        """
        사용자 발화에서 연구 관련 키워드 추출

        Args:
            user_input: 사용자 입력 텍스트

        Returns:
            카테고리별 추출된 키워드
        """
        extracted = {
            "질환": [],
            "치료": [],
            "영양": [],
            "연구": []
        }

        user_input_lower = user_input.lower()

        for category, keywords in RESEARCH_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in user_input_lower:
                    if keyword not in extracted[category]:
                        extracted[category].append(keyword)

        return extracted

    def calculate_relevance_score(
        self,
        article: Dict[str, Any],
        query_keywords: List[str]
    ) -> float:
        """
        논문의 관련성 점수 계산

        Args:
            article: 논문 데이터
            query_keywords: 검색 키워드 목록

        Returns:
            0.0 ~ 1.0 사이의 관련성 점수
        """
        if not query_keywords:
            return 0.5

        score = 0.0
        title = (article.get("title") or "").lower()
        abstract = (article.get("abstract") or "").lower()
        mesh_terms = " ".join(article.get("mesh_terms") or []).lower()

        total_weight = 0.0

        for keyword in query_keywords:
            keyword_lower = keyword.lower()

            # 제목에 포함 (가중치 높음)
            if keyword_lower in title:
                score += 0.4
                total_weight += 0.4

            # 초록에 포함
            if keyword_lower in abstract:
                # 초록에서 키워드 등장 횟수에 따른 가중치
                count = abstract.count(keyword_lower)
                score += min(0.3, 0.1 * count)
                total_weight += 0.3

            # MeSH terms에 포함
            if keyword_lower in mesh_terms:
                score += 0.2
                total_weight += 0.2

        # 정규화
        if total_weight > 0:
            normalized_score = min(1.0, score / (len(query_keywords) * 0.5))
        else:
            normalized_score = 0.0

        return round(normalized_score, 3)

    async def search(
        self,
        user_input: str,
        max_results: int = 5,
        config: str = "default",
        split: str = "train"
    ) -> Dict[str, Any]:
        """
        HuggingFace PubMed 데이터셋 검색

        Args:
            user_input: 사용자 검색 쿼리
            max_results: 최대 결과 수 (기본 5개)
            config: 데이터셋 config
            split: 데이터셋 split

        Returns:
            검색 결과 (요약 + 논문 목록)
        """
        # 1. 키워드 추출
        extracted_keywords = self.extract_keywords(user_input)
        all_keywords = []
        for keywords in extracted_keywords.values():
            all_keywords.extend(keywords)

        if not all_keywords:
            # 키워드가 없으면 기본 CKD 관련 검색
            all_keywords = ["chronic kidney disease", "CKD"]

        logger.info(f"Extracted keywords: {all_keywords}")

        # 2. HuggingFace API 호출
        try:
            articles = await self._fetch_from_hf_api(
                keywords=all_keywords,
                max_results=max_results * 3,  # 필터링을 위해 더 많이 가져옴
                config=config,
                split=split
            )
        except Exception as e:
            logger.error(f"HuggingFace API error: {e}")
            articles = []

        # 3. 관련성 점수 계산 및 정렬
        for article in articles:
            article["relevance_score"] = self.calculate_relevance_score(
                article, all_keywords
            )

        # 관련성 점수 내림차순 정렬
        articles.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        # 상위 5개 선택
        top_articles = articles[:max_results]

        # 4. 상위 3개 초록 요약 생성 (190단어 이내)
        summary = self._generate_summary(top_articles[:3])

        return {
            "success": True,
            "summary": summary,
            "papers": top_articles,
            "keywords_used": all_keywords,
            "total_found": len(articles)
        }

    async def _fetch_from_hf_api(
        self,
        keywords: List[str],
        max_results: int = 15,
        config: str = "default",
        split: str = "train"
    ) -> List[Dict[str, Any]]:
        """
        HuggingFace API에서 데이터 가져오기

        Args:
            keywords: 검색 키워드
            max_results: 최대 결과 수
            config: 데이터셋 config
            split: 데이터셋 split

        Returns:
            논문 데이터 목록
        """
        params = {
            "config": config,
            "split": split,
            "offset": 0,
            "length": max_results
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                HF_ROWS_ENDPOINT,
                params=params,
                headers=self._get_headers()
            )
            response.raise_for_status()
            data = response.json()

        articles = []
        rows = data.get("rows", [])

        for row in rows:
            row_data = row.get("row", {})

            # 키워드 필터링 - 최소 하나의 키워드가 포함된 논문만
            title = (row_data.get("title") or "").lower()
            abstract = (row_data.get("abstract") or "").lower()

            matches_keyword = False
            for keyword in keywords:
                if keyword.lower() in title or keyword.lower() in abstract:
                    matches_keyword = True
                    break

            if not matches_keyword:
                continue

            article = {
                "pmid": row_data.get("pmid", ""),
                "title": row_data.get("title", ""),
                "abstract": row_data.get("abstract", ""),
                "authors": self._parse_authors(row_data.get("authors", "")),
                "journal": row_data.get("journal", ""),
                "pub_date": row_data.get("pub_date", ""),
                "doi": row_data.get("doi", ""),
                "mesh_terms": row_data.get("mesh_terms", []),
                "relevance_score": 0.0
            }
            articles.append(article)

        logger.info(f"Fetched {len(articles)} relevant articles from HuggingFace")
        return articles

    def _parse_authors(self, authors_data: Any) -> List[str]:
        """저자 정보 파싱"""
        if isinstance(authors_data, list):
            return authors_data[:5]  # 최대 5명
        elif isinstance(authors_data, str):
            # 쉼표로 구분된 문자열인 경우
            return [a.strip() for a in authors_data.split(",")][:5]
        return []

    def _generate_summary(self, articles: List[Dict[str, Any]]) -> str:
        """
        상위 3개 논문 초록을 190단어 이내로 요약

        Args:
            articles: 상위 논문 목록

        Returns:
            요약 텍스트
        """
        if not articles:
            return "관련 연구 논문을 찾지 못했습니다."

        # 각 논문에서 핵심 문장 추출
        summaries = []

        for i, article in enumerate(articles[:3]):
            title = article.get("title", "")
            abstract = article.get("abstract", "")

            if not abstract:
                continue

            # 초록에서 첫 2문장 추출 (보통 목적과 방법 포함)
            sentences = re.split(r'[.!?]\s+', abstract)
            key_sentences = sentences[:2] if len(sentences) >= 2 else sentences

            summary_text = f"[{i+1}] {title[:50]}{'...' if len(title) > 50 else ''}: "
            summary_text += ". ".join(key_sentences)[:150]
            summaries.append(summary_text)

        # 전체 요약 (190단어 제한)
        full_summary = " ".join(summaries)
        words = full_summary.split()

        if len(words) > 190:
            full_summary = " ".join(words[:190]) + "..."

        return full_summary

    async def search_by_category(
        self,
        category: str,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        카테고리별 검색

        Args:
            category: 검색 카테고리 (질환, 치료, 영양, 연구)
            max_results: 최대 결과 수

        Returns:
            검색 결과
        """
        if category not in RESEARCH_KEYWORDS:
            category = "질환"  # 기본값

        keywords = RESEARCH_KEYWORDS[category][:5]  # 상위 5개 키워드

        return await self.search(
            user_input=" ".join(keywords),
            max_results=max_results
        )


# 싱글톤 인스턴스
_hf_pubmed_searcher: Optional[HuggingFacePubMedSearcher] = None


def get_hf_pubmed_searcher() -> HuggingFacePubMedSearcher:
    """싱글톤 HuggingFacePubMedSearcher 인스턴스 반환"""
    global _hf_pubmed_searcher
    if _hf_pubmed_searcher is None:
        _hf_pubmed_searcher = HuggingFacePubMedSearcher()
    return _hf_pubmed_searcher


# 테스트 함수
async def test_hf_pubmed_search():
    """HuggingFace PubMed 검색 테스트"""
    searcher = HuggingFacePubMedSearcher()

    test_queries = [
        "만성콩팥병 치료 연구",
        "CKD diet nutrition",
        "투석 환자 영양 관리"
    ]

    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: {query}")
        print("="*60)

        result = await searcher.search(query, max_results=5)

        print(f"\n요약 (190단어 이내):\n{result['summary']}")
        print(f"\n사용된 키워드: {result['keywords_used']}")
        print(f"\n검색된 논문 수: {result['total_found']}")

        print("\n상위 5개 논문 (relevance 내림차순):")
        for i, paper in enumerate(result['papers'], 1):
            print(f"\n{i}. [{paper['relevance_score']:.3f}] {paper['title'][:60]}...")
            print(f"   PMID: {paper['pmid']}")
            print(f"   Journal: {paper['journal']}")


if __name__ == "__main__":
    asyncio.run(test_hf_pubmed_search())
