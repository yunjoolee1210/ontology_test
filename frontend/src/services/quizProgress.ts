// 퀴즈 진행도(획득 포인트/레벨) — Supabase 사용자 계정 연동
// 로그인 사용자: quiz_results 테이블(계정별)에 저장/조회 → 마이페이지·퀴즈미션 공유.
// 비로그인(게스트): localStorage 폴백. 사전세팅: supabase_quiz_results_setup.sql

import { supabase } from '../lib/supabase';

const KEY = 'quizProgress';

export interface QuizProgress {
  points: number;
  completedCount: number;
  level: number;
}

function readLocal(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}').byQuiz || {}; } catch { return {}; }
}
function writeLocal(byQuiz: Record<string, number>) {
  localStorage.setItem(KEY, JSON.stringify({ byQuiz }));
}
function agg(byQuiz: Record<string, number>): QuizProgress {
  const points = Object.values(byQuiz).reduce((a, b) => a + (Number(b) || 0), 0);
  const completedCount = Object.keys(byQuiz).length;
  return { points, completedCount, level: completedCount };
}

/** 퀴즈 완료 결과 저장 (로그인 시 계정에, 항상 로컬에도) */
export async function saveQuizResult(quizId: string, points: number) {
  // 로컬(즉시/게스트)
  const local = readLocal();
  local[quizId] = Math.max(Number(local[quizId] || 0), points);
  writeLocal(local);
  // 계정(Supabase)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ex } = await supabase
      .from('quiz_results').select('points').eq('user_id', user.id).eq('quiz_id', quizId).maybeSingle();
    const best = Math.max(Number(ex?.points || 0), points); // 최고점 유지
    await supabase.from('quiz_results').upsert(
      { user_id: user.id, quiz_id: quizId, points: best, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,quiz_id' }
    );
  } catch (e) {
    console.error('퀴즈 결과 저장 실패:', e);
  }
}

/** 진행도 조회 (로그인 시 계정 기준, 아니면 로컬) */
export async function getQuizProgress(): Promise<QuizProgress> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 게스트(localStorage) 진행도를 계정으로 1회 병합 → 로그인 후에도 점수 유지
      const local = readLocal();
      const keys = Object.keys(local).filter(k => /^[0-9a-fA-F-]{36}$/.test(k));
      if (keys.length) {
        try {
          const rows = keys.map(k => ({
            user_id: user.id, quiz_id: k, points: Number(local[k]) || 0, updated_at: new Date().toISOString(),
          }));
          await supabase.from('quiz_results').upsert(rows, { onConflict: 'user_id,quiz_id' });
          localStorage.removeItem(KEY);
        } catch (e) { console.error('진행도 병합 실패:', e); }
      }
      const { data, error } = await supabase.from('quiz_results').select('points').eq('user_id', user.id);
      if (!error && data) {
        const points = data.reduce((a, r: any) => a + (r.points || 0), 0);
        return { points, completedCount: data.length, level: data.length };
      }
    }
  } catch (e) {
    console.error('퀴즈 진행도 조회 실패:', e);
  }
  return agg(readLocal());
}
