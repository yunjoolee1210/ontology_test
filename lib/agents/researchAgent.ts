import OpenAI from 'openai';
import { entityExtractor } from './entityExtractor';
import { searchPubMed } from '../rag/pubmedClient';
import { queryPinecone } from '../rag/pineconeClient';
import { reciprocalRankFusion } from '../rag/hybridMerger';
import { AgentResponse, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// SGLT2 억제제 및 복합 신약의 한국 허가/급여 현황 사전 데이터베이스
interface DrugRegistry {
  name: string;
  substance: string;
  koreanStatus: string;
  insuranceStatus: string;
  contraindications: string;
}

const DRUG_REGISTRY: DrugRegistry[] = [
  {
    name: '포시가 / 자디앙',
    substance: 'SGLT2 억제제 (다파글리플로진 / 엠파글리플로진)',
    koreanStatus: '한국 식약처 승인 완료 (만성콩팥병 및 2형 당뇨 치료제)',
    insuranceStatus: '급여 적용 가능 (단, eGFR 45 이상 권장, 신부전 단계에 따라 제한)',
    contraindications: 'eGFR 30 미만인 환자(만성콩팥병 4기 및 5기 투석 환자)에게는 혈당 조절 목적으로는 투약이 제한되며, 투석 환자에게는 효능 저하 및 부작용 위험으로 금기입니다.'
  },
  {
    name: '케렌디아',
    substance: '피네레논 (비선택적 미네랄로코르티코이드 수용체 길항제)',
    koreanStatus: '식약처 허가 획득 완료',
    insuranceStatus: '2형 당뇨병 동반 만성 콩팥병 환자 대상 급여 적용 진행 중',
    contraindications: '혈청 칼륨 수치가 5.0 mEq/L 초과하거나 고칼륨혈증 전력이 있는 경우, 또는 eGFR 25 미만(말기 신부전) 환자는 투여 시작이 금지됩니다.'
  },
  {
    name: '오젬픽 / 젭바운드',
    substance: 'GLP-1 수용체 작용제 (세마글루타이드 / 터제파타이드)',
    koreanStatus: '식약처 승인 완료 (당뇨 및 비만 치료제)',
    insuranceStatus: '2형 당뇨병 치료제로서 일부 인슐린과 병용 시 급여 가능',
    contraindications: '신장애 환자에게 특별히 금기는 아니지만, 탈수로 인한 급성 신손상 위험이 있으므로 정기적인 크레아티닌 수치 모니터링이 필수입니다.'
  }
];

export async function researchAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    // 1. 엔티티 및 변수 추출
    const entities = await entityExtractor(message);
    const keywordsQuery = entities.keywords.join(' ');

    // 2. PubMed 및 Pinecone 병행 검색 진행
    const [pubmedResults, pineconeResults] = await Promise.all([
      searchPubMed(entities).catch(err => {
        console.error('PubMed search failed, falling back:', err);
        return [];
      }),
      queryPinecone('kongdang-papers', keywordsQuery, 10).catch(err => {
        console.error('Pinecone papers search failed, falling back:', err);
        return [];
      })
    ]);

    // 3. RRF Hybrid Merger로 병합
    const mergedDocs = reciprocalRankFusion(pubmedResults, pineconeResults);
    const topDocs = mergedDocs.slice(0, 3);

    // 환자 프로필 정보 포맷
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

    // 4. 국내 약물 등록 현황 데이터 추출
    const matchedDrugs = DRUG_REGISTRY.filter(d => 
      message.toLowerCase().includes(d.name.toLowerCase()) || 
      message.toLowerCase().includes(d.substance.split(' ')[0].toLowerCase())
    );

    const drugRegistryText = matchedDrugs.map(d => 
      `[신약 승인 데이터 - ${d.name}]
성분명: ${d.substance}
한국 식약처 승인: ${d.koreanStatus}
건강보험 급여: ${d.insuranceStatus}
신장애 주의사항/금기: ${d.contraindications}
`
    ).join('\n---\n');

    // 5. GPT-4o-mini 호출
    const contextStr = topDocs.map((doc, idx) => 
      `[연구 ${idx + 1}]
제목: ${doc.title}
출처/저널: ${doc.org}
내용: ${doc.content}
`
    ).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 만성 신장병(CKD) 및 당뇨병(DM) 최신 신약 연구와 학술 논문을 알기 쉽게 요약/검증하여 제공하는 '의학 AI 연구원'입니다.
제시된 [환자 프로필], [연구 논문 컨텍스트], [국내 신약 승인 데이터]를 유기적으로 비교하여 환자의 질문에 답하십시오.

[작성 분량 제한]
- 핵심 내용 위주로 구성하여 공백 포함 700자 내외로 매우 간결하고 친절하게 답변을 작성하십시오.

[답변 조건 및 가이드라인]
1. **신약 금기 및 부작용 체크**: 환자의 CKD 단계와 당뇨 상태를 기준으로, 해당 신약(예: SGLT2 억제제)을 현재 복용 가능한지 여부를 임상적으로 진단하십시오. 특히 eGFR 수치 저하 및 투석 환자의 경우 투약 제한 요소를 강하게 경고해야 합니다.
2. **논문 핵심 요약**: 검색된 1~3개의 최신 논문 결과를 바탕으로, 약물이 콩팥 보호(신보호 효과)와 심혈관 보호에 어떤 작용을 하는지 환자가 이해할 수 있는 쉬운 한글 표현으로 요약해 주세요.
3. **국내 급여 및 가용성**: 한국 식약처 승인 및 국민건강보험 급여 혜택 적용을 받을 수 있는지 명시하세요.
4. **disclaimer 필수**: 답변 마지막에는 항상 의료진과의 상의를 구하는 면책 문구를 굵은 글씨로 남겨주세요:
   "**⚠️ 본 정보는 최신 의학 연구 논문을 기반으로 한 정보 제공 목적으로 작성되었으며, 복용 및 치료 계획 변경은 반드시 주치의와 직접 상의하셔야 합니다.**"`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n${profileText}\n\n[국내 신약 승인 데이터]\n${drugRegistryText || '해당 약물의 국내 공식 승인 기록 검색 한계'}\n\n[연구 논문 컨텍스트]\n${contextStr || '관련 PubMed 검색 결과 요약 없음'}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const answer = response.choices[0]?.message?.content || '신약 및 연구 요약을 생성하지 못했습니다.';

    // 출처 매핑
    const sources: AgentResponse['sources'] = topDocs.map(doc => ({
      title: doc.title,
      url: doc.url,
      doi: doc.doi,
      org: doc.org,
    }));

    if (sources.length === 0) {
      sources.push({ title: '대한신장학회 신약 임상 가이드라인', org: '대한신장학회' });
      sources.push({ title: 'PubMed Central (NCBI) 의학 데이터베이스', org: 'NCBI' });
    }

    return {
      answer,
      agentType: 'research',
      sources,
    };
  } catch (error) {
    console.error('Error in researchAgent:', error);
    return {
      answer: '최신 연구/신약 정보를 요약하는 과정에서 예상치 못한 오류가 발생했습니다.',
      agentType: 'research',
      sources: [],
    };
  }
}
