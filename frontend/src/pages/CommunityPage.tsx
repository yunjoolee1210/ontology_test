import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Plus, Edit2, Trash2, Loader2, Trophy, Star, Users, ChevronRight, ListChecks, CircleDot, Zap } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { useLayout } from '../components/LayoutContext';
import * as communityApi from '../services/communityApi';
import { listQuizzes, QuizSet } from '../services/quizApi';
import { getQuizProgress } from '../services/quizProgress';

type CategoryType = '전체' | '자유' | '챌린지' | '퀴즈';

const QUIZ_TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  challenge: { label: '챌린지', color: '#00A99A', bg: '#E6F9F7', icon: <Zap size={11} /> },
  discussion: { label: '토론형', color: '#7C3AED', bg: '#EFE9FF', icon: <MessageCircle size={11} /> },
  vote: { label: '투표형', color: '#D97706', bg: '#FEF3C7', icon: <Users size={11} /> },
};

function quizSocialType(quiz: QuizSet): keyof typeof QUIZ_TYPE_META {
  if (quiz.type === 'OX') return 'vote';
  if (quiz.levelOrder === 1) return 'challenge';
  return 'discussion';
}

// ── Social Quiz Tab ──────────────────────────────────────────────
function QuizTab() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSet[]>([]);
  const [progress, setProgress] = useState({ points: 0, completedCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listQuizzes().then(setQuizzes).catch(console.error).finally(() => setLoading(false));
    getQuizProgress().then(p => setProgress({ points: p.points, completedCount: p.completedCount })).catch(() => {});
  }, []);

  const totalParticipants = quizzes.reduce((acc, q) => acc + (q.questionCount * 3), 0); // approximate

  return (
    <div>
      {/* 배너 */}
      <div
        className="rounded-2xl p-5 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={16} className="text-white/90" />
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Weekly Challenge</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1 leading-snug">
            이번 주 콩팥 퀴즈<br />함께 풀고 포인트 받기!
          </h2>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
              <Users size={13} className="text-white" />
              <span className="text-xs text-white font-medium">현재 {totalParticipants}명 참여 중</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
              <Star size={13} className="text-white" />
              <span className="text-xs text-white font-medium">내 포인트 {progress.points}P</span>
            </div>
          </div>
        </div>
        {/* 장식 */}
        <div className="absolute right-4 top-4 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute right-8 bottom-2 w-12 h-12 rounded-full bg-white/10" />
      </div>

      {/* 내 진행 현황 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-4 rounded-xl border border-[#E0E0E0] bg-white flex items-center gap-3">
          <Trophy size={22} className="text-[#00C9B7]" />
          <div>
            <div className="text-xs text-[#999]">완료 퀴즈</div>
            <div className="text-lg font-bold text-[#1F2937]">
              {progress.completedCount}<span className="text-sm font-normal text-[#999]">/{quizzes.length}</span>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#E0E0E0] bg-white flex items-center gap-3">
          <Star size={22} className="text-[#9F7AEA]" />
          <div>
            <div className="text-xs text-[#999]">획득 포인트</div>
            <div className="text-lg font-bold text-[#9F7AEA]">{progress.points}P</div>
          </div>
        </div>
      </div>

      {/* 퀴즈 피드 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#00C9B7]" size={32} />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center text-[#999] py-16">퀴즈 콘텐츠가 아직 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => {
            const type = quizSocialType(quiz);
            const meta = QUIZ_TYPE_META[type];
            const approxParticipants = quiz.questionCount * (quiz.levelOrder === 1 ? 18 : quiz.levelOrder === 2 ? 11 : 7);
            return (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-[#EEF0F2] p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  {/* 타입 아이콘 */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.bg }}
                  >
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon}{meta.label}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={
                          quiz.type === 'OX'
                            ? { background: '#EFE9FF', color: '#7C3AED' }
                            : { background: '#E6F9F7', color: '#00A99A' }
                        }
                      >
                        {quiz.type === 'OX'
                          ? <span className="flex items-center gap-0.5"><CircleDot size={10} /> OX</span>
                          : <span className="flex items-center gap-0.5"><ListChecks size={10} /> 객관식</span>
                        }
                      </span>
                      <span className="text-[11px] text-[#999]">{quiz.level}</span>
                    </div>

                    <h3 className="text-[15px] font-bold text-[#1F2937] mb-1 leading-snug">{quiz.title}</h3>
                    <p className="text-sm text-[#666] mb-3 leading-relaxed line-clamp-2">{quiz.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-[#999]">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {approxParticipants}명 참여
                        </span>
                        <span className="flex items-center gap-1">
                          <ListChecks size={12} />
                          {quiz.questionCount}문제
                        </span>
                        <span className="flex items-center gap-1 font-semibold" style={{ color: '#9F7AEA' }}>
                          <Star size={12} />
                          {quiz.points}P
                        </span>
                      </div>
                      <button
                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
                        style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}
                      >
                        참여하기 <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Community Page ───────────────────────────────────────────────
export function CommunityPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useLayout();
  const [posts, setPosts] = useState<communityApi.Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('전체');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentUserId = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id;
    } catch { return null; }
  };

  const currentUserId = getCurrentUserId();
  const userRole = localStorage.getItem('userRole') || 'user';
  const isAdmin = userRole === 'admin';

  const fetchPosts = useCallback(async (reset = false) => {
    if (selectedCategory === '퀴즈') return;
    try {
      if (reset) { setLoading(true); setNextCursor(null); }
      else setLoadingMore(true);
      setError(null);

      const postType = selectedCategory === '전체' ? undefined : communityApi.categoryToPostType(selectedCategory);
      const response = await communityApi.getPosts(20, reset ? undefined : nextCursor || undefined, postType);

      if (reset) setPosts(response.posts);
      else setPosts(prev => [...prev, ...response.posts]);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch {
      setError('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, nextCursor]);

  useEffect(() => {
    if (selectedCategory !== '퀴즈') fetchPosts(true);
  }, [selectedCategory]);

  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!isLoggedIn) { alert('로그인이 필요합니다.'); navigate('/login'); return; }
    try {
      await communityApi.likePost(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    } catch { console.error('Like failed'); }
  };

  const handleDelete = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await communityApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) { alert(err.message || '삭제에 실패했습니다.'); }
  };

  const handleCreateClick = () => {
    if (!isLoggedIn) { alert('로그인이 필요합니다.'); navigate('/login'); return; }
    navigate('/community/create');
  };

  const canEdit = (post: communityApi.Post) => currentUserId && post.userId === currentUserId;
  const canDelete = (post: communityApi.Post) => (currentUserId && post.userId === currentUserId) || isAdmin;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#FFFFFF' }}>
      <div className="lg:hidden">
        <MobileHeader title="커뮤니티" showMenu={true} showProfile={true} />
      </div>

      <div className="p-6 lg:max-w-[832px] mx-auto pb-24 lg:pb-6">
        {/* Category Tabs */}
        <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-6">
            {(['전체', '자유', '챌린지', '퀴즈'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="relative pb-3 transition-all duration-200"
                style={{
                  color: selectedCategory === cat ? '#00C9B7' : '#9CA3AF',
                  fontSize: '15px',
                  fontWeight: selectedCategory === cat ? '600' : '400',
                }}
              >
                {cat}
                {selectedCategory === cat && (
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: '2px', background: '#9F7AEA' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 퀴즈 탭 */}
        {selectedCategory === '퀴즈' && <QuizTab />}

        {/* 커뮤니티 피드 */}
        {selectedCategory !== '퀴즈' && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#00C9B7]" />
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-20 text-[#9CA3AF]">
                <p>{error}</p>
                <button onClick={() => fetchPosts(true)} className="mt-4 px-4 py-2 bg-[#00C9B7] text-white rounded-lg">
                  다시 시도
                </button>
              </div>
            )}

            {!loading && !error && posts.length === 0 && (
              <div className="text-center py-20 text-[#9CA3AF]">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>아직 게시글이 없습니다.</p>
              </div>
            )}

            {!loading && !error && posts.length > 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      onClick={() => navigate(`/community/detail/${post.id}`)}
                      className="card hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ background: '#D1D5DB' }}>
                          {post.authorName?.[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{post.authorName}</span>
                          </div>
                          <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                            {communityApi.formatDate(post.createdAt)}
                          </span>
                        </div>
                        {canEdit(post) && (
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/community/edit/${post.id}`); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="수정">
                            <Edit2 size={16} color="#6B7280" />
                          </button>
                        )}
                        {canDelete(post) && (
                          <button onClick={(e) => handleDelete(e, post.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
                            <Trash2 size={16} color="#EF4444" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: '#F2FFFD', color: '#00C8B4' }}>
                          {communityApi.postTypeToCategory(post.postType)}
                        </span>
                      </div>

                      <h3 style={{ color: 'var(--color-text-primary)', fontSize: '11pt', lineHeight: '1.4' }}>{post.title}</h3>
                      <p className="mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)', fontSize: '10pt', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {post.content}
                      </p>

                      {post.thumbnailUrl && (
                        <img src={post.thumbnailUrl} alt={post.title} className="w-full h-48 object-cover rounded-lg mb-3" />
                      )}

                      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        <button onClick={(e) => handleLike(e, post.id)} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                          <Heart size={18} /><span>{post.likes}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <MessageCircle size={18} /><span>{post.commentCount}</span>
                        </div>
                        <button className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                          <Share2 size={18} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button onClick={() => { if (!loadingMore && hasMore) fetchPosts(false); }} disabled={loadingMore} className="px-6 py-3 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-gray-50 disabled:opacity-50">
                      {loadingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : '더 보기'}
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleCreateClick}
              className="fixed bottom-24 lg:bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all z-50"
              style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
            >
              <Plus size={28} color="white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
