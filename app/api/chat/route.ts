import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { orchestrator } from '../../../lib/agents/orchestrator';
import { checkSafety } from '../../../lib/rag/safetyChecker';
import { supabase } from '../../../lib/rag/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, message: directMessage, sessionId, userId, user_profile, ragMode, accessToken } = await req.json().catch(() => ({}));
    
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

    // Supabase URL & Anon Key 로드
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
    if (supabaseUrl.endsWith('/rest/v1/')) {
      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/$/, '');
    }
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

    // Access Token이 있으면 해당 유저 권한으로 동작하는 클라이언트 생성
    const supabaseClient = accessToken
      ? createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        })
      : supabase;

    // ③ Supabase DB 기록 (사용자 질문) - Optional
    if (sessionId) {
      try {
        // 세션 확인 및 없으면 생성
        const { data: sessionExists } = await supabaseClient
          .from('chat_sessions')
          .select('id')
          .eq('id', sessionId)
          .single();

        if (!sessionExists) {
          await supabaseClient
            .from('chat_sessions')
            .insert({
              id: sessionId,
              user_id: userId || null,
              title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : '')
            });
        }

        // 사용자 메시지 기록
        await supabaseClient
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
        const { data } = await supabaseClient
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

    // 출처 요약을 답변 본문에 텍스트로 추가하지 않고, 클라이언트의 출처 패널(SourcePanel)로만 노출하여 중복을 방지하고 길이를 단축합니다.
    const finalAnswer = orchestratorResult.answer;

    // ⑤ Supabase DB 기록 (AI 답변) - Optional
    let dbMessageId = '';
    if (sessionId) {
      try {
        const { data, error } = await supabaseClient
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
