import OpenAI from 'openai';
import { entityExtractor } from './entityExtractor';
import { searchWelfareDocs } from '../rag/supabaseClient';
import { queryPinecone } from '../rag/pineconeClient';
import { AgentResponse } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function welfareAgent(message: string): Promise<AgentResponse> {
  try {
    // 1. 엔티티 및 변수 추출
    const entities = await entityExtractor(message);
    const keywordsQuery = entities.keywords.join(' ');
    const diseaseFilter = entities.diseaseType;

    // 2. Supabase FTS 검색 실행
    let welfareDocs = await searchWelfareDocs(keywordsQuery, diseaseFilter, 5).catch(err => {
      console.error('Supabase welfare search failed, falling back:', err);
      return [];
    });

    // 3. Supabase 결과가 없는 경우 Pinecone 복지인덱스('kongdang-welfare')로 폴백 검색
    if (welfareDocs.length === 0) {
      console.log('No results in Supabase FTS. Querying Pinecone kongdang-welfare...');
      const pineconeMatches = await queryPinecone('kongdang-welfare', keywordsQuery, 5).catch(err => {
        console.error('Pinecone welfare search failed:', err);
        return [];
      });

      welfareDocs = pineconeMatches.map(match => ({
        id: match.id,
        content: match.metadata?.content || match.metadata?.abstract || '',
        org: match.metadata?.org || '복지 지원처',
        url: match.metadata?.url || '',
        rank: match.score,
        title: match.metadata?.title || '공공 복지 혜택 안내',
        disease: match.metadata?.disease as any,
      }));
    }

    // 4. 검색 결과가 여전히 비어있으면 GPT-4o-mini 일반 복지 지식 활용 폴백
    if (welfareDocs.length === 0) {
      const fallbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 보건의료 및 국가복지 전문 사회복지사입니다. 데이터베이스에서 직접적인 혜택 자료를 찾지 못했으므로 만성질환자(만성신부전, 당뇨) 대상의 일반적인 의료급여, 산정특례, 장애인 등록, 바우처 혜택 신청 기준과 절차를 친절하고 명확하게 한국어로 안내해 주세요.'
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
        answer: fallbackResponse.choices[0]?.message?.content || '죄송합니다. 국가 복지 지원 혜택을 조회하는 데 실패했습니다.',
        agentType: 'welfare',
        sources: [],
      };
    }

    // 5. GPT-4o-mini를 활용하여 복지 정보 및 요건 요약 생성
    const contextStr = welfareDocs.map((doc, idx) => 
      `[복지 정책 ${idx + 1}]
제목: ${doc.title || '만성질환 의료복지 지원'}
제공기관: ${doc.org}
대상 질병: ${doc.disease || '공통'}
지원내용: ${doc.content}
`
    ).join('\n');

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병 및 당뇨 환자들에게 국가 의료복지 혜택, 요건, 신청 절차를 친절히 설명하는 전문 사회복지사 에이전트입니다.
제공된 [복지 정책 정보]만을 바탕으로 사용자의 질문에 정확하고 세심하게 답변하세요.

[요구 사항]
1. 반드시 한국어로 답변할 것.
2. 지원 대상 요건(소득 기준 등), 혜택 상세, 필요한 구비 서류 및 신청 방법(온라인/행정복지센터)을 세분화하여 가독성 있게 요약할 것.
3. 부정확하거나 추측성 혜택 조건은 언급하지 말 것.
4. 사용자에게 따뜻하고 격려하는 어조를 유지할 것.`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n[복지 정책 정보]\n${contextStr}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    // 6. 출처 구성 및 결과 반환
    const sources = welfareDocs.map(doc => ({
      title: doc.title || '국가 복지 혜택 안내',
      url: doc.url || undefined,
      org: doc.org,
    }));

    return {
      answer: summaryResponse.choices[0]?.message?.content || '복지 정보 요약에 실패했습니다.',
      agentType: 'welfare',
      sources: sources,
    };
  } catch (error) {
    console.error('Error in welfareAgent:', error);
    return {
      answer: '죄송합니다. 의료복지 혜택을 조회하고 요약하는 도중 예상치 못한 오류가 발생했습니다.',
      agentType: 'welfare',
      sources: [],
    };
  }
}
