import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Volume2, VolumeX, Bookmark, ChefHat, ShoppingBag, Loader2, Clock, Users } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';

interface RecipeData {
  id: string;
  name: string;
  name_en: string;
  slug: string;
  image_url: string;
  category: 'low-potassium' | 'low-phosphorus';
  cooking_time: string;
  servings: string;
  nutrients: {
    calories: number;
    potassium: number;
    phosphorus: number;
    protein: number;
    sodium: number;
  };
  ingredients: string[];
  steps: string[];
  tips: string;
  created_at?: string;
}

export function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 레시피 데이터 로드
  useEffect(() => {
    const fetchRecipe = async () => {
      if (!slug) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/recipes/by-slug/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setRecipe(data);
        } else if (response.status === 404) {
          setError('레시피를 찾을 수 없습니다.');
        } else {
          setError('레시피를 불러오는데 실패했습니다.');
        }
      } catch (err) {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecipe();
  }, [slug]);

  // 즐겨찾기 상태 로드
  useEffect(() => {
    const loadFavoriteStatus = async () => {
      if (!recipe) return;
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const response = await fetch('/api/recipes/user/favorites', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setIsFavorite(data.favorites?.includes(recipe.id) || false);
        }
      } catch (err) {
        console.error('Failed to load favorite status:', err);
      }
    };
    loadFavoriteStatus();
  }, [recipe]);

  // TTS 기능
  const handleSpeak = () => {
    if (!recipe) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `${recipe.name} 레시피입니다.
      조리시간 ${recipe.cooking_time}, ${recipe.servings} 기준입니다.
      재료: ${recipe.ingredients.join(', ')}.
      조리 순서: ${recipe.steps.map((step, i) => `${i + 1}단계. ${step}`).join(' ')}.
      팁: ${recipe.tips}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // 즐겨찾기 토글
  const handleFavoriteToggle = async () => {
    if (!recipe) return;
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsFavorite(!isFavorite);

    try {
      const response = await fetch(`/api/recipes/${recipe.id}/favorite`, {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        setIsFavorite(isFavorite); // 롤백
      }
    } catch (err) {
      setIsFavorite(isFavorite); // 롤백
    }
  };

  // 페이지 나갈 때 TTS 정리
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // JSON-LD 구조화 데이터 생성
  const getJsonLd = () => {
    if (!recipe) return null;

    return {
      "@context": "https://schema.org",
      "@type": "Recipe",
      "name": recipe.name,
      "image": `${window.location.origin}${recipe.image_url}`,
      "description": `CKD 환자를 위한 ${recipe.category === 'low-potassium' ? '저칼륨' : '저인'} 레시피 - ${recipe.name}. ${recipe.tips}`,
      "keywords": `CKD, 만성콩팥병, ${recipe.category === 'low-potassium' ? '저칼륨' : '저인'}, 신장질환 식단, ${recipe.name}`,
      "author": {
        "@type": "Organization",
        "name": "CareGuide"
      },
      "datePublished": recipe.created_at || new Date().toISOString(),
      "prepTime": `PT${parseInt(recipe.cooking_time)}M`,
      "cookTime": `PT${parseInt(recipe.cooking_time)}M`,
      "totalTime": `PT${parseInt(recipe.cooking_time)}M`,
      "recipeYield": recipe.servings,
      "recipeCategory": recipe.category === 'low-potassium' ? '저칼륨 요리' : '저인 요리',
      "recipeCuisine": "Korean",
      "nutrition": {
        "@type": "NutritionInformation",
        "calories": `${recipe.nutrients.calories} kcal`,
        "proteinContent": `${recipe.nutrients.protein} g`,
        "sodiumContent": `${recipe.nutrients.sodium} mg`,
        "potassiumContent": `${recipe.nutrients.potassium} mg`
      },
      "recipeIngredient": recipe.ingredients,
      "recipeInstructions": recipe.steps.map((step, index) => ({
        "@type": "HowToStep",
        "position": index + 1,
        "text": step
      }))
    };
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#FFFFFF' }}>
        <Loader2 size={32} className="animate-spin text-[#00C9B7]" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ background: '#FFFFFF' }}>
        <ChefHat size={48} className="text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">{error || '레시피를 찾을 수 없습니다.'}</p>
        <button
          onClick={() => navigate('/diet-care')}
          className="px-4 py-2 bg-[#00C9B7] text-white rounded-lg"
        >
          레시피 목록으로
        </button>
      </div>
    );
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{recipe.name} - CKD 환자를 위한 {recipe.category === 'low-potassium' ? '저칼륨' : '저인'} 레시피 | CareGuide</title>
        <meta name="description" content={`${recipe.name} 레시피. ${recipe.tips} 조리시간: ${recipe.cooking_time}, ${recipe.servings}. 칼로리: ${recipe.nutrients.calories}kcal, 칼륨: ${recipe.nutrients.potassium}mg, 인: ${recipe.nutrients.phosphorus}mg`} />
        <meta name="keywords" content={`CKD, 만성콩팥병, ${recipe.category === 'low-potassium' ? '저칼륨' : '저인'}, 신장질환 식단, ${recipe.name}, ${recipe.ingredients.slice(0, 3).join(', ')}`} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${recipe.name} - CKD 환자를 위한 레시피`} />
        <meta property="og:description" content={recipe.tips} />
        <meta property="og:image" content={`${window.location.origin}${recipe.image_url}`} />
        <meta property="og:url" content={`${window.location.origin}/recipe/${recipe.slug}`} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${recipe.name} - CKD 레시피`} />
        <meta name="twitter:description" content={recipe.tips} />
        <meta name="twitter:image" content={`${window.location.origin}${recipe.image_url}`} />

        {/* Canonical URL */}
        <link rel="canonical" href={`${window.location.origin}/recipe/${recipe.slug}`} />

        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(getJsonLd())}
        </script>
      </Helmet>

      <div className="flex-1 overflow-y-auto" style={{ background: '#FFFFFF' }}>
        {/* Mobile Header */}
        <div className="lg:hidden">
          <MobileHeader title={recipe.name} onBack={() => navigate('/diet-care')} />
        </div>

        {/* Desktop Back Button */}
        <div className="hidden lg:block p-4">
          <button
            onClick={() => navigate('/diet-care')}
            className="flex items-center gap-2 text-gray-600 hover:text-[#00C9B7] transition-colors"
          >
            <ArrowLeft size={20} />
            <span>레시피 목록</span>
          </button>
        </div>

        {/* Hero Image */}
        <div className="relative w-full h-[180px] lg:h-[240px]">
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://placehold.co/800x450/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`;
            }}
          />
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              recipe.category === 'low-potassium'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {recipe.category === 'low-potassium' ? '저칼륨' : '저인'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 lg:max-w-[800px] lg:mx-auto pb-24 lg:pb-8">
          {/* Title & Actions */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937] mb-2">{recipe.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={16} />
                  {recipe.cooking_time}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={16} />
                  {recipe.servings}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSpeak}
                className={`p-3 rounded-full transition-colors ${
                  isSpeaking ? 'bg-[#00C9B7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isSpeaking ? '음성 중지' : '음성으로 듣기'}
              >
                {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                onClick={handleFavoriteToggle}
                className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                title="즐겨찾기"
              >
                <Bookmark
                  size={20}
                  className={isFavorite ? 'fill-[#00C9B7] text-[#00C9B7]' : 'text-gray-400'}
                />
              </button>
            </div>
          </div>

          {/* 영양소 정보 */}
          <div className="grid grid-cols-5 gap-2 mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500">칼로리</p>
              <p className="font-bold text-[#1F2937] text-lg">{recipe.nutrients.calories}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">칼륨</p>
              <p className="font-bold text-green-600 text-lg">{recipe.nutrients.potassium}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">인</p>
              <p className="font-bold text-blue-600 text-lg">{recipe.nutrients.phosphorus}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">단백질</p>
              <p className="font-bold text-[#1F2937] text-lg">{recipe.nutrients.protein}</p>
              <p className="text-xs text-gray-400">g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">나트륨</p>
              <p className="font-bold text-orange-600 text-lg">{recipe.nutrients.sodium}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
          </div>

          {/* 재료 */}
          <section className="mb-6">
            <h2 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2 text-lg">
              <ShoppingBag size={20} className="text-[#00C9B7]" />
              재료
            </h2>
            <div className="bg-[#F0FDF4] rounded-xl p-4">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                {recipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00C9B7] flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 조리 순서 */}
          <section className="mb-6">
            <h2 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2 text-lg">
              <ChefHat size={20} className="text-[#9F7AEA]" />
              조리 순서
            </h2>
            <div className="space-y-3">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#9F7AEA] text-white font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <p className="text-gray-700 pt-1">{step}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 팁 */}
          <section className="p-4 bg-[#FEF3C7] rounded-xl">
            <p className="text-[#92400E]">
              <strong>💡 CKD 환자 팁:</strong> {recipe.tips}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
