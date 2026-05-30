import OpenAI from 'openai';
import { entityExtractor } from './entityExtractor';
import { searchPubMed } from '../rag/pubmedClient';
import { queryPinecone } from '../rag/pineconeClient';
import { reciprocalRankFusion } from '../rag/hybridMerger';
import { AgentResponse } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function researchAgent(message: string): Promise<AgentResponse> {
  try {
    // 1. 엔티티 및 변수 추출
    const entities = await entityExtractor(message);
    const keywordsQuery = entities.keywords.join(' ');

    // 2. PubMed 및 Pinecone 병행 검색 진행
    const [pubmedResults, pineconeResults] = await Promise.all([
      searchPubMed(entities).catch(err => {
        console.error('PubMed search failed, falling back:', err);
        return [];
      }),
      queryPinecone('kongdang-papers', keywordsQuery, 10).catch(err => {
        console.error('Pinecone papers search failed, falling back:', err);
        return [];
      })
    ]);

    // 3. RRF Hybrid Merger로 병합
    const mergedDocs = reciprocalRankFusion(pubmedResults, pineconeResults);

    // 4. Top-3 선택
    const topDocs = mergedDocs.slice(0, 3);

    if (topDocs.length === 0) {
      // 검색 결과가 없는 경우 GPT-4o-mini 일반 지식 기반 답변
      const fallbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 콩팥병 및 당뇨 관련 전문 연구원입니다. 검색된 최신 논문이 없으므로, 귀하가 가진 의학적 배경지식을 활용하여 최신 연구 동향 및 치료 기준을 친절하게 한국어로 설명해 주세요. 반드시 전문적이고 객관적인 어조를 유지하세요.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      return {
        answer: fallbackResponse.choices[0]?.message?.content || '죄송합니다. 관련 논문 정보를 찾을 수 없으며 답변을 생성하는 데 실패했습니다.',
        agentType: 'research',
        sources: [],
      };
    }

    // 5. GPT-4o-mini로 한국어 요약 생성
    const contextStr = topDocs.map((doc, idx) => 
      `[연구 ${idx + 1}]
제목: ${doc.title}
출처/저널: ${doc.org}
내용: ${doc.content}
`
    ).join('\n');

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병 및 당뇨 관련 연구 논문을 분석하여 환자들에게 쉽고 신뢰도 높은 정보를 제공하는 의학 전문 AI 연구원입니다.
제공된 [연구 정보] 컨텍스트를 철저히 바탕으로 하여 사용자의 질문에 답변해 주세요.

[요구 사항]
1. 반드시 한국어로 답변할 것.
2. 각 연구 결과의 핵심 기여나 치료적 효과, 시사점을 명확하게 구분하여 요약할 것.
3. 컨텍스트에 없는 주관적인 사실이나 과도한 주장은 배제할 것.
4. 환자가 알기 쉽게 가독성 높은 마크다운 형식(글머리 기호 등)을 적극 사용할 것.`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n[연구 정보]\n${contextStr}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    // 6. 출처 포맷팅 및 반환
    const sources = topDocs.map(doc => ({
      title: doc.title,
      url: doc.url,
      doi: doc.doi,
      org: doc.org,
    }));

    return {
      answer: summaryResponse.choices[0]?.message?.content || '답변 요약 생성에 실패했습니다.',
      agentType: 'research',
      sources: sources,
    };
  } catch (error) {
    console.error('Error in researchAgent:', error);
    
    // 에러 발생 시 최후의 일반 응답 폴백
    return {
      answer: '죄송합니다. 최신 논문 검색 및 요약 과정에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      agentType: 'research',
      sources: [],
    };
  }
}
