import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, Apple, Utensils, ShoppingBag, Plus, X,
  Camera, Loader2, ChefHat, ThumbsUp, ThumbsDown, PenLine, ImageIcon,
} from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listDietLogs, addDietLog, DietLogRow } from '../services/dietApi';
import {
  listRecipes, voteRecipe, getUserVotes, submitUserRecipe, uploadRecipeImage,
  Recipe, NewRecipeInput,
} from '../services/recipeApi';
import {
  FoodItem,
  LOW_POTASSIUM_INGREDIENTS, HIGH_POTASSIUM_INGREDIENTS,
  LOW_POTASSIUM_PROCESSED,   HIGH_POTASSIUM_PROCESSED,
  LOW_POTASSIUM_DISHES,      HIGH_POTASSIUM_DISHES,
  LOW_PHOSPHORUS_INGREDIENTS, HIGH_PHOSPHORUS_INGREDIENTS,
  LOW_PHOSPHORUS_PROCESSED,   HIGH_PHOSPHORUS_PROCESSED,
  LOW_PHOSPHORUS_DISHES,      HIGH_PHOSPHORUS_DISHES,
  getPotassiumLevel, getPhosphorusLevel,
} from '../data/nutritionKnowledgeBase';

type TabType = 'nutri-coach' | 'recipe-coach' | 'diet-log';
type NutrientType = 'potassium' | 'phosphorus';


// ── 영양 코치 관련 컴포넌트 ──────────────────────────────────────────────────

const sortByNutrientDesc = (items: FoodItem[], nt: NutrientType): FoodItem[] =>
  [...items].sort((a, b) => ((nt === 'potassium' ? b.potassium : b.phosphorus) ?? 0) - ((nt === 'potassium' ? a.potassium : a.phosphorus) ?? 0));

const sortByNutrientAsc = (items: FoodItem[], nt: NutrientType): FoodItem[] =>
  [...items].sort((a, b) => ((nt === 'potassium' ? a.potassium : a.phosphorus) ?? 0) - ((nt === 'potassium' ? b.potassium : b.phosphorus) ?? 0));

function FoodCard({ item, nutrientType }: { item: FoodItem; nutrientType: NutrientType }) {
  const value = nutrientType === 'potassium' ? item.potassium : item.phosphorus;
  const level = nutrientType === 'potassium' ? getPotassiumLevel(value || 0) : getPhosphorusLevel(value || 0);
  return (
    <div className="flex-shrink-0 w-[130px]">
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <img src={item.image} alt={item.name} className="w-full h-[90px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/130x90/E8F5E9/2E7D32?text=${encodeURIComponent(item.name)}`; }} />
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
          style={{ backgroundColor: level.bgColor, color: level.color }}>
          {nutrientType === 'potassium' ? 'K' : 'P'} {value}mg
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
          <p className="text-white text-[10px] font-medium text-center truncate">{item.name}</p>
        </div>
      </div>
    </div>
  );
}

