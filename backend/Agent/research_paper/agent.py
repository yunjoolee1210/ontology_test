"""
Research Paper Agent Implementation
Uses OpenAI + MongoDB + Pinecone for hybrid search (Parlant removed)
"""

import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging
import os
import asyncio

# Add backend path for imports
backend_path = Path(__file__).parent.parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from openai import AsyncOpenAI
from Agent.base_agent import BaseAgent
from Agent.core.contracts import AgentRequest, AgentResponse
from app.services.hybrid_search import OptimizedHybridSearchEngine

logger = logging.getLogger(__name__)


class ResearchPaperAgent(BaseAgent):
    """
    Research Paper Agent
    Uses OpenAI for LLM responses and hybrid search for document retrieval
    """

    # System prompt for medical Q&A
    SYSTEM_PROMPT = """당신은 만성신장질환(CKD) 전문 의료 정보 AI 어시스턴트 'CareGuide'입니다.

역할:
- 신장 질환 관련 의학 정보를 정확하고 이해하기 쉽게 전달
- 검색된 의료 문서와 연구 논문을 기반으로 답변 생성
- 환자와 보호자가 이해할 수 있는 친절한 설명 제공

답변 원칙:
1. 검색된 자료를 기반으로 정확한 정보 제공
2. 의학 용어는 쉬운 설명과 함께 사용
3. 출처가 있는 정보는 명시
4. 불확실한 내용은 솔직히 인정
5. 항상 전문의 상담을 권장

프로필별 답변 스타일:
- general: 일반인 눈높이, 쉬운 용어, 친절한 설명
- patient: 환자 중심, 실생활 적용 가능한 조언, 공감적 어조
- researcher: 전문 용어 사용, 학술적 근거 중심, 참고문헌 명시

⚠️ 주의사항: 이 정보는 교육 목적이며, 실제 진료나 치료를 대체할 수 없습니다.
건강 문제가 있으시면 반드시 의료 전문가와 상담하세요."""

    def __init__(self):
        super().__init__(agent_type="research_paper")
        self._initialized = False
        self._openai_client = None
        self._search_engine = None

    async def _initialize(self):
        """Initialize OpenAI client and search engine"""
        if not self._initialized:
            # Initialize OpenAI client
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment variables")

            self._openai_client = AsyncOpenAI(api_key=api_key)

            # Initialize hybrid search engine
            self._search_engine = OptimizedHybridSearchEngine(
                use_cache=True,
                cache_ttl=3600
            )
            await self._search_engine.initialize()

            self._initialized = True
            logger.info("✅ Research Paper Agent initialized (OpenAI + Hybrid Search)")

    async def process(
        self,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process research paper search request using OpenAI + Hybrid Search

        Args:
            user_input: Search query
            session_id: Session ID
            context: Additional context (profile, language, etc.)

        Returns:
            Dict containing answer, sources, papers, tokens_used, etc.
        """
        await self._initialize()

        # Build request
        request = AgentRequest(
            query=user_input,
            session_id=session_id,
            context=context or {},
            profile=context.get('profile', 'general') if context else 'general',
            language=context.get('language', 'ko') if context else 'ko'
        )

        # Estimate tokens
        tokens_estimated = self.estimate_context_usage(user_input)
        self.context_usage += tokens_estimated

        try:
            logger.info(f"🔍 Processing query: {request.query[:50]}...")

            # Step 1: Search all sources using hybrid search
            search_results = await self._search_engine.search_all_sources(
                query=request.query,
                max_per_source=5,
                use_semantic=True,
                use_guidelines=True,
                use_qa=True,
                use_papers=True,
                use_medical=True,
                use_pubmed=True,
                max_pubmed=5  # 요건: 논문 5개 노출
            )

            # Step 2: Format search results as context
            context_text = self._format_search_results(search_results)

            # Step 3: Generate response using OpenAI
            answer = await self._generate_response(
                query=request.query,
                context=context_text,
                profile=request.profile
            )

            # Step 4: Build response
            sources_summary = {
                'qa_count': len(search_results.get('qa_results', [])),
                'paper_count': len(search_results.get('paper_results', [])),
                'medical_count': len(search_results.get('medical_results', [])),
                'guidelines_count': len(search_results.get('guidelines_results', [])),
                'pubmed_count': len(search_results.get('pubmed_results', []))
            }

            total_count = sum(sources_summary.values())

            response_data = AgentResponse(
                answer=answer,
                sources=[{
                    'type': 'hybrid_search',
                    'summary': sources_summary,
                    'search_method': search_results.get('search_method', 'hybrid_optimized'),
                    'search_time': search_results.get('search_time', 0)
                }],
                papers=search_results.get('pubmed_results', [])[:5],
                tokens_used=tokens_estimated,
                status="success",
                agent_type=self.agent_type,
                metadata={
                    'session_id': session_id,
                    'search_method': 'hybrid_optimized',
                    'total_count': total_count,
                    'sources_breakdown': sources_summary,
                    'profile': request.profile,
                    'language': request.language
                }
            )

            logger.info(f"✅ Search completed: {total_count} results from all sources")

            return response_data.dict()

        except Exception as e:
            logger.error(f"Research paper agent error: {e}", exc_info=True)
            return {
                "answer": f"검색 중 오류가 발생했습니다: {str(e)}",
                "sources": [],
                "papers": [],
                "tokens_used": 0,
                "status": "error",
                "agent_type": self.agent_type,
                "metadata": {"error": str(e)}
            }

    def _format_search_results(self, search_results: Dict) -> str:
        """Format search results as context for LLM"""
        context_parts = []

        # QA Results
        qa_results = search_results.get('qa_results', [])
        if qa_results:
            context_parts.append("### Q&A 자료:")
            for i, qa in enumerate(qa_results[:3], 1):
                question = qa.get('question', qa.get('Q', ''))
                answer = qa.get('answer', qa.get('A', ''))
                if question and answer:
                    context_parts.append(f"{i}. Q: {question}\n   A: {answer[:500]}...")

        # Paper Results
        paper_results = search_results.get('paper_results', [])
        if paper_results:
            context_parts.append("\n### 연구 논문:")
            for i, paper in enumerate(paper_results[:3], 1):
                title = paper.get('title', '')
                abstract = paper.get('abstract', paper.get('text', ''))[:400]
                if title:
                    context_parts.append(f"{i}. {title}\n   {abstract}...")

        # Medical Results
        medical_results = search_results.get('medical_results', [])
        if medical_results:
            context_parts.append("\n### 의료 정보:")
            for i, med in enumerate(medical_results[:3], 1):
                text = med.get('text', med.get('content', ''))[:400]
                if text:
                    context_parts.append(f"{i}. {text}...")

        # Guidelines Results
        guidelines_results = search_results.get('guidelines_results', [])
        if guidelines_results:
            context_parts.append("\n### 가이드라인:")
            for i, guide in enumerate(guidelines_results[:2], 1):
                text = guide.get('text', guide.get('content', ''))[:400]
                if text:
                    context_parts.append(f"{i}. {text}...")

        # PubMed Results
        pubmed_results = search_results.get('pubmed_results', [])
        if pubmed_results:
            context_parts.append("\n### PubMed 최신 연구:")
            for i, pub in enumerate(pubmed_results[:2], 1):
                title = pub.get('title', '')
                abstract = pub.get('abstract', '')[:300]
                if title:
                    context_parts.append(f"{i}. {title}\n   {abstract}...")

        return "\n".join(context_parts) if context_parts else "관련 자료를 찾지 못했습니다."

    async def _generate_response(
        self,
        query: str,
        context: str,
        profile: str = 'general'
    ) -> str:
        """Generate response using OpenAI GPT"""

        # Adjust system prompt based on profile
        profile_instruction = {
            'general': "일반인이 이해하기 쉽게 설명해주세요.",
            'patient': "환자 입장에서 실생활에 적용할 수 있는 조언을 포함해주세요.",
            'researcher': "학술적 근거와 전문 용어를 사용하여 답변해주세요."
        }.get(profile, "일반인이 이해하기 쉽게 설명해주세요.")

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": f"""다음 검색 결과를 참고하여 질문에 답변해주세요.

{profile_instruction}

### 검색 결과:
{context}

### 질문:
{query}

### 답변 형식:
1. 핵심 답변
2. 상세 설명
3. 참고 사항 (있는 경우)

⚠️ 이 답변은 교육 목적이며, 건강에 관한 궁금증이나 문제가 있을 경우 반드시 의료 전문가와 상담하시기 바랍니다."""}
        ]

        try:
            response = await self._openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Cost-effective model
                messages=messages,
                max_tokens=2000,
                temperature=0.7
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"답변 생성 중 오류가 발생했습니다: {str(e)}"

    def estimate_context_usage(self, user_input: str) -> int:
        """
        Estimate context usage (tokens)

        Args:
            user_input: User input text

        Returns:
            Estimated token count
        """
        # Base tokens for input
        estimated_tokens = int(len(user_input) * 1.5)

        # System prompt tokens
        estimated_tokens += 500

        # Search results tokens (approximate)
        estimated_tokens += 2000

        # Response generation tokens
        estimated_tokens += 1000

        return estimated_tokens

    async def close(self):
        """Clean up resources"""
        if self._search_engine:
            await self._search_engine.close()

        self._initialized = False
        logger.info("Research Paper Agent closed")
