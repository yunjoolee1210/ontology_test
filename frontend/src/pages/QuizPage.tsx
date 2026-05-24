import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Star, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { getQuiz, QuizSet } from '../services/quizApi';
import { addQuizResult } from '../services/quizProgress';

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (id) setQuiz(await getQuiz(id));
      } catch (e) {
        console.error('퀴즈 불러오기 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const back = () => navigate('/quiz/list');

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden"><MobileHeader title="퀴즈" showProfile={false} showMenu={false} onBack={back} /></div>
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#00C9B7]" size={32} /></div>
      </div>
    );
  }
  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden"><MobileHeader title="퀴즈" showProfile={false} showMenu={false} onBack={back} /></div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[#999999]">
          퀴즈를 찾을 수 없습니다.
          <button onClick={back} className="px-4 py-2 rounded-lg bg-[#00C9B7] text-white">목록으로</button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[idx];
  const isCorrect = selected === q.correctAnswer;
  const qPoints = q.points ?? 10;

  const handleAnswer = (optionIndex: number) => {
    if (showResult) return;
    setSelected(optionIndex);
    setShowResult(true);
    if (optionIndex === q.correctAnswer) {
      setScore((s) => s + 1);
      setPoints((p) => p + qPoints);
    }
  };
  const handleNext = () => {
    if (idx < quiz.questions.length - 1) {
      setIdx((i) => i + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      addQuizResult(quiz.id, points); // 획득 포인트 저장(마이페이지 공유)
      setFinished(true);
    }
  };
  const restart = () => {
    setIdx(0); setSelected(null); setShowResult(false); setScore(0); setPoints(0); setFinished(false);
  };

  if (finished) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden"><MobileHeader title={quiz.title} showProfile={false} showMenu={false} onBack={back} /></div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center p-8 rounded-2xl border border-[#E0E0E0]">
            <Trophy size={48} className="text-[#FFB84D] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1F2937] mb-2">퀴즈 완료!</h2>
            <p className="text-[#666666] mb-6">{quiz.level} · {quiz.typeLabel}</p>
            <div className="flex justify-center gap-8 mb-8">
              <div><div className="text-3xl font-bold text-[#00C9B7]">{score}/{quiz.questions.length}</div><div className="text-sm text-[#999999]">정답</div></div>
              <div><div className="text-3xl font-bold text-[#9F7AEA]">{points}P</div><div className="text-sm text-[#999999]">획득</div></div>
            </div>
            <div className="flex gap-3">
              <button onClick={restart} className="flex-1 py-3 rounded-xl border border-[#E0E0E0] text-[#666666] font-medium">다시 풀기</button>
              <button onClick={back} className="flex-1 py-3 rounded-xl text-white font-bold" style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>목록으로</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isOX = quiz.type === 'OX';

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="lg:hidden"><MobileHeader title={quiz.title} showProfile={false} showMenu={false} onBack={back} /></div>
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-[#F2FFFD] text-[#00C9B7] text-xs font-medium">{quiz.level}</span>
              <span className="px-2 py-1 rounded-md bg-[#EFE9FF] text-[#7C3AED] text-xs font-medium">{quiz.typeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-[#00C9B7]" />
              <span className="font-bold text-[#00C9B7]">{score}/{quiz.questions.length}</span>
              <Star size={16} className="text-[#9F7AEA] ml-2" />
              <span className="font-medium text-[#9F7AEA]">{points}P</span>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between mb-2 text-sm text-[#666666]">
              <span>진행 상황</span><span>{idx + 1} / {quiz.questions.length}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#EEF0F2]">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((idx + 1) / quiz.questions.length) * 100}%`, background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }} />
            </div>
          </div>

          {/* Question */}
          <div className="p-6 rounded-2xl border border-[#E0E0E0]">
            <div className="inline-block px-3 py-1 rounded-lg mb-3 bg-[#F2FFFD] text-[#00C9B7] text-sm font-medium">{qPoints} 포인트</div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-5 leading-relaxed">{q.question}</h3>

            <div className={isOX ? 'grid grid-cols-2 gap-3 mb-5' : 'space-y-3 mb-5'}>
              {q.options.map((option, index) => {
                let cls = 'border-2 transition-all duration-200';
                let icon = null;
                if (showResult) {
                  if (index === q.correctAnswer) { cls += ' border-green-500 bg-green-50'; icon = <CheckCircle size={20} color="#10B981" />; }
                  else if (index === selected) { cls += ' border-red-500 bg-red-50'; icon = <XCircle size={20} color="#EF4444" />; }
                  else cls += ' border-gray-200 opacity-50';
                } else cls += ' border-gray-200 hover:border-[#00C9B7] hover:bg-[#F2FFFD]';
                return (
                  <button key={index} onClick={() => handleAnswer(index)} disabled={showResult}
                    className={`w-full p-4 rounded-xl flex items-center justify-between ${cls} ${isOX ? 'justify-center' : ''}`}>
                    <span className={`font-medium text-[#1F2937] ${isOX ? 'text-2xl font-bold' : ''}`}>{option}</span>
                    {icon}
                  </button>
                );
              })}
            </div>

            {showResult && (
              <div className="p-4 rounded-xl mb-4" style={{ background: isCorrect ? '#F0FDF4' : '#FEF2F2', border: `2px solid ${isCorrect ? '#10B981' : '#EF4444'}` }}>
                <h4 className="mb-2 font-bold" style={{ color: isCorrect ? '#10B981' : '#EF4444' }}>{isCorrect ? '✅ 정답입니다!' : '❌ 틀렸습니다'}</h4>
                <p className="text-[#666666] text-sm leading-relaxed">{q.explanation}</p>
              </div>
            )}

            <button onClick={handleNext} disabled={!showResult}
              className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>
              {idx < quiz.questions.length - 1 ? '다음 문제' : '결과 보기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
