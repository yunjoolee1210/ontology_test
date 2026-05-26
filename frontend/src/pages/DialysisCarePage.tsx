import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Plus, Trash2, Search, MapPin, Phone, Building2,
  Droplets, Scale, Activity, FileText, ChevronDown, X,
  Heart, ShieldCheck, Dumbbell, AlertCircle, List, Map as MapIcon,
  Moon, SlidersHorizontal, Star, Share2, Compass, RotateCcw,
  Check, ExternalLink, ChevronUp, Info, Clock, Calendar
} from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { listDialysisLogs, addDialysisLog, deleteDialysisLog, DialysisLog, NewDialysisLog } from '../services/dialysisApi';
import { listHospitals, Hospital } from '../services/hospitalApi';

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
      icon: <Droplets size={18} className="text-[#00C9B7]" />,
      content: (
        <div className="space-y-3 text-sm text-[#374151] leading-relaxed">
          <p>신장은 혈액 속 노폐물과 과잉 수분을 걸러 소변으로 내보내는 장기입니다. 만성신장병 말기(5기)에 이르면 신장이 이 기능을 충분히 수행하지 못해 <strong>투석</strong>이 필요합니다.</p>
          <p>투석은 신장 기능을 인공적으로 대체하여 혈액 내 요독·수분·전해질을 조절하는 치료법입니다.</p>
          <div className="p-3 rounded-xl bg-[#F2FFFD] border border-[#CCFBF1]">
            <p className="font-semibold text-[#00C9B7] mb-1">주요 적용 기준</p>
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
                <th className="p-2.5 text-center border border-[#E5E7EB] text-[#00C9B7] font-semibold">혈액투석 (HD)</th>
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
            { name: '동정맥루 (AVF)', desc: '자신의 동맥과 정맥을 연결해 만든 접근로. 가장 권장되는 방법으로 혈류량이 풍부하고 감염·혈전 위험이 낮습니다.', badge: '권장', badgeColor: 'bg-[#F2FFFD] text-[#00C9B7] border border-[#CCFBF1]' },
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

function HospitalTab() {
  const [allHospitals, setAllHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('전체'); // 시/도
  const [selectedSiGunGu, setSelectedSiGunGu] = useState('전체'); // 시/군/구
  const [filterDialysis, setFilterDialysis] = useState(true);
  const [filterNight, setFilterNight] = useState(false);
  const [filterMinMachines, setFilterMinMachines] = useState(0);
  const [distanceFilter, setDistanceFilter] = useState('전체'); // '5', '10', '20' 등
  const [hospitalType, setHospitalType] = useState('전체'); // '전체', '병원', '의원'
  const [selectedDays, setSelectedDays] = useState<string[]>([]); // 야간 투석 요일 필터 (월~일)
  
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('name'); // 'name', 'distance', 'rating', 'machines', 'night'

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

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

  // 야간 투석 가능 요일 토글
  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // 병원 전체 데이터 로드 (클라이언트단 빠른 필터링 제공)
  useEffect(() => {
    setLoading(true);
    listHospitals()
      .then(setAllHospitals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 현재 사용자의 GPS 위치 수집
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setSortBy('distance'); // GPS 켜지면 거리순 자동 정렬
          if (mapInstance.current) {
            const naver = (window as any).naver;
            const newCenter = new naver.maps.LatLng(latitude, longitude);
            mapInstance.current.setCenter(newCenter);
            mapInstance.current.setZoom(14);
            
            // 내 위치 마커 추가/갱신
            if ((window as any).myLocationMarker) {
              (window as any).myLocationMarker.setMap(null);
            }
            
            const myMarkerHtml = `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-8 h-8 rounded-full bg-[#00C9B7]/20 animate-ping"></div>
                <div class="w-5 h-5 rounded-full bg-[#00C9B7] border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white">
                  📍
                </div>
              </div>
            `;
            
            (window as any).myLocationMarker = new naver.maps.Marker({
              position: newCenter,
              map: mapInstance.current,
              icon: { content: myMarkerHtml, anchor: new naver.maps.Point(10, 10) }
            });
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("GPS 권한이 비활성화되어 있거나 수신에 실패했습니다. 기본 서울 중심으로 안내합니다.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      alert("GPS 탐색 기능을 지원하지 않는 브라우저입니다.");
    }
  };

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

  // 시/도 바뀔 때 시/군/구 초기화
  useEffect(() => {
    setSelectedSiGunGu('전체');
  }, [region]);

  // 퀵 검색 지역 태그 적용
  const applyQuickRegion = (siDo: string, siGunGu: string) => {
    setRegion(siDo);
    setSelectedSiGunGu(siGunGu);
    setQuery('');
    setShowSearchSuggestions(false);
  };

  // Naver 지도 초기화
  useEffect(() => {
    const naver = (window as any).naver;
    if (!naver?.maps || !mapRef.current || mapInstance.current) return;

    mapInstance.current = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(36.5, 127.5), // 전국 대한민국 한가운데 중심 (36.5, 127.5)
      zoom: 7, // 대한민국 전체가 잘 보이도록 초기 줌레벨 7
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }, // 100% 검증된 우상단 줌 컨트롤
      mapTypeControl: false,
      scaleControl: false,
      logoControl: false,
    });
    setMapReady(true);
  }, [viewMode]);

  // 실시간 다차원 검색 & 필터링 로직 (Safe null checks)
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
    
    // 3. 시/군/구 필터 (2단계 드롭다운)
    if (selectedSiGunGu !== '전체') {
      const parts = h.address ? String(h.address).trim().split(/\s+/) : [];
      const district = parts[1] || '';
      if (!district.includes(selectedSiGunGu)) return false;
    }
    
    // 4. 투석기 대수 필터
    if (filterMinMachines > 0 && h.dialysis_machines < filterMinMachines) return false;
    
    // 5. 투석실 여부
    if (filterDialysis && !h.has_dialysis_unit) return false;
    
    // 6. 야간투석 여부
    if (filterNight && !h.night_dialysis) return false;
    
    // 7. GPS 기반 거리 제한 필터
    if (userLocation && distanceFilter !== '전체') {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, h.lat, h.lng);
      const limit = parseFloat(distanceFilter);
      if (dist > limit) return false;
    }
    
    // 8. 병원 구분 필터 (상급/종합병원 vs 전문 의원)
    if (hospitalType !== '전체') {
      const isClinic = h.name ? String(h.name).includes('의원') : false;
      if (hospitalType === '의원' && !isClinic) return false;
      if (hospitalType === '병원' && isClinic) return false;
    }
    
    // 9. 요일별 투석 가능 요일 필터 (야간투석 기준)
    if (selectedDays.length > 0) {
      if (!h.night_dialysis) return false;
      const matchesDay = selectedDays.some(day => h.dialysis_days ? String(h.dialysis_days).includes(day) : false);
      if (!matchesDay && h.dialysis_days !== '') return false;
    }
    
    return true;
  });

  // 정렬 옵션 처리
  const sortedHospitals = [...filteredHospitals].sort((a, b) => {
    if (sortBy === 'distance' && userLocation) {
      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    }
    
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

  // 지도 마커 업데이트 & 동적 중심/줌 이동
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    const naver = (window as any).naver;
    if (!naver?.maps) return;

    // 기존 마커 전체 클리어
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    // 필터된 모든 병원에 대해 프리미엄 스타일 커스텀 마커 매핑
    filteredHospitals.forEach(h => {
      if (!h.lat || !h.lng) return;

      const isNight = h.night_dialysis;
      const isSelected = selectedHospital?.id === h.id;
      
      const markerHtml = `
        <div class="relative cursor-pointer transition-all duration-200" style="transform: ${isSelected ? 'scale(1.2)' : 'scale(1.0)'}; z-index: ${isSelected ? 50 : 10};">
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg ${isNight ? 'bg-[#9F7AEA] text-white' : 'bg-[#00C9B7] text-white'}">
            ${isNight ? '🌙' : '💧'}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-white shadow-md ${isNight ? 'bg-[#9F7AEA]' : 'bg-[#00C9B7]'}"></div>
        </div>
      `;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(h.lat, h.lng),
        map: mapInstance.current,
        title: h.name,
        icon: { content: markerHtml, anchor: new naver.maps.Point(16, 32) }
      });

      // 마커 클릭 시 해당 병원 선택 및 지도 패닝, 줌인, 슬라이드 패널 활성화
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospital(h);
        mapInstance.current.panTo(new naver.maps.LatLng(h.lat, h.lng));
        mapInstance.current.setZoom(15);
        
        // 카드 목록이 열려 있으면 해당 카드 위치로 스크롤
        setTimeout(() => {
          selectedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      });

      markers.current.push(marker);
    });

    // 지도 줌 & 중심 경계값 설정 (현재 검색 결과가 지도 화면 내에 쏙 들어오도록 자동 핏)
    // 100% 안전한 fitBounds 호출 (객체 파라미터 제외하여 크래시 방지)
    if (filteredHospitals.length > 0 && mapInstance.current && query.trim() !== '') {
      const bounds = new naver.maps.LatLngBounds();
      filteredHospitals.forEach(h => {
        if (h.lat && h.lng) bounds.extend(new naver.maps.LatLng(h.lat, h.lng));
      });
      mapInstance.current.fitBounds(bounds);
    }
  }, [filteredHospitals, mapReady, selectedHospital]);

  // 검색어 입력 시 제안 필터링 (최대 5개 노출)
  const suggestedHospitals = query.trim()
    ? allHospitals.filter(h => h.name && String(h.name).toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const handleListCardClick = (h: Hospital) => {
    setSelectedHospital(h);
    if (mapInstance.current && h.lat && h.lng) {
      const naver = (window as any).naver;
      mapInstance.current.panTo(new naver.maps.LatLng(h.lat, h.lng));
      mapInstance.current.setZoom(15);
      
      // 모바일 모드면 맵 뷰로 전환하고 상세 보여줌
      if (viewMode === 'list') {
        setViewMode('map');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB] relative overflow-hidden select-none font-sans">
      
      {/* ── 상단 고급 검색 & 필터 헤더 영역 (Starbucks 스타일) ── */}
      <div className="bg-white border-b border-[#E5E7EB] z-30 shadow-sm flex-shrink-0 px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          
          {/* A. 퀵 검색바 & GPS & 뷰 토글 */}
          <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
            
            {/* 1) 추천 자동완성 검색창 */}
            <div className="relative flex-1 min-w-[260px]">
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
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9B7]/50 focus:border-[#00C9B7] transition-all bg-[#F9FAFB] hover:bg-gray-50"
                />
                {query && (
                  <button 
                    onClick={() => { setQuery(''); setShowSearchSuggestions(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 검색 추천 팝오버 (Starbucks Autocomplete) */}
              {showSearchSuggestions && (query.trim() !== '' || suggestedHospitals.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 p-3 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 text-xs text-[#9CA3AF]">
                    <span>추천 병원 검색결과</span>
                    <button onClick={() => setShowSearchSuggestions(false)} className="hover:text-gray-600">닫기</button>
                  </div>
                  {suggestedHospitals.length > 0 ? (
                    <div className="space-y-1.5">
                      {suggestedHospitals.map(h => (
                        <button
                          key={h.id}
                          onClick={() => {
                            setQuery(h.name || '');
                            setShowSearchSuggestions(false);
                            handleListCardClick(h);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#F0FDFA] hover:text-[#00A99A] font-semibold text-[#374151] flex items-center gap-2 transition-colors"
                        >
                          <Building2 size={13} className="text-[#00C9B7] flex-shrink-0" />
                          <span className="truncate">{h.name}</span>
                          <span className="text-[10px] text-gray-400 font-normal truncate ml-auto">{h.address}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-400">
                      매칭되는 병원명이 없습니다. 입력창에 키워드를 더 쳐보세요.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2) 현재 위치로 찾기 (GPS) */}
            <button
              onClick={handleGetCurrentLocation}
              className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${userLocation ? 'bg-[#F2FFFD] border-[#00C9B7] text-[#00A99A]' : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
            >
              <Compass size={14} className={userLocation ? 'animate-spin' : ''} />
              <span>현재 위치로 찾기</span>
            </button>

            {/* 3) 상세 필터 접기/펼치기 토글 */}
            <button
              onClick={() => setShowFilters(p => !p)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${showFilters ? 'bg-gradient-to-r from-[#00C9B7] to-[#9F7AEA] text-white border-transparent' : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
            >
              <SlidersHorizontal size={14} />
              <span>{showFilters ? '필터 접기' : '상세 필터'}</span>
            </button>

            {/* 4) 모바일 전용: 지도보기 ↔ 리스트보기 플로팅 토글 */}
            <div className="lg:hidden flex rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
              <button 
                onClick={() => setViewMode('map')}
                className={`px-3.5 py-2.5 text-xs font-bold flex items-center gap-1 transition-colors ${viewMode === 'map' ? 'bg-[#00C9B7] text-white' : 'bg-white text-[#6B7280] hover:bg-gray-50'}`}
              >
                <MapIcon size={13} />
                지도
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`px-3.5 py-2.5 text-xs font-bold flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-[#00C9B7] text-white' : 'bg-white text-[#6B7280] hover:bg-gray-50'}`}
              >
                <List size={13} />
                목록
              </button>
            </div>
          </div>

          {/* B. 지역 2단계 검색 드롭다운 & 인기 퀵 버튼 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 2단계 연동 필터 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[#4B5563]">지역 선택:</span>
              
              {/* 시/도 */}
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00C9B7] text-[#374151]"
              >
                <option value="전체">시/도 (전체)</option>
                {['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '경북', '전남', '전북', '경남', '제주'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* 시/군/구 (선택한 시/도에 따라 동적 구성) */}
              <select
                value={selectedSiGunGu}
                onChange={e => setSelectedSiGunGu(e.target.value)}
                disabled={region === '전체'}
                className="px-2.5 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00C9B7] disabled:opacity-50 disabled:cursor-not-allowed text-[#374151]"
              >
                <option value="전체">시/군/구 (전체)</option>
                {availableSiGunGus().map(sg => (
                  <option key={sg} value={sg}>{sg}</option>
                ))}
              </select>
            </div>

            {/* 자주 찾는 지역 퀵 버튼 */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-gray-400 mr-1">자주 찾는 지역:</span>
              {[
                { label: '서울 강남', siDo: '서울', siGunGu: '강남구' },
                { label: '서울 송파', siDo: '서울', siGunGu: '송파구' },
                { label: '경기 수원', siDo: '경기', siGunGu: '수원시' },
                { label: '경기 성남', siDo: '경기', siGunGu: '성남시' },
                { label: '인천 부평', siDo: '인천', siGunGu: '부평구' },
                { label: '부산 해운대', siDo: '부산', siGunGu: '해운대구' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => applyQuickRegion(item.siDo, item.siGunGu)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${region === item.siDo && selectedSiGunGu === item.siGunGu ? 'bg-[#00C9B7] border-[#00C9B7] text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* C. 접고 펼쳐지는 고급 다중 필터 상세 영역 */}
          {showFilters && (
            <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-[#FAFAFA] flex flex-col gap-4 animate-fadeIn">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1) 야간 투석 우선 스위치 (가장 크게 강조) */}
                <div className="flex flex-col justify-center p-3 rounded-xl bg-[#F8F4FE] border border-[#E5D5FC]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#9F7AEA]">
                      <Moon size={15} className="text-[#9F7AEA]" />
                      야간투석 가능 우선 검색
                    </span>
                    <button
                      onClick={() => setFilterNight(p => !p)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${filterNight ? 'bg-[#9F7AEA]' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${filterNight ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-purple-500/80 font-medium mt-1">회사 근무 후 야간에 투석할 수 있는 병원</p>
                </div>

                {/* 2) 투석실 운영 스위치 */}
                <div className="flex flex-col justify-center p-3 rounded-xl bg-[#F2FFFD] border border-[#CCFBF1]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#00C9B7]">
                      <Droplets size={15} className="text-[#00C9B7]" />
                      투석 전용 병상/투석실 보유
                    </span>
                    <button
                      onClick={() => setFilterDialysis(p => !p)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${filterDialysis ? 'bg-[#00C9B7]' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${filterDialysis ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-1">투석기가 구비된 신장 치료 전문 투석실</p>
                </div>

                {/* 3) 병원 종류 구분 필터 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 size={13} /> 병원 규모 종류
                  </label>
                  <div className="flex rounded-lg border border-[#E5E7EB] bg-white overflow-hidden p-0.5">
                    {['전체', '병원', '의원'].map(type => (
                      <button
                        key={type}
                        onClick={() => setHospitalType(type)}
                        className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-colors ${hospitalType === type ? 'bg-[#00C9B7] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        {type === '전체' ? '전체' : type === '병원' ? '대형/종합' : '클리닉/의원'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4) GPS 거리 범위 필터 (GPS 수집 시에만 활성) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    📍 내 위치 기준 반경
                  </label>
                  <select
                    value={distanceFilter}
                    onChange={e => setDistanceFilter(e.target.value)}
                    disabled={!userLocation}
                    className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#00C9B7] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="전체">전체 반경 검색</option>
                    <option value="5">5 km 이내</option>
                    <option value="10">10 km 이내</option>
                    <option value="20">20 km 이내</option>
                  </select>
                </div>

              </div>

              {/* E. 투석기 개수 슬라이더 & 투석 요일 선택 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-gray-200/50">
                
                {/* 1) 투석기 수 슬라이더 */}
                <div className="flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-700">보유 투석기 최소 대수</span>
                    <span className="text-xs font-extrabold text-[#00C9B7] bg-[#E6F9F7] px-2 py-0.5 rounded-full">
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
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#00C9B7] outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
                    <span>전체</span>
                    <span>10대+</span>
                    <span>30대+</span>
                    <span>50대+</span>
                    <span>70대+</span>
                    <span>100대 이상</span>
                  </div>
                </div>

                {/* 2) 야간 투석 가능 요일 필터 */}
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-bold text-gray-700 mb-1.5">야간 투석 가능 요일 선택</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {['월', '화', '수', '목', '금', '토'].map(day => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => handleDayToggle(day)}
                          className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center transition-all ${isSelected ? 'bg-[#9F7AEA] border-[#9F7AEA] text-white shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* 필터 제어 하단 버튼바 */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setRegion('전체');
                    setSelectedSiGunGu('전체');
                    setFilterDialysis(false);
                    setFilterNight(false);
                    setFilterMinMachines(0);
                    setDistanceFilter('전체');
                    setHospitalType('전체');
                    setSelectedDays([]);
                    setQuery('');
                  }}
                  className="px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-500 flex items-center gap-1 hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={12} />
                  초기화
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-5 py-2 rounded-full bg-[#00C9B7] text-white text-xs font-semibold flex items-center gap-1 hover:bg-[#00B3A3] transition-colors shadow-sm"
                >
                  <Check size={12} />
                  적용하기
                </button>
              </div>

            </div>
          )}

          {/* D. 활성 필터 칩 표시판 */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {region !== '전체' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2FFFD] text-[#00C9B7] text-xs font-semibold shadow-xs border border-[#CCFBF1]">
                {region} {selectedSiGunGu !== '전체' ? selectedSiGunGu : ''}
                <button onClick={() => { setRegion('전체'); setSelectedSiGunGu('전체'); }} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {filterDialysis && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2FFFD] text-[#00C9B7] text-xs font-semibold shadow-xs border border-[#CCFBF1]">
                💧 투석실 필수
                <button onClick={() => setFilterDialysis(false)} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {filterNight && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F8F4FE] text-[#9F7AEA] text-xs font-semibold shadow-xs border border-[#E5D5FC]">
                🌙 야간투석 가능
                <button onClick={() => setFilterNight(false)} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {filterMinMachines > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-semibold shadow-xs">
                ⚙️ {filterMinMachines}대 이상
                <button onClick={() => setFilterMinMachines(0)} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {hospitalType !== '전체' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold shadow-xs">
                🏢 {hospitalType === '의원' ? '의원급' : '병원급'}
                <button onClick={() => setHospitalType('전체')} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {distanceFilter !== '전체' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F9FAFB] text-[#374151] text-xs font-semibold shadow-xs border border-gray-200">
                📏 {distanceFilter}km 이내
                <button onClick={() => setDistanceFilter('전체')} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {selectedDays.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF1F2] text-[#E11D48] text-xs font-semibold shadow-xs">
                📅 야간 {selectedDays.join(',')}요일
                <button onClick={() => setSelectedDays([])} className="hover:opacity-70"><X size={10} /></button>
              </span>
            )}
            {favorites.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-semibold shadow-xs border border-pink-100 ml-auto">
                ❤️ 관심병원 ({favorites.length})
              </span>
            )}
          </div>

        </div>
      </div>

      {/* ── 메인 바디 Split Layout (Starbucks Store Map) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL: 검색결과 리스트 영역 (Desktop 전용 40% 고정, 모바일은 토글) */}
        <div 
          ref={listContainerRef}
          className={`w-full lg:w-[380px] xl:w-[420px] bg-white border-r border-[#E5E7EB] flex flex-col overflow-hidden transition-all duration-300 z-10 flex-shrink-0 ${viewMode === 'list' ? 'block' : 'hidden lg:flex'}`}
        >
          
          {/* 정렬 바 */}
          <div className="px-4 py-2 bg-gray-50 border-b border-[#E5E7EB] flex justify-between items-center">
            <span className="text-[11px] font-extrabold text-[#6B7280]">
              검색결과 <span className="text-[#00C9B7]">{sortedHospitals.length}</span>곳
            </span>
            
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-gray-500 outline-none cursor-pointer"
              >
                <option value="name">가나다순</option>
                {userLocation && <option value="distance">거리 가까운순</option>}
                <option value="rating">별점 높은순</option>
                <option value="machines">투석기 많은순</option>
                <option value="night">야간투석 우선</option>
              </select>
            </div>
          </div>

          {/* 스크롤 가능한 병원 카드 리스트 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-[#00C9B7]" size={28} />
                <span className="text-xs font-semibold text-gray-400">전국 투석 병원 정보 로딩 중...</span>
              </div>
            ) : sortedHospitals.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
                <Building2 className="mx-auto mb-3 opacity-30 text-[#9CA3AF]" size={36} />
                <p className="text-xs font-bold text-gray-700">검색 조건에 부합하는 병원이 없습니다.</p>
                <p className="text-[10px] text-gray-400 mt-1">상세 필터를 일부 해제하거나 초기화해보세요.</p>
                <button
                  onClick={() => {
                    setRegion('전체');
                    setSelectedSiGunGu('전체');
                    setFilterDialysis(false);
                    setFilterNight(false);
                    setFilterMinMachines(0);
                    setDistanceFilter('전체');
                    setHospitalType('전체');
                    setSelectedDays([]);
                    setQuery('');
                  }}
                  className="mt-4 px-4 py-2 bg-[#00C9B7] text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  필터 전체 초기화
                </button>
              </div>
            ) : (
              sortedHospitals.map(h => {
                const isSelected = selectedHospital?.id === h.id;
                const isFav = favorites.includes(h.id);
                const details = getSimulatedDetails(h);
                
                // 거리 계산
                let distString = '';
                if (userLocation && h.lat && h.lng) {
                  const dist = calculateDistance(userLocation.lat, userLocation.lng, h.lat, h.lng);
                  distString = dist < 1.0 
                    ? `${(dist * 1000).toFixed(0)}m`
                    : `${dist.toFixed(1)}km`;
                }

                return (
                  <div
                    key={h.id}
                    ref={isSelected ? selectedCardRef : undefined}
                    onClick={() => handleListCardClick(h)}
                    className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col gap-2 ${isSelected ? 'border-[#00C9B7] bg-[#F0FDFA] shadow-md' : 'border-[#EEF0F2] bg-white hover:border-[#00C9B7]/50 hover:shadow-xs'}`}
                  >
                    
                    {/* 상단: 타이틀 / 종류 / 하트 */}
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-gray-400">
                          {h.region} · {h.name && String(h.name).includes('의원') ? '전문 의원' : '종합 병원'}
                        </span>
                        <h3 className="font-extrabold text-[#1F2937] text-sm leading-snug hover:text-[#00C9B7] transition-colors">
                          {h.name}
                        </h3>
                      </div>
                      
                      <button
                        onClick={(e) => toggleFavorite(h.id, e)}
                        className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 -mt-1`}
                      >
                        <Heart 
                          size={16} 
                          className={isFav ? 'text-pink-500 fill-pink-500 animate-pulse' : 'text-gray-300'} 
                        />
                      </button>
                    </div>

                    {/* 중단: 거리 & 핵심 칩 배지 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {distString && (
                        <span className="text-xs font-extrabold text-[#00C9B7] bg-[#F2FFFD] px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-2xs border border-[#CCFBF1]">
                          📍 {distString}
                        </span>
                      )}
                      
                      {h.has_dialysis_unit && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F2FFFD] text-[#00C9B7] font-bold border border-[#CCFBF1]">💧 투석실 {h.dialysis_machines}대</span>
                      )}
                      
                      {h.night_dialysis && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F8F4FE] text-[#9F7AEA] font-bold border border-[#E5D5FC]">🌙 야간투석</span>
                      )}
                    </div>

                    {/* 주소 & 전화 */}
                    <div className="text-xs text-[#6B7280] space-y-1 mt-0.5">
                      <div className="flex items-center gap-1">
                        <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{h.address}</span>
                      </div>
                      {h.phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={11} className="text-gray-400 flex-shrink-0" />
                          <a 
                            href={`tel:${h.phone}`} 
                            onClick={e => e.stopPropagation()} 
                            className="text-[#4B5563] hover:text-[#00C9B7] font-semibold text-xs leading-none"
                          >
                            {h.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* 하단: 별점 및 간략 시간 */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-bold">
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        {details.rating} <span className="text-gray-400 font-medium">({details.reviewsCount})</span>
                      </span>
                      {h.dialysis_days && (
                        <span className="text-[#9F7AEA] bg-[#F8F4FE] px-1.5 py-0.5 rounded-xs border border-[#E5D5FC]">
                          야간: {h.dialysis_days}요일 운영
                        </span>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: 네이버 맵 영역 (Desktop 60% 또는 모바일 토글) */}
        <div 
          className={`flex-1 relative h-full bg-[#E5E7EB] ${viewMode === 'map' ? 'block' : 'hidden lg:block'}`}
        >
          {/* 지도 컨테이너 */}
          <div ref={mapRef} className="w-full h-full">
            {!(window as any).naver?.maps && (
              <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF] text-sm gap-2">
                <Loader2 className="animate-spin text-[#00C9B7]" size={28} />
                <span>지도를 불러오는 중입니다...</span>
              </div>
            )}
          </div>

          {/* 맵 플로팅 위젯 컨트롤 */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
            {/* 현재위치 재탐색 맵버튼 */}
            <button
              onClick={handleGetCurrentLocation}
              className="p-3 rounded-full bg-white shadow-lg text-[#4B5563] hover:text-[#00C9B7] hover:scale-105 transition-all border border-gray-100"
              title="내 현재 위치 찾기"
            >
              <Compass size={18} />
            </button>
          </div>

          {/* 맵 바텀 레전드 (색상 안내) */}
          <div className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-xl bg-white/90 backdrop-blur-xs border border-gray-200/50 shadow-md flex items-center gap-3 text-[10px] font-bold text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C9B7] block"></span>
              일반 투석실
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9F7AEA] block"></span>
              야간 투석실
            </span>
            <span className="text-gray-400 font-normal">|</span>
            <span>총 {filteredHospitals.length}곳 매칭</span>
          </div>

        </div>

      </div>

      {/* ── 병원 상세 정보 프리미엄 슬라이드 패널 (Bottom Sheet / Sidebar) ── */}
      {selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end bg-black/40 animate-fadeIn">
          
          {/* 투명 배경 클릭 시 패널 닫기 */}
          <div 
            onClick={() => setSelectedHospital(null)} 
            className="absolute inset-0 cursor-pointer lg:w-[calc(100%-480px)] xl:w-[calc(100%-540px)]"
          />
          
          {/* 슬라이딩 본체 */}
          <div 
            className="w-full lg:w-[480px] xl:w-[540px] bg-white rounded-t-3xl lg:rounded-t-none lg:rounded-l-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.15)] flex flex-col overflow-hidden max-h-[85vh] lg:max-h-screen z-10 transition-transform duration-300 transform translate-y-0"
          >
            
            {/* 모바일 상단 드래그 핸들 바 */}
            <div className="lg:hidden flex justify-center py-3 flex-shrink-0 cursor-pointer border-b border-gray-100" onClick={() => setSelectedHospital(null)}>
              <div className="w-10 h-1.5 rounded-full bg-gray-200"></div>
            </div>

            {/* 패널 타이틀 영역 */}
            <div className="p-5 pb-4 border-b border-gray-100 flex justify-between items-start flex-shrink-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-[#00A99A] bg-[#E6F9F7] px-2 py-0.5 rounded-md">
                    {selectedHospital.region}
                  </span>
                  {selectedHospital.night_dialysis && (
                    <span className="text-[10px] font-bold text-[#9F7AEA] bg-[#F8F4FE] px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-[#E5D5FC]">
                      🌙 야간투석 ({selectedHospital.dialysis_days}요일)
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-black text-gray-800 leading-snug mt-1">
                  {selectedHospital.name}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedHospital.address}</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleFavorite(selectedHospital.id)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <Heart size={20} className={favorites.includes(selectedHospital.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-400'} />
                </button>
                <button
                  onClick={() => setSelectedHospital(null)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 본문 스크롤 공간 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* 1. 요약 실시간 지표 (별점, 주차 등) */}
              <div className="grid grid-cols-3 gap-2 border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-gray-400 mb-0.5">네이버 평점</span>
                  <span className="text-sm font-black text-gray-800 flex items-center gap-0.5">
                    ⭐ {getSimulatedDetails(selectedHospital).rating}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-gray-200/50">
                  <span className="text-xs font-bold text-gray-400 mb-0.5">투석기 보유</span>
                  <span className="text-sm font-black text-[#00C9B7]">
                    {selectedHospital.dialysis_machines}대
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-gray-400 mb-0.5">주차 여부</span>
                  <span className="text-[11px] font-extrabold text-gray-700 truncate w-full px-1">
                    무료 가능
                  </span>
                </div>
              </div>

              {/* 2. 핵심 투석 스펙 (강조 박스) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Droplets size={14} className="text-[#00C9B7]" />
                  투석 의료 서비스 안내
                </h3>
                <div className="rounded-2xl border border-[#CCFBF1] bg-[#F2FFFD] p-4 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#CCFBF1] flex items-center justify-center text-xs text-[#00C9B7] font-bold flex-shrink-0 mt-0.5">1</div>
                    <div className="flex-1">
                      <h4 className="text-xs font-extrabold text-[#00C9B7]">투석실 Bed 보유 현황</h4>
                      <p className="text-xs text-[#1F2937] leading-relaxed mt-0.5">최신 혈액투석기 총 <strong>{selectedHospital.dialysis_machines}대</strong> 보유로 원활하고 대기 없는 스케줄 처리를 지원합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#CCFBF1] flex items-center justify-center text-xs text-[#00C9B7] font-bold flex-shrink-0 mt-0.5">2</div>
                    <div className="flex-1">
                      <h4 className="text-xs font-extrabold text-[#00C9B7]">야간 투석 치료실</h4>
                      <p className="text-xs text-[#1F2937] leading-relaxed mt-0.5">
                        {selectedHospital.night_dialysis 
                          ? `본 병원은 만성신부전 환자들의 사회 복귀를 돕기 위해 **매주 [${selectedHospital.dialysis_days}]요일 야간(23시까지)** 투석실을 연장 운영합니다.`
                          : "현재 야간 투석은 별도 협의가 필요하거나 운영하지 않으며, 일반 주간 시간대 투석이 가능합니다."
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#CCFBF1] flex items-center justify-center text-xs text-[#00C9B7] font-bold flex-shrink-0 mt-0.5">3</div>
                    <div className="flex-1">
                      <h4 className="text-xs font-extrabold text-[#00C9B7]">지원 투석 종류</h4>
                      <div className="flex gap-1.5 mt-1.5">
                        {getSimulatedDetails(selectedHospital).dialysisMethods.map(m => (
                          <span key={m} className="text-[10px] px-2 py-0.5 bg-[#00C9B7] text-white font-bold rounded-md">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. 진료 및 영업시간 정보 */}
              <div className="space-y-3.5 pt-1">
                <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Clock size={14} className="text-gray-400" />
                  병원 운영 및 시간 안내
                </h3>
                
                <div className="space-y-2 text-xs text-[#4B5563]">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="font-semibold text-gray-400">운영 구분</span>
                    <span className="font-bold text-gray-800">{selectedHospital.name.includes('의원') ? '의원급 클리닉' : '종합/대형병원'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="font-semibold text-gray-400">대표전화</span>
                    <a href={`tel:${selectedHospital.phone}`} className="font-bold text-[#00C9B7] hover:underline">{selectedHospital.phone}</a>
                  </div>
                  <div className="flex flex-col py-1 border-b border-gray-100 gap-1">
                    <span className="font-semibold text-gray-400">운영 시간대</span>
                    <span className="font-bold text-gray-800 leading-relaxed">{getSimulatedDetails(selectedHospital).opTimes}</span>
                  </div>
                </div>
              </div>

              {/* 4. 환자 편의 및 시설 */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Info size={14} className="text-gray-400" />
                  환자 편의 시설 및 교통안내
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <h4 className="text-xs font-extrabold text-gray-600 mb-1">🚗 주차 공간</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">{getSimulatedDetails(selectedHospital).parking}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <h4 className="text-xs font-extrabold text-gray-600 mb-1">🚇 대중교통 이용</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">{getSimulatedDetails(selectedHospital).publicTransport}</p>
                  </div>
                </div>
              </div>

              {/* 5. 네이버 연동 생생 리뷰 (Starbucks 요약리뷰) */}
              <div className="space-y-3.5 pt-1">
                <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                  <Star size={14} className="text-amber-500" />
                  실제 환자/보호자 생생 후기
                </h3>
                <div className="space-y-2">
                  {getSimulatedDetails(selectedHospital).reviews.map((rev, idx) => (
                    <div key={idx} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 relative">
                      <div className="absolute top-2.5 right-3 text-xs text-amber-500">★★★★★</div>
                      <p className="text-xs text-[#374151] leading-relaxed pr-12 font-medium">"{rev}"</p>
                      <div className="text-[9px] text-gray-400 mt-2 font-bold flex gap-2">
                        <span>인증보호자</span>
                        <span>•</span>
                        <span>2026년 후기</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* 고정 하단 액션 버튼바 */}
            <div className="p-4 border-t border-gray-100 bg-white flex justify-center gap-3 flex-shrink-0 w-full">
              {/* 1) 전화하기 */}
              <a
                href={`tel:${selectedHospital.phone}`}
                className="max-w-[200px] flex-1 py-3.5 rounded-full text-white text-xs font-bold text-center bg-[#00C9B7] hover:bg-[#00B3A3] transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Phone size={14} />
                전화 예약 및 문의
              </a>

              {/* 2) 네이버 길찾기 */}
              {selectedHospital.naver_map_url && (
                <a
                  href={selectedHospital.naver_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[200px] flex-1 py-3.5 rounded-full text-white text-xs font-bold text-center hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg,#00C8B4,#9F7AEA)' }}
                >
                  <Compass size={14} className="fill-white/10" />
                  길찾기
                </a>
              )}
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
        <button onClick={() => navigate('/login')} className="px-5 py-2.5 rounded-xl bg-[#00C9B7] text-white text-sm font-medium">
          로그인
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 새 기록 버튼 */}
      <div className="flex justify-center w-full mb-6">
        <button
          onClick={() => setShowForm(true)}
          className="max-w-md w-full flex items-center justify-center gap-2 py-3 rounded-full text-white font-semibold hover:opacity-90 transition-opacity shadow-sm"
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
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#00C9B7]" size={32} /></div>
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
    <div className="flex flex-col h-full bg-white">
      <div className="lg:hidden">
        <MobileHeader title="투석케어" showMenu={true} showProfile={true} />
      </div>

      <div className={`flex-1 ${activeTab === '투석 병원' ? 'overflow-hidden' : 'overflow-y-auto pb-24 lg:pb-10'}`}>
        <div className={activeTab === '투석 병원' ? 'h-full w-full' : 'max-w-2xl mx-auto px-5 lg:px-7 pt-5'}>

          {/* 탭 헤더 영역 */}
          <div className={`border-b border-[#E5E7EB] ${activeTab === '투석 병원' ? 'px-5 lg:px-7 pt-4 bg-white flex-shrink-0' : 'mb-6'}`}>
            <div className="flex gap-6">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-3 text-sm transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: activeTab === tab ? '#00C9B7' : '#9CA3AF',
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
