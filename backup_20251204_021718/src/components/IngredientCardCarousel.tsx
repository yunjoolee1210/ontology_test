import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChefHat } from 'lucide-react';

export interface IngredientCard {
  id: string;
  name: string;
  thumbnail: string;
  potassium: number; // mg per 100g
  category: 'vegetable' | 'other';
  description?: string;
}

interface IngredientCardCarouselProps {
  ingredients: IngredientCard[];
  onSelectIngredient: (ingredient: IngredientCard) => void;
  selectedId?: string;
}

// 저칼륨 채소 데이터 (과일 제외, 100g 기준 칼륨 함량)
// 이미지 파일: /food/ingredients/vegetables/{subcategory}-{english}-{korean}.png
// PRD 9.5 네이밍 컨벤션 준수: {subcategory}-{english}-{korean}.png
// publicDir: '../rsc/static' → /food/ingredients/...
export const LOW_POTASSIUM_VEGETABLES: IngredientCard[] = [
  { id: 'cabbage', name: '양배추', thumbnail: '/food/ingredients/vegetables/vegetables-cabbage-양배추.png', potassium: 170, category: 'vegetable', description: '쌈, 샐러드, 볶음 등 다양하게 활용' },
  { id: 'cucumber', name: '오이', thumbnail: '/food/ingredients/vegetables/vegetables-cucumber-오이.png', potassium: 147, category: 'vegetable', description: '냉국, 무침, 샐러드에 좋음' },
  { id: 'eggplant', name: '가지', thumbnail: '/food/ingredients/vegetables/vegetables-eggplant-가지.png', potassium: 230, category: 'vegetable', description: '볶음, 찜, 구이로 활용' },
  { id: 'lettuce', name: '상추', thumbnail: '/food/ingredients/vegetables/vegetables-lettuce-상추.png', potassium: 194, category: 'vegetable', description: '쌈 채소로 최적' },
  { id: 'bellpepper', name: '피망', thumbnail: '/food/ingredients/vegetables/vegetables-bell-pepper-피망.png', potassium: 175, category: 'vegetable', description: '볶음, 샐러드에 활용' },
  { id: 'iceberg', name: '양상추', thumbnail: '/food/ingredients/vegetables/vegetables-iceberg-lettuce-양상추.png', potassium: 141, category: 'vegetable', description: '샐러드, 샌드위치에 좋음' },
  { id: 'zucchini', name: '애호박', thumbnail: '/food/ingredients/vegetables/vegetables-zucchini-애호박.png', potassium: 261, category: 'vegetable', description: '전, 볶음, 찌개에 활용' },
  { id: 'radish', name: '무', thumbnail: '/food/ingredients/vegetables/vegetables-radish-무.png', potassium: 227, category: 'vegetable', description: '국, 나물, 깍두기로 활용' },
  { id: 'beansprout', name: '콩나물', thumbnail: '/food/ingredients/vegetables/vegetables-bean-sprout-콩나물.png', potassium: 169, category: 'vegetable', description: '무침, 국에 좋음' },
  { id: 'onion', name: '양파', thumbnail: '/food/ingredients/vegetables/vegetables-onion-양파.png', potassium: 146, category: 'vegetable', description: '볶음, 조림에 기본 재료' },
];

// 칼륨 수준 판정 (100g 기준)
const getPotassiumLevel = (value: number): { label: string; color: string; bgColor: string } => {
  if (value < 150) return { label: '매우 낮음', color: '#1B5E20', bgColor: '#C8E6C9' };
  if (value < 200) return { label: '낮음', color: '#2E7D32', bgColor: '#E8F5E9' };
  if (value < 300) return { label: '보통', color: '#F57C00', bgColor: '#FFF3E0' };
  return { label: '주의', color: '#C62828', bgColor: '#FFEBEE' };
};

export function IngredientCardCarousel({ ingredients, onSelectIngredient, selectedId }: IngredientCardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (ingredients.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Ingredient Cards */}
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <ChevronLeft size={14} color="#666" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-9"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {ingredients.map((ingredient) => {
            const level = getPotassiumLevel(ingredient.potassium);
            const isSelected = selectedId === ingredient.id;

            return (
              <div
                key={ingredient.id}
                onClick={() => onSelectIngredient(ingredient)}
                className={`flex-shrink-0 w-[110px] cursor-pointer group transition-all duration-200 ${
                  isSelected ? 'scale-105' : ''
                }`}
              >
                <div className={`relative w-[110px] h-[90px] rounded-xl overflow-hidden shadow-sm border-2 transition-all ${
                  isSelected ? 'border-[#00C9B7] shadow-lg' : 'border-gray-100 group-hover:border-[#00C9B7]/50'
                }`}>
                  <img
                    src={ingredient.thumbnail}
                    alt={ingredient.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://placehold.co/110x90/E8F5E9/2E7D32?text=${encodeURIComponent(ingredient.name)}`;
                    }}
                  />
                  {/* Potassium Badge */}
                  <div
                    className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: level.bgColor, color: level.color }}
                  >
                    K {ingredient.potassium}mg
                  </div>
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-[12px] font-medium text-center">{ingredient.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <ChevronRight size={14} color="#666" />
        </button>
      </div>

      {/* Follow-up Message */}
      <div className="mt-3 p-3 bg-gradient-to-r from-[#E8F5E9] to-[#F1F8E9] rounded-xl border border-[#C8E6C9]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#00C9B7] rounded-full flex items-center justify-center">
            <ChefHat size={16} color="white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-gray-700 leading-relaxed">
              <span className="font-medium text-[#00C9B7]">저칼륨 식재료를 사용한 요리를 추천해 드릴까요?</span>
              <br />
              <span className="text-[12px] text-gray-500">위 재료를 선택하시면 해당 재료를 주재료로 활용한 요리를 추천해 드립니다.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
