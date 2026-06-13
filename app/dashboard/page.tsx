'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  HeartPulse, 
  Activity, 
  Droplet, 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Minus, 
  ArrowUpRight, 
  ChevronRight, 
  Edit3, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../../lib/types/chat';

import { supabase } from '../../lib/rag/supabaseClient';

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3000);
  };
  
  // 대시보드 자가기록 상태
  const [waterCount, setWaterCount] = useState<number>(0); // 컵 단위 (250ml)
  const [bloodSugarFasting, setBloodSugarFasting] = useState<number>(95);
  const [bloodSugarPostprandial, setBloodSugarPostprandial] = useState<number>(135);
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  
  // 체크리스트 상태
  const [checklist, setChecklist] = useState({
    meds: false,
    diet: false,
    exercise: false,
    bloodPressure: false,
    bloodSugar: false
  });

  // 프로필 모달 및 필드 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [gender, setGender] = useState('남성');
  const [age, setAge] = useState(60);
  const [height, setHeight] = useState(170);
  const [targetWeight, setTargetWeight] = useState(65);
  const [creatinine, setCreatinine] = useState(1.2);
  const [ckdStage, setCkdStage] = useState('1기');
  const [dialysisType, setDialysisType] = useState('해당없음');
  const [diabetesType, setDiabetesType] = useState('없음');
  const [medication, setMedication] = useState('식이조절만');
  const [otherConditions, setOtherConditions] = useState<string[]>([]);
  const [limitSugar, setLimitSugar] = useState(50);
  const [limitSodium, setLimitSodium] = useState(2000);
  const [limitPotassium, setLimitPotassium] = useState(3500);
  const [limitPhosphorus, setLimitPhosphorus] = useState(1000);

  const getStageFromEGFR = (egfr: number) => {
    if (egfr >= 90) return '1기';
    if (egfr >= 60) return '2기';
    if (egfr >= 45) return '3a기';
    if (egfr >= 30) return '3b기';
    if (egfr >= 15) return '4기';
    return '5기(투석전)';
  };

  const handleAutoFillLimits = (stage: string, diabetes: string) => {
    let sugar = 50;
    let sodium = 2000;
    let potassium = 3500;
    let phosphorus = 1000;

    if (stage.includes('3') || stage.includes('4') || stage.includes('5') || stage.includes('투석')) {
      potassium = 2000;
      phosphorus = 800;
      if (stage.includes('4') || stage.includes('5') || stage.includes('투석')) {
        potassium = 1500;
      }
    }

    if (diabetes !== '없음') {
      sugar = 30;
    }

    setLimitSugar(sugar);
    setLimitSodium(sodium);
    setLimitPotassium(potassium);
    setLimitPhosphorus(phosphorus);
  };

  const handleProfileSave = async () => {
    const genderCoeff = (gender === '여성' || gender === 'female') ? 0.742 : 1.0;
    const computedEgfr = Math.round(175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * genderCoeff);
    
    let finalCkdStage = ckdStage;
    if (dialysisType !== '해당없음') {
      finalCkdStage = '5기 (투석 환자)';
    } else {
      finalCkdStage = getStageFromEGFR(computedEgfr);
    }

    const updatedProfile: UserProfile = {
      ...profile,
      gender,
      age,
      height,
      target_weight: targetWeight,
      creatinine,
      egfr: computedEgfr,
      ckd_stage: finalCkdStage,
      dialysis_type: dialysisType,
      diabetes_type: diabetesType,
      medication,
      other_conditions: otherConditions,
      limit_sugar: limitSugar,
      limit_sodium: limitSodium,
      limit_potassium: limitPotassium,
      limit_phosphorus: limitPhosphorus
    };

    setProfile(updatedProfile);
    localStorage.setItem('kongdang_profile', JSON.stringify(updatedProfile));

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (user) {
      try {
        await supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            role: profile?.role || 'patient',
            ckd_stage: finalCkdStage,
            dialysis_type: dialysisType,
            diabetes_type: diabetesType,
            medication,
            other_conditions: otherConditions,
            updated_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('Supabase sync error:', e);
      }
    }

    setIsEditingProfile(false);
    showToast('건강 프로필이 성공적으로 저장되었습니다!');
  };

  // 로컬스토리지 연동
  useEffect(() => {
    // Check for signup complete query param
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (searchParams && searchParams.get('newSignup') === 'true') {
      setShowWelcomeModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 1. 프로필 정보 로드
    const savedProfile = localStorage.getItem('kongdang_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile(parsed);
        setGender(parsed.gender || '남성');
        setAge(parsed.age || 60);
        setHeight(parsed.height || 170);
        setTargetWeight(parsed.target_weight || 65);
        setCreatinine(parsed.creatinine || 1.2);
        setCkdStage(parsed.ckd_stage || '1기');
        setDialysisType(parsed.dialysis_type || '해당없음');
        setDiabetesType(parsed.diabetes_type || '없음');
        setMedication(parsed.medication || '식이조절만');
        setOtherConditions(parsed.other_conditions || []);
        setLimitSugar(parsed.limit_sugar || 50);
        setLimitSodium(parsed.limit_sodium || 2000);
        setLimitPotassium(parsed.limit_potassium || 3500);
        setLimitPhosphorus(parsed.limit_phosphorus || 1000);
      } catch (e) {
        console.error(e);
      }
    }

    // 2. 일일 건강 데이터 로드
    const today = new Date().toISOString().split('T')[0];
    const savedData = localStorage.getItem(`kongdang_dashboard_${today}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setWaterCount(parsed.water || 0);
        setBloodSugarFasting(parsed.sugarFasting || 95);
        setBloodSugarPostprandial(parsed.sugarPost || 135);
        setSystolic(parsed.systolic || 120);
        setDiastolic(parsed.diastolic || 80);
        setChecklist(parsed.checklist || {
          meds: false, diet: false, exercise: false, bloodPressure: false, bloodSugar: false
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // 일일 건강 데이터 저장 헬퍼
  const saveData = (updates: any) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `kongdang_dashboard_${today}`;
    const current = {
      water: waterCount,
      sugarFasting: bloodSugarFasting,
      sugarPost: bloodSugarPostprandial,
      systolic: systolic,
      diastolic: diastolic,
      checklist: checklist,
      ...updates
    };
    localStorage.setItem(key, JSON.stringify(current));
  };

  const handleWaterAdd = () => {
    const newVal = waterCount + 1;
    setWaterCount(newVal);
    saveData({ water: newVal });
  };

  const handleWaterRemove = () => {
    if (waterCount <= 0) return;
    const newVal = waterCount - 1;
    setWaterCount(newVal);
    saveData({ water: newVal });
  };

  const toggleCheck = (key: keyof typeof checklist) => {
    const updatedChecklist = {
      ...checklist,
      [key]: !checklist[key]
    };
    setChecklist(updatedChecklist);
    saveData({ checklist: updatedChecklist });
  };

  // 신장 단계별 맞춤형 수분/칼륨 가이드 도출
  const getKidneyGuide = (stage: string) => {
    if (stage.includes('5기') && stage.includes('투석')) {
      return {
        waterTarget: 2, // 2컵 (500ml)
        waterDesc: '투석 환자는 과도한 수분 섭취 시 폐부종 위험이 크므로 500ml 이내로 철저히 조절하세요.',
        potassiumAlert: '🚨 초고위험: 바나나, 토마토, 시금치 등 고칼륨 식품은 절대 피하고 전처리 필수!',
        statusColor: 'text-red-600 bg-red-50 border-red-100'
      };
    }
    if (stage.includes('5기')) { // 5기(투석전)
      return {
        waterTarget: 4, // 4컵 (1L)
        waterDesc: '말기 신부전 환자는 소변량이 적으므로 일일 수분 섭취량을 1L 이내로 철저히 계량하여 드십시오.',
        potassiumAlert: '🚨 초고위험: 칼륨 배설 능력이 소실에 가까우므로 과일/야채 섭취 시 전처리가 필수적입니다.',
        statusColor: 'text-red-650 bg-red-50/50 border-red-150'
      };
    }
    if (stage.includes('4기')) {
      return {
        waterTarget: 4, // 4컵 (1L)
        waterDesc: '소변량이 줄어든 경우 수분 저류 현상이 생길 수 있으니 1L 내외로 계량해서 드세요.',
        potassiumAlert: '⚠️ 위험: 칼륨 배설 능력이 매우 떨어지므로 야채는 끓는 물에 데쳐서 드세요.',
        statusColor: 'text-amber-600 bg-amber-50 border-amber-100'
      };
    }
    if (stage.includes('3')) { // 3a기, 3b기 매칭
      return {
        waterTarget: 6, // 6컵 (1.5L)
        waterDesc: '갈증이 날 때 충분히 마시되, 급격히 들이켜지 않고 조금씩 나누어 마십니다.',
        potassiumAlert: '⚠️ 주의: 채소류는 2시간 이상 물에 담가둔 후 조리하여 칼륨을 빼주세요.',
        statusColor: 'text-yellow-750 bg-yellow-50 border-yellow-100'
      };
    }
    if (stage.includes('정상')) {
      return {
        waterTarget: 8, // 8컵 (2L)
        waterDesc: '당뇨 조절 및 노폐물 배출을 위해 하루 1.5L ~ 2L의 깨끗한 수분 섭취를 유지해 주세요.',
        potassiumAlert: '💡 일반: 과도한 편식을 피하고 신선한 채소와 균형 잡힌 영양을 고루 섭취하세요.',
        statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-100'
      };
    }
    return {
      waterTarget: 8, // 8컵 (2L)
      waterDesc: '신장 노폐물의 원활한 배출을 위해 일일 1.5L ~ 2L의 깨끗한 물 섭취를 지향하세요.',
      potassiumAlert: '💡 일반: 과도한 편식을 피하고, 매끼 신선한 야채와 양질의 한식을 드세요.',
      statusColor: 'text-[#6D3FA0] bg-purple-50 border-purple-100'
    };
  };

  const ckdGuide = getKidneyGuide(profile?.ckd_stage || '1~2기');

  // 혈당 지표 평가
  const getGlucoseStatus = (fasting: number, post: number) => {
    let fastingStatus = '정상';
    let postStatus = '정상';
    
    if (fasting >= 126) fastingStatus = '높음 (당뇨 기준)';
    else if (fasting >= 100) fastingStatus = '주의 (공복장애)';
    
    if (post >= 200) postStatus = '높음 (당뇨 기준)';
    else if (post >= 140) postStatus = '주의 (내당능장애)';
    
    return { fastingStatus, postStatus };
  };
  const sugarEval = getGlucoseStatus(bloodSugarFasting, bloodSugarPostprandial);

  // 혈압 지표 평가
  const getBpStatus = (sys: number, dia: number) => {
    if (sys >= 140 || dia >= 90) return { label: '고혈압', color: 'text-red-600 bg-red-50 border-red-100' };
    if (sys >= 130 || dia >= 80) return { label: '고혈압 전단계', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    if (sys < 90 || dia < 60) return { label: '저혈압', color: 'text-blue-600 bg-blue-50 border-blue-100' };
    return { label: '정상 혈압', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
  };
  const bpEval = getBpStatus(systolic, diastolic);

  const currentEgfr = (age && creatinine) 
    ? Math.round(175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * ((gender === '여성' || gender === 'female') ? 0.742 : 1.0))
    : null;

  const currentStage = currentEgfr !== null 
    ? (dialysisType !== '해당없음' ? '5기 (투석 환자)' : getStageFromEGFR(currentEgfr))
    : (profile?.ckd_stage || '1~2기');

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-8 animate-fade-in text-slate-800">
      
      {/* 1. 상단 웰컴 배너 및 프로필 요약 */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-900 via-[#6D3FA0] to-indigo-900 text-white shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-105 transition-transform duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0 gap-6">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-white/20 uppercase shadow-2xs">
              <Activity size={12} className="animate-pulse" />
              <span>Personal Health Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">개인 건강 대시보드</h1>
            <p className="text-sm text-purple-100 max-w-xl font-medium leading-relaxed">
              환우님의 복합 만성질환 상태를 고려한 실시간 수분 섭취 가이드라인, 생활 습관 관리 리스트 및 생체 지표 모니터링 동향을 관리합니다.
            </p>
          </div>
 
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3 w-full md:w-auto min-w-[320px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-200">현재 내 질환 프로필</span>
              <button 
                onClick={() => setIsEditingProfile(true)}
                className="text-[10px] font-black text-white hover:underline flex items-center gap-0.5 cursor-pointer bg-white/10 px-2 py-0.5 rounded-md"
              >
                <Edit3 size={10} />
                수정
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">인적 정보</span>
                <span className="font-extrabold">{profile?.gender || '남성'} | {profile?.age || '60'}세</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">신체 조건</span>
                <span className="font-extrabold">{profile?.height || '170'}cm | {profile?.target_weight || '65'}kg(목표)</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">크레아티닌 / eGFR</span>
                <span className="font-extrabold text-amber-200">{profile?.creatinine || '1.2'}mg/dL ({profile?.egfr || '68'}ml)</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">콩팥 병기 단계</span>
                <span className="font-extrabold text-amber-200">{profile?.ckd_stage || '1~2기'}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">당뇨병 유형</span>
                <span className="font-extrabold">{profile?.diabetes_type !== '없음' ? `${profile?.diabetes_type}` : '해당없음'}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                <span className="text-[9px] text-purple-300 block font-bold">투석 여부</span>
                <span className="font-extrabold truncate">{profile?.dialysis_type || '투석 안함'}</span>
              </div>

              {/* 영양소 섭취 제한량 */}
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 col-span-2 space-y-1">
                <span className="text-[9px] text-purple-300 block font-bold">일일 영양 제한 섭취량</span>
                <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-bold">
                  <div className="bg-white/5 p-1 rounded-md">
                    <span className="text-[8px] text-purple-300 block">당류</span>
                    <span className="text-white">{profile?.limit_sugar || '50'}g</span>
                  </div>
                  <div className="bg-white/5 p-1 rounded-md">
                    <span className="text-[8px] text-purple-300 block">나트륨</span>
                    <span className="text-white">{profile?.limit_sodium || '2000'}mg</span>
                  </div>
                  <div className="bg-white/5 p-1 rounded-md">
                    <span className="text-[8px] text-purple-300 block">칼륨</span>
                    <span className="text-white">{profile?.limit_potassium || '3500'}mg</span>
                  </div>
                  <div className="bg-white/5 p-1 rounded-md">
                    <span className="text-[8px] text-purple-300 block">인</span>
                    <span className="text-white">{profile?.limit_phosphorus || '1000'}mg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 대시보드 지표 카드 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* (A) 수분 섭취 트래커 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-2xl shadow-2xs">
                  <Droplet size={18} className="fill-blue-600" />
                </span>
                <h3 className="text-sm font-bold text-slate-800">일일 수분 섭취량</h3>
              </div>
              <span className="text-xs text-blue-600 font-extrabold bg-blue-50 px-2 py-1 rounded-xl">
                목표: {ckdGuide.waterTarget}컵 ({ckdGuide.waterTarget * 250}ml)
              </span>
            </div>
            
            {/* 수분 그래픽 표현 */}
            <div className="h-28 flex items-center justify-center relative">
              <div className="w-24 h-24 rounded-full border-4 border-blue-100 flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 shadow-inner">
                {/* 수분 채우기 웨이브 */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400 to-blue-300 opacity-80 transition-all duration-500"
                  style={{ height: `${Math.min((waterCount / ckdGuide.waterTarget) * 100, 100)}%` }}
                />
                <div className="relative z-10 text-center">
                  <span className="text-2xl font-black text-slate-900">{waterCount}</span>
                  <span className="text-[10px] text-slate-500 font-semibold block">/ {ckdGuide.waterTarget} 컵</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              {ckdGuide.waterDesc}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
            <button 
              onClick={handleWaterRemove}
              className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-100 rounded-xl flex items-center justify-center transition-all text-slate-600"
            >
              <Minus size={14} />
            </button>
            <button 
              onClick={handleWaterAdd}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-sm font-bold text-xs gap-1"
            >
              <Plus size={14} />
              <span>1컵 추가</span>
            </button>
          </div>
        </div>

        {/* (B) 자가 혈당 일지 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-red-50 text-red-600 rounded-2xl shadow-2xs">
                <Activity size={18} />
              </span>
              <h3 className="text-sm font-bold text-slate-800">일일 자가 혈당 모니터링</h3>
            </div>

            <div className="space-y-3.5">
              {/* 공복 혈당 */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-50">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">공복 혈당</span>
                  <div className="flex items-baseline space-x-1">
                    <input 
                      type="number" 
                      value={bloodSugarFasting}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBloodSugarFasting(val);
                        saveData({ sugarFasting: val });
                      }}
                      className="w-14 bg-transparent font-black text-slate-900 border-b border-dashed border-slate-350 focus:outline-none focus:border-purple-600 text-sm"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">mg/dL</span>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                  sugarEval.fastingStatus.includes('높음') ? 'bg-red-50 text-red-600 border border-red-100' :
                  sugarEval.fastingStatus.includes('주의') ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {sugarEval.fastingStatus}
                </span>
              </div>

              {/* 식후 2시간 혈당 */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-50">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">식후 2시간 혈당</span>
                  <div className="flex items-baseline space-x-1">
                    <input 
                      type="number" 
                      value={bloodSugarPostprandial}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBloodSugarPostprandial(val);
                        saveData({ sugarPost: val });
                      }}
                      className="w-14 bg-transparent font-black text-slate-900 border-b border-dashed border-slate-350 focus:outline-none focus:border-purple-600 text-sm"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">mg/dL</span>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                  sugarEval.postStatus.includes('높음') ? 'bg-red-50 text-red-600 border border-red-100' :
                  sugarEval.postStatus.includes('주의') ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  {sugarEval.postStatus}
                </span>
              </div>
            </div>
            
            <div className="p-3 rounded-xl border border-dashed border-slate-100 text-[10px] text-slate-400 leading-normal flex items-start gap-1">
              <AlertCircle size={12} className="text-purple-600 shrink-0 mt-0.5" />
              <span>대한당뇨병학회 기준 공복 100 미만, 식후 140 미만이 정상 목표치입니다.</span>
            </div>
          </div>
        </div>

        {/* (C) 자가 혈압 일지 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-purple-50 text-purple-600 rounded-2xl shadow-2xs">
                <HeartPulse size={18} />
              </span>
              <h3 className="text-sm font-bold text-slate-800">일일 자가 혈압 모니터링</h3>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-50 flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-baseline space-x-1">
                  <span className="text-[10px] text-slate-400 font-bold w-12">수축기:</span>
                  <input 
                    type="number" 
                    value={systolic}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setSystolic(val);
                      saveData({ systolic: val });
                    }}
                    className="w-12 bg-transparent font-black text-slate-900 border-b border-dashed border-slate-350 focus:outline-none focus:border-purple-600 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">mmHg</span>
                </div>
                
                <div className="flex items-baseline space-x-1">
                  <span className="text-[10px] text-slate-400 font-bold w-12">이완기:</span>
                  <input 
                    type="number" 
                    value={diastolic}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setDiastolic(val);
                      saveData({ diastolic: val });
                    }}
                    className="w-12 bg-transparent font-black text-slate-900 border-b border-dashed border-slate-350 focus:outline-none focus:border-purple-600 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold">mmHg</span>
                </div>
              </div>

              <div className={`text-xs font-extrabold px-3 py-2 rounded-xl border ${bpEval.color} text-center max-w-[100px]`}>
                <span className="text-[9px] text-slate-400 block font-normal mb-0.5">평가</span>
                {bpEval.label}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-dashed border-slate-100 text-[10px] text-slate-400 leading-normal flex items-start gap-1">
              <AlertCircle size={12} className="text-purple-600 shrink-0 mt-0.5" />
              <span>신장질환을 앓고 계신 경우 130/80 mmHg 미만 조절이 적극 권장됩니다.</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. 체크리스트 & 추이 통계 그래픽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* (A) 건강 관리 생활 수칙 체크리스트 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} className="text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">오늘의 건강 지키기 체크리스트</h3>
          </div>

          <div className="space-y-2.5">
            
            <button 
              onClick={() => toggleCheck('meds')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 ${
                checklist.meds 
                  ? 'bg-purple-550/10 border-purple-200 text-purple-900 font-bold' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  checklist.meds ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {checklist.meds && <Plus size={12} className="stroke-[3]" />}
                </div>
                <span>
                  {profile?.diabetes_type !== '없음' && (profile?.ckd_stage?.includes('정상') || !profile?.ckd_stage)
                    ? '정시 복약 완료 (당뇨 처방약 및 인슐린 시간 확인)'
                    : '정시 복약 완료 (처방약 및 이뇨제/혈압약 복용 시간 확인)'}
                </span>
              </div>
            </button>

            <button 
              onClick={() => toggleCheck('diet')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 ${
                checklist.diet 
                  ? 'bg-purple-550/10 border-purple-200 text-purple-900 font-bold' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  checklist.diet ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {checklist.diet && <Plus size={12} className="stroke-[3]" />}
                </div>
                <span>
                  {profile?.diabetes_type !== '없음' && (profile?.ckd_stage?.includes('정상') || !profile?.ckd_stage)
                    ? '저당·식이 조절 준수 (단순당 배제 및 당 조절 잡곡 식사)'
                    : (profile?.diabetes_type === '없음'
                        ? '저염식·저칼륨 수칙 준수 (식단 칼륨/염분 조절 조리)'
                        : '복합 식이 조절 준수 (저염·저칼륨 및 저당 식사 요법)')}
                </span>
              </div>
            </button>

            <button 
              onClick={() => toggleCheck('exercise')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 ${
                checklist.exercise 
                  ? 'bg-purple-550/10 border-purple-200 text-purple-900 font-bold' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  checklist.exercise ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {checklist.exercise && <Plus size={12} className="stroke-[3]" />}
                </div>
                <span>가벼운 30분 유산소 운동 (맥박수 체크)</span>
              </div>
            </button>

            <button 
              onClick={() => toggleCheck('bloodPressure')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 ${
                checklist.bloodPressure 
                  ? 'bg-purple-550/10 border-purple-200 text-purple-900 font-bold' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  checklist.bloodPressure ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {checklist.bloodPressure && <Plus size={12} className="stroke-[3]" />}
                </div>
                <span>아침/저녁 혈압 자가 기록 완료</span>
              </div>
            </button>

            <button 
              onClick={() => toggleCheck('bloodSugar')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left transition-all duration-300 ${
                checklist.bloodSugar 
                  ? 'bg-purple-550/10 border-purple-200 text-purple-900 font-bold' 
                  : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                  checklist.bloodSugar ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {checklist.bloodSugar && <Plus size={12} className="stroke-[3]" />}
                </div>
                <span>공복/매식후 혈당 자가 측정 완료</span>
              </div>
            </button>

          </div>
        </div>

        {/* (B) 7일 혈당 추이 그래프 (SVG 기반 디자인) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <TrendingUp size={18} className="text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800">최근 7일 혈당 동향</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
              식후 2시간 기준
              <ArrowUpRight size={10} />
            </span>
          </div>

          <div className="relative pt-6">
            {/* SVG 차트 */}
            <svg viewBox="0 0 400 160" className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* 가이드라인 */}
              <line x1="0" y1="40" x2="400" y2="40" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4" />
              <line x1="0" y1="90" x2="400" y2="90" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4" />
              <line x1="0" y1="140" x2="400" y2="140" stroke="#E2E8F0" strokeWidth="1" />
              
              {/* Y축 범례 */}
              <text x="5" y="35" className="text-[9px] fill-slate-400 font-semibold">200 mg/dL (당뇨 기준치)</text>
              <text x="5" y="85" className="text-[9px] fill-slate-400 font-semibold">140 mg/dL (목표 한계치)</text>

              {/* 그라데이션 영역 */}
              <path 
                d="M 10 140 L 10 95 L 75 88 L 140 102 L 205 92 L 270 78 L 335 85 L 390 90 L 390 140 Z" 
                fill="url(#chartGrad)" 
              />
              
              {/* 차트 꺾은선 */}
              <path 
                d="M 10 95 L 75 88 L 140 102 L 205 92 L 270 78 L 335 85 L 390 90" 
                fill="none" 
                stroke="#6D3FA0" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 데이터 포인트들 */}
              <circle cx="10" cy="95" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="75" cy="88" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="140" cy="102" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="205" cy="92" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="270" cy="78" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="335" cy="85" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />
              <circle cx="390" cy="90" r="4.5" fill="#FFFFFF" stroke="#6D3FA0" strokeWidth="2.5" />

              {/* X축 날짜 라벨 */}
              <text x="10" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">6/7</text>
              <text x="75" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">6/8</text>
              <text x="140" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">6/9</text>
              <text x="205" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">6/10</text>
              <text x="270" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">6/11</text>
              <text x="335" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-semibold">어제</text>
              <text x="390" y="155" textAnchor="middle" className="text-[9px] fill-slate-400 font-bold fill-purple-600">오늘</text>
            </svg>
          </div>
          
          <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-50/50 text-[10px] text-slate-500 leading-relaxed font-medium">
            💡 환우님의 혈당 변동성이 안정 범위에 머무르고 있습니다. 식후 140 mg/dL 이하 조절을 유지하기 위해 오늘 오후 30분 유산소 걷기를 꼭 실행해 주세요.
          </div>
        </div>

      </div>

      {/* 4. 자가 진단 및 하단 네비게이션 */}
      <div className="w-full">
        {/* 맞춤형 질문 안내 */}
        <div className="p-6 bg-purple-50/30 border border-purple-100/40 rounded-3xl space-y-4 md:space-y-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5 flex-1">
            <span className="text-[9px] font-black text-[#6D3FA0] tracking-wider uppercase">Personalized AI Consultation</span>
            <h3 className="text-sm font-bold text-slate-800">내 질환 프로필 맞춤형 건강 상담</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              등록하신 성별, 키, 나이, 건체중, eGFR(사구체여과율) 및 일일 섭취 제한량 설정에 맞추어 평소 궁금하셨던 건강 상식이나 생활 지침을 AI 챗봇에게 편하게 질문해 보세요.
            </p>
          </div>
          <Link 
            href="/chat" 
            className="w-full md:w-auto px-6 py-3 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm shrink-0 transition-all active:scale-[0.98]"
          >
            <span>AI 챗봇에게 물어보기</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* 건강 프로필 수정 모달 */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 space-y-5 relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">질환 프로필 및 섭취 제한 관리</h3>
              <button 
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* 성별, 나이, 키, 건체중 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">성별</label>
                  <select 
                    value={gender} 
                    onChange={e => setGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white cursor-pointer"
                  >
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">나이 (세)</label>
                  <input 
                    type="number" 
                    value={age} 
                    onChange={e => setAge(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">키 (cm)</label>
                  <input 
                    type="number" 
                    value={height} 
                    onChange={e => setHeight(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">건체중 (목표체중, kg)</label>
                  <input 
                    type="number" 
                    value={targetWeight} 
                    onChange={e => setTargetWeight(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* 최근 혈액검사 크레아티닌 */}
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#6D3FA0] flex items-center gap-1">
                    <span>최근 혈액검사 크레아티닌 (Cr)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number" 
                      step="0.01"
                      value={creatinine} 
                      onChange={e => setCreatinine(parseFloat(e.target.value) || 0)}
                      className="w-24 p-2 bg-white border border-purple-200 rounded-xl font-black text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-600 text-center"
                    />
                    <span className="font-bold text-slate-450">mg/dL</span>
                  </div>
                </div>
                {/* 실시간 계산 결과 */}
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">실시간 사구체여과율 (eGFR)</span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-sm font-black text-purple-700">
                      {currentEgfr !== null ? `${currentEgfr} ml/min` : '계산 불가'}
                    </span>
                    <span className="text-[10px] text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-md font-bold">
                      {currentStage}
                    </span>
                  </div>
                </div>
              </div>

              {/* 당뇨 및 투석 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">당뇨 유형</label>
                  <select 
                    value={diabetesType} 
                    onChange={e => setDiabetesType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white cursor-pointer"
                  >
                    <option value="없음">해당없음</option>
                    <option value="1형">1형 당뇨</option>
                    <option value="2형">2형 당뇨</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">진행 중인 투석 방법</label>
                  <select 
                    value={dialysisType} 
                    onChange={e => setDialysisType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white cursor-pointer"
                  >
                    <option value="해당없음">투석 안함</option>
                    <option value="혈액투석">혈액투석</option>
                    <option value="복막투석">복막투석</option>
                    <option value="신장이식 후">신장이식 후</option>
                  </select>
                </div>
              </div>

              {/* 섭취 제한량 권장 버튼 */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-2">
                <span className="font-bold text-slate-600">일일 섭취 제한량 설정</span>
                <button
                  type="button"
                  onClick={() => handleAutoFillLimits(currentStage, diabetesType)}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-[#6D3FA0] border border-purple-200 rounded-lg text-[10px] font-bold transition-all"
                >
                  ⚕️ 의학적 권장량 자동 계산
                </button>
              </div>

              {/* 영양소별 제한량 입력 */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">당류 제한 (g)</label>
                  <input 
                    type="number" 
                    value={limitSugar} 
                    onChange={e => setLimitSugar(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">나트륨 제한 (mg)</label>
                  <input 
                    type="number" 
                    value={limitSodium} 
                    onChange={e => setLimitSodium(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">칼륨 제한 (mg)</label>
                  <input 
                    type="number" 
                    value={limitPotassium} 
                    onChange={e => setLimitPotassium(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 block">인 제한 (mg)</label>
                  <input 
                    type="number" 
                    value={limitPhosphorus} 
                    onChange={e => setLimitPhosphorus(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 transition-all text-center"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                className="flex-1 py-2.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all text-center"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WELCOME MODAL FOR NEW SIGNUPS */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-8 space-y-6 text-center relative overflow-hidden">
            {/* Decorative spheres */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>

            <div className="p-4 bg-gradient-to-tr from-[#6D3FA0] to-purple-600 text-white rounded-3xl inline-flex shadow-lg animate-bounce">
              <HeartPulse size={36} className="animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-850">🎉 가입과 온보딩 완료!</h2>
              <p className="text-xs text-[#6D3FA0] font-extrabold uppercase tracking-wide">
                환우 맞춤형 건강 관리가 시작됩니다
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold pt-1">
                작성해주신 신체 지표 및 크레아티닌 검사결과를 기준으로 분석된 환우님의 콩팥 건강 정보와 영양소 기준 한계치입니다.
              </p>
            </div>

            {/* Analysis Box */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left text-xs font-semibold space-y-2 relative">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">신장 건강 상태</span>
                <span className="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                  {profile?.ckd_stage || '1~2기'} (eGFR: {profile?.egfr || '--'}ml)
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">동반 만성 질환</span>
                <span className="font-extrabold text-slate-800">
                  당뇨: {profile?.diabetes_type !== '없음' ? `${profile?.diabetes_type} 당뇨` : '해당없음'}
                </span>
              </div>
              <div className="pt-1 space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">적용된 일일 영양소 권장량 제한선</span>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-black">
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200/60">
                    <span className="text-[8px] text-slate-400 block font-bold">당류</span>
                    <span className="text-slate-800">{profile?.limit_sugar || '50'}g</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200/60">
                    <span className="text-[8px] text-slate-400 block font-bold">나트륨</span>
                    <span className="text-[#C0392B]">{profile?.limit_sodium || '2000'}mg</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200/60">
                    <span className="text-[8px] text-slate-400 block font-bold">칼륨</span>
                    <span className="text-purple-750">{profile?.limit_potassium || '3500'}mg</span>
                  </div>
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200/60">
                    <span className="text-[8px] text-slate-400 block font-bold">인</span>
                    <span className="text-indigo-700">{profile?.limit_phosphorus || '1000'}mg</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md hover:opacity-90 active:scale-[0.98]"
            >
              대시보드 관리 시작하기
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST NOTIFICATION */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xl border border-slate-700/50 animate-fade-in backdrop-blur-md">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
}
