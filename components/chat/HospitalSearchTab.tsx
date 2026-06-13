'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Map, AlertTriangle, ShieldAlert, RefreshCw, CheckCircle } from 'lucide-react';

interface Hospital {
  name: string;
  grade: string;
  address: string;
  phone: string;
  distance?: string; // Simulated distance for location-allowed state
  hasHemodialysis: boolean; // 혈액투석
  hasPeritonealdialysis: boolean; // 복막투석
  hasNightdialysis: boolean; // 야간투석
  isComplicationSpecialized: boolean; // 합병증 특화 (상급종합병원)
  mapUrl: string;
}

const ALL_HOSPITALS: Hospital[] = [
  {
    name: '서울대학교병원',
    grade: '상급종합병원',
    address: '서울특별시 종로구 대학로 101',
    phone: '1588-5700',
    hasHemodialysis: true,
    hasPeritonealdialysis: true,
    hasNightdialysis: false,
    isComplicationSpecialized: true,
    mapUrl: 'https://map.naver.com/v5/search/서울대학교병원'
  },
  {
    name: '서울아산병원',
    grade: '상급종합병원',
    address: '서울특별시 송파구 올림픽로43길 88',
    phone: '1688-7575',
    hasHemodialysis: true,
    hasPeritonealdialysis: true,
    hasNightdialysis: false,
    isComplicationSpecialized: true,
    mapUrl: 'https://map.naver.com/v5/search/서울아산병원'
  },
  {
    name: '삼성서울병원',
    grade: '상급종합병원',
    address: '서울특별시 강남구 일원로 81',
    phone: '1599-3114',
    hasHemodialysis: true,
    hasPeritonealdialysis: true,
    hasNightdialysis: true,
    isComplicationSpecialized: true,
    mapUrl: 'https://map.naver.com/v5/search/삼성서울병원'
  },
  {
    name: '열린편한내과의원',
    grade: '의원 (투석전문의료기관)',
    address: '서울특별시 강남구 테헤란로 123 4층',
    phone: '02-555-1234',
    hasHemodialysis: true,
    hasPeritonealdialysis: false,
    hasNightdialysis: true,
    isComplicationSpecialized: false,
    mapUrl: 'https://map.naver.com/v5/search/역삼역 열린편한내과'
  },
  {
    name: '보라매병원',
    grade: '종합병원 (시립)',
    address: '서울특별시 동작구 보라매로5길 20',
    phone: '02-870-2114',
    hasHemodialysis: true,
    hasPeritonealdialysis: true,
    hasNightdialysis: false,
    isComplicationSpecialized: false,
    mapUrl: 'https://map.naver.com/v5/search/보라매병원'
  },
  {
    name: '가톨릭대학교 서울성모병원',
    grade: '상급종합병원',
    address: '서울특별시 서초구 반포대로 222',
    phone: '1588-1511',
    hasHemodialysis: true,
    hasPeritonealdialysis: true,
    hasNightdialysis: false,
    isComplicationSpecialized: true,
    mapUrl: 'https://map.naver.com/v5/search/서울성모병원'
  }
];

