import OpenAI from 'openai';
import { AgentResponse } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function nutritionAgent(message: string): Promise<AgentResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 신장병 및 당뇨 합병증 식단 전문 임상영양사입니다. 칼륨, 인, 나트륨, 단백질 조절 가이드를 기반으로 하여 환자가 먹어도 되는 음식과 피해야 할 음식을 아주 상세하고 실용적으로 설명해 주세요. 마크다운 표나 글머리 기호를 활용해 가독성 있게 한국어로 답변해 주세요.'
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
      answer: response.choices[0]?.message?.content || '영양 정보를 생성하는 데 실패했습니다.',
      agentType: 'nutrition',
      sources: [
        { title: '한국임상영양학회 신장질환 영양 가이드라인', org: '한국임상영양학회' },
        { title: '식품의약품안전처 국가표준식품성분표', org: '식약처' }
      ]
    };
  } catch (error) {
    console.error('Error in nutritionAgent:', error);
    return {
      answer: '식단 조언을 불러오는 중 오류가 발생했습니다.',
      agentType: 'nutrition',
      sources: []
    };
  }
}
