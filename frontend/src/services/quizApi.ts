// Quiz API (Supabase) — 퀴즈미션 콘텐츠
// quizzes 테이블에서 레벨/유형별 퀴즈 세트를 읽는다. 사전세팅: supabase_quiz_setup.sql

import { supabase } from '../lib/supabase';

export interface QuizQuestion {
  question: string;
  options: string[];     // OX는 ["O","X"]
  correctAnswer: number; // 0-based
  explanation: string;
  points?: number;
}

export interface QuizSet {
  id: string;
  level: string;          // 초급/중급/고급
  levelOrder: number;     // 1,2,3
  type: 'MCQ' | 'OX';
  typeLabel: string;      // 객관식 / O·X
  title: string;
  description: string;
  points: number;
  questions: QuizQuestion[];
  questionCount: number;
}

const rowToSet = (r: any): QuizSet => ({
  id: r.id,
  level: r.level,
  levelOrder: r.level_order,
  type: r.type === 'OX' ? 'OX' : 'MCQ',
  typeLabel: r.type === 'OX' ? 'O·X 퀴즈' : '객관식',
  title: r.title,
  description: r.description || '',
  points: r.points ?? 100,
  questions: Array.isArray(r.questions) ? r.questions : [],
  questionCount: Array.isArray(r.questions) ? r.questions.length : 0,
});

/** 전체 퀴즈 세트 (레벨→유형 순) */
export const listQuizzes = async (): Promise<QuizSet[]> => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('level_order', { ascending: true })
    .order('type', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToSet);
};

/** 단일 퀴즈 세트 (문제 포함) */
export const getQuiz = async (id: string): Promise<QuizSet | null> => {
  const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToSet(data) : null;
};
