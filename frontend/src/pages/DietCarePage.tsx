import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Apple, Utensils, ShoppingBag, Plus, X, Camera, Loader2, Volume2, VolumeX, Bookmark, ChefHat } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listDietLogs, addDietLog } from '../services/dietApi';
import { listRecipes, Recipe } from '../services/recipeApi';
import {
  FoodItem,
  LOW_POTASSIUM_INGREDIENTS,
  HIGH_POTASSIUM_INGREDIENTS,
  LOW_POTASSIUM_PROCESSED,
  HIGH_POTASSIUM_PROCESSED,
  LOW_POTASSIUM_DISHES,
  HIGH_POTASSIUM_DISHES,
  LOW_PHOSPHORUS_INGREDIENTS,
  HIGH_PHOSPHORUS_INGREDIENTS,
  LOW_PHOSPHORUS_PROCESSED,
  HIGH_PHOSPHORUS_PROCESSED,
  LOW_PHOSPHORUS_DISHES,
  HIGH_PHOSPHORUS_DISHES,
  getPotassiumLevel,
  getPhosphorusLevel,
} from '../data/nutritionKnowledgeBase';

type TabType = 'nutri-coach' | 'recipe-coach' | 'diet-log';
type NutrientType = 'potassium' | 'phosphorus';

interface DietLog {
  log_id: string;
  dish_name: string;
  meal_type: string;
  image_url: string;
  confidence?: number;
  nutrients?: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrate: number;
    sodium: number;
    potassium: number;
    phosphorus: number;
  };
  food_count: number;
  recognition_source: string;
  logged_at: string;
}

// 레시피 데이터 인터페이스 (API 응답 형식)
interface RecipeData {
  id: string;
  name: string;
  name_en: string;
  slug: string;  // SEO-friendly URL slug
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
}

// 정렬 함수: 영양소 값 기준 내림차순 (높은 것 먼저)
const sortByNutrientDesc = (items: FoodItem[], nutrientType: NutrientType): FoodItem[] => {
  return [...items].sort((a, b) => {
    const valA = nutrientType === 'potassium' ? (a.potassium || 0) : (a.phosphorus || 0);
    const valB = nutrientType === 'potassium' ? (b.potassium || 0) : (b.phosphorus || 0);
    return valB - valA;
  });
};

// 정렬 함수: 영양소 값 기준 오름차순 (낮은 것 먼저)
const sortByNutrientAsc = (items: FoodItem[], nutrientType: NutrientType): FoodItem[] => {
  return [...items].sort((a, b) => {
    const valA = nutrientType === 'potassium' ? (a.potassium || 0) : (a.phosphorus || 0);
    const valB = nutrientType === 'potassium' ? (b.potassium || 0) : (b.phosphorus || 0);
    return valA - valB;
  });
};

interface FoodCardProps {
  item: FoodItem;
  nutrientType: NutrientType;
}