export function HospitalSearchTab() {
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'requesting' | 'granted' | 'denied'>('prompt');
  const [searchTerm, setSearchTerm] = useState('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hasComplication, setHasComplication] = useState(false);

  // Request browser location
  const requestLocation = () => {
    setLocationStatus('requesting');
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Location allowed
        setLocationStatus('granted');
        // Filter/assign 3 mock nearby hospitals with mock distances
        const mockNearby = [
          { ...ALL_HOSPITALS[0], distance: '1.2 km' },
          { ...ALL_HOSPITALS[2], distance: '2.5 km' },
          { ...ALL_HOSPITALS[3], distance: '3.1 km' }
        ];
        setHospitals(mockNearby);
      },
      (error) => {
        // Location denied
        setLocationStatus('denied');
        setHospitals([]);
      },
      { timeout: 5000 }
    );
  };

  // Manual search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      alert('지역 또는 병원 이름을 입력해 주세요.');
      return;
    }
    const filtered = ALL_HOSPITALS.filter(
      h => h.address.includes(searchTerm) || h.name.includes(searchTerm)
    );
    setHospitals(filtered);
  };

  // Readjust hospital list when complication flag changes
  useEffect(() => {
    if (hasComplication) {
      // Prioritize/Filter complication specialized hospitals (상급종합병원)
      setHospitals(prev => {
        // Get base set (either previous search results, or nearby list, or all if empty)
        const baseSet = prev.length > 0 ? prev : ALL_HOSPITALS;
        // Re-adjust by placing specialized hospitals at the top or filtering for them
        const adjusted = [...baseSet].sort((a, b) => {
          if (a.isComplicationSpecialized && !b.isComplicationSpecialized) return -1;
          if (!a.isComplicationSpecialized && b.isComplicationSpecialized) return 1;
          return 0;
        });
        return adjusted;
      });
    } else {
      // Revert/refresh based on current flow
      if (locationStatus === 'granted') {
        const mockNearby = [
          { ...ALL_HOSPITALS[0], distance: '1.2 km' },
          { ...ALL_HOSPITALS[2], distance: '2.5 km' },
          { ...ALL_HOSPITALS[3], distance: '3.1 km' }
        ];
        setHospitals(mockNearby);
      } else if (searchTerm) {
        const filtered = ALL_HOSPITALS.filter(
          h => h.address.includes(searchTerm) || h.name.includes(searchTerm)
        );
        setHospitals(filtered);
      } else {
        setHospitals([]);
      }
    }
  }, [hasComplication, locationStatus]);

  const handlePhoneCall = (name: string, phone: string) => {
    alert(`📞 ${name} (${phone}) 유선 연락을 연결합니다. (가상 연계)`);
  };

  const handleMapOpen = (name: string, mapUrl: string) => {
    if (confirm(`🗺️ ${name} 네이버 지도 검색 페이지를 새 창으로 여시겠습니까?`)) {
      window.open(mapUrl, '_blank');
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-6 animate-fade-in text-slate-800">
      
      {/* A. 위치 권한 흐름 제어판 */}
      <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="text-sm font-bold flex items-center justify-center md:justify-start gap-1.5 text-slate-850">
            <MapPin size={16} className="text-[#6D3FA0]" />
            <span>내 주변 투석 전문 병원 찾기</span>
          </h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            위치 정보 제공 동의 시 현재 위치에서 반경 5km 이내의 인근 전문 병원을 즉시 탐색합니다.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {locationStatus === 'prompt' && (
            <button
              onClick={requestLocation}
              className="px-5 py-2.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <span>위치 정보 허용하기</span>
            </button>
          )}

          {locationStatus === 'requesting' && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-450 px-4 py-2">
              <RefreshCw size={12} className="animate-spin text-purple-600" />
              <span>위치 정보 확인 중...</span>
            </div>
          )}

          {locationStatus === 'granted' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                ✓ 위치 정보 동의 완료
              </span>
              <button
                onClick={requestLocation}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-450 transition-colors"
                title="새로고침"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          {locationStatus === 'denied' && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl">
              위치 권한 거부됨 (수동 입력 필요)
            </span>
          )}
        </div>
      </div>

      {/* B. 수동 검색 바 (위치 거부 시 또는 임의 검색용) */}
      {(locationStatus === 'denied' || locationStatus === 'prompt') && (
        <form onSubmit={handleSearch} className="flex gap-2 animate-fade-in">
          <input
            type="text"
            placeholder="예: 서울 강남구, 강남역, 역삼동 등 지역명을 입력해 주세요."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            지역 검색
          </button>
        </form>
      )}

      {/* C. 병원 리스트 출력 영역 */}
      <div className="space-y-4">
        {hospitals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hospitals.map((h, idx) => (
              <div 
                key={idx} 
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-2xs bg-white ${
                  h.isComplicationSpecialized && hasComplication 
                    ? 'border-purple-300 ring-2 ring-purple-600/10' 
                    : 'border-slate-100'
                }`}
              >
                {/* 상단: 이름 & 등급 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-[#6D3FA0]">
                      {h.grade}
                    </span>
                    {h.distance && (
                      <span className="text-[10px] font-black text-rose-500 flex items-center gap-0.5">
                        📍 {h.distance}
                      </span>
                    )}
                  </div>
                  <h5 className="text-sm font-extrabold text-slate-850 flex items-center gap-1.5">
                    {h.name}
                    {h.isComplicationSpecialized && hasComplication && (
                      <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded-md font-bold shrink-0">
                        합병증 특화
                      </span>
                    )}
                  </h5>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">{h.address}</p>
                </div>

                {/* 중단: 투석실 옵션 체크리스트 */}
                <div className="p-3 bg-slate-50/80 border border-slate-100/50 rounded-xl text-[10px] text-slate-500 space-y-1 font-semibold">
                  <div className="flex justify-between">
                    <span>혈액투석</span>
                    <span className={h.hasHemodialysis ? 'text-purple-600 font-bold' : 'text-slate-350'}>
                      {h.hasHemodialysis ? '✓ 가능' : '✗ 미운영'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>복막투석</span>
                    <span className={h.hasPeritonealdialysis ? 'text-purple-600 font-bold' : 'text-slate-350'}>
                      {h.hasPeritonealdialysis ? '✓ 가능' : '✗ 미운영'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>야간투석</span>
                    <span className={h.hasNightdialysis ? 'text-purple-600 font-bold' : 'text-slate-350'}>
                      {h.hasNightdialysis ? '✓ 운영' : '✗ 미운영'}
                    </span>
                  </div>
                </div>

                {/* 하단: 액션 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePhoneCall(h.name, h.phone)}
                    className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone size={10} />
                    <span>전화</span>
                  </button>
                  <button
                    onClick={() => handleMapOpen(h.name, h.mapUrl)}
                    className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-[#6D3FA0] border border-purple-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Map size={10} />
                    <span>지도</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center space-y-1.5 text-slate-400">
            <MapPin size={24} className="mx-auto text-slate-300 animate-bounce" />
            <p className="text-xs font-semibold">
              {locationStatus === 'granted' ? '주변 병원 목록을 계산하고 있습니다.' : '위치 정보를 허용하시거나 지역을 검색하여 병원을 탐색하세요.'}
            </p>
          </div>
        )}
      </div>

      {/* D. 합병증 확인 및 재조정 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-dashed border-purple-200 bg-purple-50/10 rounded-2xl">
        <div className="space-y-0.5 text-center sm:text-left">
          <h5 className="text-xs font-black text-slate-700 flex items-center justify-center sm:justify-start gap-1">
            <AlertTriangle size={14} className="text-purple-600" />
            <span>신장·당뇨 합병증 동반 여부 확인</span>
          </h5>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            심혈관계, 시력저하, 당뇨발 등 합병증이 동반된 경우 다학제 진료가 가능한 상급종합병원 위주로 자동 재조정합니다.
          </p>
        </div>
        <button
          onClick={() => setStepComplications(!hasComplication)}
          className={`shrink-0 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
            hasComplication
              ? 'bg-[#C0392B] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {hasComplication ? '✓ 합병증 확인 켜짐 (해제하기)' : '합병증 동반 여부 확인하기'}
        </button>
      </div>

      {/* E. 주의사항 안내 패널 (기본 / 추가 주의사항) */}
      <div className="space-y-3 pt-2">
        {/* 기본 주의사항 */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-left">
          <h6 className="text-xs font-bold text-slate-750 flex items-center gap-1">
            <CheckCircle size={13} className="text-purple-600" />
            <span>기본 병원 내원 주의사항</span>
          </h6>
          <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
            신부전/당뇨 복합 질환자는 정기적인 투석과 혈당 관리가 필수적입니다. 처음 인공신장실을 선정할 때는 신장내과 분과 전문의와 투석 전문 전담 간호사의 상주 여부, 응급 처치 연계 체계(심장/뇌혈관)를 사전에 반드시 확인하셔야 합니다.
          </p>
        </div>

        {/* 추가 주의사항 (합병증 확인 시 노출) */}
        {hasComplication && (
          <div className="p-4 bg-red-50/50 border border-red-200 rounded-xl space-y-1.5 text-left animate-shake">
            <h6 className="text-xs font-bold text-[#C0392B] flex items-center gap-1">
              <ShieldAlert size={14} className="text-[#C0392B]" />
              <span>🚨 합병증 발생 환자 필수 추가 주의사항</span>
            </h6>
            <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
              뇌졸중, 심근경색, 당뇨망막증, 당뇨발 괴사 등 만성 합병증이 동반된 환자분은 응급 야간 투석실과 이식 센터가 연계된 **3차 대학병원(상급종합병원)**으로 재조정하여 내원해야 합니다. 
              <br />
              또한, 국민건강보험 요양급여 적용을 위해 의원(1차) 또는 종합병원(2차)에서 발급한 **진료의뢰서**와 최근 검사기록지를 반드시 지참하고 예약을 조율하셔야 의료비 본인부담 혜택을 온전히 받으실 수 있습니다.
            </p>
          </div>
        )}
      </div>

    </div>
  );

  // Helper setter to update complication state
  function setStepComplications(flag: boolean) {
    setHasComplication(flag);
  }
}
