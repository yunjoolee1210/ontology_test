'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Users, ShieldAlert, CheckCircle2, ChevronRight, Activity, ArrowRight } from 'lucide-react';
import { CuteLogoIcon } from '../../components/layout/GNB';
import { supabase } from '../../lib/rag/supabaseClient';

type Role = 'patient' | 'caregiver' | 'researcher';
type Condition = 'kidney' | 'diabetes';

export default function HomeOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check login status on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        setIsLoggedIn(true);
        setUserId(user.id);
        
        // Try fetching existing profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, conditions')
          .eq('id', user.id)
          .single();

        if (profile) {
          setRole(profile.role as Role);
          setConditions(profile.conditions as Condition[]);
        }
      } else {
        // Load from localStorage if not logged in
        const savedProfile = localStorage.getItem('kongdang_profile');
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.role) setRole(parsed.role);
            if (parsed.conditions) setConditions(parsed.conditions);
          } catch (e) {
            console.error(e);
          }
        }
      }
    };
    checkUser();
  }, []);

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    setStep(2);
  };

  const toggleCondition = (condition: Condition) => {
    setConditions(prev => 
      prev.includes(condition) 
        ? prev.filter(c => c !== condition) 
        : [...prev, condition]
    );
  };

  const handleSave = async () => {
    if (!role) {
      alert('사용자 역할을 먼저 선택해 주세요.');
      setStep(1);
      return;
    }
    if (conditions.length === 0) {
      alert('적어도 하나의 관심 질환을 선택해 주세요.');
      return;
    }

    setLoading(true);
    const profileData = { role, conditions };

    try {
      // 1. LocalStorage 저장 (비로그인/로그인 공통)
      localStorage.setItem('kongdang_profile', JSON.stringify(profileData));

      // 2. 로그인 상태인 경우 Supabase 저장
      if (isLoggedIn && userId) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            role,
            conditions,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }
      
      // 저장 성공 후 챗봇 화면으로 이동
      router.push('/chat');
    } catch (e: any) {
      console.error(e);
      alert('설정 저장 중 오류가 발생했으나, 로컬 브라우저에 임시 저장되었습니다.');
      router.push('/chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-10 animate-fade-in px-4">
      {/* 로고 및 서비스 타이틀 */}
      <div className="text-center space-y-3 mb-10">
        <div className="p-3.5 rounded-3xl bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-xl inline-flex animate-pulse">
          <CuteLogoIcon size={36} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-800">
          콩당콩당에 오신 것을 환영합니다
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          만성 신장병(CKD)과 당뇨병(DM) 관리를 위한 최신 RAG 논문 검색 및 보건복지 혜택 안내를 한눈에 받아보세요.
        </p>
      </div>

      {/* 카드 스태퍼 */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 relative overflow-hidden">
        {/* 장식용 블러 레이어 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-100 rounded-full blur-3xl opacity-50"></div>

        {/* 단계 진행바 */}
        <div className="flex items-center justify-center space-x-3 mb-8 relative">
          <button 
            onClick={() => setStep(1)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === 1 ? 'bg-purple-700 text-white shadow-md' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
          >
            1
          </button>
          <div className={`w-12 h-0.5 rounded ${step === 2 ? 'bg-purple-700' : 'bg-slate-200'}`}></div>
          <button 
            disabled={!role}
            onClick={() => setStep(2)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === 2 ? 'bg-purple-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 disabled:opacity-50'}`}
          >
            2
          </button>
        </div>

        {/* Step 1: 역할 선택 */}
        {step === 1 && (
          <div className="space-y-6 relative animate-slide-right">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-800">Step 1. 당신은 누구신가요?</h2>
              <p className="text-xs text-slate-400 mt-1">개인 맞춤형 에이전트 구성을 위해 역할을 선택해 주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'patient', title: '환자', desc: '직접 수치를 보며 건강을 관리하고 정보를 탐색합니다.', icon: User, color: 'from-blue-500 to-indigo-600' },
                { id: 'caregiver', title: '간병인/보호자', desc: '환우를 곁에서 서포트하며 복지 혜택과 복약 정보를 탐색합니다.', icon: Users, color: 'from-purple-500 to-pink-600' },
                { id: 'researcher', title: '전문 연구자', desc: '의료진 및 연구원으로서 PubMed 논문 및 임상 자료를 분석합니다.', icon: Activity, color: 'from-emerald-500 to-teal-600' }
              ].map(item => {
                const Icon = item.icon;
                const isSelected = role === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleRoleSelect(item.id as Role)}
                    className={`p-6 rounded-2xl border text-left flex flex-col justify-between space-y-4 hover:shadow-lg transition-all duration-300 group cursor-pointer ${isSelected ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}
                  >
                    <div className={`p-3 rounded-xl bg-gradient-to-tr ${item.color} text-white shadow-md w-11 h-11 flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        {item.title}
                        {isSelected && <CheckCircle2 size={14} className="text-purple-600" />}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: 관심 질환 선택 */}
        {step === 2 && (
          <div className="space-y-6 relative animate-slide-left">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-800">Step 2. 관심 질환은 무엇인가요?</h2>
              <p className="text-xs text-slate-400 mt-1">관심 있으신 만성질환을 선택해 주세요 (복수 선택 가능).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'kidney', title: '신장병 (콩팥병)', desc: '만성 신부전, 투석, 산정특례 및 식단 관리 정보 매칭', details: '💧 사구체여과율(eGFR) 추적' },
                { id: 'diabetes', title: '당뇨병', desc: '혈당 조절, 당화혈색소, 당뇨병 합병증 연구 및 영양 정보 매칭', details: '🩸 인슐린 및 혈당 추적' }
              ].map(item => {
                const isSelected = conditions.includes(item.id as Condition);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleCondition(item.id as Condition)}
                    className={`p-6 rounded-2xl border text-left flex flex-col justify-between space-y-4 hover:shadow-lg transition-all duration-300 group cursor-pointer ${isSelected ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-600/20' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.details}
                      </span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'}`}>
                        {isSelected && <CheckCircle2 size={12} className="fill-white text-purple-600" />}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 하단 제어 버튼 */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                이전 단계로
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || conditions.length === 0}
                className="px-6 py-2.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '저장 중...' : '맞춤 설정 완료'}
                {!loading && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center items-center space-x-2 text-[10px] text-slate-400 mt-6 leading-relaxed">
        <ShieldAlert size={14} className="text-[#C0392B]" />
        <span>콩당콩당 서비스는 건강 관리 보조 목적으로만 사용되며 의료진의 진단을 대신하지 않습니다.</span>
      </div>
    </div>
  );
}
