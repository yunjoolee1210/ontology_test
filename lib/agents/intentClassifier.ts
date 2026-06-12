import OpenAI from 'openai';
import { Intent } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// 키워드별 단순 사전 매칭 정의 (비용 0 및 우선 검증용)
const KEYWORD_MAP: Record<Intent, string[]> = {
  medical: ['콩팥', '당뇨', '신장', '질환', '합병증', '수치', '신부전', 'egfr', '사구체', '혈당', '인슐린'],
  nutrition: ['식단', '음식', '먹어', '바나나', '현미밥', '칼륨', '단백질', '저염', '나트륨', '식사', '과일'],
  welfare: ['복지', '혜택', '신청', '산정특례', '장애등록', '요양비', '급여', '바우처', '보건소', '지원금'],
  research: ['논문', '연구', '임상', '최신', '실험', '저널', 'pubmed', 'study', 'paper', '학술'],
  drug: ['약물', '복약', '부작용', '처방', 'sglt2', '약', '복용', '메트포르민', '부작용'],
  lifestyle: ['운동', '수면', '생활습관', '담배', '술', '음주', '스트레스', '유산소'],
  hospital: ['병원', '의료원', '응급실', '신장내과', '의원', '내과', '투석실', '야간투석', '심평원', '가까운', '어디가야'],
  general: ['안녕', '반가워', '인사', '고마워', '감사']
};

export async function intentClassifier(message: string): Promise<Intent[]> {
  const lowercaseMsg = message.toLowerCase();
  const matchedIntents = new Set<Intent>();

  // 1단계: 간단한 키워드 매칭
  for (const [intent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lowercaseMsg.includes(kw))) {
      matchedIntents.add(intent as Intent);
    }
  }

  // 매칭된 것이 확실하다면 일부 결과 반환
  if (matchedIntents.size > 0 && !matchedIntents.has('general')) {
    return Array.from(matchedIntents);
  }

  // 2단계: LLM을 활용한 다중 의도(JSON array) 분류
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 만성질환(신장병, 당뇨병) 전문 챗봇의 다중 의도 분류기입니다.
사용자 메시지를 분석하여 하나 이상의 의도를 분류해 순수 JSON String Array 형식으로 반환하세요.
다른 설명 텍스트나 마크다운 코드 블록 기호는 절대 제외하십시오. 오직 ["intent1", "intent2"] 형태만 출력 가능합니다.

[의도 범주]
- "medical": 질환 상세 증상, 병기 기준, 신장/당뇨 검사 수치, 합병증 진행 등에 대한 의료 질문.
- "nutrition": 음식 섭취 가이드, 식단 구성, 특정 영양소(칼륨/인/나트륨 등) 조언.
- "welfare": 산정특례, 요양급여, 보건소 지원, 장애인 등록 절차 등 의료 사회 복지 혜택 질문.
- "research": 최신 임상 시험 결과, 신장/당뇨 학술 논문, PubMed 연구자료 등 학술 연구 지식 질문.
- "drug": 특정 약물(예: SGLT2 억제제, 메트포르민 등), 복용 방법, 부작용 및 상호작용 질문.
- "lifestyle": 운동법, 수면 조절, 스트레스, 금연/금주 등 건강 습관 질문.
- "hospital": 신장내과/내분비내과 병원 찾기, 혈액투석 가능 병원, 야간투석실 운영 여부, 병원 예약 및 의뢰 절차 질문.
- "general": 단순 인사, 가벼운 대화, 감사 표시 등 위의 특화 범주에 속하지 않는 일상 질문.

[Few-Shot Examples]
User: 콩팥병 산정특례 혜택하고 현미밥 식단 알려줘
Assistant: ["welfare", "nutrition"]

User: SGLT2 최신 임상 시험 논문 결과 요약해줘
Assistant: ["research", "drug"]

User: 당뇨 신장 합병증 증상과 수면 습관 관계는?
Assistant: ["medical", "lifestyle"]

User: 집 근처에 혈액투석실 있는 신장내과 병원 있어?
Assistant: ["hospital"]

User: 안녕! 만나서 반가워
Assistant: ["general"]`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0,
      max_tokens: 80,
    });

    const content = response.choices[0]?.message?.content?.trim() || '[]';
    // 혹시 모를 마크다운 기호 제거
    const cleanContent = content.replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanContent);

    if (Array.isArray(parsed) && parsed.length > 0) {
      // 유효한 의도만 필터링
      const validIntents = parsed.filter(i => 
        ['medical', 'nutrition', 'welfare', 'research', 'drug', 'lifestyle', 'hospital', 'general'].includes(i)
      ) as Intent[];
      if (validIntents.length > 0) {
        return validIntents;
      }
    }
  } catch (error) {
    console.error('Error during LLM intent classification:', error);
  }

  // 폴백
  return matchedIntents.size > 0 ? Array.from(matchedIntents) : ['general'];
}
