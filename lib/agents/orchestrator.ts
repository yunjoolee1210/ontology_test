import OpenAI from 'openai';
import { UserProfile, AgentResponse, Intent } from '../types/chat';
import { intentClassifier } from './intentClassifier';
import { medicalAgent } from './medicalAgent';
import { dietAgent } from './dietAgent';
import { welfareAgent } from './welfareAgent';
import { researchAgent } from './researchAgent';
import { drugAgent } from './drugAgent';
import { lifestyleAgent } from './lifestyleAgent';
import { hospitalAgent } from './hospitalAgent';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function orchestrator(
  message: string,
  userProfile?: UserProfile,
  ragMode: 'Rag' | 'Rag+Ontology' | 'Rag+Ontology+Lora' = 'Rag'
): Promise<AgentResponse> {
  try {
    // 1. 의도(Intent) 분석
    const intents = await intentClassifier(message);

    // 2. 의도에 매칭되는 전문 에이전트 비동기 병렬 호출 실행
    const promises: Promise<AgentResponse>[] = [];
    const activeAgents: Intent[] = [];

    intents.forEach((intent) => {
      if (intent === 'medical') {
        promises.push(medicalAgent(message, userProfile));
        activeAgents.push('medical');
      } else if (intent === 'nutrition') {
        promises.push(dietAgent(message, userProfile));
        activeAgents.push('nutrition');
      } else if (intent === 'lifestyle') {
        promises.push(lifestyleAgent(message));
        activeAgents.push('lifestyle');
      } else if (intent === 'welfare') {
        promises.push(welfareAgent(message, userProfile));
        activeAgents.push('welfare');
      } else if (intent === 'research') {
        promises.push(researchAgent(message, userProfile));
        activeAgents.push('research');
      } else if (intent === 'drug') {
        promises.push(drugAgent(message));
        activeAgents.push('drug');
      } else if (intent === 'hospital') {
        promises.push(hospitalAgent(message, userProfile));
        activeAgents.push('hospital');
      }
    });

    let agentResponses: AgentResponse[] = [];

    // 만약 특화 의도 매칭이 없거나 general만 있는 경우 폴백 처리
    if (promises.length === 0) {
      // 일반 대화 및 폴백 생성
      const fallbackRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 만성 콩팥병 및 당뇨 복합 환자를 돕는 친절한 케어 파트너입니다. 의료 진단이 아닌 일반 정보 수준에서 따뜻하고 안전하게 답해주십시오.',
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.5,
      });
      const answer = fallbackRes.choices[0]?.message?.content || '죄송합니다. 답변을 구성하지 못했습니다.';
      return {
        answer,
        agentType: 'general',
        sources: [{ title: '콩당콩당 기본 건강 케어 가이드라인', org: '콩당콩당 헬스케어' }],
      };
    }

    // 에이전트 응답 수집
    agentResponses = await Promise.all(promises);

    // 3. 수집된 개별 에이전트 답변 및 출처 수집
    const subAnswers = agentResponses.map(
      (res) => `[에이전트 분야: ${res.agentType}]\n${res.answer}`
    ).join('\n\n');

    // 출처 중복 제거 취합
    const allSourcesMap = new Map<string, { title: string; url?: string; doi?: string; org?: string }>();
    agentResponses.forEach((res) => {
      res.sources?.forEach((s) => {
        allSourcesMap.set(s.title, s);
      });
    });
    const combinedSources = Array.from(allSourcesMap.values());

    // 대표 에이전트 타입 결정 (첫 번째 매칭)
    const primaryAgentType = agentResponses[0]?.agentType || 'medical';

    // 4. ragMode별 특화 시스템 프롬프트를 사용하여 최종 오케스트레이션 수행
    const profileText = userProfile
      ? `[환자 개인 건강 프로필]
- eGFR(사구체여과율): ${userProfile.egfr || '미입력'} mL/min/1.73m²
- 콩팥병 단계: ${userProfile.ckd_stage || '미입력'}
- 투석 방법: ${userProfile.dialysis_type || '해당없음'}
- 당뇨 유형: ${userProfile.diabetes_type || '없음'}
- 복용 약물: ${userProfile.medication || '미입력'}
- 기타 질환: ${(userProfile.other_conditions || []).join(', ') || '없음'}
- 당 섭취 제한량: ${userProfile.limit_sugar ? userProfile.limit_sugar + 'g 이하' : '설정 필요'}
- 나트륨 제한량: ${userProfile.limit_sodium ? userProfile.limit_sodium + 'mg 이하' : '설정 필요'}
- 칼륨 제한량: ${userProfile.limit_potassium ? userProfile.limit_potassium + 'mg 이하' : '설정 필요'}
- 인 제한량: ${userProfile.limit_phosphorus ? userProfile.limit_phosphorus + 'mg 이하' : '설정 필요'}`
      : '환자 건강 프로필 정보 없음';

    let systemPrompt = `당신은 만성 콩팥병, 당뇨병, 고혈압 복합 환자를 케어하는 종합 AI 헬스파트너 '콩당콩당'의 중앙 통제 오케스트레이터입니다.
아래 제공된 [환자 개인 건강 프로필]과, 다중 에이전트들이 생성해낸 [분야별 전문 답변들]을 기반으로 환자용 최종 종합 답변을 1개의 완성도 높은 메시지로 합성해 주십시오.

[합성 작성 규칙]
- 분야별 에이전트들이 작성한 전문 임상 정보 및 주의사항을 누락하지 말고 유기적으로 결합하여 최종 메시지를 만드십시오.
- 중복되는 내용은 자연스럽게 합치고, 상충되는 임상 지침이 있다면 환자 상태(특히 eGFR 저하 및 투석 상황)를 기준으로 최우선 조율하십시오.
- 작성 분량은 공백 포함 800자 내외로 명확하고 쉽게 전달할 수 있도록 구성하십시오.

[의료 AI 가드레일 및 Out-of-Scope 규정]
- **서비스 범위 제한**: 만성 콩팥병(CKD), 당뇨병(DM), 고혈압(HTN) 이외의 질환(암, 코로나, 치과 질환 등)이나 비의학적 일반 분야(주식, 코딩, 연예 등)에 대해서는 절대 조언을 제공하지 마십시오. 범위를 벗어난 질의가 탐지될 경우 반드시 정중하게 사절 메시지를 답변하십시오.
- **임의 진단 금지**: 환자의 자가 진단을 확증하거나 단정 짓는 표현을 절대 사용하지 마십시오.
- **처방 및 투약 임의 조절 금지**: 임의로 약물 복용량을 변경하거나 복용을 중단하도록 권유하는 문구를 절대 배제하십시오.
- **대면 진료 권장 및 면책 고지**: 모든 답변의 끝이나 맥락에 반드시 주치의 대면 상담 및 전문의 처방이 최우선임을 고지하고 면책 문구를 정갈하게 출력하십시오.

`;

    // RAG Mode별 Persona 및 System Instruction 세부 주입
    if (ragMode === 'Rag') {
      systemPrompt += `[RAG 모드 적용 지침: Rag (기본 RAG)]
- 매우 드라이하고 표준적이며 기계적인 텍스트 검색 정보 나열형 어조로 일관하십시오.
- 정보 전달에 집중하고, 미사여구나 감정적 위로, 친절한 수식어는 철저히 배제하고 사실 위주로 설명하십시오.
- 환자 프로필에 대한 개별적인 다정다감한 케어링 어조를 절대 섞지 마십시오.
`;
    } else if (ragMode === 'Rag+Ontology') {
      systemPrompt += `[RAG 모드 적용 지침: Rag+Ontology (온톨로지 지식 융합)]
- 의학적 용어 및 질환 간의 논리적인 '인과 관계(온톨로지)'를 구조적으로 설명하여 해설가처럼 논리 정연하게 작성하십시오.
- 예: 'eGFR 수치 저하로 인해 신장 필터 기능이 소실됨 -> 칼륨 배출이 어려워짐 -> 혈중 칼륨 농도가 비정상적으로 상승(고칼륨혈증) -> 부정맥 유발'과 같은 의학적 기전을 명시적으로 파싱하고 연결하여 설명하십시오.
- 차분하고 학구적이며 논리적인 임상 지식 위주의 톤을 철저하게 유지하십시오.
`;
    } else {
      // Rag+Ontology+Lora
      systemPrompt += `[RAG 모드 적용 지침: Rag+Ontology+Lora (미세조정 환자 맞춤)]
- 환자의 건강 프로필 수치(예: eGFR 수치, 당뇨 유형, 제한 섭취량 등)를 상세히 호명하고 인용하십시오. (예: "OO님은 현재 eGFR이 XX이시고 투석을 하지 않는 단계이시므로...")
- 환자의 상황에 공감하며 따뜻하고 감정적인 케어링이 들어간 다정다감한 보호자/간병인 톤으로 말해주십시오.
- "너무 걱정 마세요", "차근차근 실천해 봅시다"와 같은 공감적 교감 멘트와 함께, 맞춤형 영양 한도치를 짚어주어 최고의 밀착 관리를 받는 느낌을 주십시오.
`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `사용자 질문: ${message}

${profileText}

[분야별 전문 답변들]
${subAnswers}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const finalAnswer = response.choices[0]?.message?.content || '종합 답변 생성에 실패했습니다.';

    return {
      answer: finalAnswer,
      agentType: primaryAgentType,
      sources: combinedSources,
    };
  } catch (error) {
    console.error('Orchestrator overall execution failed:', error);
    return {
      answer: '오케스트레이터 분석 수행 중 예기치 못한 에러가 발생했습니다. 전문의와 상의하십시오.',
      agentType: 'medical',
      sources: [],
    };
  }
}