function FoodSection({ title, icon, lowItems, highItems, nutrientType }: {
  title: string; icon: React.ReactNode; lowItems: FoodItem[]; highItems: FoodItem[]; nutrientType: NutrientType;
}) {
  const [showLow, setShowLow] = useState(true);
  const [showHigh, setShowHigh] = useState(true);
  const sortedHigh = useMemo(() => sortByNutrientDesc(highItems, nutrientType), [highItems, nutrientType]);
  const sortedLow  = useMemo(() => sortByNutrientAsc(lowItems, nutrientType), [lowItems, nutrientType]);
  const highLabel = nutrientType === 'potassium' ? '고칼륨 함량 음식' : '고인 함량 음식';
  const lowLabel  = nutrientType === 'potassium' ? '저칼륨 함량 음식' : '저인 함량 음식';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="font-medium text-[#1F2937] text-sm">{title}</span></div>
      <div className="mb-3">
        <div onClick={() => setShowHigh(!showHigh)} className="flex items-center gap-2 mb-2 cursor-pointer">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="text-xs text-[#EF4444] font-medium">{highLabel} ({sortedHigh.length})</span>
          {showHigh ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
        {showHigh && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {sortedHigh.map((item, idx) => <FoodCard key={idx} item={item} nutrientType={nutrientType} />)}
          </div>
        )}
      </div>
      <div>
        <div onClick={() => setShowLow(!showLow)} className="flex items-center gap-2 mb-2 cursor-pointer">
          <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-xs text-[#22C55E] font-medium">{lowLabel} ({sortedLow.length})</span>
          {showLow ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
        {showLow && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {sortedLow.map((item, idx) => <FoodCard key={idx} item={item} nutrientType={nutrientType} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 레시피 카드 ───────────────────────────────────────────────────────────────

const tagColor = (t: string) =>
  t.includes('나트륨') ? 'bg-blue-100 text-blue-700'
    : t.includes('칼륨') ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-700';

interface RecipeCardProps {
  recipe: Recipe;
  userVote: 'like' | 'dislike' | null;
  onVote: (recipeId: string, type: 'like' | 'dislike') => void;
  onLoginRequired: () => void;
}

function RecipeCard({ recipe, userVote, onVote, onLoginRequired }: RecipeCardProps) {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('accessToken');

  const handleVoteClick = (e: React.MouseEvent, type: 'like' | 'dislike') => {
    e.stopPropagation();
    if (!isLoggedIn) { onLoginRequired(); return; }
    onVote(recipe.id, type);
  };

  return (
    <div
      onClick={() => navigate(`/recipe/${recipe.slug}`)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="relative w-full aspect-[3/2] overflow-hidden flex-shrink-0">
        <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/400x225/E8F5E9/2E7D32?text=${encodeURIComponent(recipe.name)}`; }} />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 text-[#00A99A]">
          {recipe.categoryLabel}
        </span>
        {recipe.isUserSubmitted && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#9F7AEA]/90 text-white">
            사용자 레시피
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="text-[11px] text-gray-500 font-medium mb-0.5">{recipe.originalDish}</div>
        <h4 className="font-bold text-[#1F2937] text-sm leading-snug mb-2 line-clamp-2">{recipe.name}</h4>
        <div className="flex flex-wrap gap-1 mb-2">
          {recipe.tags.map((t) => (
            <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColor(t)}`}>{t}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>나트륨 {recipe.nutrients.sodium}mg</span>
            <span>·</span>
            <span>{recipe.nutrients.kcal}kcal</span>
          </div>
          {/* 좋아요 / 싫어요 */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleVoteClick(e, 'like')}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
                userVote === 'like' ? 'bg-[#00C9B7]/10 text-[#00C9B7]' : 'text-gray-400 hover:text-[#00C9B7]'
              }`}
            >
              <ThumbsUp size={11} className={userVote === 'like' ? 'fill-[#00C9B7]' : ''} />
              <span>{recipe.likesCount}</span>
            </button>
            <button
              onClick={(e) => handleVoteClick(e, 'dislike')}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
                userVote === 'dislike' ? 'bg-red-50 text-red-400' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <ThumbsDown size={11} className={userVote === 'dislike' ? 'fill-red-400' : ''} />
              <span>{recipe.dislikesCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 레시피 등록 모달 ─────────────────────────────────────────────────────────

const EMPTY_FORM: NewRecipeInput & { imageFile: File | null } = {
  name: '', originalDish: '', category: 'soup', tags: [],
  substitutePoint: '', ingredients: [''], steps: [''],
  nutrients: { kcal: 0, protein: 0, sodium: 0, potassium: 0, phosphorus: 0 },
  imageFile: null,
};

const TAG_OPTIONS = ['저나트륨', '저칼륨', '저인'];
const CAT_OPTIONS = [
  { value: 'soup', label: '국·탕·찌개' },
  { value: 'main', label: '메인요리' },
  { value: 'side', label: '반찬·김치·샐러드' },
] as const;

function RecipeSubmitModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean; onClose: () => void; onSuccess: (r: Recipe) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof EMPTY_FORM, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleTag = (tag: string) =>
    set('tags', form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag]);

  const setListItem = (key: 'ingredients' | 'steps', idx: number, val: string) => {
    const next = [...form[key]];
    next[idx] = val;
    set(key, next);
  };
  const addListItem = (key: 'ingredients' | 'steps') => set(key, [...form[key], '']);
  const removeListItem = (key: 'ingredients' | 'steps', idx: number) =>
    set(key, form[key].filter((_, i) => i !== idx));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set('imageFile', file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.originalDish || !form.substitutePoint) {
      setError('음식명, 대체 레시피명, 대체 포인트는 필수입니다.');
      return;
    }
    if (form.ingredients.filter(Boolean).length === 0) {
      setError('재료를 1개 이상 입력하세요.');
      return;
    }
    if (form.steps.filter(Boolean).length === 0) {
      setError('조리 순서를 1단계 이상 입력하세요.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (form.imageFile) imageUrl = await uploadRecipeImage(form.imageFile);
      const recipe = await submitUserRecipe({ ...form, imageUrl });
      onSuccess(recipe);
      setForm({ ...EMPTY_FORM });
      setPreviewUrl(null);
    } catch (err: any) {
      setError(err?.message || '등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-[#1F2937]">레시피 등록</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="p-4 space-y-5">
          {/* 기본 정보 */}
          <section>
            <p className="text-xs font-semibold text-[#00C9B7] mb-3 uppercase tracking-wide">기본 정보</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">원래 음식명 <span className="text-red-400">*</span></label>
                <input value={form.originalDish} onChange={(e) => set('originalDish', e.target.value)}
                  placeholder="예: 김치찌개" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대체 레시피명 <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="예: 씻은 김치 맑은 돼지찌개" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">분류</label>
                <select value={form.category} onChange={(e) => set('category', e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]">
                  {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">저감 영양소 태그</label>
                <div className="flex gap-2">
                  {TAG_OPTIONS.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        form.tags.includes(tag)
                          ? 'bg-[#00C9B7] text-white border-[#00C9B7]'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-[#00C9B7]'
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 대체 포인트 */}
          <section>
            <p className="text-xs font-semibold text-[#00C9B7] mb-3 uppercase tracking-wide">대체 포인트 <span className="text-red-400">*</span></p>
            <textarea value={form.substitutePoint} onChange={(e) => set('substitutePoint', e.target.value)}
              placeholder="어떤 재료/방법으로 나트륨·칼륨·인을 줄였는지 설명해주세요."
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7] resize-none" />
          </section>

          {/* 재료 */}
          <section>
            <p className="text-xs font-semibold text-[#00C9B7] mb-3 uppercase tracking-wide">재료</p>
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2">
                  <input value={ing} onChange={(e) => setListItem('ingredients', idx, e.target.value)}
                    placeholder={`재료 ${idx + 1} (예: 저염간장 5g)`}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]" />
                  {form.ingredients.length > 1 && (
                    <button onClick={() => removeListItem('ingredients', idx)} className="p-2 text-gray-400 hover:text-red-400">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => addListItem('ingredients')}
                className="flex items-center gap-1 text-sm text-[#00C9B7] hover:text-[#00B5A5]">
                <Plus size={15} /> 재료 추가
              </button>
            </div>
          </section>

          {/* 조리 순서 */}
          <section>
            <p className="text-xs font-semibold text-[#00C9B7] mb-3 uppercase tracking-wide">조리 순서</p>
            <div className="space-y-2">
              {form.steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#9F7AEA] text-white text-xs font-bold flex items-center justify-center mt-1.5">{idx + 1}</span>
                  <textarea value={step} onChange={(e) => setListItem('steps', idx, e.target.value)}
                    placeholder={`${idx + 1}단계`} rows={2}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7] resize-none" />
                  {form.steps.length > 1 && (
                    <button onClick={() => removeListItem('steps', idx)} className="p-2 text-gray-400 hover:text-red-400 mt-1">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => addListItem('steps')}
                className="flex items-center gap-1 text-sm text-[#00C9B7] hover:text-[#00B5A5]">
                <Plus size={15} /> 단계 추가
              </button>
            </div>
          </section>

          {/* 영양정보 (선택) */}
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">영양정보 (선택)</p>
            <div className="grid grid-cols-5 gap-2">
              {(['kcal', 'protein', 'sodium', 'potassium', 'phosphorus'] as const).map((key) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-500 mb-1">
                    {key === 'kcal' ? '열량(kcal)' : key === 'protein' ? '단백질(g)' : key === 'sodium' ? '나트륨(mg)' : key === 'potassium' ? '칼륨(mg)' : '인(mg)'}
                  </label>
                  <input type="number" min={0}
                    value={form.nutrients[key] || ''}
                    onChange={(e) => set('nutrients', { ...form.nutrients, [key]: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00C9B7]" />
                </div>
              ))}
            </div>
          </section>

          {/* 이미지 (선택) */}
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">대표 이미지 (선택)</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#00C9B7] transition-colors">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-36 object-cover rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <ImageIcon size={32} />
                  <p className="text-sm">이미지를 선택하세요 (선택)</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </section>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="p-4 border-t">
          <button onClick={handleSubmit} disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${
              isSubmitting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#00C9B7] text-white hover:bg-[#00B5A5]'
            }`}>
            {isSubmitting ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />등록 중...</span> : '레시피 등록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 식사 기록 모달 ────────────────────────────────────────────────────────────

function MealRecordModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
}) {
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
    if (file) { setSelectedImage(file); setPreviewUrl(URL.createObjectURL(file)); setResult(null); setError(null); }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;
    setIsLoading(true); setError(null);
    try {
      const saved = await addDietLog({ mealType, dishName: dishName.trim() || undefined, imageFile: selectedImage });
      setResult({ success: true, dish_name: saved.dish_name });
      setTimeout(() => { onSuccess(); handleClose(); }, 1500);
    } catch (err: any) {
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null); setPreviewUrl(null); setDishName(''); setMealType('lunch');
    setResult(null); setError(null); onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-[90%] max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-[#1F2937]">식사 기록하기</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#00C9B7] transition-colors">
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
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">식사 유형</label>
            <div className="flex gap-2">
              {[{ value: 'breakfast', label: '아침' }, { value: 'lunch', label: '점심' }, { value: 'dinner', label: '저녁' }, { value: 'snack', label: '간식' }].map((type) => (
                <button key={type.value} onClick={() => setMealType(type.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${mealType === type.value ? 'bg-[#00C9B7] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">요리명</label>
            <input type="text" value={dishName} onChange={(e) => setDishName(e.target.value)}
              placeholder="예: 김치찌개"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]" />
          </div>
          {result && (
            <div className="bg-[#F0FDF4] rounded-xl p-4">
              <p className="text-green-600 font-medium mb-1">저장 완료!</p>
              <p className="text-lg font-bold text-[#1F2937]">{result.dish_name}</p>
            </div>
          )}
          {error && <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">{error}</div>}
        </div>
        <div className="p-4 border-t">
          <button onClick={handleUpload} disabled={!selectedImage || isLoading}
            className={`w-full py-3 rounded-xl font-medium transition-colors ${!selectedImage || isLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#00C9B7] text-white hover:bg-[#00B5A5]'}`}>
            {isLoading ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />저장 중...</span>
              : result ? '저장 완료!' : '업로드하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

const NUTRIENT_FILTERS = ['저칼륨', '저나트륨', '저인'] as const;

export function DietCarePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('nutri-coach');

  // 레시피 코치
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike'>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // 식단 로그
  const [dietLogs, setDietLogs] = useState<DietLogRow[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 공통
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 필터 적용 레시피
  const filteredRecipes = useMemo(() =>
    filterTags.length === 0
      ? recipes
      : recipes.filter((r) => filterTags.some((t) => r.tags.includes(t))),
    [recipes, filterTags]
  );

  const toggleFilter = (tag: string) =>
    setFilterTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  // 레시피 불러오기
  useEffect(() => {
    (async () => {
      setIsLoadingRecipes(true);
      try { setRecipes(await listRecipes()); }
      catch (err) { console.error('Failed to load recipes:', err); }
      finally { setIsLoadingRecipes(false); }
    })();
  }, []);

  // 로그인 시 투표 현황 불러오기
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    getUserVotes().then(setUserVotes).catch(() => {});
  }, []);

  // 좋아요 / 싫어요
  const handleVote = async (recipeId: string, voteType: 'like' | 'dislike') => {
    const currentVote = userVotes[recipeId] ?? null;
    const isToggle = currentVote === voteType;

    // 낙관적 업데이트
    setUserVotes((prev) => {
      const next = { ...prev };
      if (isToggle) delete next[recipeId]; else next[recipeId] = voteType;
      return next;
    });
    setRecipes((prev) => prev.map((r) => {
      if (r.id !== recipeId) return r;
      const likesDelta   = voteType === 'like'    ? (isToggle ? -1 : 1) : (currentVote === 'like'    ? -1 : 0);
      const dislikesDelta = voteType === 'dislike' ? (isToggle ? -1 : 1) : (currentVote === 'dislike' ? -1 : 0);
      return { ...r, likesCount: r.likesCount + likesDelta, dislikesCount: r.dislikesCount + dislikesDelta };
    }));

    try {
      await voteRecipe(recipeId, voteType);
    } catch {
      // 실패 시 롤백 (페이지 새로고침)
      listRecipes().then(setRecipes).catch(() => {});
      getUserVotes().then(setUserVotes).catch(() => {});
    }
  };

  // 레시피 등록 성공
  const handleSubmitSuccess = (newRecipe: Recipe) => {
    setRecipes((prev) => [newRecipe, ...prev]);
    setShowSubmitModal(false);
  };

  // 등록 버튼
  const handleSubmitClick = () => {
    if (!localStorage.getItem('accessToken')) { setShowLoginModal(true); return; }
    setShowSubmitModal(true);
  };

  // 식단 기록 불러오기
  const fetchDietLogs = async () => {
    setIsLoadingLogs(true);
    try { setDietLogs(await listDietLogs(20)); }
    catch (err) { console.error('Failed to fetch diet logs:', err); }
    finally { setIsLoadingLogs(false); }
  };
  useEffect(() => { if (activeTab === 'diet-log') fetchDietLogs(); }, [activeTab]);

  const getMealTypeLabel = (type: string) =>
    ({ breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }[type] || type);
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAddClick = () => {
    if (!localStorage.getItem('accessToken')) { setShowLoginModal(true); return; }
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#FFFFFF' }}>
      <div className="lg:hidden">
        <MobileHeader title="식단케어" showMenu={true} showProfile={true} />
      </div>

      <div className="p-4 lg:max-w-[900px] mx-auto pb-24 lg:pb-6">
        {/* 탭 */}
        <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-6">
            {([['nutri-coach', '영양 코치'], ['recipe-coach', '레시피 추천'], ['diet-log', '식단 로그']] as const).map(([key, label]) => (
              <div key={key} onClick={() => setActiveTab(key)}
                className="relative pb-3 cursor-pointer transition-all duration-200"
                style={{ color: activeTab === key ? '#00C9B7' : '#9CA3AF', fontSize: '15px', fontWeight: activeTab === key ? 'bold' : 'normal' }}>
                {label}
                {activeTab === key && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px]" style={{ background: '#9F7AEA' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── 영양 코치 ─────────────────────────────────────────────────────── */}
        {activeTab === 'nutri-coach' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-[#1F2937] mb-3">칼륨 (Potassium)</h3>
              <div className="bg-[#F0FDF4] rounded-xl p-4 mb-4 text-sm text-[#166534] leading-relaxed">
                <p className="mb-1"><strong>칼륨이란?</strong> 신경과 근육 기능에 필수적인 전해질로, 심장 박동 조절에 중요한 역할을 합니다.</p>
                <p className="mb-1"><strong>CKD 환자 주의점:</strong> 신장이 칼륨 배출을 제대로 못하면 고칼륨혈증이 발생하여 심장 부정맥, 심정지 위험이 있습니다.</p>
                <p className="mb-1"><strong>1일 권장량:</strong> 2,000mg 이하 (1끼 약 667mg)</p>
                <p><strong>줄이는 팁:</strong> 채소는 물에 2시간 담그거나 데치면 칼륨이 30~50% 감소합니다.</p>
              </div>
              <FoodSection title="식재료" icon={<Apple size={16} className="text-[#22C55E]" />} lowItems={LOW_POTASSIUM_INGREDIENTS} highItems={HIGH_POTASSIUM_INGREDIENTS} nutrientType="potassium" />
              <FoodSection title="가공식품" icon={<ShoppingBag size={16} className="text-[#F59E0B]" />} lowItems={LOW_POTASSIUM_PROCESSED} highItems={HIGH_POTASSIUM_PROCESSED} nutrientType="potassium" />
              <FoodSection title="요리" icon={<Utensils size={16} className="text-[#8B5CF6]" />} lowItems={LOW_POTASSIUM_DISHES} highItems={HIGH_POTASSIUM_DISHES} nutrientType="potassium" />
            </section>
            <section>
              <h3 className="text-lg font-bold text-[#1F2937] mb-3">인 (Phosphorus)</h3>
              <div className="bg-[#EFF6FF] rounded-xl p-4 mb-4 text-sm text-[#1E40AF] leading-relaxed">
                <p className="mb-1"><strong>인이란?</strong> 뼈와 치아 형성, 에너지 대사에 필수적인 미네랄입니다.</p>
                <p className="mb-1"><strong>CKD 환자 주의점:</strong> 신장이 인 배출을 못하면 고인혈증으로 뼈에서 칼슘이 빠져나와 골다공증, 혈관 석회화 위험이 있습니다.</p>
                <p className="mb-1"><strong>1일 권장량:</strong> 800mg 이하 (1끼 약 267mg)</p>
                <p><strong>줄이는 팁:</strong> 가공식품의 인산염 첨가물(소시지, 햄, 콜라 등) 피하기, 유제품 섭취 제한</p>
              </div>
              <FoodSection title="식재료" icon={<Apple size={16} className="text-[#22C55E]" />} lowItems={LOW_PHOSPHORUS_INGREDIENTS} highItems={HIGH_PHOSPHORUS_INGREDIENTS} nutrientType="phosphorus" />
              <FoodSection title="가공식품" icon={<ShoppingBag size={16} className="text-[#F59E0B]" />} lowItems={LOW_PHOSPHORUS_PROCESSED} highItems={HIGH_PHOSPHORUS_PROCESSED} nutrientType="phosphorus" />
              <FoodSection title="요리" icon={<Utensils size={16} className="text-[#8B5CF6]" />} lowItems={LOW_PHOSPHORUS_DISHES} highItems={HIGH_PHOSPHORUS_DISHES} nutrientType="phosphorus" />
            </section>
          </div>
        )}

        {/* ── 레시피 코치 ───────────────────────────────────────────────────── */}
        {activeTab === 'recipe-coach' && (
          <div className="space-y-4">
            {/* 안내 메시지 — 최상단 */}
            <div className="bg-gradient-to-r from-[#F0FDF4] to-[#EFF6FF] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ChefHat size={24} className="text-[#00C9B7] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-[#1F2937] mb-1">신장질환식 대체 레시피</h4>
                  <p className="text-sm text-gray-600">
                    평소에 자주 먹는 음식을 <span className="text-[#00C9B7] font-medium">저염·저칼륨·저인</span> 식재료로 대체한 레시피 추천을 공유합니다.
                    마음에 드는 요리는 <span className="font-medium">'좋아요'</span>로 평가해 주세요.
                  </p>
                </div>
              </div>
            </div>

            {/* 필터 + 등록 버튼 */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* 저감 영양소 필터 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">저감 영양소</span>
                {NUTRIENT_FILTERS.map((tag) => (
                  <button key={tag} onClick={() => toggleFilter(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      filterTags.includes(tag)
                        ? tag.includes('칼륨') ? 'bg-green-500 text-white border-green-500'
                          : tag.includes('나트륨') ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#00C9B7]'
                    }`}>
                    {tag}
                  </button>
                ))}
                {filterTags.length > 0 && (
                  <button onClick={() => setFilterTags([])} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    전체
                  </button>
                )}
              </div>
              {/* 레시피 등록 버튼 */}
              <button onClick={handleSubmitClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}>
                <PenLine size={13} />
                레시피 등록
              </button>
            </div>

            {/* 레시피 그리드 */}
            {isLoadingRecipes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#00C9B7]" />
              </div>
            ) : filteredRecipes.length > 0 ? (
              <>
<div className="grid grid-cols-2 gap-3">
                  {filteredRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      userVote={userVotes[recipe.id] ?? null}
                      onVote={handleVote}
                      onLoginRequired={() => setShowLoginModal(true)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <ChefHat size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">해당 필터에 맞는 레시피가 없습니다.</p>
                <button onClick={() => setFilterTags([])} className="mt-2 text-xs text-[#00C9B7] underline">필터 초기화</button>
              </div>
            )}
          </div>
        )}

        {/* ── 식단 로그 ─────────────────────────────────────────────────────── */}
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
                    <div className="flex-shrink-0">
                      <img src={log.image_url} alt={log.dish_name} className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/64x64/E8F5E9/2E7D32?text=${encodeURIComponent(log.dish_name.charAt(0))}`; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#1F2937] truncate">{log.dish_name}</p>
                          <p className="text-xs text-[#9CA3AF]">{getMealTypeLabel(log.meal_type)} · {log.logged_at ? formatDate(log.logged_at) : ''}</p>
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

      {/* 식단 로그 플로팅 버튼 */}
      {activeTab === 'diet-log' && (
        <button onClick={handleAddClick}
          className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all z-40"
          style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}>
          <Plus size={24} />
        </button>
      )}

      {/* 모달들 */}
      <RecipeSubmitModal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSuccess={handleSubmitSuccess} />

      <MealRecordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchDietLogs} />

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-[85%] max-w-sm mx-4 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F0FDF4] flex items-center justify-center">
              <ChefHat size={32} className="text-[#00C9B7]" />
            </div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">로그인이 필요합니다</h3>
            <p className="text-sm text-gray-500 mb-6">레시피 등록·평가 기능은<br />로그인 후 이용할 수 있습니다.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}>
                로그인
              </button>
              <button onClick={() => setShowLoginModal(false)}
                className="w-full py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-100">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
