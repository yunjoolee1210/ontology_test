import OpenAI from 'openai';
import { Entity } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function entityExtractor(message: string): Promise<Entity> {
  // 기본 엔티티 구조
  const defaultEntity: Entity = {
    keywords: [],
  };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병(CKD) 및 당뇨(DM) 관련 메시지에서 의료 및 복지 관련 변수를 추출하는 고성능 엔티티 추출기입니다.
주어진 메시지를 분석하여 다음 JSON 형식으로 변수를 추출해 주세요.

{
  "diseaseType": "CKD" | "DM" | "BOTH" | null, // 콩팥병(만성신부전 등)은 CKD, 당뇨는 DM, 둘 다 언급되면 BOTH
  "ckdStage": 1 | 2 | 3 | 4 | 5 | null, // 콩팥병 기수(1~5단계, 3기 등)가 언급된 경우 숫자만 입력
  "keywords": string[], // 검색 쿼리에 유용한 질환/약물/치료 관련 주요 키워드 배열
  "welfareType": string | null // 복지 혜택 종류 (예: '의료급여', '장애등록', '요양비 지원' 등)
}

주의: JSON 이외의 텍스트나 마크다운 기호(\`\`\`json 등)는 절대 포함하지 말고 순수 JSON만 반환해 주세요.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    // 혹시라도 markdown wrapper가 있을 경우 제거
    const cleanContent = content.replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanContent) as Partial<Entity>;

    return {
      diseaseType: parsed.diseaseType || undefined,
      ckdStage: parsed.ckdStage || undefined,
      keywords: parsed.keywords && parsed.keywords.length > 0 ? parsed.keywords : [message],
      welfareType: parsed.welfareType || undefined,
    };
  } catch (error) {
    console.error('Error during entity extraction:', error);
    
    // 간이 정규식 기반 폴백
    const keywords = message.split(' ').filter(word => word.length > 1);
    const hasCkd = /콩팥|신장|신부전|CKD/i.test(message);
    const hasDm = /당뇨|DM/i.test(message);
    const ckdStageMatch = message.match(/([1-5])\s*기/);

    return {
      diseaseType: hasCkd && hasDm ? 'BOTH' : (hasCkd ? 'CKD' : (hasDm ? 'DM' : undefined)),
      ckdStage: ckdStageMatch ? parseInt(ckdStageMatch[1], 10) : undefined,
      keywords: keywords.length > 0 ? keywords : [message],
    };
  }
}
