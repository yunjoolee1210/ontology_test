import OpenAI from 'openai';
import { AgentResponse, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// Curated specialized hospital database in Korea for CKD/DM care
interface CuratedHospital {
  name: string;
  grade: string;
  address: string;
  transit: string;
  departments: string[];
  dialysisRoom: boolean;
  dialysisDetails: string;
  phone: string;
  specialty: string;
  description: string;
}

const CURATED_HOSPITALS: CuratedHospital[] = [
  {
    name: '서울대학교병원',
    grade: '상급종합병원',
    address: '서울특별시 종로구 대학로 101',
    transit: '4호선 혜화역 3번 출구 도보 5분',
    departments: ['신장내과', '내분비내과', '이식혈관외과'],
    dialysisRoom: true,
    dialysisDetails: '최첨단 혈액투석 및 복막투석실 운영, 신장이식 센터 보유',
    phone: '1588-5700',
    specialty: '신장이식 대기 등록 및 고난도 신장/당뇨 합병증 수술 전문',
    description: '대한민국 최고의 상급종합병원으로 만성콩팥병 4-5단계 환자의 이식 수술 및 당뇨 망막/족부 복합 합병증 관리에 최적화되어 있습니다.'
  },
  {
    name: '서울아산병원',
    grade: '상급종합병원',
    address: '서울특별시 송파구 올림픽로43길 88',
    transit: '2호선 잠실나루역 1번 출구 셔틀버스 운행',
    departments: ['신장내과', '내분비내과', '신췌장이식외과'],
    dialysisRoom: true,
    dialysisDetails: '24시간 투석 환자 전용 응급 치료 및 이식 후 거부반응 모니터링 시스템 구축',
    phone: '1688-7575',
    specialty: '신장-췌장 동시 이식 및 혈액투석 혈관 접근로 재건 수술',
    description: '최대 규모의 이식 센터를 자랑하며, 당뇨로 인한 신부전이 동반된 복합 환자 관리 능력이 매우 뛰어납니다.'
  },
  {
    name: '삼성서울병원',
    grade: '상급종합병원',
    address: '서울특별시 강남구 일원로 81',
    transit: '3호선 일원역 1번 출구 도보 5분',
    departments: ['신장내과', '내분비대사내과', '혈관외과'],
    dialysisRoom: true,
    dialysisDetails: '야간 투석 센터 운영 (직장인 환자를 위한 밤 11시까지 운영)',
    phone: '1599-3114',
    specialty: '투석 혈관 개통술 및 당뇨병성 족부 합병증(당뇨발) 다학제 클리닉',
    description: '직장인 신부전 환자를 위한 야간 투석 프로그램을 운영 중이며, 당뇨발 합병증 치료 분야에서 높은 성공률을 보입니다.'
  },
  {
    name: '열린편한내과의원 (가상 예시 - 투석 전문 의원)',
    grade: '의원 (투석전문의료기관)',
    address: '서울특별시 강남구 테헤란로 123 4층',
    transit: '2호선 역삼역 3번 출구 도보 2분',
    departments: ['신장내과 (인공신장실)'],
    dialysisRoom: true,
    dialysisDetails: '총 30베드 규모 최신 고유량 투석기 도입, 주 3회 정기 투석 전문',
    phone: '02-555-1234',
    specialty: '직장인 및 지역 거주자를 위한 맞춤형 주야간 정기 투석 케어',
    description: '신장내과 전문의가 상주하며, 대기 시간 없이 직장이나 자택 근처에서 정기적으로 편안하게 혈액투석 서비스를 받을 수 있는 1차 클리닉입니다.'
  },
  {
    name: '보라매병원',
    grade: '종합병원 (시립)',
    address: '서울특별시 동작구 보라매로5길 20',
    transit: '신림선 보라매병원역 1번 출구 도보 1분',
    departments: ['신장내과', '내분비내과'],
    dialysisRoom: true,
    dialysisDetails: '취약계층 및 의료급여 수급자 전용 투석 혜택 연계',
    phone: '02-870-2114',
    specialty: '의료급여 수급권자 투석 비용 지원 및 합리적인 의료비 솔루션',
    description: '서울시립 종합병원으로, 의료비 부담이 큰 5기 투석 환자 및 당뇨 환자분들에게 공공보건의료 혜택 및 사회복지 서비스 연계 프로그램이 잘 구축되어 있습니다.'
  },
  {
    name: '가톨릭대학교 서울성모병원',
    grade: '상급종합병원',
    address: '서울특별시 서초구 반포대로 222',
    transit: '3/7/9호선 고속터미널역 3번 출구 도보 7분',
    departments: ['신장내과', '내분비내과', '장기이식센터'],
    dialysisRoom: true,
    dialysisDetails: '복막투석 환자 홈케어 교육 프로그램 센터 지정 운영',
    phone: '1588-1511',
    specialty: '복막투석 전담 간호사 관리 제도 및 혈액투석 혈관센터 운영',
    description: '국내 최초 복막투석 센터를 개설한 곳으로, 집에서 복막투석을 자가 관리해야 하는 환자들을 위한 체계적인 교육 및 긴급 상담 핫라인이 강점입니다.'
  }
];

export async function hospitalAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    // LLM을 이용해 사용자 쿼리와 프로필에 가장 잘 매칭되는 병원 2~3곳을 추천
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

    const dbContext = CURATED_HOSPITALS.map((h, idx) => 
      `[병원 ${idx + 1}]
이름: ${h.name} (${h.grade})
주소: ${h.address}
교통편: ${h.transit}
진료과: ${h.departments.join(', ')}
투석실 여부: ${h.dialysisRoom ? '있음 (' + h.dialysisDetails + ')' : '없음'}
연락처: ${h.phone}
특화 분야: ${h.specialty}
설명: ${h.description}
`
    ).join('\n---\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병(만성신부전) 및 당뇨병 환자들의 의료기관 안내를 전담하는 전문 의료 네비게이터 '병원 찾기 에이전트'입니다.
제공된 [추천 가능 병원 풀]에서 사용자의 질문(지역 요청, 진료과, 투석실 필요 여부 등) 및 [환자 프로필] 컨텍스트에 부합하는 병원을 최대 3개 선택하여 맞춤형으로 안내하십시오.

[작성 분량 제한]
- 핵심 내용 위주로 구성하여 공백 포함 700자 내외로 매우 간결하고 친절하게 답변을 작성하십시오.

[답변 가이드라인]
1. 환자의 상황(예: 이미 혈액투석을 받는 환자에게는 투석실과 접근성을 강조하고, 4기 이식 준비 환자에게는 대학병원 이식센터를 강조)에 따라 각 병원의 추천 사유를 1줄씩 구체적으로 명시하세요.
2. 만약 환자가 서울 이외의 다른 지역을 물어보거나 풀에 없는 특화 조건을 물어볼 경우, 풀에 있는 병원을 우선 매칭하되 "전국 단위 실시간 병원 조회가 필요한 경우 건강보험심사평가원(HIRA) 사이트나 담당 주치의가 발급하는 진료의뢰서를 지참하여 상급 종합병원을 예약하는 절차"를 친절히 보완해 설명하십시오.
3. 교통편, 연락처, 예약 시 주의사항(예: 3차 대학병원 방문 시에는 1차 또는 2차 병원의 진료의뢰서가 반드시 지참되어야 요양급여 적용을 받을 수 있다는 점)을 명확하게 마크다운으로 깔끔하게 포맷하여 제공하세요.`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n${profileText}\n\n[추천 가능 병원 풀]\n${dbContext}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    // 선택된 병원들을 추출하여 소스로 바인딩 (간단하게 매칭되는 병원 이름을 소스로 지정)
    const answer = response.choices[0]?.message?.content || '병원 정보를 생성하는 데 실패했습니다.';
    const sources: Array<{ title: string; org: string; url?: string }> = [];

    CURATED_HOSPITALS.forEach(h => {
      if (answer.includes(h.name)) {
        sources.push({
          title: `${h.name} (${h.grade})`,
          org: '건강보험심사평가원(HIRA) 제공',
          url: `https://map.naver.com/v5/search/${encodeURIComponent(h.name)}`
        });
      }
    });

    if (sources.length === 0) {
      sources.push({
        title: '건강보험심사평가원(HIRA) 병원/의원 검색 서비스',
        org: '건강보험심사평가원',
        url: 'https://www.hira.or.kr/'
      });
    }

    return {
      answer,
      agentType: 'hospital',
      sources
    };
  } catch (error) {
    console.error('Error in hospitalAgent:', error);
    return {
      answer: '병원 정보를 조회하는 과정에서 예상치 못한 오류가 발생했습니다.',
      agentType: 'hospital',
      sources: []
    };
  }
}