function FoodCard({ item, nutrientType }: FoodCardProps) {
  const value = nutrientType === 'potassium' ? item.potassium : item.phosphorus;
  const level = nutrientType === 'potassium'
    ? getPotassiumLevel(value || 0)
    : getPhosphorusLevel(value || 0);

  return (
    <div className="flex-shrink-0 w-[130px]">
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-[90px] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/130x90/E8F5E9/2E7D32?text=${encodeURIComponent(item.name)}`;
          }}
        />
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
          style={{ backgroundColor: level.bgColor, color: level.color }}
        >
          {nutrientType === 'potassium' ? 'K' : 'P'} {value}mg
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
          <p className="text-white text-[10px] font-medium text-center truncate">{item.name}</p>
        </div>
      </div>
    </div>
  );
}

interface FoodSectionProps {
  title: string;
  icon: React.ReactNode;
  lowItems: FoodItem[];
  highItems: FoodItem[];
  nutrientType: NutrientType;
}

function FoodSection({ title, icon, lowItems, highItems, nutrientType }: FoodSectionProps) {
  const [showLow, setShowLow] = useState(true);
  const [showHigh, setShowHigh] = useState(true);

  // 정렬된 아이템
  const sortedHighItems = useMemo(() => sortByNutrientDesc(highItems, nutrientType), [highItems, nutrientType]);
  const sortedLowItems = useMemo(() => sortByNutrientAsc(lowItems, nutrientType), [lowItems, nutrientType]);

  // 라벨
  const highLabel = nutrientType === 'potassium' ? '고칼륨 함량 음식' : '고인 함량 음식';
  const lowLabel = nutrientType === 'potassium' ? '저칼륨 함량 음식' : '저인 함량 음식';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="font-medium text-[#1F2937] text-sm">{title}</span>
      </div>

      {/* 고함량 음식 (먼저 표시, 내림차순) */}
      <div className="mb-3">
        <div
          onClick={() => setShowHigh(!showHigh)}
          className="flex items-center gap-2 mb-2 cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="text-xs text-[#EF4444] font-medium">{highLabel} ({sortedHighItems.length})</span>
          {showHigh ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
        {showHigh && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {sortedHighItems.map((item, idx) => (
              <FoodCard key={idx} item={item} nutrientType={nutrientType} />
            ))}
          </div>
        )}
      </div>

      {/* 저함량 음식 (오름차순) */}
      <div>
        <div
          onClick={() => setShowLow(!showLow)}
          className="flex items-center gap-2 mb-2 cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-xs text-[#22C55E] font-medium">{lowLabel} ({sortedLowItems.length})</span>
          {showLow ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
        {showLow && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {sortedLowItems.map((item, idx) => (
              <FoodCard key={idx} item={item} nutrientType={nutrientType} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 레시피 카드 컴포넌트
const tagColor = (t: string) =>
  t.includes('나트륨') ? 'bg-blue-100 text-blue-700'
    : t.includes('칼륨') ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-700';

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/recipe/${recipe.slug}`)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="relative w-full aspect-[3/2] overflow-hidden flex-shrink-0">
        <img
          src={recipe.imageUrl}
          alt={recipe.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/400x225/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`;
          }}
        />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 text-[#00A99A]">
          {recipe.categoryLabel}
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        {/* 원래 요리 → 대체 레시피 강조 */}
        <div className="text-[11px] text-gray-400 line-through mb-0.5">{recipe.originalDish}</div>
        <h4 className="font-bold text-[#1F2937] text-sm leading-snug mb-2 line-clamp-2">{recipe.name}</h4>
        <div className="flex flex-wrap gap-1 mb-2">
          {recipe.tags.map((t) => (
            <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColor(t)}`}>{t}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 text-[11px] text-gray-500">
          <span>나트륨 {recipe.nutrients.sodium}mg</span>
          <span>·</span>
          <span>{recipe.nutrients.kcal}kcal</span>
        </div>
      </div>
    </div>
  );
}

// 레시피 상세 모달
interface RecipeDetailModalProps {
  recipe: RecipeData | null;
  isOpen: boolean;
  onClose: () => void;
  onFavorite: (id: string) => void;
  isFavorite: boolean;
}

