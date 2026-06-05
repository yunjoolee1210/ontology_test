import OpenAI from 'openai';
import { AgentResponse } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function medicalAgent(message: string): Promise<AgentResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 만성 신장병(CKD) 및 당뇨병(DM) 전문의입니다. 의학 가이드라인에 의거하여, 환자의 질문에 정확하고 임상적인 사실만을 기초로 한국어로 친절히 조언해 주세요. 마지막에 반드시 "※ 구체적인 증상 관리는 담당 주치의와 상담이 필요합니다." 문구를 추가하세요.'
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
      answer: response.choices[0]?.message?.content || '의학 정보를 생성하는 데 실패했습니다.',
      agentType: 'medical',
      sources: [
        { title: '대한신장학회 만성콩팥병 진료지침', org: '대한신장학회' },
        { title: '대한당뇨병학회 당뇨병 진료지침 2025', org: '대한당뇨병학회' }
      ]
    };
  } catch (error) {
    console.error('Error in medicalAgent:', error);
    return {
      answer: '의학 정보를 조회하는 동안 오류가 발생했습니다.',
      agentType: 'medical',
      sources: []
    };
  }
}
