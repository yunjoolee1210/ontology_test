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

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
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

  // 로컬스토리지 연동
  useEffect(() => {
    // 1. 프로필 정보 로드
    const savedProfile = localStorage.getItem('kongdang_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
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
    switch (stage) {
      case '5기 (투석 환자)':
        return {
          waterTarget: 2, // 2컵 (500ml) + 소변량
          waterDesc: '투석 환자는 과도한 수분 섭취 시 폐부종 위험이 크므로 500ml 이내로 철저히 조절하세요.',
          potassiumAlert: '🚨 초고위험: 바나나, 토마토, 시금치 등 고칼륨 식품은 절대 피하고 전처리 필수!',
          statusColor: 'text-red-600 bg-red-50 border-red-100'
        };
      case '4기 (중증 신기능 저하)':
        return {
          waterTarget: 4, // 4컵 (1L)
          waterDesc: '소변량이 줄어든 경우 수분 저류 현상이 생길 수 있으니 1L 내외로 계량해서 드세요.',
          potassiumAlert: '⚠️ 위험: 칼륨 배설 능력이 매우 떨어지므로 야채는 끓는 물에 데쳐서 드세요.',
          statusColor: 'text-amber-600 bg-amber-50 border-amber-100'
        };
      case '3기 (중등도 신기능 저하)':
        return {
          waterTarget: 6, // 6컵 (1.5L)
          waterDesc: '갈증이 날 때 충분히 마시되, 급격히 들이켜지 않고 조금씩 나누어 마십니다.',
          potassiumAlert: '⚠️ 주의: 채소류는 2시간 이상 물에 담가둔 후 조리하여 칼륨을 빼주세요.',
          statusColor: 'text-yellow-700 bg-yellow-50 border-yellow-100'
        };
      default:
        return {
          waterTarget: 8, // 8컵 (2L)
          waterDesc: '신장 노폐물의 원활한 배출을 위해 일일 1.5L ~ 2L의 깨끗한 물 섭취를 지향하세요.',
          potassiumAlert: '💡 일반: 과도한 편식을 피하고, 매끼 신선한 야채와 양질의 한식을 드세요.',
          statusColor: 'text-[#6D3FA0] bg-purple-50 border-purple-100'
        };
    }
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

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-8 animate-fade-in text-slate-800">
      
      {/* 1. 상단 웰컴 배너 및 프로필 요약 */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-900 via-[#6D3FA0] to-indigo-900 text-white shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-105 transition-transform duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-white/20 uppercase shadow-2xs">
              <Activity size={12} className="animate-pulse" />
              <span>Personal Health Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">개인 건강 대시보드</h1>
            <p className="text-sm text-purple-100 max-w-xl font-medium leading-relaxed">
              환우님의 복합 만성질환 상태를 고려한 실시간 수분 섭취 가이드라인, 생활 습관 관리 리스트 및 생체 지표 모니터링 동향을 관리합니다.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3 w-full md:w-auto min-w-[280px] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-200">현재 내 질환 프로필</span>
              <Link href="/mypage" className="text-[10px] font-black text-white hover:underline flex items-center gap-0.5">
                <Edit3 size={10} />
                수정
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-purple-300 block mb-0.5 font-bold">콩팥 병기 단계</span>
                <span className="font-extrabold">{profile?.ckd_stage || '1~2기'}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-purple-300 block mb-0.5 font-bold">당뇨병 유형</span>
                <span className="font-extrabold">{profile?.diabetes_type !== '없음' ? `${profile?.diabetes_type}` : '해당없음'}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 col-span-2">
                <span className="text-[10px] text-purple-300 block mb-0.5 font-bold">진행 중인 투석 방법</span>
                <span className="font-extrabold">{profile?.dialysis_type || '투석 안함'}</span>
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
                <span>정시 복약 완료 (처방약 및 이뇨제 복용 시간 확인)</span>
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
                <span>저염식·저칼륨 수칙 준수 (식단 칼륨/염분 조절 조리)</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 신약 정보 or 가이드 */}
        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-purple-600 tracking-wider uppercase">FOOD PROTECTION CHECK</span>
            <h3 className="text-sm font-bold text-slate-800">신장·당뇨 3중 식품 성분 판정</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              먹고 싶은 음식이 환우님의 현재 콩팥병 기수(eGFR) 및 당뇨, 고혈압 상태에 안전한지 걱정되시나요? 성분 체크 및 대체 식품 추천을 즉시 받아보세요.
            </p>
          </div>
          <Link 
            href="/chat" 
            className="w-full py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-2xl font-bold text-xs flex items-center justify-center space-x-1 shadow-2xs mt-4"
          >
            <span>AI 챗봇에게 음식 물어보기</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* 자가 퀴즈 챌린지 */}
        <div className="p-6 bg-purple-50/40 border border-purple-100/50 rounded-3xl space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-[#6D3FA0] tracking-wider uppercase">DAILY CHALLENGE</span>
            <h3 className="text-sm font-bold text-[#6D3FA0]">만성질환 OX 퀴즈 챌린지</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              신장 기능 저하 예방과 혈당 혈압 조절을 위한 올바른 의학 생활 습관 상식을 퀴즈로 재미있게 테스트하고 콩당 포인트를 쌓으세요!
            </p>
          </div>
          <Link 
            href="/dashboard/quiz" 
            className="w-full py-3 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center space-x-1 shadow-sm mt-4"
          >
            <span>퀴즈 챌린지 풀기</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

    </div>
  );
}