function RecipeDetailModal({ recipe, isOpen, onClose, onFavorite, isFavorite }: RecipeDetailModalProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  const handleClose = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    onClose();
  };

  if (!isOpen || !recipe) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-[95%] max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative flex-shrink-0">
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-48 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://placehold.co/400x200/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`;
            }}
          />
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              recipe.category === 'low-potassium'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {recipe.category === 'low-potassium' ? '저칼륨 요리' : '저인 요리'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-[#1F2937]">{recipe.name}</h3>
              <p className="text-sm text-gray-500">{recipe.cooking_time} · {recipe.servings}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSpeak}
                className={`p-2 rounded-full transition-colors ${
                  isSpeaking ? 'bg-[#00C9B7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isSpeaking ? '음성 중지' : '음성으로 듣기'}
              >
                {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                onClick={() => onFavorite(recipe.id)}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Bookmark
                  size={20}
                  className={isFavorite ? 'fill-[#00C9B7] text-[#00C9B7]' : 'text-gray-400'}
                />
              </button>
            </div>
          </div>

          {/* 영양소 정보 */}
          <div className="grid grid-cols-5 gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500">칼로리</p>
              <p className="font-bold text-[#1F2937]">{recipe.nutrients.calories}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">칼륨</p>
              <p className="font-bold text-green-600">{recipe.nutrients.potassium}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">인</p>
              <p className="font-bold text-blue-600">{recipe.nutrients.phosphorus}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">단백질</p>
              <p className="font-bold text-[#1F2937]">{recipe.nutrients.protein}</p>
              <p className="text-xs text-gray-400">g</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">나트륨</p>
              <p className="font-bold text-orange-600">{recipe.nutrients.sodium}</p>
              <p className="text-xs text-gray-400">mg</p>
            </div>
          </div>

          {/* 재료 */}
          <div className="mb-4">
            <h4 className="font-medium text-[#1F2937] mb-2 flex items-center gap-2">
              <ShoppingBag size={16} className="text-[#00C9B7]" />
              재료
            </h4>
            <div className="bg-[#F0FDF4] rounded-xl p-3">
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {recipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C9B7] flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 조리 순서 */}
          <div className="mb-4">
            <h4 className="font-medium text-[#1F2937] mb-2 flex items-center gap-2">
              <ChefHat size={16} className="text-[#9F7AEA]" />
              조리 순서
            </h4>
            <div className="space-y-2">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#9F7AEA] text-white text-sm font-medium flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-gray-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 팁 */}
          <div className="p-3 bg-[#FEF3C7] rounded-xl">
            <p className="text-sm text-[#92400E]">
              <strong>💡 CKD 환자 팁:</strong> {recipe.tips}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 식사 기록 모달
interface MealRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function MealRecordModal({ isOpen, onClose, onSuccess }: MealRecordModalProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mealType, setMealType] = useState<string>('lunch');
  const [dishName, setDishName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setError(null);

    try {
      // Supabase: 이미지 Storage 업로드 + diet_logs 기록 (AI 영양분석은 추후 서버리스로)
      const saved = await addDietLog({
        mealType,
        dishName: dishName.trim() || undefined,
        imageFile: selectedImage,
      });

      setResult({ success: true, dish_name: saved.dish_name });
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setDishName('');
    setMealType('lunch');
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-[90%] max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-[#1F2937]">식사 기록하기</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 이미지 업로드 영역 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#00C9B7] transition-colors"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Camera size={40} className="text-gray-400" />
                <p className="text-sm text-gray-500">음식 사진을 선택해주세요</p>
                <p className="text-xs text-gray-400">JPG, PNG, GIF (최대 5MB)</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 식사 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">식사 유형</label>
            <div className="flex gap-2">
              {[
                { value: 'breakfast', label: '아침' },
                { value: 'lunch', label: '점심' },
                { value: 'dinner', label: '저녁' },
                { value: 'snack', label: '간식' }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setMealType(type.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    mealType === type.value
                      ? 'bg-[#00C9B7] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 요리명 입력 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요리명
            </label>
            <input
              type="text"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="예: 김치찌개"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]"
            />
          </div>

          {/* 결과 표시 */}
          {result && (
            <div className="bg-[#F0FDF4] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 font-medium">인식 완료!</span>
                {result.confidence && (
                  <span className="text-xs text-gray-500">
                    (신뢰도: {Math.round(result.confidence * 100)}%)
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-[#1F2937]">{result.dish_name}</p>
              {result.nutrients && (
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-500">칼로리</p>
                    <p className="font-bold text-[#1F2937]">{result.nutrients.calories}kcal</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-500">칼륨</p>
                    <p className="font-bold text-[#EF4444]">{result.nutrients.potassium}mg</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-500">인</p>
                    <p className="font-bold text-[#3B82F6]">{result.nutrients.phosphorus}mg</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={handleUpload}
            disabled={!selectedImage || isLoading}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${
              !selectedImage || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#00C9B7] text-white hover:bg-[#00B5A5]'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                분석 중...
              </span>
            ) : result ? (
              '저장 완료!'
            ) : (
              '업로드 및 분석하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DietCarePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('nutri-coach');
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 레시피 코치 상태
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [favoriteRecipes, setFavoriteRecipes] = useState<string[]>([]);

  // 레시피 목록 불러오기
  useEffect(() => {
    const fetchRecipes = async () => {
      setIsLoadingRecipes(true);
      try {
        setRecipes(await listRecipes());
      } catch (err) {
        console.error('Failed to load recipes:', err);
      } finally {
        setIsLoadingRecipes(false);
      }
    };
    fetchRecipes();
  }, []);

  // 즐겨찾기 토글 (로그인 필요)
  const handleFavoriteToggle = async (recipeId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setShowLoginModal(true);
      return;
    }

    const isFavorite = favoriteRecipes.includes(recipeId);

    // 즉시 UI 업데이트 (낙관적 업데이트)
    if (isFavorite) {
      setFavoriteRecipes(prev => prev.filter(id => id !== recipeId));
    } else {
      setFavoriteRecipes(prev => [...prev, recipeId]);
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // 실패 시 롤백
        if (isFavorite) {
          setFavoriteRecipes(prev => [...prev, recipeId]);
        } else {
          setFavoriteRecipes(prev => prev.filter(id => id !== recipeId));
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // 실패 시 롤백
      if (isFavorite) {
        setFavoriteRecipes(prev => [...prev, recipeId]);
      } else {
        setFavoriteRecipes(prev => prev.filter(id => id !== recipeId));
      }
    }
  };

  // 즐겨찾기 목록 불러오기
  useEffect(() => {
    const loadFavorites = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const response = await fetch('/api/recipes/user/favorites', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setFavoriteRecipes(data.favorites || []);
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    };
    loadFavorites();
  }, []);

  // 등록 버튼 클릭 시 로그인 체크
  const handleAddClick = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setShowLoginModal(true);
    } else {
      setIsModalOpen(true);
    }
  };

  // 식단 기록 목록 가져오기
  const fetchDietLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const results = await listDietLogs(20);
      setDietLogs(results);
    } catch (err) {
      console.error('Failed to fetch diet logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'diet-log') {
      fetchDietLogs();
    }
  }, [activeTab]);

  const getMealTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: '아침',
      lunch: '점심',
      dinner: '저녁',
      snack: '간식'
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#FFFFFF' }}>
      <div className="lg:hidden">
        <MobileHeader title="식단케어" showMenu={true} showProfile={true} />
      </div>

      <div className="p-4 lg:max-w-[900px] mx-auto pb-24 lg:pb-6">
        {/* Tabs */}
        <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-6">
            <div
              onClick={() => setActiveTab('nutri-coach')}
              className="relative pb-3 cursor-pointer transition-all duration-200"
              style={{
                color: activeTab === 'nutri-coach' ? '#00C9B7' : '#9CA3AF',
                fontSize: '15px',
                fontWeight: activeTab === 'nutri-coach' ? 'bold' : 'normal'
              }}
            >
              영양 코치
              {activeTab === 'nutri-coach' && (
                <div
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: '2px', background: '#9F7AEA', width: '100%' }}
                />
              )}
            </div>
            <div
              onClick={() => setActiveTab('recipe-coach')}
              className="relative pb-3 cursor-pointer transition-all duration-200"
              style={{
                color: activeTab === 'recipe-coach' ? '#00C9B7' : '#9CA3AF',
                fontSize: '15px',
                fontWeight: activeTab === 'recipe-coach' ? 'bold' : 'normal'
              }}
            >
              레시피 코치
              {activeTab === 'recipe-coach' && (
                <div
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: '2px', background: '#9F7AEA', width: '100%' }}
                />
              )}
            </div>
            <div
              onClick={() => setActiveTab('diet-log')}
              className="relative pb-3 cursor-pointer transition-all duration-200"
              style={{
                color: activeTab === 'diet-log' ? '#00C9B7' : '#9CA3AF',
                fontSize: '15px',
                fontWeight: activeTab === 'diet-log' ? 'bold' : 'normal'
              }}
            >
              식단 로그
              {activeTab === 'diet-log' && (
                <div
                  className="absolute bottom-[-1px] left-0 right-0"
                  style={{ height: '2px', background: '#9F7AEA', width: '100%' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Nutri Coach Content */}
        {activeTab === 'nutri-coach' && (
          <div className="space-y-8">
            {/* 칼륨 섹션 */}
            <section>
              <h3 className="text-lg font-bold text-[#1F2937] mb-3">칼륨 (Potassium)</h3>
              <div className="bg-[#F0FDF4] rounded-xl p-4 mb-4 text-sm text-[#166534] leading-relaxed">
                <p className="mb-1"><strong>칼륨이란?</strong> 신경과 근육 기능에 필수적인 전해질로, 심장 박동 조절에 중요한 역할을 합니다.</p>
                <p className="mb-1"><strong>CKD 환자 주의점:</strong> 신장이 칼륨 배출을 제대로 못하면 고칼륨혈증이 발생하여 심장 부정맥, 심정지 위험이 있습니다.</p>
                <p className="mb-1"><strong>1일 권장량:</strong> 2,000mg 이하 (1끼 약 667mg)</p>
                <p><strong>줄이는 팁:</strong> 채소는 물에 2시간 담그거나 데치면 칼륨이 30~50% 감소합니다.</p>
              </div>

              <FoodSection
                title="식재료"
                icon={<Apple size={16} className="text-[#22C55E]" />}
                lowItems={LOW_POTASSIUM_INGREDIENTS}
                highItems={HIGH_POTASSIUM_INGREDIENTS}
                nutrientType="potassium"
              />
              <FoodSection
                title="가공식품"
                icon={<ShoppingBag size={16} className="text-[#F59E0B]" />}
                lowItems={LOW_POTASSIUM_PROCESSED}
                highItems={HIGH_POTASSIUM_PROCESSED}
                nutrientType="potassium"
              />
              <FoodSection
                title="요리"
                icon={<Utensils size={16} className="text-[#8B5CF6]" />}
                lowItems={LOW_POTASSIUM_DISHES}
                highItems={HIGH_POTASSIUM_DISHES}
                nutrientType="potassium"
              />
            </section>

            {/* 인 섹션 */}
            <section>
              <h3 className="text-lg font-bold text-[#1F2937] mb-3">인 (Phosphorus)</h3>
              <div className="bg-[#EFF6FF] rounded-xl p-4 mb-4 text-sm text-[#1E40AF] leading-relaxed">
                <p className="mb-1"><strong>인이란?</strong> 뼈와 치아 형성, 에너지 대사에 필수적인 미네랄입니다.</p>
                <p className="mb-1"><strong>CKD 환자 주의점:</strong> 신장이 인 배출을 못하면 고인혈증으로 뼈에서 칼슘이 빠져나와 골다공증, 혈관 석회화 위험이 있습니다.</p>
                <p className="mb-1"><strong>1일 권장량:</strong> 800mg 이하 (1끼 약 267mg)</p>
                <p><strong>줄이는 팁:</strong> 가공식품의 인산염 첨가물(소시지, 햄, 콜라 등) 피하기, 유제품 섭취 제한</p>
              </div>

              <FoodSection
                title="식재료"
                icon={<Apple size={16} className="text-[#22C55E]" />}
                lowItems={LOW_PHOSPHORUS_INGREDIENTS}
                highItems={HIGH_PHOSPHORUS_INGREDIENTS}
                nutrientType="phosphorus"
              />
              <FoodSection
                title="가공식품"
                icon={<ShoppingBag size={16} className="text-[#F59E0B]" />}
                lowItems={LOW_PHOSPHORUS_PROCESSED}
                highItems={HIGH_PHOSPHORUS_PROCESSED}
                nutrientType="phosphorus"
              />
              <FoodSection
                title="요리"
                icon={<Utensils size={16} className="text-[#8B5CF6]" />}
                lowItems={LOW_PHOSPHORUS_DISHES}
                highItems={HIGH_PHOSPHORUS_DISHES}
                nutrientType="phosphorus"
              />
            </section>
          </div>
        )}

        {/* Recipe Coach Content */}
        {activeTab === 'recipe-coach' && (
          <div className="space-y-6">
            {/* 안내 메시지 */}
            <div className="bg-gradient-to-r from-[#F0FDF4] to-[#EFF6FF] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ChefHat size={24} className="text-[#00C9B7] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-[#1F2937] mb-1">신장질환식 대체 레시피 30선</h4>
                  <p className="text-sm text-gray-600">
                    좋아하던 요리를 <span className="text-[#00C9B7] font-medium">저염·저칼륨·저인</span>으로 바꾼
                    <span className="font-medium"> 대체 레시피</span>입니다. 카드를 누르면 대체 포인트와 질환식 조리법을 볼 수 있어요.
                  </p>
                </div>
              </div>
            </div>

            {/* 레시피 그리드 */}
            {isLoadingRecipes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#00C9B7]" />
              </div>
            ) : recipes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {recipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <ChefHat size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">등록된 레시피가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* Diet Log Content */}
        {activeTab === 'diet-log' && (
          <div className="space-y-6">
            <h3 className="font-medium text-[#1F2937]">식사 기록</h3>

            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#00C9B7]" />
              </div>
            ) : dietLogs.length > 0 ? (
              <div className="space-y-3">
                {dietLogs.map((log) => (
                  <div key={log.log_id} className="border rounded-xl p-3 flex gap-3">
                    {/* 썸네일 이미지 */}
                    <div className="flex-shrink-0">
                      <img
                        src={log.image_url}
                        alt={log.dish_name}
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/64x64/E8F5E9/2E7D32?text=${encodeURIComponent(log.dish_name.charAt(0))}`;
                        }}
                      />
                    </div>
                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#1F2937] truncate">{log.dish_name}</p>
                          <p className="text-xs text-[#9CA3AF]">
                            {getMealTypeLabel(log.meal_type)} · {formatDate(log.logged_at)}
                          </p>
                        </div>
                        {log.nutrients && (
                          <span className="flex-shrink-0 px-2 py-1 rounded-lg text-xs bg-[#F3F4F6] text-[#00C9B7] font-medium">
                            {log.nutrients.calories}kcal
                          </span>
                        )}
                      </div>
                      {log.nutrients && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span>칼륨 <strong className="text-[#EF4444]">{log.nutrients.potassium}mg</strong></span>
                          <span>인 <strong className="text-[#3B82F6]">{log.nutrients.phosphorus}mg</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Camera size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">아직 기록된 식사가 없습니다.</p>
                <p className="text-xs mt-1">우측 하단의 + 버튼을 눌러 첫 식사를 기록해보세요!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 플로팅 버튼 (식단 로그 탭에서만 표시) */}
      {activeTab === 'diet-log' && (
        <button
          onClick={handleAddClick}
          className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all z-40"
          style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* 식사 기록 모달 */}
      <MealRecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDietLogs}
      />

      {/* 로그인 필요 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-[85%] max-w-sm mx-4 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F0FDF4] flex items-center justify-center">
              <Utensils size={32} className="text-[#00C9B7]" />
            </div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">회원 전용 메뉴입니다</h3>
            <p className="text-sm text-gray-500 mb-6">
              로그인하시면 식단 기록 기능을<br />이용할 수 있습니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
              >
                로그인
              </button>
              <button
                onClick={() => setShowLoginModal(false)}
                className="w-full py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
