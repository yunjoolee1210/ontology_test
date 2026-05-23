import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, ArrowRight, Sparkles, Clock, Users, AlertCircle } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { getRecipeBySlug, Recipe } from '../services/recipeApi';

const tagColor = (t: string) =>
  t.includes('나트륨') ? 'bg-blue-50 text-blue-700 border-blue-200'
    : t.includes('칼륨') ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

export function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (slug) setRecipe(await getRecipeBySlug(slug));
      } catch (e) {
        console.error('레시피 불러오기 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

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
          {/* Hero */}
          <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/640x360/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`; }}
            />
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-[#00A99A]">
              {recipe.categoryLabel}
            </span>
          </div>

          <div className="p-5 lg:p-7">
            {/* 원래요리 → 대체 레시피 (강조) */}
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="text-gray-400 line-through">{recipe.originalDish}</span>
              <ArrowRight size={16} className="text-[#00C9B7]" />
              <span className="text-[#00C9B7] font-bold">대체 레시피</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1F2937] mb-3 leading-snug">{recipe.name}</h1>

            <div className="flex flex-wrap gap-2 mb-5">
              {recipe.tags.map((t) => (
                <span key={t} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tagColor(t)}`}>#{t}</span>
              ))}
            </div>

            {/* 대체 포인트 — 질환식 핵심 강조 박스 */}
            <div className="rounded-2xl p-4 mb-6 border" style={{ background: 'linear-gradient(135deg,#F0FDFA,#F5F3FF)', borderColor: '#CCFBF1' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-[#00C9B7]" />
                <h3 className="font-bold text-[#0F766E]">대체 포인트 (질환식 핵심)</h3>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{recipe.substitutePoint}</p>
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

            {/* 재료 */}
            <h3 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2"><Users size={16} className="text-[#00C9B7]" />재료</h3>
            <div className="grid grid-cols-2 gap-2 mb-7">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center rounded-xl border border-[#EEF0F2] px-3 py-2.5 text-sm text-[#374151]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C9B7] mr-2 flex-shrink-0" />
                  <span className="truncate">{ing}</span>
                </div>
              ))}
            </div>

            {/* 질환식 조리법 (강조) */}
            <h3 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2"><Clock size={16} className="text-[#9F7AEA]" />질환식 조리법</h3>
            <ol className="space-y-3 mb-7">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>{i + 1}</span>
                  <p className="text-sm text-[#374151] leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>

            <div className="flex items-start gap-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3 text-xs text-[#92400E]">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>개인의 신장 기능 단계와 처방에 따라 적정 섭취량이 다를 수 있습니다. 식단 적용 전 의료진·영양사와 상담하세요.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
