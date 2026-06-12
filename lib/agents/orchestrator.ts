import OpenAI from 'openai';
import { intentClassifier } from './intentClassifier';
import { medicalAgent } from './medicalAgent';
import { dietAgent } from './dietAgent';
import { welfareAgent } from './welfareAgent';
import { researchAgent } from './researchAgent';
import { drugAgent } from './drugAgent';
import { hospitalAgent } from './hospitalAgent';
import { AgentResponse, Intent, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function orchestrator(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    // 1. 의도 분류 호출 (다중 의도 감지 가능)
    const intents = await intentClassifier(message);
    console.log(`Orchestrator: Message "${message}" classified as intents:`, intents);

    // 'general'만 단독이거나, 아무 의도가 없으면 general로 즉시 처리
    if (intents.length === 0 || (intents.length === 1 && intents[0] === 'general')) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 콩팥병 및 당뇨 환자들을 위한 친절한 건강 코치입니다. 식단, 생활 습관, 일반 관리 등에 대해 쉽고 따뜻하게 한국어로 조언해 주세요. 단, 구체적인 복지 혜택이나 최신 임상 시험/논문에 대해서는 특화 에이전트로 연계될 수 있으니 일상적인 관리에 주력하세요.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.5,
        max_tokens: 800,
      });

      return {
        answer: response.choices[0]?.message?.content || '죄송합니다. 답변을 생성하지 못했습니다.',
        agentType: 'general',
        sources: []
      };
    }

    // 2. 분류된 의도에 맞는 에이전트들을 병렬로 실행
    const agentPromises: Promise<AgentResponse>[] = [];

    // 'general' 의도가 다른 특화 의도와 섞여있다면 특화 의도에 집중하기 위해 제외
    const activeIntents = intents.filter(i => i !== 'general');

    activeIntents.forEach(intent => {
      switch (intent) {
        case 'medical':
          agentPromises.push(medicalAgent(message, userProfile));
          break;
        case 'nutrition':
        case 'lifestyle':
          agentPromises.push(dietAgent(message, userProfile));
          break;
        case 'welfare':
          agentPromises.push(welfareAgent(message, userProfile));
          break;
        case 'research':
          agentPromises.push(researchAgent(message, userProfile));
          break;
        case 'drug':
          agentPromises.push(drugAgent(message)); // drugAgent doesn't strictly need userProfile yet, but we will keep it simple
          break;
        case 'hospital':
          agentPromises.push(hospitalAgent(message, userProfile));
          break;
      }
    });

    const agentResponses = await Promise.all(agentPromises);

    // 에이전트 실행 결과가 없는 경우 일반 처리로 전환
    if (agentResponses.length === 0) {
      return {
        answer: '죄송합니다. 적절한 전문 에이전트를 매칭하지 못해 일상 건강 가이드로 갈음합니다.',
        agentType: 'general',
        sources: []
      };
    }

    // 단일 에이전트 응답이면 그대로 반환하여 비용 최소화
    if (agentResponses.length === 1) {
      return agentResponses[0];
    }

    // 3. 복수 에이전트인 경우 응답 통합 합성 (LLM Synthesizer)
    console.log(`Orchestrator: Synthesizing ${agentResponses.length} agent responses.`);
    
    // 개별 에이전트들의 응답 텍스트 병합
    const synthesisContext = agentResponses.map(res => 
      `[에이전트: ${res.agentType}]
응답: ${res.answer}
`
    ).join('\n---\n');

    const synthesisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병 및 당뇨 환자를 돕는 스마트 AI 헬스케어 오케스트레이터입니다.
각 전문 분야 에이전트들이 도출해 낸 개별 [의견 목록]을 기반으로 하여, 사용자의 질문에 대한 하나의 유기적이고 일관된 한국어 통합 응답을 합성해 주세요.

[합성 주의사항]
1. 서로 다른 의도의 정보를 자연스럽게 병합하고 어색한 중복 표현은 제거하세요. (예: 두 에이전트가 모두 인사하거나 주의사항을 각자 말하는 부분 정리)
2. 각 에이전트가 제시한 핵심 임상적/식단/복지/병원 가이드는 누락 없이 정확히 포함하세요.
3. 보기 쉽게 마크다운 구조(소제목, 글머리 기호 등)를 사용해 가독성을 대폭 높이세요.
4. 환자를 위하고 안심시키는 친절하고 세심한 어조를 유지하세요.`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n[에이전트별 의견 목록]\n${synthesisContext}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    // 4. 출처 정보 병합 및 중복 제거
    const allSources: any[] = [];
    const seenTitles = new Set<string>();

    agentResponses.forEach(res => {
      res.sources.forEach(src => {
        if (!seenTitles.has(src.title.toLowerCase())) {
          seenTitles.add(src.title.toLowerCase());
          allSources.push(src);
        }
      });
    });

    // 대표 에이전트 타입 결정 (첫 번째 의도 기준)
    const primaryAgentType = activeIntents[0] || 'general';

    // 대표 위험도 캡처
    const primaryRisk = agentResponses.find(r => r.riskLevel)?.riskLevel;

    return {
      answer: synthesisResponse.choices[0]?.message?.content || '통합 답변 생성에 실패했습니다.',
      agentType: primaryAgentType,
      sources: allSources,
      riskLevel: primaryRisk
    };
  } catch (error) {
    console.error('Error in Orchestrator:', error);
    return {
      answer: '죄송합니다. 답변을 취합하고 합성하는 도중 에러가 발생했습니다.',
      agentType: 'general',
      sources: []
    };
  }
}
