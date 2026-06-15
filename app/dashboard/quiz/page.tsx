'use client';

import React, { useState } from 'react';
import { Award, CheckCircle, XCircle, RefreshCw, HelpCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Question {
  question: string;
  options: string[];
  answerIdx: number;
  explanation: string;
}

const QUIZ_QUESTIONS: Question[] = [
  {
    question: '만성 콩팥병(CKD) 3기 환자의 하루 나트륨 권장 섭취 기준은 다음 중 어느 것입니까?',
    options: ['2,000mg 이하 (소금 5g)', '4,000mg 이하 (소금 10g)', '6,000mg 이하 (소금 15g)', '제한이 필요 없다'],
    answerIdx: 0,
    explanation: '대한신장학회 가이드라인에 따르면, 만성 콩팥병 환자의 하루 나트륨 섭취량은 2,000mg(소금 5g 분량) 이하로 조절하여 부종과 혈압을 예방해야 합니다.',
  },
  {
    question: '당뇨병성 신증(신장 합병증)을 조기 진단하기 위해 소변 검사에서 확인해야 하는 지표는 무엇입니까?',
    options: ['요당(Glucose)', '미세알부민(Microalbumin)', '적혈구(RBC)', '백혈구(WBC)'],
    answerIdx: 1,
    explanation: '당뇨 환자는 신장 사구체가 손상되면서 소량의 단백질인 알부민이 미세하게 소변으로 새어 나오게 됩니다. 따라서 미세알부민뇨 수치 측정이 조기 합병증 스크리닝의 핵심 지표입니다.',
  },
  {
    question: '만성 콩팥병 환자가 수치를 특별히 조절해야 하는 전해질 중 하나로, 오렌지나 바나나 등 과일에 다량 함유된 물질은 무엇입니까?',
    options: ['나트륨(Sodium)', '철(Iron)', '칼륨(Potassium)', '마그네슘(Magnesium)'],
    answerIdx: 2,
    explanation: '칼륨 배설 능력이 저하되는 신부전 환자는 고칼륨혈증 예방을 위해 칼륨이 풍부한 오렌지, 바나나, 토마토 등의 섭취를 주의하여 제한해야 합니다.',
  }
];

export default function QuizPage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleOptionClick = (idx: number) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
  };

  const handleNext = () => {
    const isCorrect = selectedIdx === QUIZ_QUESTIONS[currentIdx].answerIdx;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    setIsAnswered(true);
  };

  const handleNextQuestion = () => {
    setSelectedIdx(null);
    setIsAnswered(false);
    
    if (currentIdx < QUIZ_QUESTIONS.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setCurrentIdx(0);
    setSelectedIdx(null);
    setIsAnswered(false);
    setScore(0);
    setShowResult(false);
  };

  const q = QUIZ_QUESTIONS[currentIdx];

  return (
    <div className="w-full max-w-xl mx-auto py-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center space-x-1">
          <ArrowLeft size={14} />
          <span>목록으로</span>
        </Link>
        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
          문제 {currentIdx + 1} / {QUIZ_QUESTIONS.length}
        </span>
      </div>

      {!showResult ? (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl mt-0.5">
              <HelpCircle size={20} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
              {q.question}
            </h2>
          </div>

          <div className="space-y-3">
            {q.options.map((option, idx) => {
              const isSelected = selectedIdx === idx;
              const isCorrectAnswer = idx === q.answerIdx;
              let btnClass = 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700';

              if (isAnswered) {
                if (isCorrectAnswer) {
                  btnClass = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold';
                } else if (isSelected) {
                  btnClass = 'border-red-500 bg-red-50 text-red-800';
                } else {
                  btnClass = 'border-slate-100 bg-slate-50 opacity-50 text-slate-400';
                }
              } else if (isSelected) {
                btnClass = 'border-purple-600 bg-purple-50 text-purple-800 ring-2 ring-purple-600 font-semibold';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleOptionClick(idx)}
                  disabled={isAnswered}
                  className={`w-full text-left p-4 rounded-xl border text-sm transition-all duration-200 flex items-center justify-between ${btnClass}`}
                >
                  <span>{option}</span>
                  {isAnswered && isCorrectAnswer && <CheckCircle size={18} className="text-emerald-600" />}
                  {isAnswered && isSelected && !isCorrectAnswer && <XCircle size={18} className="text-red-600" />}
                </button>
              );
            })}
          </div>

          {!isAnswered ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedIdx === null}
              className="w-full py-3.5 bg-gradient-to-tr from-purple-700 to-purple-600 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            >
              정답 확인하기
            </button>
          ) : (
            <div className="space-y-5 border-t border-slate-100 pt-5 animate-fade-in">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-800 block mb-1">💡 해설</span>
                {q.explanation}
              </div>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="w-full py-3.5 bg-[#6D3FA0] text-white rounded-xl text-sm font-bold shadow-md hover:bg-purple-800 active:scale-[0.98] transition-all"
              >
                {currentIdx < QUIZ_QUESTIONS.length - 1 ? '다음 문제 풀기' : '퀴즈 완료'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-md p-8 text-center space-y-6 animate-fade-in">
          <div className="p-4 bg-gradient-to-tr from-purple-700 to-[#4338CA] rounded-full text-white inline-flex shadow-lg">
            <Award size={48} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">퀴즈 챌린지 완료!</h2>
            <p className="text-sm text-slate-500">신장 및 당뇨 자가 진단 퀴즈 채점을 마쳤습니다.</p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 max-w-xs mx-auto">
            <span className="text-xs text-purple-700 font-bold tracking-wider uppercase">내 최종 점수</span>
            <div className="text-3xl font-black text-purple-900 mt-1">
              {score} <span className="text-sm font-normal text-slate-500">/ {QUIZ_QUESTIONS.length} 문제</span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetQuiz}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all inline-flex items-center space-x-1.5 shadow-sm"
          >
            <RefreshCw size={14} />
            <span>퀴즈 다시 풀기</span>
          </button>
        </div>
      )}
    </div>
  );
}
