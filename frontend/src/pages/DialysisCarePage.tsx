import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Plus, Trash2, Search, MapPin, Phone, Building2,
  Droplets, Scale, Activity, FileText, ChevronDown, X,
  Heart, ShieldCheck, Dumbbell, AlertCircle, List, Map as MapIcon,
  Moon, SlidersHorizontal, Star, Share2, Compass, RotateCcw,
  Check, ExternalLink, ChevronUp, Info, Clock, Calendar, ThumbsUp, MessageSquare
} from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listDialysisLogs, addDialysisLog, deleteDialysisLog, DialysisLog, NewDialysisLog } from '../services/dialysisApi';
import { 
  listHospitals, 
  Hospital, 
  listHospitalReviews, 
  addHospitalReview, 
  deleteHospitalReview, 
  HospitalReview 
} from '../services/hospitalApi';

type Tab = '투석 코치' | '투석 병원' | '투석 기록';

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '경남', '광주', '대전', '대구', '충북', '충남', '경북', '전남', '전북', '강원', '제주', '세종', '울산'];

// ── 투석 코치 탭 ─────────────────────────────────────────────────
function CoachTab() {
  const [open, setOpen] = useState<string | null>('what');

  const toggle = (id: string) => setOpen(p => p === id ? null : id);

  const sections = [
    {
      id: 'what',
      title: '투석이란?',
      icon: <Droplets size={18} className="text-[#00C8B4]" />,
      content: (
        <div className="space-y-3 text-sm text-[#374151] leading-relaxed">
          <p>신장은 혈액 속 노폐물과 과잉 수분을 걸러 소변으로 내보내는 장기입니다. 만성신장병 말기(5기)에 이르면 신장이 이 기능을 충분히 수행하지 못해 <strong>투석</strong>이 필요합니다.</p>
          <p>투석은 신장 기능을 인공적으로 대체하여 혈액 내 요독·수분·전해질을 조절하는 치료법입니다.</p>
          <div className="p-3 rounded-xl bg-[#F2FFFD] border border-[#CCFBF1]">
            <p className="font-semibold text-[#00C8B4] mb-1">주요 적용 기준</p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>GFR(사구체여과율) 10 mL/min/1.73㎡ 미만</li>
              <li>심각한 요독 증상(오심, 구토, 의식 저하)</li>
              <li>조절 불가능한 고칼륨혈증·폐부종</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'compare',
      title: '혈액투석 vs 복막투석 비교',
      icon: <Activity size={18} className="text-[#9F7AEA]" />,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="p-2.5 text-left border border-[#E5E7EB] text-[#374151] font-semibold">항목</th>
                <th className="p-2.5 text-center border border-[#E5E7EB] text-[#00C8B4] font-semibold">혈액투석 (HD)</th>
                <th className="p-2.5 text-center border border-[#E5E7EB] text-[#9F7AEA] font-semibold">복막투석 (PD)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['치료 장소', '병원 (주 3회)', '가정 (매일)'],
                ['1회 시간', '4~5시간', '4~8시간 (자동화 시 취침 중)'],
                ['혈관 접근', '동정맥루 / 카테터', '복막 카테터'],
                ['식이제한', '수분·칼륨 엄격', '상대적으로 유연'],
                ['자유도', '병원 스케줄 의존', '생활 패턴 유지 가능'],
                ['감염 위험', '혈류 감염', '복막염'],
                ['적합 대상', '심혈관 안정 필요 시', '잔여 신기능 있을 때'],
              ].map(([item, hd, pd]) => (
                <tr key={item} className="even:bg-[#FAFAFA]">
                  <td className="p-2.5 border border-[#E5E7EB] font-medium text-[#374151]">{item}</td>
                  <td className="p-2.5 border border-[#E5E7EB] text-center text-[#374151]">{hd}</td>
                  <td className="p-2.5 border border-[#E5E7EB] text-center text-[#374151]">{pd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'access',
      title: '혈관 접근로 종류',
      icon: <ShieldCheck size={18} className="text-[#2563EB]" />,
      content: (
        <div className="space-y-3">
          {[
            { name: '동정맥루 (AVF)', desc: '자신의 동맥과 정맥을 연결해 만든 접근로. 가장 권장되는 방법으로 혈류량이 풍부하고 감염·혈전 위험이 낮습니다.', badge: '권장', badgeColor: 'bg-[#F2FFFD] text-[#00C8B4] border border-[#CCFBF1]' },
            { name: '동정맥 이식편 (AVG)', desc: '인공혈관을 동맥과 정맥 사이에 이식합니다. 자신의 혈관이 불량할 때 사용하며 혈전 위험이 다소 높습니다.', badge: '차선', badgeColor: 'bg-yellow-100 text-yellow-700' },
            { name: '중심정맥 카테터 (CVC)', desc: '목이나 가슴의 큰 정맥에 삽입하는 카테터입니다. 즉시 사용 가능하나 감염 위험이 높아 임시 수단으로 사용됩니다.', badge: '임시', badgeColor: 'bg-red-100 text-red-700' },
          ].map(({ name, desc, badge, badgeColor }) => (
            <div key={name} className="p-3 rounded-xl border border-[#EEF0F2]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-semibold text-sm text-[#1F2937]">{name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'daily',
      title: '일상생활 가이드',
      icon: <Dumbbell size={18} className="text-[#D97706]" />,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <Droplets size={20} className="text-[#2563EB]" />, title: '수분 관리', desc: '1일 소변량 + 500mL 이내로 제한. 투석 간 체중 증가 3% 미만 유지', bg: '#EFF6FF' },
            { icon: <Heart size={20} className="text-[#DC2626]" />, title: '식이 관리', desc: '칼륨·인 함량이 낮은 식품 선택. 저염식 (나트륨 2000mg/일 이하)', bg: '#FFF5F5' },
            { icon: <Dumbbell size={20} className="text-[#9F7AEA]" />, title: '운동', desc: '주 3~5회 유산소 운동 30분 권장. 동정맥루 팔 과부하 주의', bg: '#F8F4FE' },
            { icon: <ShieldCheck size={20} className="text-[#D97706]" />, title: '감염 예방', desc: '투석 부위 청결 유지. 발열·발적 시 즉시 병원 방문', bg: '#FFFBEB' },
          ].map(({ icon, title, desc, bg }) => (
            <div key={title} className="p-3 rounded-xl border border-[#EEF0F2]" style={{ background: bg }}>
              <div className="mb-2">{icon}</div>
              <div className="text-sm font-bold text-[#1F2937] mb-1">{title}</div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'warning',
      title: '응급 증상 및 주의사항',
      icon: <AlertCircle size={18} className="text-[#EF4444]" />,
      content: (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
            <p className="text-xs font-semibold text-[#991B1B] mb-2">즉시 병원 방문이 필요한 증상</p>
            <ul className="text-xs text-[#7F1D1D] space-y-1 list-disc pl-4">
              <li>호흡곤란, 가슴 통증</li>
              <li>동정맥루 부위 출혈·감염(발열, 발적, 부종)</li>
              <li>투석 후 심한 저혈압·의식 저하</li>
              <li>48시간 이상 소변 없음</li>
            </ul>
          </div>
          <p className="text-xs text-[#6B7280] px-1">※ 이 정보는 의료 참고용이며, 개인의 상태에 따라 담당 의료진과 반드시 상담하세요.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map(({ id, title, icon, content }) => (
        <div key={id} className="rounded-2xl border border-[#EEF0F2] overflow-hidden">
          <button
            onClick={() => toggle(id)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {icon}
              <span className="font-semibold text-[#1F2937] text-sm">{title}</span>
            </div>
            <ChevronDown
              size={18}
              className="text-gray-400 transition-transform duration-200"
              style={{ transform: open === id ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {open === id && (
            <div className="px-4 pb-4 pt-1 bg-white border-t border-[#EEF0F2]">
              {content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface HospitalReviewsSectionProps {
  hospital: Hospital;
  reviews: HospitalReview[];
  onReviewAdded: () => void;
}

function HospitalReviewsSection({ hospital, reviews, onReviewAdded }: HospitalReviewsSectionProps) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await addHospitalReview({
        hospital_id: hospital.id,
        rating,
        content: content.trim()
      });
      setContent('');
      setRating(5);
      onReviewAdded();
    } catch (err: any) {
      if (err.message === '로그인 필요') {
        alert('리뷰를 작성하려면 로그인이 필요합니다.');
      } else {
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return;
    try {
      await deleteHospitalReview(reviewId, hospital.id);
      onReviewAdded();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 text-left" onClick={e => e.stopPropagation()}>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">💬 환자 보호자 리뷰 ({reviews.length})</h4>
      
      {/* 리뷰 리스트 */}
      <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
        {reviews.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">등록된 리뷰가 없습니다. 첫 리뷰를 남겨보세요!</p>
        ) : (
          reviews.map(rev => (
            <div key={rev.id} className="p-3 bg-gray-50 rounded-xl border border-gray-150 relative text-xs">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-700">{rev.author_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                  {(rev.user_id === 'local_user' || localStorage.getItem('userId') === rev.user_id) && (
                    <button 
                      onClick={() => handleDelete(rev.id)} 
                      className="text-red-400 hover:text-red-600 text-[10px] font-bold"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed break-words whitespace-pre-wrap">{rev.content}</p>
            </div>
          ))
        )}
      </div>

      {/* 리뷰 작성 폼 */}
      <form onSubmit={handleSubmit} className="border-t border-gray-150 pt-3 space-y-2.5">
        {/* 평점 선택 기능 제거 (요구사항 반영) */}

        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="환자 및 보호자분들께 힘이 되는 리뷰를 작성해주세요..."
            className="flex-1 p-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#00C8B4] resize-none h-[54px] bg-[#F9FAFB]"
            maxLength={300}
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 bg-[#00C8B4] text-white rounded-xl text-xs font-bold hover:bg-[#00B3A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
          >
            {submitting ? '등록중' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 투석 병원 탭 (Naver Map) ──────────────────────────────────────
const POPULAR_SEARCHES = ['강남구', '송파구', '수원시', '부평구', '해운대구', '대구 중구'];

const getSimulatedDetails = (h: Hospital) => {
  const idStr = h.id ? String(h.id) : 'h_default';
  const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const rating = (4.3 + (hash % 7) * 0.1).toFixed(1);
  const reviewsCount = 12 + (hash % 67);
  
  const reviewTemplates = [
    ["투석실이 정말 깨끗하고 조용해요. 간호사 선생님들이 정성껏 돌봐주십니다.", "주차 공간이 편리하고 대기시간도 짧아 아주 만족스러워요."],
    ["최신 투석 장비가 잘 구비되어 있습니다. 원장님이 매우 전문적이십니다.", "야간 투석 운영 요일이 직장 생활과 병행하기에 큰 위안이 됩니다."],
    ["대중교통 접근성이 뛰어납니다. 지하철역 바로 옆이라 환자 혼자 가기 편해요.", "베드 간격이 넉넉하고 개인 TV가 있어서 투석받는 시간이 편안합니다."],
    ["간호사분들의 숙련도가 높아 투석 침 꽂을 때 아프지 않게 잘해주십니다.", "실내 환경이 쾌적하며 친절하고 신속하게 예약을 잡아주십니다."],
    ["투석실 전담팀이 있어 위생 관리가 철저한 것 같아요. 안심하고 신뢰합니다.", "주치의 선생님 면담이 깊이 있고 따뜻해 항상 감사하게 다닙니다."]
  ];
  
  const reviews = reviewTemplates[hash % reviewTemplates.length];
  
  const parkingOptions = ["무료 주차 제공 (외래 환자 4시간 무료)", "무료 주차장 완비 (발레파킹 가능)", "건물 지하 주차 공간 넉넉함", "병원 내 타워 주차장 완비 (기계식)"];
  const parking = parkingOptions[hash % parkingOptions.length];
  
  const transportOptions = [
    "지하철역 출구 도보 3분 거리",
    "지하철역 2번 출구 바로 앞 (도보 1분)",
    "시내 버스정류장 바로 앞 (도보 2분)",
    "지하철역 도보 5분 거리, 셔틀차량 상시 운행"
  ];
  const publicTransport = transportOptions[hash % transportOptions.length];
  
  const opTimes = h.night_dialysis
    ? "월·수·금: 06:00 ~ 23:00 (야간투석 가능) / 화·목·토: 06:00 ~ 18:00"
    : "월~토: 06:00 ~ 18:00 (일요일 휴진)";
    
  return {
    rating,
    reviewsCount,
    reviews,
    parking,
    publicTransport,
    opTimes,
    dialysisMethods: ["혈액투석(HD) 가능", "복막투석(PD) 연계"]
  };
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// SIDO region coordinate mapping for centering and zooming the map
const REGION_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  '서울': { lat: 37.5665, lng: 126.9780, zoom: 11 },
  '경기': { lat: 37.2752, lng: 127.0095, zoom: 9 },
  '인천': { lat: 37.4563, lng: 126.7052, zoom: 11 },
  '부산': { lat: 35.1796, lng: 129.0756, zoom: 11 },
  '대구': { lat: 35.8714, lng: 128.6014, zoom: 11 },
  '광주': { lat: 35.1595, lng: 126.8526, zoom: 11 },
  '대전': { lat: 36.3504, lng: 127.3845, zoom: 11 },
  '울산': { lat: 35.5389, lng: 129.3114, zoom: 11 },
  '세종': { lat: 36.4800, lng: 127.2890, zoom: 11 },
  '강원': { lat: 37.7519, lng: 128.2571, zoom: 9 },
  '충북': { lat: 36.6356, lng: 127.4912, zoom: 9 },
  '충남': { lat: 36.5184, lng: 126.8000, zoom: 9 },
  '전북': { lat: 35.8206, lng: 127.1087, zoom: 9 },
  '전남': { lat: 34.8160, lng: 126.4629, zoom: 9 },
  '경북': { lat: 36.5760, lng: 128.5056, zoom: 9 },
  '경남': { lat: 35.2373, lng: 128.6919, zoom: 9 },
  '제주': { lat: 33.4996, lng: 126.5312, zoom: 10 },
};

function HospitalTab() {
  const [allHospitals, setAllHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  
  // ── 필터 상태 정의 ──
  const [region, setRegion] = useState('전체'); // 시/도
  const [selectedSiGunGu, setSelectedSiGunGu] = useState('전체'); // 시/군/구
  const [filterNight, setFilterNight] = useState(false); // 야간 투석 운영
  const [filterKsn, setFilterKsn] = useState(false); // 우수 인공신장실
  const [filterHira, setFilterHira] = useState(false); // 심평원 1등급
  const [filterSpecialist, setFilterSpecialist] = useState(false); // 투석전문의 상주
  const [filterMinMachines, setFilterMinMachines] = useState(0); // 투석기 대수 최소값

  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('name'); // 'name', 'rating', 'machines', 'night'
  const [mapZoom, setMapZoom] = useState<number>(7);
  const [mapBounds, setMapBounds] = useState<any>(null);

  // 모바일 전용 UI 상태
  const [bottomSheetStage, setBottomSheetStage] = useState<1 | 2 | 3>(2); // 1: 최소화, 2: 중간, 3: 최대화

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // 터치 및 제스처 레퍼런스
  const touchStartY = useRef<number>(0);
  const touchStartStage = useRef<number>(2);
  const swipeStartX = useRef<number>(0);

  // ── 자체 리뷰 평점 실시간 캐시 및 계산 로직 ──
  const [reviewsCache, setReviewsCache] = useState<Record<string, HospitalReview[]>>({});

  const loadReviews = useCallback(async (hospitalId: string) => {
    try {
      const revs = await listHospitalReviews(hospitalId);
      setReviewsCache(prev => ({ ...prev, [hospitalId]: revs }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (selectedHospital) {
      loadReviews(selectedHospital.id);
    }
  }, [selectedHospital, loadReviews]);

  const getHospitalRatingStats = useCallback((hospitalId: string) => {
    const revs = reviewsCache[hospitalId];
    if (!revs || revs.length === 0) {
      const localSaved = localStorage.getItem(`reviews_${hospitalId}`);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved) as HospitalReview[];
          if (parsed.length > 0) {
            const sum = parsed.reduce((acc, r) => acc + r.rating, 0);
            return {
              rating: (sum / parsed.length).toFixed(1),
              count: parsed.length
            };
          }
        } catch (e) {}
      }
      return { rating: '리뷰 없음', count: 0 };
    }
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    return {
      rating: (sum / revs.length).toFixed(1),
      count: revs.length
    };
  }, [reviewsCache]);

  const renderReviewsSection = (h: Hospital) => {
    return (
      <HospitalReviewsSection 
        hospital={h} 
        reviews={reviewsCache[h.id] || []} 
        onReviewAdded={() => loadReviews(h.id)} 
      />
    );
  };

  // 로컬스토리지 기반 즐겨찾기 로드
  useEffect(() => {
    const saved = localStorage.getItem('dialysis_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // 즐겨찾기 토글
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let updated;
    if (favorites.includes(id)) {
      updated = favorites.filter(fav => fav !== id);
    } else {
      updated = [...favorites, id];
    }
    setFavorites(updated);
    localStorage.setItem('dialysis_favorites', JSON.stringify(updated));
  };

  // 병원 전체 데이터 로드 (클라이언트단 빠른 필터링 제공)
  useEffect(() => {
    setLoading(true);
    listHospitals()
      .then(setAllHospitals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 시/도 선택 시, 소속된 병원 정보에서 유니크한 시/군/구 자동 추출
  const availableSiGunGus = useCallback(() => {
    if (region === '전체') return [];
    const set = new Set<string>();
    allHospitals.forEach(h => {
      if (h.region === region && h.address) {
        const parts = String(h.address).trim().split(/\s+/);
        if (parts.length > 1) {
          const district = parts[1]; // 구 또는 군
          if (district.endsWith('구') || district.endsWith('군') || district.endsWith('시')) {
            set.add(district);
          }
        }
      }
    });
    return Array.from(set).sort();
  }, [allHospitals, region]);

  // 시/도 바뀔 때 시/군/구 초기화 및 지도 중심 자동 스위칭
  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setSelectedSiGunGu('전체');
    if (mapInstance.current) {
      const naver = (window as any).naver;
      if (newRegion !== '전체') {
        const coords = REGION_COORDS[newRegion];
        if (coords) {
          mapInstance.current.setCenter(new naver.maps.LatLng(coords.lat, coords.lng));
          mapInstance.current.setZoom(coords.zoom);
        }
      } else {
        mapInstance.current.setCenter(new naver.maps.LatLng(36.5, 127.5));
        mapInstance.current.setZoom(7);
      }
    }
  };

  // Naver 지도 초기화
  useEffect(() => {
    const naver = (window as any).naver;
    if (!naver?.maps || !mapRef.current || mapInstance.current) return;

    mapInstance.current = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(36.5, 127.5), // 전국 대한민국 중심
      zoom: 7,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
      mapTypeControl: false,
      scaleControl: false,
      logoControl: false,
      gestureHandling: 'cooperative' // 두 손가락 스크롤 조율
    });
    setMapReady(true);
  }, []);

  // 지도 이벤트 리스너 등록 (Zoom & Bounds 수집, 200ms 디바운스)
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const naver = (window as any).naver;

    let timer: any = null;
    const boundsListener = naver.maps.Event.addListener(mapInstance.current, 'bounds_changed', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setMapBounds(mapInstance.current.getBounds());
      }, 200);
    });

    const zoomListener = naver.maps.Event.addListener(mapInstance.current, 'zoom_changed', () => {
      setMapZoom(mapInstance.current.getZoom());
    });

    return () => {
      if (timer) clearTimeout(timer);
      naver.maps.Event.removeListener(boundsListener);
      naver.maps.Event.removeListener(zoomListener);
    };
  }, [mapReady]);

  // 실시간 다차원 검색 & 필터링 로직
  const filteredHospitals = allHospitals.filter(h => {
    // 1. 키워드 검색 (이름, 주소, 지역명)
    if (query.trim()) {
      const clean = query.toLowerCase();
      const inName = h.name ? String(h.name).toLowerCase().includes(clean) : false;
      const inAddress = h.address ? String(h.address).toLowerCase().includes(clean) : false;
      const inRegion = h.region ? String(h.region).toLowerCase().includes(clean) : false;
      if (!inName && !inAddress && !inRegion) return false;
    }
    
    // 2. 시/도 필터
    if (region !== '전체' && h.region !== region) return false;
    
    // 3. 시/군/구 필터
    if (selectedSiGunGu !== '전체') {
      const parts = h.address ? String(h.address).trim().split(/\s+/) : [];
      const district = parts[1] || '';
      if (!district.includes(selectedSiGunGu)) return false;
    }
    
    // 4. 투석기 대수 필터
    if (filterMinMachines > 0 && h.dialysis_machines < filterMinMachines) return false;
    
    // 5. 야간투석 여부
    if (filterNight && !h.night_dialysis) return false;

    // 6. 우수 인공신장실 여부
    if (filterKsn && h.ksn_certified !== '인증') return false;

    // 7. 심평원 1등급 여부
    if (filterHira && h.hira_grade !== '1등급') return false;

    // 8. 투석전문의 상주 여부
    if (filterSpecialist) {
      const hasSpecialist = h.is_dialysis_specialist === 1 || (h.specialist_count !== undefined && h.specialist_count > 0);
      if (!hasSpecialist) return false;
    }
    
    // 9. 지도 화면 영역 Bounds 기반 필터링 (로컬 뷰 동기화)
    if (mapBounds && viewMode === 'map') {
      const sw = mapBounds.getSW();
      const ne = mapBounds.getNE();
      if (h.lat < sw.lat() || h.lat > ne.lat() || h.lng < sw.lng() || h.lng > ne.lng()) {
        return false;
      }
    }
    
    return true;
  });

  // 정렬 옵션 처리
  const sortedHospitals = [...filteredHospitals].sort((a, b) => {
    if (sortBy === 'rating') {
      const ratingA = parseFloat(getSimulatedDetails(a).rating);
      const ratingB = parseFloat(getSimulatedDetails(b).rating);
      return ratingB - ratingA;
    }
    
    if (sortBy === 'machines') {
      return b.dialysis_machines - a.dialysis_machines;
    }
    
    if (sortBy === 'night') {
      if (a.night_dialysis && !b.night_dialysis) return -1;
      if (!a.night_dialysis && b.night_dialysis) return 1;
      return b.dialysis_machines - a.dialysis_machines;
    }
    
    return a.name.localeCompare(b.name, 'ko');
  });

  // 지도 마커 & 공식 MarkerClustering 렌더링
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const naver = (window as any).naver;
    if (!naver?.maps) return;

    // 1. 기존 마커 및 클러스터링 초기화
    if ((window as any).markerClusteringInstance) {
      (window as any).markerClusteringInstance.setMap(null);
    }
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    // 2. 새 마커 생성
    const newMarkers = sortedHospitals.map(h => {
      if (!h.lat || !h.lng) return null;

      const isNight = h.night_dialysis;
      const isSelected = selectedHospital?.id === h.id;
      
      const markerHtml = `
        <div class="hospital-marker-wrapper relative cursor-pointer transition-all duration-200 ${isSelected ? 'is-selected' : ''}" style="transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}; z-index: ${isSelected ? 9999 : 100};">
          <!-- Hospital Label -->
          <div class="hospital-label absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-white border border-gray-200 shadow-md text-[10px] font-black text-gray-700 whitespace-nowrap pointer-events-none select-none ${isSelected ? 'selected-hospital-label border-[#00C8B4] text-[#00C8B4] scale-105 z-50' : 'z-10'}">
            ${h.name}
          </div>
          <!-- Pin Body (Teal/Mint for standard, Purple for night-operating, Custom Brand Gradient for selected) -->
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg text-white ${isSelected ? 'ring-4 ring-[#00C9B7]/30 animate-pulse' : ''}" style="background: ${isSelected ? 'linear-gradient(135deg, #00C9B7, #9F7AEA)' : isNight ? 'linear-gradient(135deg, #9F7AEA, #7C3AED)' : 'linear-gradient(135deg, #00C8B4, #00B3A3)'};">
            ${isSelected ? '📍' : isNight ? '🌙' : '💧'}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border-r border-b border-white shadow-md" style="background: ${isSelected ? '#9F7AEA' : isNight ? '#7C3AED' : '#00B3A3'};"></div>
        </div>
      `;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(h.lat, h.lng),
        icon: { content: markerHtml, anchor: new naver.maps.Point(16, 32) }
      });

      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospital(h);
        setBottomSheetStage(1); // 모바일에서 카드 정보 부상시 바텀 시트 자동 축소
        mapInstance.current.panTo(new naver.maps.LatLng(h.lat, h.lng));
        mapInstance.current.setZoom(15);
      });

      return marker;
    }).filter(Boolean) as any[];

    markers.current = newMarkers;

    // 3. 네이버 지도 공식 MarkerClustering 활용 (CareKidney의 고유 브랜드 그라디언트 및 서클 디자인)
    if (newMarkers.length > 0 && (window as any).MarkerClustering) {
      const mc = new (window as any).MarkerClustering({
        minClusterSize: 2,
        maxZoom: 14,
        map: mapInstance.current,
        markers: newMarkers,
        disableClickZoom: false,
        gridSize: 80,
        icons: [
          {
            content: '<div class="flex items-center justify-center cursor-pointer text-white font-extrabold" style="width:40px;height:40px;line-height:36px;font-size:12px;background:#00C9B7;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(0,201,183,0.4)">__count__</div>',
            size: new naver.maps.Size(40, 40),
            anchor: new naver.maps.Point(20, 20)
          },
          {
            content: '<div class="flex items-center justify-center cursor-pointer text-white font-extrabold" style="width:46px;height:46px;line-height:42px;font-size:13px;background:#9F7AEA;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(159,122,234,0.4)">__count__</div>',
            size: new naver.maps.Size(46, 46),
            anchor: new naver.maps.Point(23, 23)
          },
          {
            content: '<div class="flex items-center justify-center cursor-pointer text-white font-extrabold" style="width:52px;height:52px;line-height:48px;font-size:14px;background:linear-gradient(135deg, #00C9B7, #9F7AEA);border:2px solid white;border-radius:50%;box-shadow:0 0 12px rgba(159,122,234,0.5)">__count__</div>',
            size: new naver.maps.Size(52, 52),
            anchor: new naver.maps.Point(26, 26)
          }
        ],
        indexGenerator: [100, 500],
        stylingFunction: (clusterMarker: any, count: number) => {
          const el = clusterMarker.getElement();
          if (el) {
            const inner = el.querySelector('div');
            if (inner) inner.innerHTML = String(count);
          }
        }
      });
      (window as any).markerClusteringInstance = mc;
    } else {
      // 마커 클러스터가 없거나 로드 전인 빌드 백업
      newMarkers.forEach(m => m.setMap(mapInstance.current));
    }
  }, [sortedHospitals, mapReady, selectedHospital]);

  // 검색 제안 필터링 (최대 5개)
  const suggestedHospitals = query.trim()
    ? allHospitals.filter(h => h.name && String(h.name).toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const handleListCardClick = (h: Hospital) => {
    setSelectedHospital(h);
    if (mapInstance.current && h.lat && h.lng) {
      const naver = (window as any).naver;
      mapInstance.current.panTo(new naver.maps.LatLng(h.lat, h.lng));
      mapInstance.current.setZoom(15);
      
      // 모바일 기기 대응: 바텀 시트 자동 축소 및 지도 핀 포커스
      setBottomSheetStage(1);
    }
  };

  // 모바일 바텀시트 터치 제스처 처리
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartStage.current = bottomSheetStage;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaY) > 50) {
      if (deltaY > 0) {
        // 아래로 스와이프
        if (touchStartStage.current === 3) setBottomSheetStage(2);
        else if (touchStartStage.current === 2) setBottomSheetStage(1);
      } else {
        // 위로 스와이프
        if (touchStartStage.current === 1) setBottomSheetStage(2);
        else if (touchStartStage.current === 2) setBottomSheetStage(3);
      }
    }
  };

  // 가로형 요약 카드 스와이프 제어 (이전/다음 병원 연동)
  const handlePrevHospital = () => {
    if (!selectedHospital || sortedHospitals.length === 0) return;
    const idx = sortedHospitals.findIndex(h => h.id === selectedHospital.id);
    const prevIdx = idx > 0 ? idx - 1 : sortedHospitals.length - 1;
    handleListCardClick(sortedHospitals[prevIdx]);
  };

  const handleNextHospital = () => {
    if (!selectedHospital || sortedHospitals.length === 0) return;
    const idx = sortedHospitals.findIndex(h => h.id === selectedHospital.id);
    const nextIdx = idx < sortedHospitals.length - 1 ? idx + 1 : 0;
    handleListCardClick(sortedHospitals[nextIdx]);
  };

  const handleHorizontalSwipeStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleHorizontalSwipeEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(deltaX) > 60) {
      if (deltaX > 0) {
        handlePrevHospital();
      } else {
        handleNextHospital();
      }
    }
  };

  // 모바일 3단계 시트 높이 클래스
  const getBottomSheetHeight = () => {
    if (bottomSheetStage === 1) return 'h-[64px]';
    if (bottomSheetStage === 2) return 'h-[36vh]';
    return 'h-[85vh]';
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden select-none font-sans">
      
      {/* ── CSS 스타일 주입 (줌 레벨별 마커 이름 동적 숨김 성능 최적화) ── */}
      <style>{`
        .zoom-small .hospital-label {
          display: none !important;
        }
        .zoom-small .hospital-marker-wrapper.is-selected .hospital-label {
          display: block !important;
          z-index: 10000;
        }
        .zoom-large .hospital-label {
          display: block !important;
        }
      `}</style>

      {/* ── 상단 고급 검색 & 필터 오버레이 ── */}
      <div className="bg-white border-b border-[#E5E7EB] z-30 shadow-sm flex-shrink-0 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-2">
            
            {/* 1) 검색창 */}
            <div className="relative flex-1">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  placeholder="병원명, 주소, 지역명 통합 검색..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#00C8B4]/30 focus:border-[#00C8B4] transition-all bg-[#F9FAFB] hover:bg-gray-50"
                />
                {query && (
                  <button 
                    onClick={() => { setQuery(''); setShowSearchSuggestions(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-250 text-gray-400"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 검색어 추천 자동완성 */}
              {showSearchSuggestions && (query.trim() !== '' || suggestedHospitals.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 p-3 max-h-[250px] overflow-y-auto">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 text-[11px] text-gray-400">
                    <span>추천 병원 검색결과</span>
                    <button onClick={() => setShowSearchSuggestions(false)} className="hover:text-gray-600 font-bold">닫기</button>
                  </div>
                  {suggestedHospitals.length > 0 ? (
                    <div className="space-y-1">
                      {suggestedHospitals.map(h => (
                        <button
                          key={h.id}
                          onClick={() => {
                            setQuery(h.name || '');
                            setShowSearchSuggestions(false);
                            handleListCardClick(h);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-[#F2FFFD] hover:text-[#00C8B4] font-semibold text-[#374151] flex items-center gap-2 transition-colors border border-transparent hover:border-[#CCFBF1]"
                        >
                          <Building2 size={13} className="text-[#00C8B4] flex-shrink-0" />
                          <span className="truncate">{h.name}</span>
                          <span className="text-[10px] text-gray-400 font-normal truncate ml-auto">{h.address}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-5 text-xs text-gray-400">
                      매칭되는 병원이 없습니다. 다른 키워드를 입력해 보세요.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2) 압축된 필터 버튼 (모바일 스크롤 칩을 소거하여 맵을 최대 확보) */}
            <button
              onClick={() => setShowFilters(true)}
              className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-xs font-semibold flex items-center gap-1 bg-white text-[#4B5563] hover:bg-gray-50 shadow-2xs transition-all flex-shrink-0"
            >
              <SlidersHorizontal size={13} />
              <span>필터</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 메인 바디 Split Layout (PC: 좌리스트 우지도, Mobile: 전체 지도) ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        
        {/* DESKTOP PANEL: 좌측 검색 리스트 (PC 전용 420px 고정) */}
        <div 
          ref={listContainerRef}
          className="hidden lg:flex w-[420px] bg-white border-r border-[#E5E7EB] flex-col overflow-hidden transition-all duration-300 z-10 flex-shrink-0 h-full"
        >
          {/* PC용 정렬 및 검색 결과 개수 바 */}
          <div className="px-4 py-2 bg-gray-50 border-b border-[#E5E7EB] flex justify-between items-center flex-shrink-0">
            <span className="text-[11px] font-extrabold text-[#6B7280]">
              검색결과 <span className="text-[#00C8B4]">{sortedHospitals.length}</span>곳
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-gray-500 outline-none cursor-pointer"
            >
              <option value="name">가나다순</option>
              <option value="rating">별점 높은순</option>
              <option value="machines">투석기 많은순</option>
              <option value="night">야간투석 우선</option>
            </select>
          </div>

          {/* 스크롤 리스트 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-[#00C8B4]" size={28} />
                <span className="text-xs font-semibold text-gray-400">투석 병원 정보 수집 중...</span>
              </div>
            ) : sortedHospitals.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
                <Building2 className="mx-auto mb-3 opacity-30 text-[#9CA3AF]" size={36} />
                <p className="text-xs font-bold text-gray-700">검색 범위 내 병원이 없습니다.</p>
                <p className="text-[10px] text-gray-400 mt-1">지도를 다른 곳으로 이동하거나 필터를 변경해 보세요.</p>
              </div>
            ) : (
              sortedHospitals.map(h => {
                const isSelected = selectedHospital?.id === h.id;
                const isFav = favorites.includes(h.id);
                
                return (
                  <div
                    key={h.id}
                    ref={isSelected ? selectedCardRef : undefined}
                    onClick={() => handleListCardClick(h)}
                    className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col gap-2 cursor-pointer ${isSelected ? 'border-[#00C8B4] bg-[#F2FFFD] shadow-md' : 'border-[#EEF0F2] bg-white hover:border-[#00C8B4]/50'}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-gray-400">
                          {h.region} · { (h.name && String(h.name).includes('의원')) ? '의원' : '종합병원' }
                        </span>
                        <h3 className="font-extrabold text-[#1F2937] text-sm leading-snug hover:text-[#00C8B4] transition-colors">
                          {h.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-dashed border-gray-100">
                      {h.hira_grade === '1등급' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-amber-50 text-[#D97706] border border-amber-200">
                          🏅 심평원 1등급
                        </span>
                      )}
                      
                      {h.ksn_certified === '인증' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-[#F2FFFD] text-[#00C8B4] border border-[#CCFBF1]">
                          🛡️ 우수 인공신장실
                        </span>
                      )}
                      
                      {h.night_dialysis && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F8F4FE] text-[#9F7AEA] font-bold border border-[#E5D5FC]">
                          🌙 야간투석
                        </span>
                      )}

                      {h.is_dialysis_specialist === 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-extrabold border border-blue-100">
                          👨‍⚕️ 전문의 상주
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#6B7280] space-y-1 mt-0.5">
                      <div className="flex items-center gap-1">
                        <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{h.address}</span>
                      </div>
                      {h.phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-600 font-medium">{h.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(h.id);
                          }}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
                            isFav ? 'bg-[#00C8B4]/10 text-[#00C8B4]' : 'text-gray-400 hover:text-[#00C8B4]'
                          }`}
                        >
                          <ThumbsUp size={11} className={isFav ? 'fill-[#00C8B4]' : ''} />
                          <span>좋아요</span>
                        </button>

                        {(() => {
                          const stats = getHospitalRatingStats(h.id);
                          return (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <MessageSquare size={11} className="text-gray-300" />
                              <span>리뷰 {stats.count > 0 ? stats.count : 0}</span>
                            </span>
                          );
                        })()}
                      </div>

                      {h.dialysis_machines > 0 && (
                        <span className="text-[10px] text-gray-400 font-bold">
                          투석기 {h.dialysis_machines}대
                        </span>
                      )}
                    </div>

                    {/* 아코디언 상세 정보 펼침 */}
                    {isSelected && (
                      <div 
                        className="mt-3 pt-3 border-t border-gray-250 space-y-3 animate-slideDown overflow-y-auto max-h-[50vh] pr-1 select-text"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-1.5">
                          {h.hira_grade && (
                            <div className="p-2.5 rounded-xl border text-[11px] font-extrabold bg-amber-50 text-[#D97706] border-amber-200">
                              🏅 건강보험심사평가원 적정성 평가 <strong>최우수 1등급</strong>
                            </div>
                          )}
                          {h.ksn_certified === '인증' && (
                            <div className="p-2.5 bg-[#F2FFFD] rounded-xl border border-[#CCFBF1] text-[11px] text-[#00C8B4] font-extrabold">
                              🛡️ 우수 인공신장실
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 border border-gray-150 rounded-xl p-2.5 bg-gray-50/50">
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-[9px] font-bold text-gray-400 mb-0.5">신장학회 인증</span>
                            <span className={`text-[10px] font-black ${h.ksn_certified === '인증' ? 'text-[#00C8B4]' : 'text-gray-400'}`}>
                              { h.ksn_certified === '인증' ? '우수신장실' : '미인증' }
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-center justify-center text-center border-x border-gray-200/50">
                            <span className="text-[9px] font-bold text-gray-400 mb-0.5">투석 장비</span>
                            <span className="text-[10px] font-black text-[#00C8B4]">
                              💧 {h.dialysis_machines}대 보유
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-[9px] font-bold text-gray-400 mb-0.5">투석 전문의</span>
                            <span className={`text-[10px] font-black ${ (h.specialist_count && h.specialist_count > 0) ? 'text-[#9F7AEA]' : 'text-gray-500' }`}>
                              👨‍⚕️ {h.specialist_count || 0}명 상주
                            </span>
                          </div>
                        </div>

                        {h.night_dialysis && (
                          <div className="rounded-xl border border-[#E5D5FC] bg-[#F8F4FE] p-2.5 text-xs font-semibold text-[#9F7AEA]">
                            🌙 {h.dialysis_days ? `매주 ${h.dialysis_days}요일 야간(23시) 연장 운영` : '야간 투석 연장 운영 지원'}
                          </div>
                        )}

                        {h.nephrology_doctor && (
                          <div className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/20 text-xs">
                            <div className="font-bold text-blue-700 mb-1">신장내과 전문의 상주 정보</div>
                            <div className="text-gray-600 font-semibold">{h.nephrology_doctor}</div>
                          </div>
                        )}

                        <div className="space-y-1 text-xs text-gray-600 border-t border-gray-100 pt-2">
                          <div className="flex justify-between py-0.5">
                            <span className="font-semibold text-gray-400">대표전화</span>
                            <a href={`tel:${h.phone}`} className="font-bold text-[#00C8B4]">{h.phone}</a>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="font-semibold text-gray-400">운영시간</span>
                            <span className="font-bold text-gray-800">
                              { h.night_dialysis ? "월·수·금: 06:00~23:00 / 화·목·토: 06:00~18:00" : "월~토: 06:00 ~ 18:00 (일요일 휴진)" }
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-gray-150 pt-2">
                          {renderReviewsSection(h)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: 네이버 지도 컨테이너 (PC: 65% 고정, Mobile: 화면 전체) */}
        <div 
          className="w-full h-full flex-1 relative bg-[#E5E7EB] order-1 lg:order-2 overflow-hidden"
        >
          {/* 지도 컨테이너 */}
          <div ref={mapRef} className={`w-full h-full ${mapZoom >= 15 ? 'zoom-large' : 'zoom-small'}`}>
            {!(window as any).naver?.maps && (
              <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-sm gap-2">
                <Loader2 className="animate-spin text-[#00C8B4]" size={28} />
                <span>지도를 활성화하는 중입니다...</span>
              </div>
            )}
          </div>

          {/* 맵 범례 (지도 밑부분에 밀착 플로팅) */}
          <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-xs border border-gray-200/50 shadow-md flex items-center gap-2.5 text-[10px] font-bold text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C9B7] block"></span>
              일반 투석
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9F7AEA] block"></span>
              야간 투석
            </span>
            <span className="text-gray-300">|</span>
            <span>{sortedHospitals.length}곳 노출됨</span>
          </div>
        </div>

        {/* ── MOBILE EXCLUSIVE: Swipeable Bottom Sheet (모바일 전용 3단계 시트) ── */}
        <div 
          className={`lg:hidden fixed bottom-[64px] left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${getBottomSheetHeight()}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 드래그용 핸들러 */}
          <div className="w-full py-3 bg-white flex flex-col items-center justify-center flex-shrink-0 cursor-row-resize border-b border-gray-100">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1"></div>
            <div className="text-[10px] font-extrabold text-gray-400">
              현재 영역 내 병원 <span className="text-[#00C9B7]">{sortedHospitals.length}</span>곳 보기
            </div>
          </div>

          {/* 바텀시트 컨텐츠 리스트 (Stage 2, 3에서만 활성화) */}
          {bottomSheetStage > 1 && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-16">
              <div className="flex justify-between items-center pb-2 border-b border-gray-150 mb-3">
                <span className="text-xs font-bold text-gray-400">목록 정렬 기준</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer"
                >
                  <option value="name">가나다순</option>
                  <option value="rating">별점 높은순</option>
                  <option value="machines">투석기 많은순</option>
                  <option value="night">야간투석 우선</option>
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-[#00C8B4]" size={24} />
                </div>
              ) : sortedHospitals.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">
                  매칭되는 병원이 없습니다. 지도를 다르게 드래그해보세요.
                </div>
              ) : (
                sortedHospitals.map(h => {
                  return (
                    <div
                      key={h.id}
                      onClick={() => handleListCardClick(h)}
                      className="p-3.5 rounded-2xl border border-gray-150 bg-white hover:border-[#00C8B4]/50 transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-gray-400">{h.region}</span>
                        <h3 className="font-extrabold text-[#1F2937] text-sm leading-snug">{h.name}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {h.hira_grade === '1등급' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-amber-50 text-[#D97706] border border-amber-200">
                            🏅 심평원 1등급
                          </span>
                        )}
                        {h.ksn_certified === '인증' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-[#F2FFFD] text-[#00C8B4] border border-[#CCFBF1]">
                            🛡️ 우수 인공신장실
                          </span>
                        )}
                        {h.night_dialysis && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F8F4FE] text-[#9F7AEA] font-bold border border-[#E5D5FC]">
                            🌙 야간투석
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-500 truncate">{h.address}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── MOBILE EXCLUSIVE: Horizontal Swipe Details Card (선택된 병원 요약 카드 플로팅) ── */}
        {selectedHospital && bottomSheetStage === 1 && (
          <div 
            className="lg:hidden fixed bottom-[72px] left-4 right-4 z-45 bg-white border border-gray-150 rounded-2xl shadow-xl p-4 flex flex-col gap-2 transition-all animate-slideUp"
            onTouchStart={handleHorizontalSwipeStart}
            onTouchEnd={handleHorizontalSwipeEnd}
          >
            {/* 카드 닫기 및 네비게이션 헤더 */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-[9px] font-bold text-gray-400">{selectedHospital.region}</span>
                <h3 className="font-extrabold text-[#1F2937] text-sm leading-snug truncate">{selectedHospital.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedHospital(null)} 
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* 등급 / 전문의 배지 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedHospital.hira_grade === '1등급' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-amber-50 text-[#D97706] border border-amber-200">
                  🏅 심평원 1등급
                </span>
              )}
              {selectedHospital.ksn_certified === '인증' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold bg-[#F2FFFD] text-[#00C8B4] border border-[#CCFBF1]">
                  🛡️ 우수 인공신장실
                </span>
              )}
              {selectedHospital.night_dialysis && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F8F4FE] text-[#9F7AEA] font-bold border border-[#E5D5FC]">
                  🌙 야간투석
                </span>
              )}
            </div>

            {/* 주소 및 탭안내 */}
            <div className="text-[11px] text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{selectedHospital.address}</span>
              </div>
              {selectedHospital.phone && (
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-gray-400 flex-shrink-0" />
                  <a href={`tel:${selectedHospital.phone}`} className="text-blue-500 hover:underline">{selectedHospital.phone}</a>
                </div>
              )}
            </div>

            {/* 좌우 이동 및 정보 확장 버튼바 */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <button 
                  onClick={handlePrevHospital}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-[10px] font-bold text-gray-600 flex items-center gap-0.5"
                >
                  ◀ 이전
                </button>
                <button 
                  onClick={handleNextHospital}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-[10px] font-bold text-gray-600 flex items-center gap-0.5"
                >
                  다음 ▶
                </button>
              </div>

              <button
                onClick={() => {
                  // 해당 병원을 리스트의 중심으로 확장 노출하기 위해 시트 Stage 3로 변경
                  setBottomSheetStage(3);
                }}
                className="text-[11px] font-bold text-[#00C8B4] hover:underline"
              >
                상세 리뷰/정보 확인
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── 전역 필터 모달 (PC/모바일 공용 글래스모피즘 팝업) ── */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scaleUp">
            
            {/* 모달 헤더 */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-extrabold text-[#1F2937] text-base">필터 설정</h3>
              <button 
                onClick={() => setShowFilters(false)}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* 1. 지역 선택 (SIDO 행정구역 dropdown 최상단 배치) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 block">지역 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1 font-bold">시/도 선택</span>
                    <select
                      value={region}
                      onChange={e => handleRegionChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00C8B4] text-[#374151]"
                    >
                      <option value="전체">전체 시/도</option>
                      {Object.keys(REGION_COORDS).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1 font-bold">시/군/구 선택</span>
                    <select
                      value={selectedSiGunGu}
                      onChange={e => setSelectedSiGunGu(e.target.value)}
                      disabled={region === '전체'}
                      className="w-full px-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00C8B4] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151]"
                    >
                      <option value="전체">전체 시/군/구</option>
                      {availableSiGunGus().map(sg => (
                        <option key={sg} value={sg}>{sg}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. 핵심 지표 토글 스위치 (2x2 그리드 배치) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 block">핵심 상세 조건</label>
                <div className="grid grid-cols-2 gap-3">
                  
                  {/* 야간 투석 운영 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F4FE] border border-[#E5D5FC]">
                    <span className="text-xs font-extrabold text-[#9F7AEA]">🌙 야간 투석 운영</span>
                    <button
                      onClick={() => setFilterNight(p => !p)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${filterNight ? 'bg-[#9F7AEA]' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${filterNight ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* 우수 인공신장실 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F2FFFD] border border-[#CCFBF1]">
                    <span className="text-xs font-extrabold text-[#00C8B4]">🛡️ 우수 인공신장실</span>
                    <button
                      onClick={() => setFilterKsn(p => !p)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${filterKsn ? 'bg-[#00C8B4]' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${filterKsn ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* 심평원 1등급 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-200">
                    <span className="text-xs font-extrabold text-amber-700">🏅 심평원 1등급</span>
                    <button
                      onClick={() => setFilterHira(p => !p)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${filterHira ? 'bg-amber-500' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${filterHira ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* 투석전문의 상주 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-xs font-extrabold text-blue-600">👨‍⚕️ 투석전문의 상주</span>
                    <button
                      onClick={() => setFilterSpecialist(p => !p)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${filterSpecialist ? 'bg-blue-500' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${filterSpecialist ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                </div>
              </div>

              {/* 3. 투석기 개수 슬라이더 */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">보유 투석기 최소 대수</span>
                  <span className="text-xs font-extrabold text-[#00C8B4] bg-[#F2FFFD] px-2 py-0.5 rounded-full border border-[#CCFBF1]">
                    {filterMinMachines > 0 ? `${filterMinMachines}대 이상` : '제한 없음'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={filterMinMachines}
                  onChange={e => setFilterMinMachines(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#00C8B4] outline-none"
                />
                <div className="flex justify-between text-[9px] text-gray-400 font-semibold">
                  <span>전체</span>
                  <span>10대+</span>
                  <span>30대+</span>
                  <span>50대+</span>
                  <span>70대+</span>
                  <span>100대+</span>
                </div>
              </div>

            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRegion('전체');
                  setSelectedSiGunGu('전체');
                  setFilterNight(false);
                  setFilterKsn(false);
                  setFilterHira(false);
                  setFilterSpecialist(false);
                  setFilterMinMachines(0);
                  setQuery('');
                  if (mapInstance.current) {
                    const naver = (window as any).naver;
                    mapInstance.current.setCenter(new naver.maps.LatLng(36.5, 127.5));
                    mapInstance.current.setZoom(7);
                  }
                }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 flex items-center gap-1 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={12} />
                초기화
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-6 py-2.5 rounded-xl bg-[#00C8B4] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#00B3A3] transition-all shadow-sm"
              >
                <Check size={12} />
                적용하기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
// ── 투석 기록 탭 ─────────────────────────────────────────────────
const EMPTY_FORM: NewDialysisLog = {
  treatmentDate: new Date().toISOString().slice(0, 10),
  fluidRemovalL: null,
  weightBefore: null,
  weightAfter: null,
  bpBefore: '',
  bpAfter: '',
  symptoms: '',
};

function LogTab() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('accessToken');
  const [logs, setLogs] = useState<DialysisLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewDialysisLog>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    listDialysisLogs().then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.treatmentDate) return;
    setSaving(true);
    try {
      const added = await addDialysisLog(form);
      setLogs(prev => [added, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      alert(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('기록을 삭제하시겠습니까?')) return;
    await deleteDialysisLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  if (!isLoggedIn) {
    return (
      <div className="text-center py-20 text-[#9CA3AF]">
        <FileText className="mx-auto mb-4 opacity-30" size={40} />
        <p className="mb-4">투석 기록은 로그인 후 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/login')} className="px-5 py-2.5 rounded-xl bg-[#00C8B4] text-white text-sm font-medium">
          로그인
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 새 기록 작성 버튼 (첫 번째 스크린샷의 퀴즈 참여하기 버튼 규격으로 정교화) */}
      <div className="flex justify-center w-full mb-6">
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 rounded-full text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}
        >
          <Plus size={18} /> 새 투석 기록 작성
        </button>
      </div>

      {/* 기록 작성 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#1F2937]">투석 기록 작성</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1 block">치료 날짜 *</label>
                <input type="date" value={form.treatmentDate}
                  onChange={e => setForm(p => ({ ...p, treatmentDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Droplets size={12} className="text-[#2563EB]" />제거 수분량 (L)</label>
                  <input type="number" step="0.1" placeholder="예: 2.5"
                    value={form.fluidRemovalL ?? ''}
                    onChange={e => setForm(p => ({ ...p, fluidRemovalL: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Scale size={12} className="text-[#9F7AEA]" />시작 체중 (kg)</label>
                  <input type="number" step="0.1" placeholder="예: 65.2"
                    value={form.weightBefore ?? ''}
                    onChange={e => setForm(p => ({ ...p, weightBefore: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Scale size={12} className="text-[#D97706]" />종료 체중 (kg)</label>
                  <input type="number" step="0.1" placeholder="예: 62.8"
                    value={form.weightAfter ?? ''}
                    onChange={e => setForm(p => ({ ...p, weightAfter: e.target.value ? +e.target.value : null }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Activity size={12} className="text-[#EF4444]" />혈압 전 (mmHg)</label>
                  <input type="text" placeholder="예: 140/90"
                    value={form.bpBefore}
                    onChange={e => setForm(p => ({ ...p, bpBefore: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#374151] mb-1 block flex items-center gap-1"><Activity size={12} className="text-[#9F7AEA]" />혈압 후 (mmHg)</label>
                  <input type="text" placeholder="예: 125/80"
                    value={form.bpAfter}
                    onChange={e => setForm(p => ({ ...p, bpAfter: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151] mb-1 block">증상 메모</label>
                <textarea rows={3} placeholder="투석 중 또는 후 증상을 기록하세요"
                  value={form.symptoms}
                  onChange={e => setForm(p => ({ ...p, symptoms: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00C9B7]" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleSave} disabled={saving || !form.treatmentDate}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}>
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00C8B4]" size={32} /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-[#9CA3AF]">
          <FileText className="mx-auto mb-3 opacity-30" size={40} />
          <p>아직 투석 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="p-4 rounded-2xl border border-[#EEF0F2] bg-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-bold text-[#1F2937]">{log.treatmentDate}</span>
                  {log.fluidRemovalL != null && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-medium">
                      제거 {log.fluidRemovalL}L
                    </span>
                  )}
                </div>
                <button onClick={() => handleDelete(log.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#6B7280]">
                {log.weightBefore != null && (
                  <span className="flex items-center gap-1"><Scale size={11} /> 시작 {log.weightBefore}kg</span>
                )}
                {log.weightAfter != null && (
                  <span className="flex items-center gap-1"><Scale size={11} /> 종료 {log.weightAfter}kg</span>
                )}
                {log.bpBefore && (
                  <span className="flex items-center gap-1"><Activity size={11} /> 혈압 전 {log.bpBefore}</span>
                )}
                {log.bpAfter && (
                  <span className="flex items-center gap-1"><Activity size={11} /> 혈압 후 {log.bpAfter}</span>
                )}
              </div>

              {log.symptoms && (
                <p className="mt-2 text-xs text-[#374151] bg-[#F9FAFB] rounded-lg px-3 py-2 leading-relaxed">
                  {log.symptoms}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────
export function DialysisCarePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('투석 병원'); // 투석 병원을 디폴트로 설정

  const tabs: Tab[] = ['투석 코치', '투석 병원', '투석 기록'];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] bg-white overflow-hidden">
      <div className="lg:hidden">
        <MobileHeader title="투석케어" showMenu={true} showProfile={true} />
      </div>

      <div className={`flex-1 ${activeTab === '투석 병원' ? 'flex flex-col overflow-hidden h-full' : 'overflow-y-auto pb-24 lg:pb-10'}`}>
        <div className={activeTab === '투석 병원' ? 'flex-1 flex flex-col h-full w-full' : 'max-w-2xl mx-auto px-5 lg:px-7 pt-5'}>

          {/* 탭 헤더 영역 */}
          <div className={`border-b border-[#E5E7EB] ${activeTab === '투석 병원' ? 'px-5 lg:px-7 pt-4 bg-white flex-shrink-0' : 'mb-6'}`}>
            <div className="flex gap-6">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-3 text-sm transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: activeTab === tab ? '#00C8B4' : '#9CA3AF',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9F7AEA] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeTab === '투석 코치' && <CoachTab />}
          {activeTab === '투석 병원' && <HospitalTab />}
          {activeTab === '투석 기록' && <LogTab />}
        </div>
      </div>
    </div>
  );
}
