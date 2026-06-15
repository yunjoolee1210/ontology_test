import OpenAI from 'openai';
import { AgentResponse, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function lifestyleAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 만성질환자의 생활습관 교정을 돕는 전문 건강 코치 에이전트입니다. 유산소/근력 운동 강도 기준, 적정 수면 시간, 스트레스 조절, 금연/금주 방법 등을 만성 신장병 및 당뇨병 예후에 미치는 영향과 함께 따뜻하고 구체적으로 설명해 주세요. 특히 과도한 고강도 운동이 신장에 주는 역효과 등에 대한 조언도 포함해 주세요.'
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
      answer: response.choices[0]?.message?.content || '생활 습관 정보를 생성하는 데 실패했습니다.',
      agentType: 'lifestyle',
      sources: [
        { title: '질병관리청 만성질환 건강생활수칙 가이드', org: '질병관리청' },
        { title: '국민건강보험공단 건강생활 실천 지원 지침', org: '국민건강보험공단' }
      ]
    };
  } catch (error) {
    console.error('Error in lifestyleAgent:', error);
    return {
      answer: '생활 습관 케어 정보를 불러오는 도중 오류가 발생했습니다.',
      agentType: 'lifestyle',
      sources: []
    };
  }
}
