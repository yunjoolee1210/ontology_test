import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, ArrowRight, Sparkles, Clock, Users, AlertCircle, ThumbsUp, ThumbsDown, ShoppingCart, Send, Pencil, Trash2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import {
  getRecipeBySlug, listProducts, getUserVotes, voteRecipe,
  listComments, addComment, updateComment, deleteComment,
  Recipe, RecipeProduct, RecipeComment,
} from '../services/recipeApi';
import { supabase } from '../lib/supabase';

const tagColor = (t: string) =>
  t.includes('나트륨') ? 'bg-blue-500/80 text-white border-blue-400'
    : t.includes('칼륨') ? 'bg-green-500/80 text-white border-green-400'
      : 'bg-amber-500/80 text-white border-amber-400';

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [products, setProducts] = useState<RecipeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // comments
  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const isLoggedIn = !!localStorage.getItem('accessToken');

  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([
          slug ? getRecipeBySlug(slug) : null,
          listProducts(),
        ]);
        if (r) {
          setRecipe(r);
          const [cmts, votes] = await Promise.all([
            listComments(r.id),
            isLoggedIn ? getUserVotes() : Promise.resolve({} as Record<string, 'like' | 'dislike'>),
          ]);
          setComments(cmts);
          if (isLoggedIn) setUserVote(votes[r.id] ?? null);
        }
        setProducts(p);

        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      } catch (e) {
        console.error('레시피 불러오기 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!recipe || !isLoggedIn || isVoting) return;
    setIsVoting(true);
    const isToggle = userVote === type;
    const prevVote = userVote;
    setUserVote(isToggle ? null : type);
    setRecipe((prev) => {
      if (!prev) return prev;
      const likesDelta    = type === 'like'    ? (isToggle ? -1 : 1) : (prevVote === 'like'    ? -1 : 0);
      const dislikesDelta = type === 'dislike' ? (isToggle ? -1 : 1) : (prevVote === 'dislike' ? -1 : 0);
      return { ...prev, likesCount: prev.likesCount + likesDelta, dislikesCount: prev.dislikesCount + dislikesDelta };
    });
    try {
      await voteRecipe(recipe.id, type);
    } catch {
      setUserVote(prevVote);
      const r = await getRecipeBySlug(slug!).catch(() => null);
      if (r) setRecipe(r);
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddComment = async () => {
    if (!recipe || !commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const c = await addComment(recipe.id, commentText.trim());
      setComments((prev) => [...prev, c]);
      setCommentText('');
    } catch (e: any) {
      alert(e.message || '댓글 등록 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editText.trim()) return;
    try {
      await updateComment(id, editText.trim());
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, content: editText.trim(), updatedAt: new Date().toISOString() } : c));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || '수정 실패');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      alert(e.message || '삭제 실패');
    }
  };

  const findProduct = (ingredient: string): RecipeProduct | undefined =>
    products.find((p) => ingredient.includes(p.ingredientKeyword));

  const back = () => navigate('/diet-care');

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden"><MobileHeader title="레시피" showProfile={false} showMenu={false} onBack={back} /></div>
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#00C9B7]" size={32} /></div>
      </div>
    );
  }
  if (!recipe) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden"><MobileHeader title="레시피" showProfile={false} showMenu={false} onBack={back} /></div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[#999]">
          레시피를 찾을 수 없습니다.
          <button onClick={back} className="px-4 py-2 rounded-lg bg-[#00C9B7] text-white">레시피 목록으로</button>
        </div>
      </div>
    );
  }

  const n = recipe.nutrients;
  const nutrientItems = [
    { label: '열량', value: `${n.kcal}`, unit: 'kcal', color: '#1F2937' },
    { label: '단백질', value: `${n.protein}`, unit: 'g', color: '#1F2937' },
    { label: '나트륨', value: `${n.sodium}`, unit: 'mg', color: '#2563EB' },
    { label: '칼륨', value: `${n.potassium}`, unit: 'mg', color: '#16A34A' },
    { label: '인', value: `${n.phosphorus}`, unit: 'mg', color: '#D97706' },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="lg:hidden"><MobileHeader title={recipe.name} showProfile={false} showMenu={false} onBack={back} /></div>
      <div className="hidden lg:flex items-center h-14 px-6 border-b border-[#E5E7EB]">
        <button onClick={back} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={22} /></button>
        <span className="ml-2 font-medium text-[#1F2937]">레시피 코치</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 lg:pb-10">
        <div className="max-w-2xl mx-auto">

          {/* ── Hero: 이미지 + 딤 오버레이 ── */}
          <div className="relative w-full aspect-[16/9] bg-gray-200 overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://placehold.co/640x360/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`;
              }}
            />
            {/* 딤 그라디언트 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* 카테고리 배지 (좌상단) */}
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm text-white border border-white/30">
              {recipe.categoryLabel}
            </span>
            {recipe.isUserSubmitted && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-[#9F7AEA]/80 text-white">
                사용자 레시피
              </span>
            )}

            {/* 하단 오버레이 텍스트 */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8">
              {/* 원래 요리 → 대체 레시피 */}
              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-white/80">
                <span>{recipe.originalDish}</span>
                <ArrowRight size={12} className="text-[#00C9B7]" />
                <span className="text-[#00C9B7] font-semibold">대체 레시피</span>
              </div>

              {/* 음식명 */}
              <h1 className="text-xl font-bold text-white leading-snug mb-2 drop-shadow">
                {recipe.name}
              </h1>

              {/* 태그 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {recipe.tags.map((t) => (
                  <span key={t} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tagColor(t)}`}>
                    #{t}
                  </span>
                ))}
              </div>

              {/* 좋아요 / 싫어요 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/70 mr-0.5">도움이 됐나요?</span>
                <button
                  onClick={() => handleVote('like')}
                  disabled={!isLoggedIn || isVoting}
                  title={!isLoggedIn ? '로그인 후 이용 가능' : undefined}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors backdrop-blur-sm border ${
                    userVote === 'like'
                      ? 'bg-[#00C9B7] text-white border-[#00C9B7]'
                      : isLoggedIn
                        ? 'bg-white/20 text-white border-white/40 hover:bg-[#00C9B7]/60'
                        : 'bg-white/10 text-white/50 border-white/20 cursor-not-allowed'
                  }`}
                >
                  <ThumbsUp size={12} className={userVote === 'like' ? 'fill-white' : ''} />
                  <span>{recipe.likesCount}</span>
                </button>
                <button
                  onClick={() => handleVote('dislike')}
                  disabled={!isLoggedIn || isVoting}
                  title={!isLoggedIn ? '로그인 후 이용 가능' : undefined}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors backdrop-blur-sm border ${
                    userVote === 'dislike'
                      ? 'bg-red-400 text-white border-red-400'
                      : isLoggedIn
                        ? 'bg-white/20 text-white border-white/40 hover:bg-red-400/60'
                        : 'bg-white/10 text-white/50 border-white/20 cursor-not-allowed'
                  }`}
                >
                  <ThumbsDown size={12} className={userVote === 'dislike' ? 'fill-white' : ''} />
                  <span>{recipe.dislikesCount}</span>
                </button>
                {!isLoggedIn && (
                  <span className="text-[10px] text-white/50">로그인 후 평가 가능</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 lg:p-7">

            {/* 재료 */}
            <h3 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2">
              <Users size={16} className="text-[#00C9B7]" />재료
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-7">
              {recipe.ingredients.map((ing, i) => {
                const product = findProduct(ing);
                return (
                  <div key={i} className="flex items-center rounded-xl border border-[#EEF0F2] px-3 py-2.5 text-sm text-[#374151]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C9B7] mr-2 flex-shrink-0" />
                    <span className="flex-1 truncate">{ing}</span>
                    {product && (
                      <a
                        href={product.coupangUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={product.productName}
                        className="ml-1.5 flex-shrink-0 flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded"
                      >
                        <ShoppingCart size={10} />
                        구매
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 추천 제품 */}
            {recipe.ingredients.some((ing) => findProduct(ing)) && (
              <div className="mb-7 p-3 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                  <ShoppingCart size={13} /> 재료별 추천 구매 제품 (쿠팡 파트너스)
                </p>
                <div className="space-y-1.5">
                  {recipe.ingredients
                    .map((ing) => ({ ing, product: findProduct(ing) }))
                    .filter(({ product }) => !!product)
                    .map(({ ing, product }) => (
                      <a
                        key={product!.id}
                        href={product!.coupangUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between hover:bg-orange-100 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <div>
                          <span className="text-xs text-gray-500">{ing} → </span>
                          <span className="text-xs font-medium text-orange-700">{product!.productName}</span>
                        </div>
                        <span className="text-[10px] text-orange-500 border border-orange-300 px-1.5 py-0.5 rounded">구매링크</span>
                      </a>
                    ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">※ 이 링크는 쿠팡 파트너스 링크로, 구매 시 소정의 수수료를 받을 수 있습니다.</p>
              </div>
            )}

            {/* 질환식 조리법 */}
            <h3 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2">
              <Clock size={16} className="text-[#9F7AEA]" />질환식 조리법
            </h3>
            <ol className="space-y-3 mb-7">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}
                  >{i + 1}</span>
                  <p className="text-sm text-[#374151] leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>

            {/* 대체 포인트 */}
            <div className="rounded-2xl p-4 mb-6 border" style={{ background: 'linear-gradient(135deg,#F0FDFA,#F5F3FF)', borderColor: '#CCFBF1' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-[#00C9B7]" />
                <h3 className="font-bold text-[#0F766E]">대체 포인트 (질환식 핵심)</h3>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{recipe.substitutePoint}</p>
            </div>

            {/* 주의사항 */}
            <div className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={18} className="text-[#D97706]" />
                <h3 className="font-bold text-[#92400E]">질환식 조리법 주의사항</h3>
              </div>
              <ul className="text-xs text-[#92400E] leading-relaxed space-y-1 list-disc pl-4">
                <li>채소·고기는 데쳐서 우러난 물을 버려 칼륨을 줄이세요.</li>
                <li>국물은 적게 드시고, 소금·간장 등 나트륨 사용은 최소화하세요.</li>
                <li>인이 많은 가공식품·유제품·견과류는 피하세요.</li>
                <li>개인의 신장 기능 단계·처방에 따라 적정 섭취량이 다릅니다. 식단 적용 전 반드시 의료진·영양사와 상담하세요.</li>
              </ul>
            </div>

            {/* 영양정보 (주의사항 하단) */}
            <h3 className="font-bold text-[#1F2937] mb-3">영양정보 <span className="text-xs font-normal text-gray-400">(1인분 기준)</span></h3>
            <div className="grid grid-cols-5 gap-2 mb-8">
              {nutrientItems.map((it) => (
                <div key={it.label} className="text-center rounded-xl border border-[#EEF0F2] py-3">
                  <div className="text-[11px] text-gray-500 mb-1">{it.label}</div>
                  <div className="font-bold text-sm" style={{ color: it.color }}>{it.value}</div>
                  <div className="text-[10px] text-gray-400">{it.unit}</div>
                </div>
              ))}
            </div>

            {/* ── 댓글 ── */}
            <div className="border-t border-[#EEF0F2] pt-6">
              <h3 className="font-bold text-[#1F2937] mb-4">
                댓글 <span className="text-sm font-normal text-gray-400">{comments.length}개</span>
              </h3>

              {/* 댓글 목록 */}
              {comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">첫 번째 댓글을 남겨보세요!</p>
              ) : (
                <ul className="space-y-3 mb-5">
                  {comments.map((c) => (
                    <li key={c.id} className="bg-gray-50 rounded-xl p-3">
                      {editingId === c.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            maxLength={500}
                            rows={2}
                            className="w-full text-sm border border-[#00C9B7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#00C9B7]"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-500 px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-100"
                            >취소</button>
                            <button
                              onClick={() => handleEditSave(c.id)}
                              className="text-xs text-white bg-[#00C9B7] px-3 py-1 rounded-lg hover:bg-[#00A99A]"
                            >저장</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-semibold text-[#374151]">{c.authorName}</span>
                              <span className="text-[10px] text-gray-400 ml-2">{formatDate(c.createdAt)}</span>
                            </div>
                            {currentUserId === c.userId && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => { setEditingId(c.id); setEditText(c.content); }}
                                  className="p-1 text-gray-400 hover:text-[#00C9B7] rounded"
                                ><Pencil size={13} /></button>
                                <button
                                  onClick={() => handleDelete(c.id)}
                                  className="p-1 text-gray-400 hover:text-red-400 rounded"
                                ><Trash2 size={13} /></button>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-[#374151] mt-1 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* 댓글 작성 */}
              {isLoggedIn ? (
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="댓글을 입력하세요 (최대 500자)"
                    maxLength={500}
                    rows={2}
                    className="flex-1 text-sm border border-[#E5E7EB] rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#00C9B7] focus:border-[#00C9B7]"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || isSubmitting}
                    className="flex-shrink-0 p-2.5 rounded-xl bg-[#00C9B7] text-white hover:bg-[#00A99A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-4">
                  <button
                    onClick={() => navigate('/login')}
                    className="text-[#00C9B7] underline font-medium"
                  >로그인</button> 후 댓글을 작성할 수 있습니다.
                </p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
