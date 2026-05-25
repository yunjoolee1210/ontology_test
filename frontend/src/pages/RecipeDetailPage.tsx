import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, ArrowRight, Sparkles, Clock, Users, AlertCircle, ThumbsUp, ThumbsDown, ShoppingCart } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { getRecipeBySlug, listProducts, getUserVotes, voteRecipe, Recipe, RecipeProduct } from '../services/recipeApi';

const tagColor = (t: string) =>
  t.includes('나트륨') ? 'bg-blue-50 text-blue-700 border-blue-200'
    : t.includes('칼륨') ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

export function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [products, setProducts] = useState<RecipeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const isLoggedIn = !!localStorage.getItem('accessToken');

  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([
          slug ? getRecipeBySlug(slug) : null,
          listProducts(),
        ]);
        if (r) setRecipe(r);
        setProducts(p);

        // 로그인 사용자 투표 현황
        if (r && isLoggedIn) {
          const votes = await getUserVotes();
          setUserVote(votes[r.id] ?? null);
        }
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

    // 낙관적 업데이트
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

  // 재료 문자열이 제품 키워드를 포함하는지 체크
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
          {/* Hero 이미지 */}
          <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
            <img src={recipe.imageUrl} alt={recipe.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/640x360/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`; }} />
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-[#00A99A]">
              {recipe.categoryLabel}
            </span>
            {recipe.isUserSubmitted && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-[#9F7AEA]/90 text-white">
                사용자 레시피
              </span>
            )}
          </div>

          <div className="p-5 lg:p-7">
            {/* 원래 요리 → 대체 레시피 */}
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="text-gray-600 font-medium">{recipe.originalDish}</span>
              <ArrowRight size={16} className="text-[#00C9B7]" />
              <span className="text-[#00C9B7] font-bold">대체 레시피</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1F2937] mb-3 leading-snug">{recipe.name}</h1>

            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.tags.map((t) => (
                <span key={t} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tagColor(t)}`}>#{t}</span>
              ))}
            </div>

            {/* 좋아요 / 싫어요 */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mr-1">이 레시피가 도움이 됐나요?</p>
              <button
                onClick={() => handleVote('like')}
                disabled={!isLoggedIn || isVoting}
                title={!isLoggedIn ? '로그인 후 이용 가능' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  userVote === 'like'
                    ? 'bg-[#00C9B7] text-white'
                    : isLoggedIn
                      ? 'bg-white border border-gray-200 text-gray-600 hover:border-[#00C9B7] hover:text-[#00C9B7]'
                      : 'bg-white border border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ThumbsUp size={15} className={userVote === 'like' ? 'fill-white' : ''} />
                <span>{recipe.likesCount}</span>
              </button>
              <button
                onClick={() => handleVote('dislike')}
                disabled={!isLoggedIn || isVoting}
                title={!isLoggedIn ? '로그인 후 이용 가능' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  userVote === 'dislike'
                    ? 'bg-red-400 text-white'
                    : isLoggedIn
                      ? 'bg-white border border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-400'
                      : 'bg-white border border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ThumbsDown size={15} className={userVote === 'dislike' ? 'fill-white' : ''} />
                <span>{recipe.dislikesCount}</span>
              </button>
              {!isLoggedIn && (
                <span className="text-xs text-gray-400">로그인 후 평가 가능</span>
              )}
            </div>

            {/* 영양정보 */}
            <h3 className="font-bold text-[#1F2937] mb-3">영양정보 <span className="text-xs font-normal text-gray-400">(1인분 기준)</span></h3>
            <div className="grid grid-cols-5 gap-2 mb-7">
              {nutrientItems.map((it) => (
                <div key={it.label} className="text-center rounded-xl border border-[#EEF0F2] py-3">
                  <div className="text-[11px] text-gray-500 mb-1">{it.label}</div>
                  <div className="font-bold text-sm" style={{ color: it.color }}>{it.value}</div>
                  <div className="text-[10px] text-gray-400">{it.unit}</div>
                </div>
              ))}
            </div>

            {/* 재료 (제품 링크 포함) */}
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

            {/* 추천 제품 (재료 매칭 제품이 있을 때만 표시) */}
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
                  <span className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>{i + 1}</span>
                  <p className="text-sm text-[#374151] leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>

            {/* 대체 포인트 */}
            <div className="rounded-2xl p-4 mb-4 border" style={{ background: 'linear-gradient(135deg,#F0FDFA,#F5F3FF)', borderColor: '#CCFBF1' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-[#00C9B7]" />
                <h3 className="font-bold text-[#0F766E]">대체 포인트 (질환식 핵심)</h3>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{recipe.substitutePoint}</p>
            </div>

            {/* 주의사항 */}
            <div className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] p-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
