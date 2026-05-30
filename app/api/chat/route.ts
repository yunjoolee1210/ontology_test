import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { intentClassifier } from '../../../lib/agents/intentClassifier';
import { researchAgent } from '../../../lib/agents/researchAgent';
import { welfareAgent } from '../../../lib/agents/welfareAgent';
import { checkSafety } from '../../../lib/rag/safetyChecker';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, message: directMessage } = await req.json().catch(() => ({}));
    
    // useChat은 body에 messages 배열을 전송하고, 단독 호출 시에는 message를 직접 전송할 수 있음
    let userMessage = '';
    if (directMessage && typeof directMessage === 'string') {
      userMessage = directMessage;
    } else if (messages && Array.isArray(messages) && messages.length > 0) {
      userMessage = messages[messages.length - 1].content;
    }

    userMessage = userMessage.trim();

    // ① message 유효성 검사 (빈값 거부, 500자 초과 거부)
    if (!userMessage) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    if (userMessage.length > 500) {
      return NextResponse.json({ error: '메시지는 최대 500자까지 입력 가능합니다.' }, { status: 400 });
    }

    // 의료 안전 가드레일 체크
    const safety = checkSafety(userMessage);
    if (!safety.isSafe) {
      // 안전하지 않은 응답은 바로 스트리밍 형태로 안전 메시지 전송
      const safeStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(safety.reason || '안전 가이드라인 위배로 답변이 불가합니다.'));
          controller.close();
        }
      });
      return new Response(safeStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Agent-Type': 'general',
          'Access-Control-Expose-Headers': 'X-Agent-Type',
        }
      });
    }

    // ② intentClassifier(message) 호출
    const intent = await intentClassifier(userMessage);
    console.log(`Classified intent: ${intent} for message: "${userMessage}"`);

    // ③ intent === 'general' (에이전트 미할당, 일반 GPT-4o-mini 직접 스트리밍)
    if (intent === 'general') {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 콩팥병 및 당뇨 환자들을 위한 친절한 건강 코치입니다. 식단, 생활 습관, 일반 관리 등에 대해 쉽고 따뜻하게 한국어로 조언해 주세요. 단, 구체적인 복지 혜택이나 최신 임상 시험/논문에 대해서는 특화 에이전트로 연계될 수 있으니 일상적인 관리에 주력하세요.'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        stream: true,
        temperature: 0.5,
      });

      // OpenAI 스트림을 ReadableStream으로 변환
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              const text = chunk.choices[0]?.delta?.content || '';
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            }
          } catch (e) {
            console.error('Error during general stream:', e);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Agent-Type': 'general',
          'Access-Control-Expose-Headers': 'X-Agent-Type',
        }
      });
    }

    // ④ intent === 'research' (연구논문 Agent 실행)
    if (intent === 'research') {
      try {
        const agentResult = await researchAgent(userMessage);
        
        // 출처 요약을 답변 밑에 이쁘게 덧붙임
        let finalAnswer = agentResult.answer;
        if (agentResult.sources && agentResult.sources.length > 0) {
          finalAnswer += '\n\n🔍 **최신 논문 및 학술 연구 출처**:\n';
          agentResult.sources.forEach((s, idx) => {
            const doiStr = s.doi ? ` (DOI: ${s.doi})` : '';
            const urlStr = s.url ? ` [[링크](${s.url})]` : '';
            finalAnswer += `${idx + 1}. *${s.title}* - ${s.org}${doiStr}${urlStr}\n`;
          });
        }

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(finalAnswer));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Agent-Type': 'research',
            'X-Agent-Sources': JSON.stringify(agentResult.sources),
            'Access-Control-Expose-Headers': 'X-Agent-Type, X-Agent-Sources',
          }
        });
      } catch (err) {
        console.error('Research agent error, falling back to general:', err);
        // 에러 시 general 폴백
        return fallbackToGeneral(userMessage);
      }
    }

    // ⑤ intent === 'welfare' (의료복지 Agent 실행)
    if (intent === 'welfare') {
      try {
        const agentResult = await welfareAgent(userMessage);
        
        let finalAnswer = agentResult.answer;
        if (agentResult.sources && agentResult.sources.length > 0) {
          finalAnswer += '\n\n🏥 **복지/지원 정보 출처**:\n';
          agentResult.sources.forEach((s, idx) => {
            const urlStr = s.url ? ` [[공식 사이트](${s.url})]` : '';
            finalAnswer += `${idx + 1}. *${s.title}* - ${s.org}${urlStr}\n`;
          });
        }

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(finalAnswer));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Agent-Type': 'welfare',
            'X-Agent-Sources': JSON.stringify(agentResult.sources),
            'Access-Control-Expose-Headers': 'X-Agent-Type, X-Agent-Sources',
          }
        });
      } catch (err) {
        console.error('Welfare agent error, falling back to general:', err);
        return fallbackToGeneral(userMessage);
      }
    }

    return NextResponse.json({ error: '알 수 없는 오류가 발생했습니다.' }, { status: 500 });
  } catch (error) {
    console.error('Global API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

// 공통 폴백 함수
async function fallbackToGeneral(message: string): Promise<Response> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '당신은 콩팥병 및 당뇨 환자를 돕는 건강 전문 어드바이저입니다. 시스템 장애로 특화 에이전트에 연동하지 못했으므로, 당신의 임상 및 복지 상식을 동원하여 최대한 도움이 되는 조언을 한국어로 해주세요.'
      },
      {
        role: 'user',
        content: message
      }
    ],
    stream: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          controller.enqueue(new TextEncoder().encode(text));
        }
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Agent-Type': 'general',
      'Access-Control-Expose-Headers': 'X-Agent-Type',
    }
  });
}
