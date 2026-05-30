import OpenAI from 'openai';
import { Intent } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

const RESEARCH_KEYWORDS = [
  '논문', '연구', '임상', '치료', '효과', '최신', '약물', 
  '병기', 'study', 'paper', 'clinical', 'evidence'
];

const WELFARE_KEYWORDS = [
  '복지', '지원', '혜택', '신청', '보험', '요양', '급여', 
  '장애', '등록', '서비스', '자격'
];

export async function intentClassifier(message: string): Promise<Intent> {
  const lowercaseMsg = message.toLowerCase();

  // 1단계: 키워드 매칭 (비용 0)
  const hasResearch = RESEARCH_KEYWORDS.some(kw => lowercaseMsg.includes(kw));
  const hasWelfare = WELFARE_KEYWORDS.some(kw => lowercaseMsg.includes(kw));

  // 양쪽 키워드 동시 포함 또는 research 키워드만 포함 시 research 우선
  if (hasResearch) {
    return 'research';
  }
  
  if (hasWelfare) {
    return 'welfare';
  }

  // 2단계: 키워드 불명확 시 GPT-4o-mini few-shot 분류
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병(CKD) 및 당뇨(DM) 환자를 위한 AI 의도 분류기입니다.
사용자 메시지를 보고 아래의 3가지 의도 중 하나로 분류하세요. 오직 의도 명칭('research', 'welfare', 'general')만 반환해야 합니다. 다른 텍스트는 절대 포함하지 마세요.

1. 'research' : 최신 의학 연구, 논문, 임상 시험, 치료 약물 효과, 학술 자료 등 학술 연구 정보를 요구하는 질문.
2. 'welfare' : 국가 의료 지원, 복지 혜택, 보건소 지원금, 건강 보험 급여, 요양 혜택, 등록 장애인 혜택 등 복지 및 행정 지원을 요구하는 질문.
3. 'general' : 식단, 생활 습관, 일상적인 건강 관리 정보, 가벼운 인사, 그 외 일반적인 상담 등 에이전트 미할당 질문.

[Few-Shot Examples]
User: 콩팥병 환자에게 좋은 최신 임상 치료 결과가 뭐가 있어?
Assistant: research

User: 만성 신부전 3기 등록장애 혜택 신청하는 방법이 궁금해.
Assistant: welfare

User: 당뇨 환자인데 오늘 저녁 식단으로 현미밥 먹어도 괜찮을까?
Assistant: general

User: 최근 당뇨 신장 합병증 약물에 대한 논문 찾아줘.
Assistant: research

User: 보건복지부에서 만성질환자 대상 바우처 서비스 지원해 주나요?
Assistant: welfare

User: 안녕 반가워! 오늘 신장 수치 관리법 알려줘.
Assistant: general`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const parsedIntent = response.choices[0]?.message?.content?.trim() as Intent;
    
    if (['research', 'welfare', 'general'].includes(parsedIntent)) {
      return parsedIntent;
    }
  } catch (error) {
    console.error('Error during intent classification:', error);
  }

  // 3단계: 오류 또는 불명확 시 general 반환
  return 'general';
}
