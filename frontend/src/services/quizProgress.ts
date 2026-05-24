// 퀴즈 진행도(획득 포인트/레벨) — 퀴즈미션과 마이페이지가 공유 (localStorage)
// 퀴즈별 최고 점수를 저장해 합산. 같은 퀴즈 재응시 시 더 높은 점수만 반영.

const KEY = 'quizProgress';

export interface QuizProgress {
  points: number;         // 누적 획득 포인트
  completedCount: number; // 완료한 퀴즈 수
  level: number;          // 지식 레벨 (완료 수 기준)
}

function read(): Record<string, number> {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return d.byQuiz || {};
  } catch {
    return {};
  }
}

export function addQuizResult(quizId: string, points: number) {
  const byQuiz = read();
  byQuiz[quizId] = Math.max(Number(byQuiz[quizId] || 0), points);
  localStorage.setItem(KEY, JSON.stringify({ byQuiz }));
}

export function getQuizProgress(): QuizProgress {
  const byQuiz = read();
  const points = Object.values(byQuiz).reduce((a, b) => a + (Number(b) || 0), 0);
  const completedCount = Object.keys(byQuiz).length;
  return { points, completedCount, level: completedCount };
}
