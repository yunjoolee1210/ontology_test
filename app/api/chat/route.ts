import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '../../../lib/agents/orchestrator';
import { checkSafety } from '../../../lib/rag/safetyChecker';
import { supabase } from '../../../lib/rag/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, message: directMessage, sessionId, userId, user_profile, ragMode } = await req.json().catch(() => ({}));
    
    let userMessage = '';
    if (directMessage && typeof directMessage === 'string') {
      userMessage = directMessage;
    } else if (messages && Array.isArray(messages) && messages.length > 0) {
      userMessage = messages[messages.length - 1].content;
    }

    userMessage = userMessage.trim();

    // ① 유효성 검사
    if (!userMessage) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    if (userMessage.length > 500) {
      return NextResponse.json({ error: '메시지는 최대 500자까지 입력 가능합니다.' }, { status: 400 });
    }

    // ② 의료 안전 가드레일 체크
    const safety = checkSafety(userMessage);
    if (!safety.isSafe) {
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

    // ③ Supabase DB 기록 (사용자 질문) - Optional
    if (sessionId) {
      try {
        // 세션 확인 및 없으면 생성
        const { data: sessionExists } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('id', sessionId)
          .single();

        if (!sessionExists) {
          await supabase
            .from('chat_sessions')
            .insert({
              id: sessionId,
              user_id: userId || null,
              title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : '')
            });
        }

        // 사용자 메시지 기록
        await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            role: 'user',
            content: userMessage
          });
      } catch (e) {
        console.error('Supabase save error:', e);
      }
    }

    // 환자 건강 프로필 구성
    let userProfile = user_profile;
    if (!userProfile && userId) {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (data) {
          userProfile = {
            ckd_stage: data.ckd_stage,
            dialysis_type: data.dialysis_type,
            diabetes_type: data.diabetes_type,
            medication: data.medication,
            other_conditions: data.other_conditions
          };
        }
      } catch (e) {
        console.error('Failed to load user profile in API route:', e);
      }
    }

    // ④ 오케스트레이터 호출 (의도 분류 → 병렬 실행 → 답변 합성)
    const orchestratorResult = await orchestrator(userMessage, userProfile, ragMode);

    // 출처 요약을 답변 밑에 정갈하게 배치
    let finalAnswer = orchestratorResult.answer;
    if (orchestratorResult.sources && orchestratorResult.sources.length > 0) {
      finalAnswer += '\n\n🔍 **신뢰 정보 검색 출처**:\n';
      orchestratorResult.sources.forEach((s, idx) => {
        const doiStr = s.doi ? ` (DOI: ${s.doi})` : '';
        const urlStr = s.url ? ` [링크](${s.url})` : '';
        finalAnswer += `${idx + 1}. *${s.title}* - ${s.org || '공식 정보처'}${doiStr}${urlStr}\n`;
      });
    }

    // ⑤ Supabase DB 기록 (AI 답변) - Optional
    let dbMessageId = '';
    if (sessionId) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            role: 'assistant',
            content: finalAnswer,
            agent_type: orchestratorResult.agentType,
            sources: orchestratorResult.sources
          })
          .select('id')
          .single();
        if (!error && data) {
          dbMessageId = data.id;
        }
      } catch (e) {
        console.error('Supabase assistant save error:', e);
      }
    }

    // ⑥ 스트리밍 형태로 전송
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(finalAnswer));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Agent-Type': orchestratorResult.agentType,
        'X-Agent-Sources': encodeURIComponent(JSON.stringify(orchestratorResult.sources || [])),
        'X-Message-ID': dbMessageId || '',
        'Access-Control-Expose-Headers': 'X-Agent-Type, X-Agent-Sources, X-Message-ID',
      }
    });
  } catch (error) {
    console.error('Global API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}
