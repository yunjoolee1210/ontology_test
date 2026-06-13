import OpenAI from 'openai';
import { entityExtractor } from './entityExtractor';
import { searchWelfareDocs } from '../rag/supabaseClient';
import { queryPinecone } from '../rag/pineconeClient';
import { AgentResponse, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function welfareAgent(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    // 1. 엔티티 및 변수 추출
    const entities = await entityExtractor(message);
    const keywordsQuery = entities.keywords.join(' ');
    
    // 질병 필터 설정
    let diseaseFilter: 'CKD' | 'DM' | 'BOTH' = 'BOTH';
    if (userProfile?.ckd_stage && userProfile?.ckd_stage !== '해당없음') {
      diseaseFilter = 'CKD';
    }
    if (userProfile?.diabetes_type && userProfile?.diabetes_type !== '없음') {
      diseaseFilter = diseaseFilter === 'CKD' ? 'BOTH' : 'DM';
    }

    // 2. Supabase FTS 검색 실행
    let welfareDocs = await searchWelfareDocs(keywordsQuery, diseaseFilter, 5).catch(err => {
      console.error('Supabase welfare search failed, falling back:', err);
      return [];
    });

    // 3. Supabase 결과가 없는 경우 Pinecone 복지인덱스('kongdang-welfare')로 폴백 검색
    if (welfareDocs.length === 0) {
      console.log('No results in Supabase FTS. Querying Pinecone kongdang-welfare...');
      const pineconeMatches = await queryPinecone('kongdang-welfare', keywordsQuery, 5).catch(err => {
        console.error('Pinecone welfare search failed:', err);
        return [];
      });

      welfareDocs = pineconeMatches.map(match => ({
        id: match.id,
        content: match.metadata?.content || match.metadata?.abstract || '',
        org: match.metadata?.org || '복지 지원처',
        url: match.metadata?.url || '',
        rank: match.score,
        title: match.metadata?.title || '공공 복지 혜택 안내',
        disease: match.metadata?.disease as any,
      }));
    }

    // 환자 프로필 정보 포맷팅
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

    // 4. 복제/요약 생성을 위한 컨텍스트 구성
    const contextStr = welfareDocs.map((doc, idx) => 
      `[복지 정보 ${idx + 1}]
제목: ${doc.title || '만성질환 의료복지 지원'}
제공기관: ${doc.org}
대상 질병: ${doc.disease || '공통'}
지원내용: ${doc.content}
`
    ).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 만성질환(콩팥병, 당뇨병) 환자 대상의 국가 의료복지 혜택 및 공공 의료비 지원 제도 신청을 안내하는 '의료복지 전문 사회복지사'입니다.
제시된 [환자 프로필]과 [복지 정책 정보]를 매칭하여 환자에게 가장 정확한 지원금 혜택 및 신청 절차를 조언하십시오.

[핵심 판정 가이드라인]
- 환자가 **신장 투석 중(혈액/복막)**이거나 **5기**라면, 건강보험 산정특례(V001) 등록을 통한 본인부담금 감면(요양급여 10%만 부담) 및 장애인 등록 요건(신장장애인 등급 기준)을 1순위로 안내하세요.
- 환자가 **1형 당뇨**이거나 인슐린 치료 환자라면, 인슐린 펌프 및 당뇨병 소모성 재료(인슐린 주사바늘, 혈당측정 검사지 등) 건강보험 급여 지원 요건과 환급 신청 절차를 안내하세요.
- 환자의 소득 조건이나 복약 상태에 따라 보건소 만성질환 관리 지원이나 지자체 취약계층 긴급의료비 지원 제도를 설명하십시오.

[출력 포맷 요구사항]
1. **신청 가능한 복지 제도 리스트** (중요도 순서)
2. **제도별 지원 대상 요건 체크리스트** (체크박스 마크다운 \`- [ ]\` 사용)
3. **구비 서류 및 온/오프라인 신청 처** (전화번호 및 담당 기관 포함)
4. 향후 질환이 진행되었을 때(예: 4기에서 5기로 전환 시) 추가로 누릴 수 있는 예비 혜택 안내
5. 따뜻하고 위로가 되는 전문 상담원 어조`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}\n\n${profileText}\n\n[복지 정책 정보]\n${contextStr || '만성질환자 대상 기본 의료비 경감 지원 혜택 및 산정특례 기본 고시 참조'}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const answer = response.choices[0]?.message?.content || '복지 정보 요약에 실패했습니다.';

    // 출처 구성
    const sources: AgentResponse['sources'] = welfareDocs.map(doc => ({
      title: doc.title || '국가 복지 혜택 안내',
      url: doc.url || undefined,
      org: doc.org,
    }));

    if (sources.length === 0) {
      sources.push({ title: '건강보험 산정특례 등록 기준 고시', org: '국민건강보험공단' });
      sources.push({ title: '장애인복지법 시행령 장애등록기준', org: '보건복지부' });
    }

    return {
      answer,
      agentType: 'welfare',
      sources,
    };
  } catch (error) {
    console.error('Error in welfareAgent:', error);
    return {
      answer: '국가 복지 지원 제도 정보를 수집하는 도중 오류가 발생했습니다. 자세한 정보는 국민건강보험공단(1577-1000)으로 문의해 보세요.',
      agentType: 'welfare',
      sources: [],
    };
  }
}
