import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Apple, Utensils, ShoppingBag, Plus, X, Camera, Loader2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
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

type TabType = 'nutri-coach' | 'diet-log';
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
      const formData = new FormData();
      formData.append('file', selectedImage);
      formData.append('meal_type', mealType);
      if (dishName.trim()) {
        formData.append('dish_name', dishName.trim());
      }

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/diet-log/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        setError(data.error || '업로드에 실패했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
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

  // 식단 기록 목록 가져오기
  const fetchDietLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/diet-log/list?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setDietLogs(data.results);
      }
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
              뉴트리코치
              {activeTab === 'nutri-coach' && (
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

        {/* Diet Log Content */}
        {activeTab === 'diet-log' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-[#1F2937]">목표 설정</h3>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #F2FFFD 0%, #F8F4FE 100%)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs mb-1 text-[#6B7280]">칼륨 (mg/일)</label>
                  <input type="number" placeholder="2000" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-[#6B7280]">인 (mg/일)</label>
                  <input type="number" placeholder="800" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-[#6B7280]">단백질 (g/일)</label>
                  <input type="number" placeholder="60" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-[#6B7280]">열량 (kcal/일)</label>
                  <input type="number" placeholder="2000" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="font-medium text-[#1F2937]">식사 기록</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#00C9B7] text-white text-sm font-medium rounded-lg hover:bg-[#00B5A5] transition-colors"
              >
                <Plus size={16} />
                기록하기
              </button>
            </div>

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
                <p className="text-xs mt-1">위의 "기록하기" 버튼을 눌러 첫 식사를 기록해보세요!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 플로팅 버튼 (식단 로그 탭에서만 표시) */}
      {activeTab === 'diet-log' && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 w-14 h-14 bg-[#00C9B7] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#00B5A5] transition-colors z-40"
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
    </div>
  );
}
