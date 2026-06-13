import OpenAI from 'openai';
import { AgentResponse, UserProfile } from '../types/chat';
import { queryPinecone } from '../rag/pineconeClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// 한국 대표 식품 영양 성분 & 3중 안전 판정 기본 정의
interface FoodRule {
  food: string;
  diabetes: string; // "안전" | "소량" | "주의" | "금지"
  kidney: string;
  hypertension: string;
  grade: '안전' | '소량' | '주의' | '금지';
  gradeBadge: string;
  reason: string;
  alternative: string;
}

const FOOD_RULES: FoodRule[] = [
  {
    food: '백미밥',
    diabetes: '소량',
    kidney: '안전',
    hypertension: '안전',
    grade: '소량',
    gradeBadge: '🟡 소량 섭취 권장',
    reason: '정제 탄수화물로 급격한 혈당 상승(GI 수치 높음)을 유발하므로 당뇨 관리를 위해 1회 1/2공기 이하 섭취가 필요합니다.',
    alternative: '잡곡밥(단, 신장병 3기 이상일 경우 잡곡 속 인/칼륨 제한을 위해 현미보다는 보리, 귀리 혼합 또는 흰쌀밥 위주 식사 권장)'
  },
  {
    food: '바나나',
    diabetes: '소량',
    kidney: '금지',
    hypertension: '안전',
    grade: '금지',
    gradeBadge: '⛔ 섭취 금지 (투석/신장애 환자)',
    reason: '칼륨 함량(100g당 358mg)이 극도로 높아 3기 이상 만성신부전 환자에게 고칼륨혈증(부정맥 쇼크 유발) 위험이 매우 큽니다.',
    alternative: '사과, 배(껍질 제거 후 소량 섭취), 통조림 과일(시럽 버린 후 물에 헹궈서)'
  },
  {
    food: '두부',
    diabetes: '안전',
    kidney: '소량',
    hypertension: '안전',
    grade: '소량',
    gradeBadge: '🟡 소량 섭취 권장',
    reason: '양질의 식물성 단백질원이나, 인(P) 성분이 포함되어 있어 신장의 배설 기능이 감소한 3-5기 환자는 하루 반 모 이내로 제한해야 합니다.',
    alternative: '계란 흰자(인 성분이 노른자보다 훨씬 적어 안전한 단백질원)'
  },
  {
    food: '김치',
    diabetes: '안전',
    kidney: '소량',
    hypertension: '금지',
    grade: '주의',
    gradeBadge: '🔴 섭취 주의 (나트륨)',
    reason: '소금에 절인 배추로 나트륨 함량이 높아 고혈압 악화 및 신장 부종(수분 저류)을 일으킵니다. 고춧가루로 인한 칼륨 성분도 주의해야 합니다.',
    alternative: '물김치(건더기만 물에 씻어서), 무염 겉절이, 오이피클(무염)'
  },
  {
    food: '닭가슴살',
    diabetes: '안전',
    kidney: '소량',
    hypertension: '안전',
    grade: '소량',
    gradeBadge: '🟡 소량 섭취 권장',
    reason: '단백질 함량이 높아 근육 유지에 좋지만, 신부전 환자는 사구체 여과율 저하에 따라 단백질 제한식(투석 전)이 필요하며 인 함량도 존재합니다.',
    alternative: '하루 권장량(투석 전 체중당 0.6~0.8g, 투석 중 1.2g)에 맞춘 계란 흰자 및 살코기 소량 섭취'
  }
];

