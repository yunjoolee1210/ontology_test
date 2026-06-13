import OpenAI from 'openai';
import { intentClassifier } from './intentClassifier';
import { medicalAgent } from './medicalAgent';
import { dietAgent } from './dietAgent';
import { welfareAgent } from './welfareAgent';
import { researchAgent } from './researchAgent';
import { drugAgent } from './drugAgent';
import { hospitalAgent } from './hospitalAgent';
import { AgentResponse, Intent, UserProfile } from '../types/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export async function orchestrator(message: string, userProfile?: UserProfile): Promise<AgentResponse> {
  try {
    let rawAnswer = '';
    let primaryAgentType: Intent = 'general';
    let allSources: any[] = [];
    let primaryRisk: 'normal' | 'caution' | 'danger' | 'emergency' | undefined = undefined;

    // 1. 의도 분류 호출 (다중 의도 감지 가능)
    const intents = await intentClassifier(message);
    console.log(`Orchestrator: Message "${message}" classified as intents:`, intents);

    // 'general'만 단독이거나, 아무 의도가 없으면 general로 즉시 처리
    if (intents.length === 0 || (intents.length === 1 && intents[0] === 'general')) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 콩팥병 및 당뇨 환자들을 위한 친절한 건강 코치입니다. 식단, 생활 습관, 일반 관리 등에 대해 쉽고 따뜻하게 한국어로 조언해 주세요. 단, 구체적인 복지 혜택이나 최신 임상 시험/논문에 대해서는 특화 에이전트로 연계될 수 있으니 일상적인 관리에 주력하세요.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.5,
        max_tokens: 800,
      });

      rawAnswer = response.choices[0]?.message?.content || '죄송합니다. 답변을 생성하지 못했습니다.';
      primaryAgentType = 'general';
      allSources = [];
    } else {
      // 2. 분류된 의도에 맞는 에이전트들을 병렬로 실행
      const agentPromises: Promise<AgentResponse>[] = [];

      // 'general' 의도가 다른 특화 의도와 섞여있다면 특화 의도에 집중하기 위해 제외
      const activeIntents = intents.filter(i => i !== 'general');

      activeIntents.forEach(intent => {
        switch (intent) {
          case 'medical':
            agentPromises.push(medicalAgent(message, userProfile));
            break;
          case 'nutrition':
          case 'lifestyle':
            agentPromises.push(dietAgent(message, userProfile));
            break;
          case 'welfare':
            agentPromises.push(welfareAgent(message, userProfile));
            break;
          case 'research':
            agentPromises.push(researchAgent(message, userProfile));
            break;
          case 'drug':
            agentPromises.push(drugAgent(message)); // drugAgent doesn't strictly need userProfile yet
            break;
          case 'hospital':
            agentPromises.push(hospitalAgent(message, userProfile));
            break;
        }
      });

      const agentResponses = await Promise.all(agentPromises);

      // 에이전트 실행 결과가 없는 경우 일반 처리로 전환
      if (agentResponses.length === 0) {
        rawAnswer = '죄송합니다. 적절한 전문 에이전트를 매칭하지 못해 일상 건강 가이드로 갈음합니다.';
        primaryAgentType = 'general';
        allSources = [];
      } else if (agentResponses.length === 1) {
        rawAnswer = agentResponses[0].answer;
        primaryAgentType = agentResponses[0].agentType;
        allSources = agentResponses[0].sources;
        primaryRisk = agentResponses[0].riskLevel;
      } else {
        // 3. 복수 에이전트인 경우 응답 통합 합성 (LLM Synthesizer)
        console.log(`Orchestrator: Synthesizing ${agentResponses.length} agent responses.`);
        
        // 개별 에이전트들의 응답 텍스트 병합
        const synthesisContext = agentResponses.map(res => 
          `[에이전트: ${res.agentType}]
응답: ${res.answer}
`
        ).join('\n---\n');

        const synthesisResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `당신은 콩팥병 및 당뇨 환자를 돕는 스마트 AI 헬스케어 오케스트레이터입니다.
각 전문 분야 에이전트들이 도출해 낸 개별 [의견 목록]을 기반으로 하여, 사용자의 질문에 대한 하나의 유기적이고 일관된 한국어 통합 응답을 합성해 주세요.

[합성 주의사항]
1. 서로 다른 의도의 정보를 자연스럽게 병합하고 어색한 중복 표현은 제거하세요. (예: 두 에이전트가 모두 인사하거나 주의사항을 각자 말하는 부분 정리)
2. 각 에이전트가 제시한 핵심 임상적/식단/복지/병원 가이드는 누락 없이 정확히 포함하세요.
3. 보기 쉽게 마크다운 구조(소제목, 글머리 기호 등)를 사용해 가독성을 대폭 높이세요.
4. 환자를 위하고 안심시키는 친절하고 세심한 어조를 유지하세요.`
            },
            {
              role: 'user',
              content: `사용자 질문: ${message}\n\n[에이전트별 의견 목록]\n${synthesisContext}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1200,
        });

        rawAnswer = synthesisResponse.choices[0]?.message?.content || '통합 답변 생성에 실패했습니다.';
        primaryAgentType = activeIntents[0] || 'general';
        primaryRisk = agentResponses.find(r => r.riskLevel)?.riskLevel;

        const seenTitles = new Set<string>();
        agentResponses.forEach(res => {
          res.sources.forEach(src => {
            if (!seenTitles.has(src.title.toLowerCase())) {
              seenTitles.add(src.title.toLowerCase());
              allSources.push(src);
            }
          });
        });
      }
    }

    // 4. 포스트 프로세싱 (700자 이내 요약 + 주의사항 유지 + 다음 task/추가정보 탐색 유도 추가)
    const userProfileText = userProfile 
      ? `(환자 상태 - 콩팥 단계: ${userProfile.ckd_stage || '미입력'}, 투석: ${userProfile.dialysis_type || '해당없음'}, 당뇨: ${userProfile.diabetes_type || '없음'})`
      : '';

    const postProcessResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 콩팥병 및 당뇨 환자를 위한 AI 케어 상담 요약 전문가입니다.
사용자 질문에 대한 전문 에이전트의 [원본 답변]을 환자가 읽기 편하게 가공하고 요약해 주세요.

[요약 및 가공 규칙]
1. 답변 핵심 본문(마크다운 형식 유지)은 공백 포함 700자 이내로 정갈하게 작성하십시오. 
   - 정보가 너무 생략되어 부정확해지지 않도록 간결하고 함축적인 문장으로 요약하십시오.
   - 원본 답변에 있는 위험도 뱃지(🟢 정상, 🟡 주의, 🔴 위험, 🚨 응급 등) 및 3중 안전 판정 뱃지(🟢 안전, 🟡 소량, 🔴 주의, ⛔ 금지 등)는 반드시 그대로 유지하십시오.
2. 임상적/의학적 주의사항(주의, 경고, 위험 요인, 피해야 할 점) 및 하단의 면책 고지(disclaimer - "※ 이 정보는 참고용이며...")는 반드시 한 글자도 빠짐없이 또는 핵심 위주로 명시하십시오. (가장 중요)
3. 환자의 상황(콩팥 단계, 투석 여부, 당뇨 여부 등)에 맞추어 사용자가 이어서 질문하기 좋은 2~3개의 후속 행동/유도 질문(Suggestions)을 반드시 생성하십시오.
4. Suggestions는 다음 형식으로 답변 맨 하단에 [SUGGESTIONS] 태그 내에 포함하십시오. 이 블록은 700자 제한 규칙 계산에서 완전히 제외됩니다.

[Suggestions 형식 규칙]
- 각 행은 반드시 "- {아이콘} {짧은 버튼 텍스트}: {사용자가 실제로 전송할 전체 질문 프롬프트}" 형식이어야 합니다.
- 아이콘은 관련 있는 이모지(🥗, 🏥, 🔬, 🩺, 🏛️ 등)를 사용하십시오.
- 짧은 버튼 텍스트는 15자 내외로 간결하게 작성하고, 콜론(:) 뒤에 질문 프롬프트를 적어주십시오.

예시:
[SUGGESTIONS]
- 🥗 저칼륨 식단 알아보기: 제 콩팥 단계와 당뇨 상태에 맞춘 저칼륨 식단 예시와 조리 팁을 자세히 알려주세요.
- 🏥 야간 투석 병원 찾기: 제 투석 조건을 고려하여 근처에서 야간에 혈액 투석이 가능한 전문 병원을 찾아주세요.
[/SUGGESTIONS]`
        },
        {
          role: 'user',
          content: `사용자 질문: ${message} ${userProfileText}\n\n[원본 답변]\n${rawAnswer}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const finalAnswer = postProcessResponse.choices[0]?.message?.content || rawAnswer;

    return {
      answer: finalAnswer,
      agentType: primaryAgentType,
      sources: allSources,
      riskLevel: primaryRisk
    };
  } catch (error) {
    console.error('Error in Orchestrator:', error);
    return {
      answer: '죄송합니다. 답변을 취합하고 합성하는 도중 에러가 발생했습니다.',
      agentType: 'general',
      sources: []
    };
  }
}
