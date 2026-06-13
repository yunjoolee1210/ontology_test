'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  HeartPulse, 
  Key, 
  Mail, 
  User, 
  ShieldAlert, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  UserCheck, 
  Compass, 
  ArrowLeft,
  Settings,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

type Step = 'account' | 'demographics' | 'creatinine' | 'diabetes_dialysis' | 'review';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);

  // 1. Account Info (Step 'account')
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Onboarding Profile Data
  const [gender, setGender] = useState('남성');
  const [age, setAge] = useState(60);
  const [height, setHeight] = useState(170);
  const [targetWeight, setTargetWeight] = useState(65);
  const [creatinine, setCreatinine] = useState(1.2);
  const [diabetesType, setDiabetesType] = useState('없음');
  const [dialysisType, setDialysisType] = useState('해당없음');
  const [medication, setMedication] = useState('식이조절만');
  const [otherConditions, setOtherConditions] = useState<string[]>([]);

  // Auth User ID reference after Step 1 signup
  const [createdUserId, setCreatedUserId] = useState<string>('');

  const toggleCondition = (cond: string) => {
    setOtherConditions(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  // Step 1: Sign up in Auth
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        setCreatedUserId(data.user.id);
        // Move to the next onboarding step
        setStep('demographics');
      } else {
        throw new Error('회원가입에 실패했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || '회원가입 중 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Calculations for review step
  const genderCoeff = gender === '여성' ? 0.742 : 1.0;
  const computedEgfr = Math.round(175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * genderCoeff);
  
  let calculatedStage = '1기';
  if (dialysisType !== '해당없음') {
    calculatedStage = '5기 (투석 환자)';
  } else {
    if (computedEgfr >= 90) calculatedStage = '1기';
    else if (computedEgfr >= 60) calculatedStage = '2기';
    else if (computedEgfr >= 45) calculatedStage = '3a기';
    else if (computedEgfr >= 30) calculatedStage = '3b기';
    else if (computedEgfr >= 15) calculatedStage = '4기';
    else calculatedStage = '5기(투석전)';
  }

  // Auto calculate intake limits based on stage & diabetes
  let calculatedSugar = diabetesType !== '없음' ? 30 : 50;
  let calculatedSodium = 2000;
  let calculatedPotassium = 3500;
  let calculatedPhosphorus = 1000;

  if (calculatedStage.includes('3') || calculatedStage.includes('4') || calculatedStage.includes('5') || calculatedStage.includes('투석')) {
    calculatedPotassium = 2000;
    calculatedPhosphorus = 800;
    if (calculatedStage.includes('4') || calculatedStage.includes('5') || calculatedStage.includes('투석')) {
      calculatedPotassium = 1500;
    }
  }

  // Step 5: Save Profile details & complete onboarding
  const handleOnboardingComplete = async () => {
    setLoading(true);
    const userIdToSave = createdUserId || (await supabase.auth.getUser()).data.user?.id;

    if (!userIdToSave) {
      alert('사용자 정보 세션이 만료되었습니다. 다시 시도해 주세요.');
      router.push('/auth/login');
      setLoading(false);
      return;
    }

    const completedProfile = {
      gender,
      age,
      height,
      target_weight: targetWeight,
      creatinine,
      egfr: computedEgfr,
      ckd_stage: calculatedStage,
      dialysis_type: dialysisType,
      diabetes_type: diabetesType,
      medication,
      other_conditions: otherConditions,
      limit_sugar: calculatedSugar,
      limit_sodium: calculatedSodium,
      limit_potassium: calculatedPotassium,
      limit_phosphorus: calculatedPhosphorus,
      name,
      email
    };

    try {
      // 1. Save to user_profiles table in Supabase
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userIdToSave,
          name,
          role: 'patient',
          ckd_stage: calculatedStage,
          dialysis_type: dialysisType,
          diabetes_type: diabetesType,
          medication,
          other_conditions: otherConditions,
          points: 120, // 가입 및 온보딩 보너스 포인트
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // 2. Save to localStorage
      localStorage.setItem('kongdang_profile', JSON.stringify(completedProfile));

      alert('가입과 온보딩 건강 프로필 등록이 모두 완료되었습니다! 개인 대시보드로 이동합니다.');
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      alert('프로필 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-6 animate-fade-in px-4 text-slate-800">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
        {/* 장식용 그라디언트 구 */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-100 rounded-full blur-3xl opacity-60"></div>

        {/* TOP STATUS PROGRESS */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 relative">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-md">
              <HeartPulse size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-800">콩당콩당 회원가입</h1>
              <p className="text-[10px] text-slate-400 font-semibold">간편 가입 & 질환 프로필 등록</p>
            </div>
          </div>

          {/* Stepper Progress Badges */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${step === 'account' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 'demographics' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 'creatinine' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 'diabetes_dialysis' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
            <span className={`w-2 h-2 rounded-full ${step === 'review' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
          </div>
        </div>

        {/* STEP 1: Account Registration */}
        {step === 'account' && (
          <form onSubmit={handleAccountSubmit} className="space-y-5 relative">
            <div className="text-center space-y-1">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center justify-center gap-1">
                <Sparkles size={16} className="text-[#6D3FA0]" />
                <span>가볍게 시작하는 회원가입</span>
              </h2>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                기본 계정 정보 입력 후, Perplexity Health 스타일의 개인 맞춤형 질환 프로필 온보딩이 진행됩니다.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">이름</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] focus:border-[#6D3FA0] focus:bg-white transition-all font-semibold"
                  />
                  <User size={14} className="text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">이메일 주소</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] focus:border-[#6D3FA0] focus:bg-white transition-all font-semibold"
                  />
                  <Mail size={14} className="text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">비밀번호</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8자 이상 입력해 주세요"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] focus:border-[#6D3FA0] focus:bg-white transition-all font-semibold"
                  />
                  <Key size={14} className="text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-2 text-[10px] text-slate-400 pt-1 leading-relaxed">
              <ShieldAlert size={14} className="text-[#C0392B] shrink-0 mt-0.5" />
              <span>가입 즉시 콩당콩당 서비스 이용약관 및 의학적 책임 한계 고지 사항에 동의하게 됩니다.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
            >
              <span>{loading ? '계정 생성 중...' : '다음 단계로 (프로필 등록)'}</span>
              <ArrowRight size={14} />
            </button>

            <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-4 flex justify-center space-x-2 font-semibold">
              <span>이미 계정이 있으신가요?</span>
              <Link href="/auth/login" className="font-bold text-[#6D3FA0] hover:underline">
                로그인
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: Demographics (Onboarding Part 1) */}
        {step === 'demographics' && (
          <div className="space-y-5 relative">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">ONBOARDING STEP 1/3</span>
              <h2 className="text-base font-extrabold text-slate-800">인적 및 신체 정보 등록</h2>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                성별과 연령은 eGFR(사구체여과율)을 계산하는 필수 변수입니다.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              {/* 성별 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">성별</label>
                <div className="grid grid-cols-2 gap-3">
                  {['남성', '여성'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2.5 px-4 border rounded-xl text-xs font-bold transition-all ${gender === g ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 나이 */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">나이 (세)</label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                />
              </div>

              {/* 키 & 목표 건체중 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">키 (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => setHeight(Math.max(100, parseInt(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">목표 건체중 (kg)</label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={e => setTargetWeight(Math.max(30, parseInt(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('creatinine')}
              className="w-full py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
            >
              <span>다음 단계 (검사지 정보 입력)</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 3: Serum Creatinine (Onboarding Part 2) */}
        {step === 'creatinine' && (
          <div className="space-y-5 relative">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">ONBOARDING STEP 2/3</span>
              <h2 className="text-base font-extrabold text-slate-800">최근 혈액검사 크레아티닌 수치</h2>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                최근 내과/검진에서 받은 혈청 크레아티닌(Creatinine) 수치를 입력해 주세요.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl text-[11px] text-slate-500 leading-relaxed space-y-1 font-medium">
                <span className="font-extrabold text-purple-800 block">💡 eGFR 자동 계산 안내</span>
                크레아티닌(Cr)과 나이, 성별 정보를 기반으로 한국인 신장 진료지침 표준 공식(MDRD)에 따라 사구체여과율(eGFR)을 계산하여 콩팥 단계를 판정합니다.
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">크레아티닌 수치 (mg/dL)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={creatinine}
                    onChange={e => setCreatinine(Math.max(0.1, parseFloat(e.target.value) || 0))}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                  />
                  <span className="text-xs font-bold text-slate-500">mg/dL</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('demographics')}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
              >
                <ArrowLeft size={14} />
                <span>이전</span>
              </button>
              <button
                onClick={() => setStep('diabetes_dialysis')}
                className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
              >
                <span>다음 단계 (질환 유형 선택)</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Diabetes & Dialysis (Onboarding Part 3) */}
        {step === 'diabetes_dialysis' && (
          <div className="space-y-5 relative">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">ONBOARDING STEP 3/3</span>
              <h2 className="text-base font-extrabold text-slate-800">당뇨병 및 치료 형태 등록</h2>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                동반 당뇨 질환 및 현재 진행 중인 투석 방법을 설정해 주세요.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              {/* 당뇨 유형 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500">당뇨 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {['없음', '1형', '2형'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiabetesType(d)}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${diabetesType === d ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {d === '없음' ? '해당없음' : `${d} 당뇨`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 투석 방법 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500">투석 여부 및 상태</label>
                <div className="grid grid-cols-2 gap-2">
                  {['해당없음', '혈액투석', '복막투석', '신장이식 후'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDialysisType(type)}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${dialysisType === type ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 당뇨 복약 상태 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500">당 조절 상태</label>
                <div className="flex flex-wrap gap-1.5">
                  {['식이조절만', '경구약', '인슐린', '경구약+인슐린'].map(med => (
                    <button
                      key={med}
                      type="button"
                      onClick={() => setMedication(med)}
                      className={`py-1.5 px-3 border rounded-xl text-xs font-bold transition-all ${medication === med ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {med}
                    </button>
                  ))}
                </div>
              </div>

              {/* 기타 질환 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500">기타 동반 합병증</label>
                <div className="grid grid-cols-2 gap-2">
                  {['고혈압', '고지혈증'].map(cond => {
                    const isSel = otherConditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        className={`py-2 px-3 border rounded-xl text-xs font-bold flex justify-between items-center transition-all ${isSel ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                      >
                        <span>{cond}</span>
                        <div className={`w-3.5 h-3.5 rounded-full border ${isSel ? 'bg-[#6D3FA0] border-[#6D3FA0]' : 'bg-white border-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('creatinine')}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
              >
                <ArrowLeft size={14} />
                <span>이전</span>
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
              >
                <span>검토 및 요약 확인</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Complete (Perplexity-Health summary) */}
        {step === 'review' && (
          <div className="space-y-5 relative text-left">
            <div className="text-center space-y-1">
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">분석 완료</span>
              <h2 className="text-base font-extrabold text-slate-800">신장 병기 & 섭취 제한량 제안</h2>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">
                제출하신 데이터를 분석하여 계산된 콩팥병 상태와 일일 영양소 권장량입니다.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              {/* eGFR & Stage badge */}
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-[#6D3FA0] block font-bold">MDRD 공식 자동 판정</span>
                  <h4 className="text-sm font-extrabold text-slate-850">신장 기능: eGFR {computedEgfr} mL/min</h4>
                </div>
                <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-purple-600 text-white shadow-2xs">
                  {calculatedStage}
                </span>
              </div>

              {/* Nutrition limits suggestions */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">설정된 일일 영양소 섭취 제한량</span>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] text-slate-400 block font-bold">당류</span>
                    <span className="font-extrabold text-slate-800">{calculatedSugar}g</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] text-slate-400 block font-bold">나트륨</span>
                    <span className="font-extrabold text-[#C0392B]">{calculatedSodium}mg</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] text-slate-400 block font-bold">칼륨</span>
                    <span className="font-extrabold text-purple-700">{calculatedPotassium}mg</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] text-slate-400 block font-bold">인</span>
                    <span className="font-extrabold text-indigo-700">{calculatedPhosphorus}mg</span>
                  </div>
                </div>
              </div>

              {/* Profiles Summary List */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">인적 프로필</span>
                  <span className="font-bold">{gender} | {age}세 | {height}cm | {targetWeight}kg (건체중)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">질환 및 조절</span>
                  <span className="font-bold">당뇨: {diabetesType !== '없음' ? `${diabetesType} (${medication})` : '해당없음'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">투석 요법</span>
                  <span className="font-bold">{dialysisType}</span>
                </div>
                {otherConditions.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">동반 합병 질환</span>
                    <span className="font-bold">{otherConditions.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('diabetes_dialysis')}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
              >
                <ArrowLeft size={14} />
                <span>이전</span>
              </button>
              <button
                onClick={handleOnboardingComplete}
                disabled={loading}
                className="flex-2 py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
              >
                <span>{loading ? '저장 중...' : '온보딩 완료 및 대시보드로 이동'}</span>
                <CheckCircle2 size={14} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
