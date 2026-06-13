import OpenAI from 'openai';
import { AgentResponse, UserProfile } from '../types/chat';
import { queryPinecone } from '../rag/pineconeClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// 한국어 구어체 매핑 사전
const COLLOQUIAL_MAPPING: Record<string, { standard: string; risk: string; desc: string }> = {
  '거품뇨': { standard: '단백뇨 HPO:0000093', risk: 'caution', desc: '소변 내 과도한 단백질 배출, 신장 여과 기능 저하 의심' },
  '오줌에 거품': { standard: '단백뇨 HPO:0000093', risk: 'caution', desc: '소변 내 과도한 단백질 배출, 신장 여과 기능 저하 의심' },
  '소변 거품': { standard: '단백뇨 HPO:0000093', risk: 'caution', desc: '소변 내 과도한 단백질 배출, 신장 여과 기능 저하 의심' },
  '부종': { standard: '부종(edema)', risk: 'caution', desc: '수분 저류 및 삼투압 불균형' },
  '다리 퉁퉁': { standard: '부종(edema)', risk: 'caution', desc: '수분 저류 및 신장 배설 기능 저하' },
  '몸이 부어요': { standard: '부종(edema)', risk: 'caution', desc: '신장 수분 및 나트륨 조절 실패' },
  '손발 저림': { standard: '말초신경병증 DOID:3070', risk: 'caution', desc: '당뇨성/요독성 신경 손상' },
  '발저림': { standard: '말초신경병증 DOID:3070', risk: 'caution', desc: '당뇨성 신경합병증 위험성' },
  '숨이 차요': { standard: '호흡곤란', risk: 'danger', desc: '폐부종 또는 심부전 합병증 의심' },
  '가슴이 두근': { standard: '부정맥', risk: 'danger', desc: '고칼륨혈증 또는 전해질 불균형에 의한 부정맥 위험' },
  '머리가 띵함': { standard: '요독증/저혈당', risk: 'caution', desc: '신부전 요독 현상 또는 급격한 혈당 강하 감별 필요' },
  '소변 뿌옇다': { standard: '혼탁뇨', risk: 'caution', desc: '요로 감염 또는 요중 염류 침착' },
  '눈이 침침': { standard: '시력 저하', risk: 'caution', desc: '당뇨망막병증 합병증 가능성' },
  '발 상처': { standard: '당뇨발 궤양', risk: 'danger', desc: '당뇨병성 족부 괴사 및 궤양 주의' },
  '발에 상처': { standard: '당뇨발 궤양', risk: 'danger', desc: '당뇨병성 족부 괴사 및 궤양 주의' },
  '소변 안 나와': { standard: '핍뇨(oliguria)', risk: 'emergency', desc: '급성 신손상(AKI) 및 급성 신부전' }
};

export async function medicalAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    const lowercaseMsg = message.toLowerCase().trim();

    // 1. 🚨 응급 키워드 룰베이스 1차 필터링 (<0.1초 즉시 탐지)
    const emergencyKeywords = ['의식 잃', '숨 못 쉬', '혈당 30 이하', '심한 가슴통증', '가슴 통증', '소변 안 나와'];
    const hasEmergencyKeyword = emergencyKeywords.some(kw => lowercaseMsg.includes(kw));

    if (hasEmergencyKeyword) {
      return {
        answer: `🚨 **응급 상황 경고 프로콜 실행**
환자분의 안전을 위해 다음 단계를 **즉시** 실행해야 합니다.

1. **즉시 119 응급 신고**: 주저하지 말고 119에 연락해 응급 상황임을 알리십시오.
2. **가장 가까운 대학병원 응급실 방문**: 혈액투석 및 만성질환 다학제 진료가 가능한 대형 병원 응급실로 즉시 내원하십시오.
3. **절대 혼자 계시지 마십시오**: 가족이나 보호자에게 현재 상황과 장소를 신속히 알려 동행하십시오.

*대기 중 조치 사항:*
- 의식이 흐려지는 경우, 기도를 확보하고 평평한 곳에 눕히십시오.
- 당뇨 환자의 경우 저혈당 쇼크 의심 시(의식이 있는 상태라면) 즉시 사탕/주스 등의 당분을 섭취하게 하십시오.`,
        agentType: 'medical',
        sources: [
          { title: '질병관리청 국가건강정보포털 응급처치 가이드', org: '질병관리청' }
        ],
        riskLevel: 'emergency'
      };
    }

    // 2. 구어체 -> 표준 의학 용어 매핑 검증
    let mappedConcept = '';
    let mappedRisk: 'normal' | 'caution' | 'danger' | 'emergency' = 'normal';
    let conceptDesc = '';

    for (const [colloquial, info] of Object.entries(COLLOQUIAL_MAPPING)) {
      if (lowercaseMsg.includes(colloquial)) {
        mappedConcept = info.standard;
        mappedRisk = info.risk as any;
        conceptDesc = info.desc;
        break;
      }
    }

    // 3. 환자 프로필 정보 추출 및 RAG 검색 준비
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
      : '환자 프로필 정보 미기입';

    // RAG 쿼리 생성
    const searchTerms = [mappedConcept, userProfile?.ckd_stage, userProfile?.dialysis_type].filter(Boolean).join(' ');
    
    // Pinecone RAG 검색 (symptom 가이드라인)
    const pineconeResults = await queryPinecone('kongdang-papers', searchTerms, 5).catch(err => {
      console.error('Pinecone papers query failed:', err);
      return [];
    });

    const contextStr = pineconeResults.map((match, idx) => 
      `[임상지침 출처 ${idx + 1}]
제목: ${match.metadata?.title || '대한신장학회 만성콩팥병 가이드라인'}
요약: ${match.metadata?.abstract || match.metadata?.content || ''}
기관: ${match.metadata?.org || '대한신장학회/대한당뇨병학회'}
`
    ).join('\n---\n');

    // 4. GPT-4o-mini 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 만성 신장병(CKD) 및 당뇨병(DM) 분야의 최고 권위를 가진 '증상문진 의학 전문의'입니다.
