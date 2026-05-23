import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Volume2, VolumeX, X } from 'lucide-react';

export interface NutritionCard {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  details: string;
  category: 'tip' | 'recipe';
  ingredients?: string[];
  cookingSteps?: string[];
  nutritionInfo?: {
    sodium?: number;
    potassium?: number;
    phosphorus?: number;
    protein?: number;
  };
}

interface NutritionCardCarouselProps {
  cards: NutritionCard[];
  onBookmark: (cardId: string) => void;
  bookmarkedIds: string[];
}

export function NutritionCardCarousel({ cards, onBookmark, bookmarkedIds }: NutritionCardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<NutritionCard | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const closeDetail = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSelectedCard(null);
  };

  if (cards.length === 0) return null;

  return (
    <div className="mt-4">
      {/* Thumbnail Carousel */}
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <ChevronLeft size={16} color="#666" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-10"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="flex-shrink-0 w-[140px] cursor-pointer group"
            >
              <div className="relative w-[140px] h-[100px] rounded-lg overflow-hidden shadow-sm border border-gray-100 group-hover:shadow-md transition-shadow">
                <img
                  src={card.thumbnail}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://placehold.co/140x100/E8F5E9/2E7D32?text=${encodeURIComponent(card.title.substring(0, 6))}`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/90 text-gray-700">
                  {card.category === 'tip' ? '팁' : '레시피'}
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium text-gray-800 line-clamp-2 group-hover:text-[#00C9B7] transition-colors">
                {card.title}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 border border-gray-200"
        >
          <ChevronRight size={16} color="#666" />
        </button>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="relative h-[180px]">
            <img
              src={selectedCard.thumbnail}
              alt={selectedCard.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/400x180/E8F5E9/2E7D32?text=${encodeURIComponent(selectedCard.title)}`;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Close button */}
            <button
              onClick={closeDetail}
              className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <X size={16} color="#666" />
            </button>

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="inline-block px-2 py-1 text-[10px] font-medium rounded-full bg-[#00C9B7] text-white mb-2">
                {selectedCard.category === 'tip' ? '저칼륨 요리 팁' : '저칼륨 레시피'}
              </span>
              <h3 className="text-white text-[18px] font-bold">{selectedCard.title}</h3>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-[14px] text-gray-700 leading-relaxed mb-4">
              {selectedCard.description}
            </p>

            {/* Ingredients for recipes */}
            {selectedCard.ingredients && selectedCard.ingredients.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[13px] font-semibold text-gray-800 mb-2">재료</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.ingredients.map((ing, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 rounded-full text-[12px] text-gray-600">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cooking steps */}
            {selectedCard.cookingSteps && selectedCard.cookingSteps.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[13px] font-semibold text-gray-800 mb-2">조리 방법</h4>
                <ol className="space-y-2">
                  {selectedCard.cookingSteps.map((step, idx) => (
                    <li key={idx} className="flex gap-2 text-[13px] text-gray-600">
                      <span className="flex-shrink-0 w-5 h-5 bg-[#00C9B7] text-white rounded-full flex items-center justify-center text-[11px] font-medium">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Nutrition info */}
            {selectedCard.nutritionInfo && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-[13px] font-semibold text-gray-800 mb-2">영양 정보 (1인분 기준)</h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[11px] text-gray-500">나트륨</p>
                    <p className="text-[13px] font-medium text-gray-800">{selectedCard.nutritionInfo.sodium || '-'}mg</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">칼륨</p>
                    <p className="text-[13px] font-medium text-gray-800">{selectedCard.nutritionInfo.potassium || '-'}mg</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">인</p>
                    <p className="text-[13px] font-medium text-gray-800">{selectedCard.nutritionInfo.phosphorus || '-'}mg</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">단백질</p>
                    <p className="text-[13px] font-medium text-gray-800">{selectedCard.nutritionInfo.protein || '-'}g</p>
                  </div>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {selectedCard.details}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => handleSpeak(`${selectedCard.title}. ${selectedCard.description}. ${selectedCard.details}`)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-colors ${
                  isSpeaking
                    ? 'bg-[#00C9B7] text-white border-[#00C9B7]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span className="text-[13px] font-medium">{isSpeaking ? '음성 중지' : '음성으로 듣기'}</span>
              </button>

              <button
                onClick={() => onBookmark(selectedCard.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-colors ${
                  bookmarkedIds.includes(selectedCard.id)
                    ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {bookmarkedIds.includes(selectedCard.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                <span className="text-[13px] font-medium">
                  {bookmarkedIds.includes(selectedCard.id) ? '즐겨찾기됨' : '즐겨찾기'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
