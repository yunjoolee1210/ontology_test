import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, ChevronRight, Loader2, ListChecks, CircleDot } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listQuizzes, QuizSet } from '../services/quizApi';
import { getQuizProgress } from '../services/quizProgress';

export function QuizListPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ points: 0, completedCount: 0, level: 0 });

  useEffect(() => {
    (async () => {
      try {
        setQuizzes(await listQuizzes());
      } catch (e) {
        console.error('퀴즈 불러오기 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
    getQuizProgress().then(setProgress).catch(() => {});
  }, []);

  const levels = [1, 2, 3]
    .map((order) => ({
      order,
      level: quizzes.find((q) => q.levelOrder === order)?.level || ['', '초급', '중급', '고급'][order],
      items: quizzes.filter((q) => q.levelOrder === order),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="lg:hidden">
        <MobileHeader title="투석케어" showMenu={true} showProfile={true} />
      </div>

      <div className="flex-1 overflow-y-auto p-5 lg:p-10 pb-24 lg:pb-10">
        <div className="lg:max-w-[832px] mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-[#E0E0E0] bg-white">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={20} className="text-[#00C9B7]" strokeWidth={2} />
                <span className="text-sm text-[#666666] font-medium">완료 퀴즈</span>
              </div>
              <div className="text-2xl font-bold text-[#1F2937]">{progress.completedCount}<span className="text-base font-normal text-[#999999]">/{quizzes.length}</span></div>
            </div>
            <div className="p-5 rounded-xl border border-[#E0E0E0] bg-white">
              <div className="flex items-center gap-2 mb-2">
                <Star size={20} className="text-[#9F7AEA]" strokeWidth={2} />
                <span className="text-sm text-[#666666] font-medium">획득 포인트</span>
              </div>
              <div className="text-2xl font-bold text-[#9F7AEA]">{progress.points}P</div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[#00C9B7]" size={32} />
            </div>
          ) : levels.length === 0 ? (
            <div className="text-center text-[#999999] py-16">
              퀴즈 콘텐츠가 아직 없습니다. (DB 세팅 필요)
            </div>
          ) : (
            levels.map((g) => (
              <div key={g.order} className="mb-8">
                <h2 className="text-lg font-bold text-[#1F2937] mb-4">
                  {g.level} <span className="text-sm font-normal text-[#999999]">레벨</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {g.items.map((quiz) => (
                    <button
                      key={quiz.id}
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                      className="text-left p-5 rounded-xl border border-[#E0E0E0] bg-white hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                              style={
                                quiz.type === 'OX'
                                  ? { background: '#EFE9FF', color: '#7C3AED' }
                                  : { background: '#E6F9F7', color: '#00A99A' }
                              }
                            >
                              {quiz.type === 'OX' ? <CircleDot size={12} /> : <ListChecks size={12} />}
                              {quiz.typeLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#F2FFFD] text-[#00C9B7] text-[11px] font-medium">
                              {quiz.level}
                            </span>
                          </div>
                          <h3 className="text-[15px] font-bold text-[#1F2937] mb-1">{quiz.title}</h3>
                          <p className="text-sm text-[#666666] mb-3 leading-relaxed line-clamp-2">{quiz.description}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-[#999999]">문제 {quiz.questionCount}개</span>
                            <span className="flex items-center gap-1 text-[#9F7AEA] font-medium">
                              <Star size={12} strokeWidth={2} />
                              {quiz.points}P
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          size={22}
                          className="text-[#CCCCCC] group-hover:text-[#00C9B7] transition-colors flex-shrink-0"
                          strokeWidth={2}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