제시된 [환자 프로필]과 [임상지침 정보]를 기반으로 환자의 증상을 안전하고 정확하게 분석하십시오.

[답변 작성 요구 조건]
1. **위험도 판정**: 증상의 중증도에 따라 아래 기준 중 하나를 반드시 명시하십시오.
   - 🟢 정상 (정상 범주 내 단순 이상)
   - 🟡 주의 (정밀 모니터링 필요, 1주일 내 외래 진료 권장)
   - 🔴 위험 (합병증 가속화 위험, 2~3일 내 빠른 외래 또는 입원 요망)
   - 🚨 응급 (급성 쇼크/손상 위험, 즉시 응급실 내원)
2. **의학 용어 설명**: 환자가 입력한 구어체 표현(예: '다리 퉁퉁')을 표준 의학 용어(예: '하체 부종/수분 저류')로 매칭하여, 이해하기 쉬운 비유와 원리를 들어 친절히 설명하십시오.
3. **행동 지침**: 환자가 현재 직장이나 집에서 실천할 수 있는 1차 대처법(예: 다리를 심장보다 높게 올리기, 수분 섭취 제한 등)을 3단계 이내로 제시하십시오.
4. **방문 시 팁**: 병원 내원 시 의사에게 꼭 설명해야 할 질문이나 핵심 단어를 미리 코칭해 주십시오.
5. **disclaimer 첨부**: 모든 답변 끝에는 반드시 면책 문구를 정갈하게 출력하십시오:
   "⚠️ 이 정보는 참고용이며, 의료 진단이나 처방을 대체하지 않습니다. 증상이 심각하거나 응급 상황이라면 즉시 119에 연락하거나 응급실을 방문하세요."`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}
${profileText}
매핑된 임상 개념: ${mappedConcept ? `${mappedConcept} (${conceptDesc})` : '없음'}
매핑 기초 위험도: ${mappedRisk}

[임상지침 정보]
${contextStr || '신장/당뇨 학회 임상 진료 지침 요약 정보 참조 가능'}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const answer = response.choices[0]?.message?.content || '의학 진료 정보 요약에 실패했습니다.';

    // RAG 출처 매핑
    const sources: AgentResponse['sources'] = pineconeResults.map(p => ({
      title: p.metadata?.title || '대한신장학회 만성콩팥병 진료지침',
      org: p.metadata?.org || '대한신장학회',
      url: p.metadata?.url || undefined
    }));

    if (sources.length === 0) {
      sources.push({ title: '대한신장학회 만성콩팥병 진료지침', org: '대한신장학회' });
      sources.push({ title: '대한당뇨병학회 당뇨병 진료지침 2025', org: '대한당뇨병학회' });
    }

    // 최종 위험도 분석 (답변 내 뱃지 텍스트 파싱하여 픽스)
    let finalRisk = mappedRisk;
    if (answer.includes('🔴') || answer.includes('위험')) {
      finalRisk = 'danger';
    } else if (answer.includes('🚨') || answer.includes('응급')) {
      finalRisk = 'emergency';
    } else if (answer.includes('🟡') || answer.includes('주의')) {
      finalRisk = 'caution';
    } else if (answer.includes('🟢') || answer.includes('정상')) {
      finalRisk = 'normal';
    }

    return {
      answer,
      agentType: 'medical',
      sources,
      riskLevel: finalRisk
    };
  } catch (error) {
    console.error('Error in medicalAgent:', error);
    return {
      answer: '의학 상담 가이드를 도출하는 도중 에러가 발생했습니다. 담당 주치의와 상의하세요.',
      agentType: 'medical',
      sources: []
    };
  }
}
