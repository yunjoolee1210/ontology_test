import OpenAI from 'openai';
import { AgentResponse } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function drugAgent(message: string): Promise<AgentResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 임상약학 전문 약사 에이전트입니다. 신장병 및 당뇨 관련 치료제(예: SGLT2 억제제, 메트포르민, ARB/ACE 억제제 혈압약 등)의 복용 방법, 기전, 흔한 부작용, 약물 상호작용에 대해 전문적이고 객관적인 사실에 입각하여 설명해 주세요. 반드시 환자가 임의로 약물 복용을 중단하거나 변경하지 않도록 안내하세요.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    return {
      answer: response.choices[0]?.message?.content || '약물 정보를 생성하는 데 실패했습니다.',
      agentType: 'drug',
      sources: [
        { title: '약학정보원 의약품 안전성 정보', org: '약학정보원' },
        { title: '식품의약품안전처 의약품 통합 정보 시스템', org: '식약처' }
      ]
    };
  } catch (error) {
    console.error('Error in drugAgent:', error);
    return {
      answer: '약물 복약 안내 정보를 불러오는 도중 오류가 발생했습니다.',
      agentType: 'drug',
      sources: []
    };
  }
}