export async function dietAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    const lowercaseMsg = message.toLowerCase().trim();

    // 1. 사용자 질문에 특정 매핑 식품이 포함되어 있는지 필터링
    let matchedRules: FoodRule[] = [];
    FOOD_RULES.forEach(rule => {
      if (lowercaseMsg.includes(rule.food)) {
        matchedRules.push(rule);
      }
    });

    const profileText = userProfile 
      ? `[환자 프로필]
- 성별: ${userProfile.gender || '미입력'}
- 나이: ${userProfile.age ? userProfile.age + '세' : '미입력'}
- 키: ${userProfile.height ? userProfile.height + 'cm' : '미입력'}
- 건체중 (목표 체중): ${userProfile.target_weight ? userProfile.target_weight + 'kg' : '미입력'}
- 크레아티닌: ${userProfile.creatinine ? userProfile.creatinine + 'mg/dL' : '미입력'}
- 사구체여과율 (eGFR): ${userProfile.egfr ? userProfile.egfr + 'ml/min/1.73m²' : '미입력'}
- 콩팥 단계: ${userProfile.ckd_stage || '미입력'}
- 투석 방법: ${userProfile.dialysis_type || '해당없음'}
- 당뇨 유형: ${userProfile.diabetes_type || '없음'}
- 복약 상태: ${userProfile.medication || '미입력'}
- 기타 질환: ${(userProfile.other_conditions || []).join(', ') || '없음'}
- 일일 영양 섭취 제한량:
  * 당류: ${userProfile.limit_sugar ? userProfile.limit_sugar + 'g 이하' : '개별 맞춤 설정 필요'}
  * 나트륨: ${userProfile.limit_sodium ? userProfile.limit_sodium + 'mg 이하' : '개별 맞춤 설정 필요'}
  * 칼륨: ${userProfile.limit_potassium ? userProfile.limit_potassium + 'mg 이하' : '개별 맞춤 설정 필요'}
  * 인: ${userProfile.limit_phosphorus ? userProfile.limit_phosphorus + 'mg 이하' : '개별 맞춤 설정 필요'}`
      : '환자 건강 프로필 정보 없음';

    // 2. RAG 검색 (식이/운동 지침 자료)
    const searchTerms = `${lowercaseMsg} 식이요법 운동 지침`;
    const pineconeResults = await queryPinecone('kongdang-papers', searchTerms, 5).catch(err => {
      console.error('Pinecone diet query failed:', err);
      return [];
    });

    const contextStr = pineconeResults.map((match, idx) => 
      `[식이지침 출처 ${idx + 1}]
제목: ${match.metadata?.title || '만성신부전 및 당뇨병 임상 영양지침'}
지침내용: ${match.metadata?.abstract || match.metadata?.content || ''}
`
    ).join('\n---\n');

    // 3. GPT-4o-mini 호출
    const foodRegistryText = matchedRules.map(r => 
      `[식품 판정 데이터 - ${r.food}]
종합 등급: ${r.gradeBadge}
- 당뇨(GI/당): ${r.diabetes}
- 콩팥(칼륨/인): ${r.kidney}
- 고혈압(나트륨): ${r.hypertension}
사유: ${r.reason}
대안 식품: ${r.alternative}
`
    ).join('\n---\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 만성 신장병(CKD) 및 당뇨병(DM) 환자들의 맞춤형 식단 지도와 운동 프로그램을 관리하는 '식이/운동 치료 임상영양사'입니다.
제시된 [환자 프로필], [식이지침 출처], [식품 판정 데이터]를 기반으로 안전하고 실용적인 생활 가이드를 조언해 주십시오.

[작성 분량 제한]
- 핵심 내용 위주로 구성하여 공백 포함 700자 내외로 매우 간결하고 친절하게 답변을 작성하십시오.

[식품 판정 가이드라인]
- 환자가 언급한 음식에 대해 **3중 안전 판정(당뇨, 콩팥, 고혈압)**을 시행하고 다음 등급 중 하나로 규정하여 뱃지와 함께 이유를 밝히십시오:
  🟢 안전  /  🟡 소량  /  🔴 주의  /  ⛔ 금지
- 특히 **투석 중이거나 신장 단계가 3기 이상**인 경우, 식품 내 **칼륨(Potassium)**과 **인(Phosphorus)** 수치를 가장 중요하게 검사하여 바나나, 토마토, 견과류, 우유, 잡곡류의 섭취 한도를 엄격히 규제하십시오.
- 칼륨을 낮추는 조리 팁을 반드시 안내하십시오: "껍질 제거 후 얇게 썰어 찬물에 2시간 이상 담근 후 끓는 물에 데쳐서 조리하며, 데친 물은 버리십시오."

[운동 권고 가이드라인]
- 환자의 콩팥 기능 단계 및 당뇨 복약 상태에 맞는 운동 방법과 주의사항을 안내하십시오:
  - eGFR 30 이상: 중등도 유산소 운동 가능.
  - eGFR 15~30: 저강도 걷기 위주, 과부하 금지.
  - 투석 환자: 투석일 외 비투석일에 운동 진행하며, 투석 직후 6시간은 충분히 휴식하십시오.
  - 당뇨 환자: 저혈당 예방을 위해 반드시 식후 1~2시간 후에 운동을 진행하고, 속효성 인슐린 주사 후 30분 이내 운동 금기.

[출력 형식]
1. **음식 안전 판정 결과 뱃지** 및 상세 성분 분석 사유
2. **대안 식품 추천** (한식 위주)
3. **저칼륨 조리 팁**
4. **맞춤형 운동 강도 & 타이밍 가이드**
5. **disclaimer** 문구 첨부: "※ 이 식이요법은 전반적인 임상 기준이며 환자 개인의 정확한 혈액검사 수치에 따라 다를 수 있으니 임상영양사와 최종 상의하시기 바랍니다."`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}
${profileText}

[식품 판정 데이터]
${foodRegistryText || '해당 음식의 종합 데이터 없음, RAG 지침 참고하여 3중 판정 직접 수행 필요'}

[임상 영양/운동 지침 RAG]
${contextStr || '대한신장학회/대한당뇨병학회 영양 섭취 및 생활 조언 기본 가이드 참고'}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const answer = response.choices[0]?.message?.content || '식단 및 운동 가이드를 생성하는 데 실패했습니다.';

    // 출처 매핑
    const sources: AgentResponse['sources'] = pineconeResults.map(p => ({
      title: p.metadata?.title || '만성신부전 및 당뇨병 임상 영양 지침',
      org: p.metadata?.org || '대한임상영양학회',
      url: p.metadata?.url || undefined
    }));

    if (sources.length === 0) {
      sources.push({ title: '대한신장학회 투석 환자 식이요법 지침', org: '대한신장학회' });
      sources.push({ title: '대한당뇨병학회 당뇨병 식사요법 권고안 2025', org: '대한당뇨병학회' });
    }

    return {
      answer,
      agentType: matchedRules.length > 0 || message.includes('먹') || message.includes('식단') ? 'nutrition' : 'lifestyle',
      sources
    };
  } catch (error) {
    console.error('Error in dietAgent:', error);
    return {
      answer: '식이/운동 가이드를 생성하는 과정에서 예기치 못한 에러가 발생했습니다. 주치의와 상의하세요.',
      agentType: 'nutrition',
      sources: []
    };
  }
}
