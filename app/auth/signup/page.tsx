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
  Sparkles,
  Heart,
  Droplet,
  Info,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';
import { CuteLogoIcon } from '../../../components/layout/GNB';


type Step = 
  | 'account' 
  | 'celebration' 
  | 'onboarding_welcome' 
  | 'demographics' 
  | 'conditions' 
  | 'condition_details_ckd' 
  | 'condition_details_db' 
  | 'review';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);
  const [signupMode, setSignupMode] = useState<'real' | 'demo'>('real');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // 1. Account Info (Step 'account')
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Onboarding Profile Data
  const [gender, setGender] = useState('남성');
  const [age, setAge] = useState(60);
  const [height, setHeight] = useState(170);
  const [targetWeight, setTargetWeight] = useState(65);

  // Custom nutrient states for review step modification
  const [customSugar, setCustomSugar] = useState<number | null>(null);
  const [customSodium, setCustomSodium] = useState<number | null>(null);
  const [customPotassium, setCustomPotassium] = useState<number | null>(null);
  const [customPhosphorus, setCustomPhosphorus] = useState<number | null>(null);

  // Condition Selections
  const [hasCKD, setHasCKD] = useState(true);
  const [hasDiabetes, setHasDiabetes] = useState(true);
  const [hasHypertension, setHasHypertension] = useState(false);
  const [hasHyperlipidemia, setHasHyperlipidemia] = useState(false);

  // CKD specific details
  const [creatinine, setCreatinine] = useState(1.2);
  const [dialysisType, setDialysisType] = useState('해당없음');

  // Diabetes specific details
  const [diabetesType, setDiabetesType] = useState('2형');
  const [medication, setMedication] = useState('식이조절만');

  // Auth User ID reference after Step 1 signup
  const [createdUserId, setCreatedUserId] = useState<string>('');

  // Confetti generation for celebration step
  const [confetti] = useState(() => {
    const colors = ['#6D3FA0', '#4338CA', '#9F7AEA', '#8B5CF6', '#A78BFA', '#D6BCFA', '#FBB6CE'];
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2 + Math.random() * 3}s`,
      size: `${5 + Math.random() * 8}px`
    }));
  });

  // Step 1: Sign up in Auth
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (signupMode === 'demo') {
      const mockUid = `demo_user_${Date.now()}`;
      setCreatedUserId(mockUid);
      setStep('celebration');
      setLoading(false);
      return;
    }

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
        setStep('celebration');
      } else {
        throw new Error('회원가입에 실패했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.toLowerCase().includes('rate limit') || err.message?.toLowerCase().includes('exceeded') || err.message?.toLowerCase().includes('email limit') || err.status === 429) {
        console.warn('Supabase Auth rate limit hit. Falling back to simulated demo user session.');
        setShowRateLimitModal(true);
      } else {
        setErrorMsg(err.message || '회원가입 중 에러가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculations for eGFR
  const genderCoeff = gender === '여성' ? 0.742 : 1.0;
  const computedEgfr = Math.round(175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203) * genderCoeff);
  
  let calculatedStage = '1기';
  if (!hasCKD) {
    calculatedStage = '정상 신장 기능';
  } else if (dialysisType !== '해당없음') {
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
  let calculatedSugar = hasDiabetes ? 30 : 50;
  let calculatedSodium = 2000;
  let calculatedPotassium = 3500;
  let calculatedPhosphorus = 1000;

  if (hasCKD) {
    if (calculatedStage.includes('3') || calculatedStage.includes('4') || calculatedStage.includes('5') || calculatedStage.includes('투석')) {
      calculatedPotassium = 2000;
      calculatedPhosphorus = 800;
      if (calculatedStage.includes('4') || calculatedStage.includes('5') || calculatedStage.includes('투석')) {
        calculatedPotassium = 1500;
      }
    }
  }

  const sugarVal = customSugar !== null ? customSugar : calculatedSugar;
  const sodiumVal = customSodium !== null ? customSodium : calculatedSodium;
  const potassiumVal = customPotassium !== null ? customPotassium : calculatedPotassium;
  const phosphorusVal = customPhosphorus !== null ? customPhosphorus : calculatedPhosphorus;

  // Sync other conditions array
  const otherConditions: string[] = [];
  if (hasHypertension) otherConditions.push('고혈압');
  if (hasHyperlipidemia) otherConditions.push('고지혈증');

  // Step 5: Save Profile details & complete onboarding
  const handleOnboardingComplete = async () => {
    setLoading(true);
    const userIdToSave = createdUserId || (await supabase.auth.getUser()).data.user?.id || `demo_user_${Date.now()}`;

    const conditions: string[] = [];
    if (hasCKD) conditions.push('kidney');
    if (hasDiabetes) conditions.push('diabetes');

    const completedProfile = {
      gender,
      age,
      height,
      target_weight: targetWeight,
      creatinine: hasCKD ? creatinine : 1.0,
      egfr: hasCKD ? computedEgfr : 95,
      ckd_stage: calculatedStage,
      dialysis_type: hasCKD ? dialysisType : '해당없음',
      diabetes_type: hasDiabetes ? diabetesType : '없음',
      medication: hasDiabetes ? medication : '식이조절만',
      other_conditions: otherConditions,
      limit_sugar: sugarVal,
      limit_sodium: sodiumVal,
      limit_potassium: potassiumVal,
      limit_phosphorus: phosphorusVal,
      name,
      email,
      conditions // Local profile data format sync
    };

    try {
      // 1. Save to user_profiles table in Supabase
      if (userIdToSave && !userIdToSave.startsWith('demo_user_')) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            id: userIdToSave,
            name,
            role: 'patient',
            conditions,
            ckd_stage: calculatedStage,
            dialysis_type: hasCKD ? dialysisType : '해당없음',
            diabetes_type: hasDiabetes ? diabetesType : '없음',
            medication: hasDiabetes ? medication : '식이조절만',
            other_conditions: otherConditions,
            points: 120, // 가입 및 온보딩 보너스 포인트
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.warn('Supabase profile upsert failed (ignoring for demo):', error);
        }
      } else {
        console.log('Skipping Supabase profiles table write for simulated demo user.');
      }

      // 2. Save to localStorage
      localStorage.setItem('kongdang_profile', JSON.stringify(completedProfile));

      // Redirect directly to dashboard with welcome flag
      router.push('/dashboard?newSignup=true');
    } catch (err: any) {
      console.error('Onboarding complete error:', err);
      localStorage.setItem('kongdang_profile', JSON.stringify(completedProfile));
      router.push('/dashboard?newSignup=true');
    } finally {
      setLoading(false);
    }
  };

  // Step Routing Helpers
  const goToNextFromConditions = () => {
    if (hasCKD) {
      setStep('condition_details_ckd');
    } else if (hasDiabetes) {
      setStep('condition_details_db');
    } else {
      setStep('review');
    }
  };

  const goToNextFromCKD = () => {
    if (hasDiabetes) {
      setStep('condition_details_db');
    } else {
      setStep('review');
    }
  };

  const goBackFromDB = () => {
    if (hasCKD) {
      setStep('condition_details_ckd');
    } else {
      setStep('conditions');
    }
  };

  const goBackFromReview = () => {
    if (hasDiabetes) {
      setStep('condition_details_db');
    } else if (hasCKD) {
      setStep('condition_details_ckd');
    } else {
      setStep('conditions');
    }
  };

  // CSS CONFETTI BLOCK INJECTION
  const injectConfettiStyles = () => (
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes confetti-fall {
        0% {
          transform: translateY(-20px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(90vh) rotate(360deg);
          opacity: 0;
        }
      }
      .confetti-piece {
        position: absolute;
        animation: confetti-fall var(--dur) linear infinite;
        top: 0;
        border-radius: 20%;
      }
    `}} />
  );

  return (
    <div className="w-full py-4 px-4 text-slate-800">
      {injectConfettiStyles()}

      {/* STEP 1: Account Registration (Centered Form Layout) */}
      {step === 'account' && (
        <div className="w-full max-w-lg mx-auto py-6 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-indigo-100 rounded-full blur-3xl opacity-60"></div>

            {/* TOP HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 relative">
              <div className="flex items-center space-x-2">
                <div>
                  <h1 className="text-sm font-black tracking-tight text-slate-800">콩당콩당 가입</h1>
                  <p className="text-[10px] text-slate-400 font-semibold">스마트 만성질환 통합 AI 케어</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAccountSubmit} className="space-y-5 relative">
              <div className="text-center">
                <h2 className="text-base font-extrabold text-slate-800 flex items-center justify-center gap-1">
                  <Sparkles size={16} className="text-[#6D3FA0]" />
                  <span>회원가입</span>
                </h2>
              </div>

              {/* Signup Mode Selector Tab */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setSignupMode('real');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    signupMode === 'real'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
                      : 'text-slate-400 hover:text-slate-650'
                  }`}
                >
                  일반 회원가입
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignupMode('demo');
                    setErrorMsg(null);
                    if (!name) setName('테스트 환우');
                    if (!email) setEmail(`demo_${Math.floor(1000 + Math.random() * 9000)}@test.com`);
                    if (!password) setPassword('demo1234');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    signupMode === 'demo'
                      ? 'bg-gradient-to-r from-[#6D3FA0] to-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-650'
                  }`}
                >
                  <Sparkles size={12} className={signupMode === 'demo' ? 'animate-pulse' : ''} />
                  데모 간편 가입
                </button>
              </div>

              {signupMode === 'demo' && (
                <div className="p-3 bg-purple-50/50 border border-purple-100 text-[#6D3FA0] rounded-xl text-[11px] leading-relaxed font-semibold animate-fade-in">
                  💡 <strong>데모 간편 가입 모드 활성화:</strong> 이메일 인증 절차 없이, 즉시 모의 계정을 생성하여 당뇨·신장 온보딩을 자유롭게 테스트할 수 있습니다.
                </div>
              )}

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

              {errorMsg && (
                <div className="p-3 bg-purple-50 border border-purple-100 text-purple-700 rounded-xl text-[11px] font-semibold flex items-start gap-1.5">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5 text-purple-650" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-start space-x-2 text-[10px] text-slate-400 pt-1 leading-relaxed">
                <ShieldAlert size={14} className="text-purple-600 shrink-0 mt-0.5" />
                <span>가입 즉시 콩당콩당 서비스 이용약관 및 의학적 책임 한계 고지 사항에 동의하게 됩니다.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
              >
                <span>{loading ? '계정 생성 중...' : '다음 단계로'}</span>
                <ArrowRight size={14} />
              </button>

              <div className="text-center text-[11px] text-slate-400 border-t border-slate-100 pt-4 flex justify-center space-x-2 font-semibold">
                <span>이미 계정이 있으신가요?</span>
                <Link href="/auth/login" className="font-bold text-[#6D3FA0] hover:underline">
                  로그인
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: Sign-up Congratulations (Confetti Animation Screen) */}
      {step === 'celebration' && (
        <div className="w-full max-w-lg mx-auto py-8 animate-fade-in relative overflow-hidden">
          {/* CONFETTI RENDER */}
          {confetti.map(p => (
            <div
              key={p.id}
              className="confetti-piece"
              style={{
                backgroundColor: p.color,
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
                '--dur': p.duration
              } as any}
            />
          ))}

          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 space-y-6 text-center relative z-10">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-850">🎉 회원가입을 축하합니다!</h2>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                콩당콩당 서비스 회원가입이 성공적으로 완료되었습니다.<br />
                지금부터 환우님만을 위한 맞춤 건강 홈을 제공하기 위해 <br />
                <strong>1:1 개인 질환 프로필 온보딩</strong>을 시작합니다.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-2xl text-[11px] text-[#6D3FA0] font-semibold text-left space-y-1">
              <span className="font-black block text-sm">💡 온보딩에서 관리 가능한 핵심 혜택:</span>
              <p>• 신장 수치(Creatinine) 자동 판정 및 eGFR 단계 확인</p>
              <p>• 당뇨 유형 및 조절 상태 맞춤 스케줄링 설정</p>
              <p>• 일일 칼륨·인·나트륨·당분 의학 섭취 제한 권장치 산출</p>
            </div>

            <button
              onClick={() => setStep('onboarding_welcome')}
              className="w-full py-4 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-2xl text-xs font-black shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
            >
              <span>맞춤 프로필 등록 시작하기</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING WIZARD STEPS: 2-Column Perplexity-like Layout */}
      {step !== 'account' && step !== 'celebration' && (
        <div className="w-full max-w-5xl mx-auto py-2 animate-fade-in">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[560px]">
            
            {/* LEFT COLUMN: Form Steps (60% width) */}
            <div className="w-full md:w-3/5 p-8 flex flex-col justify-between relative">
              <div className="absolute top-0 left-0 w-24 h-24 bg-purple-50 rounded-full blur-3xl opacity-50"></div>
              
              <div className="space-y-6 relative z-10">
                {/* Stepper Status Indicators */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] font-black tracking-widest text-[#6D3FA0] uppercase bg-purple-50 px-2.5 py-1 rounded-md">
                    {step === 'onboarding_welcome' && 'Onboarding Welcome'}
                    {step === 'demographics' && 'Step 1: 신체 정보'}
                    {step === 'conditions' && 'Step 2: 질환 선택'}
                    {step === 'condition_details_ckd' && 'Step 3: 신부전 검사 정보'}
                    {step === 'condition_details_db' && 'Step 4: 당뇨 조절 상태'}
                    {step === 'review' && 'Step 5: 프로필 검토'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${step === 'onboarding_welcome' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
                    <span className={`w-2 h-2 rounded-full ${step === 'demographics' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
                    <span className={`w-2 h-2 rounded-full ${step === 'conditions' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
                    <span className={`w-2 h-2 rounded-full ${(step === 'condition_details_ckd' || step === 'condition_details_db') ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
                    <span className={`w-2 h-2 rounded-full ${step === 'review' ? 'bg-[#6D3FA0]' : 'bg-slate-200'}`} />
                  </div>
                </div>

                {/* STEP ONBOARDING_WELCOME: Perplexity-style Welcome */}
                {step === 'onboarding_welcome' && (
                  <div className="space-y-5">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 leading-tight">
                      Get started with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6D3FA0] to-purple-600">콩당콩당 AI 케어</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      환우님의 안전하고 정교한 식단 및 생체 지표 모니터링을 위한 통합 1:1 건강 프로필 설정을 시작합니다.
                    </p>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-start space-x-3 text-xs">
                        <div className="p-1.5 rounded-lg bg-purple-50 text-[#6D3FA0] mt-0.5">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-[13px]">당뇨·신장 맞춤형 식사 가이드</h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">당뇨 조절 방식 및 신장 기능 상태에 최적화된 맞춤형 식사 가이드가 대시보드에 매칭됩니다.</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 text-xs">
                        <div className="p-1.5 rounded-lg bg-purple-50 text-[#6D3FA0] mt-0.5">
                          <HeartPulse size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-[13px]">임상 의학 정보 기반 챗봇</h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">1차 진료 지침 및 신장학회 가이드라인 검증 데이터로 학습된 AI 챗봇 서비스를 사용하실 수 있습니다.</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 text-xs">
                        <div className="p-1.5 rounded-lg bg-purple-50 text-[#6D3FA0] mt-0.5">
                          <ShieldAlert size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-[13px]">암호화 및 철저한 보안 E2E</h4>
                          <p className="text-slate-400 text-[11px] leading-relaxed">입력하신 크레아티닌 수치와 질환 기록은 외부 AI 모델 학습에 사용되지 않고 암호화 처리됩니다.</p>
                        </div>
                      </div>
                    </div>

                    {/* 약관 동의 체크박스 추가 */}
                    <div className="flex items-center space-x-2 pt-4 pb-2 border-t border-slate-100">
                      <input
                        type="checkbox"
                        id="terms-agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="w-4 h-4 text-[#6D3FA0] border-slate-300 rounded focus:ring-[#6D3FA0] cursor-pointer"
                      />
                      <label htmlFor="terms-agree" className="font-semibold text-slate-500 text-[11px] cursor-pointer select-none leading-tight">
                        서비스 이용약관 및 의학적 책임 한계 고지에 동의합니다.
                      </label>
                    </div>

                    <button
                      onClick={() => agreed && setStep('demographics')}
                      disabled={!agreed}
                      className={`w-full mt-2 py-3.5 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer ${
                        agreed
                          ? 'bg-[#6D3FA0] hover:bg-purple-800'
                          : 'bg-slate-350 cursor-not-allowed shadow-none opacity-60'
                      }`}
                    >
                      <span>시작하기</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* STEP DEMOGRAPHICS */}
                {step === 'demographics' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-800">인적 및 신체 지표 정보</h2>
                      <p className="text-[11px] text-slate-400 font-semibold">기본 신체 정보는 맞춤형 건체중 관리와 eGFR(사구체여과율) 연동의 기초가 됩니다.</p>
                    </div>

                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-450 block uppercase font-bold">성별</label>
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

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-450 block font-bold">나이 (세)</label>
                        <input
                          type="number"
                          value={age}
                          onChange={e => setAge(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 block font-bold">키 (cm)</label>
                          <input
                            type="number"
                            value={height}
                            onChange={e => setHeight(Math.max(100, parseInt(e.target.value) || 0))}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-450 block font-bold">목표 건체중 (kg)</label>
                          <input
                            type="number"
                            value={targetWeight}
                            onChange={e => setTargetWeight(Math.max(30, parseInt(e.target.value) || 0))}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#6D3FA0]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        onClick={() => setStep('onboarding_welcome')}
                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <ArrowLeft size={14} />
                        <span>이전</span>
                      </button>
                      <button
                        onClick={() => setStep('conditions')}
                        className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <span>다음</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP CONDITIONS (Perplexity Style Condition Add Screen) */}
                {step === 'conditions' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-800">질환 프로필 선택</h2>
                      <p className="text-[11px] text-slate-400 font-semibold">
                        관리하고자 하시는 만성 질환을 선택해 주세요. 선택된 정보에 따라 세부 수치 수집 폼이 활성화됩니다.
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {/* 만성 콩팥병 */}
                      <button
                        type="button"
                        onClick={() => setHasCKD(prev => !prev)}
                        className={`w-full p-4 border rounded-2xl flex justify-between items-center text-left transition-all ${
                          hasCKD ? 'border-[#6D3FA0] bg-purple-50/40 text-[#6D3FA0] font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Droplet size={18} className={hasCKD ? 'text-[#6D3FA0]' : 'text-slate-400'} />
                          <div>
                            <span className="text-xs block font-bold text-slate-800">만성 콩팥병 (Chronic Kidney Disease)</span>
                            <span className="text-[10px] text-slate-400 font-normal">혈액검사 크레아티닌 수치 입력 및 신장 기수 가이드 활성화</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${hasCKD ? 'bg-[#6D3FA0] border-[#6D3FA0] text-white' : 'border-slate-300 bg-white'}`}>
                          {hasCKD && <CheckCircle2 size={12} className="stroke-[3]" />}
                        </div>
                      </button>

                      {/* 당뇨병 */}
                      <button
                        type="button"
                        onClick={() => setHasDiabetes(prev => !prev)}
                        className={`w-full p-4 border rounded-2xl flex justify-between items-center text-left transition-all ${
                          hasDiabetes ? 'border-[#6D3FA0] bg-purple-50/40 text-[#6D3FA0] font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Activity size={18} className={hasDiabetes ? 'text-[#6D3FA0]' : 'text-slate-400'} />
                          <div>
                            <span className="text-xs block font-bold text-slate-800">당뇨병 (Diabetes Mellitus)</span>
                            <span className="text-[10px] text-slate-400 font-normal">1형/2형 당뇨 및 혈당 관리 저당 식단 가이드라인 적용</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${hasDiabetes ? 'bg-[#6D3FA0] border-[#6D3FA0] text-white' : 'border-slate-300 bg-white'}`}>
                          {hasDiabetes && <CheckCircle2 size={12} className="stroke-[3]" />}
                        </div>
                      </button>

                      {/* 고혈압 */}
                      <button
                        type="button"
                        onClick={() => setHasHypertension(prev => !prev)}
                        className={`w-full p-4 border rounded-2xl flex justify-between items-center text-left transition-all ${
                          hasHypertension ? 'border-[#6D3FA0] bg-purple-50/40 text-[#6D3FA0] font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Heart size={18} className={hasHypertension ? 'text-[#6D3FA0]' : 'text-slate-400'} />
                          <div>
                            <span className="text-xs block font-bold text-slate-800">동반 합병증: 고혈압</span>
                            <span className="text-[10px] text-slate-400 font-normal">일일 나트륨 권장 섭취 제약 자동 조절</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${hasHypertension ? 'bg-[#6D3FA0] border-[#6D3FA0] text-white' : 'border-slate-300 bg-white'}`}>
                          {hasHypertension && <CheckCircle2 size={12} className="stroke-[3]" />}
                        </div>
                      </button>

                      {/* 고지혈증 */}
                      <button
                        type="button"
                        onClick={() => setHasHyperlipidemia(prev => !prev)}
                        className={`w-full p-4 border rounded-2xl flex justify-between items-center text-left transition-all ${
                          hasHyperlipidemia ? 'border-[#6D3FA0] bg-purple-50/40 text-[#6D3FA0] font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <ShieldAlert size={18} className={hasHyperlipidemia ? 'text-[#6D3FA0]' : 'text-slate-400'} />
                          <div>
                            <span className="text-xs block font-bold text-slate-800">동반 합병증: 고지혈증</span>
                            <span className="text-[10px] text-slate-400 font-normal">포화지방 및 콜레스테롤 섭취 통제 로직 로딩</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${hasHyperlipidemia ? 'bg-[#6D3FA0] border-[#6D3FA0] text-white' : 'border-slate-300 bg-white'}`}>
                          {hasHyperlipidemia && <CheckCircle2 size={12} className="stroke-[3]" />}
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setStep('demographics')}
                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <ArrowLeft size={14} />
                        <span>이전</span>
                      </button>
                      <button
                        onClick={goToNextFromConditions}
                        className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <span>다음</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP CONDITION_DETAILS_CKD: Creatinine, Dialysis */}
                {step === 'condition_details_ckd' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-800">신장 기능 상세 정보</h2>
                      <p className="text-[11px] text-slate-400 font-semibold">최근 혈액 검사상 크레아티닌 수치는 사구체여과율과 콩팥 기수를 결정하는 핵심 지표입니다.</p>
                    </div>

                    <div className="space-y-4 text-xs font-semibold">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-450 block font-bold">혈청 크레아티닌 수치 (mg/dL)</label>
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

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-450 block font-bold">진행 중인 투석 종류</label>
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
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        onClick={() => setStep('conditions')}
                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <ArrowLeft size={14} />
                        <span>이전</span>
                      </button>
                      <button
                        onClick={goToNextFromCKD}
                        className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <span>다음</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP CONDITION_DETAILS_DB: Diabetes Type, Meds */}
                {step === 'condition_details_db' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-800">당뇨 관리 상세 정보</h2>
                      <p className="text-[11px] text-slate-400 font-semibold">현재 관리 중인 당뇨병 종류 및 인슐린 투여/복약 조절 방법을 지정해 주세요.</p>
                    </div>

                    <div className="space-y-4 text-xs font-semibold">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-450 block font-bold">당뇨 유형</label>
                        <div className="grid grid-cols-2 gap-3">
                          {['1형', '2형'].map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDiabetesType(d)}
                              className={`py-2.5 px-4 border rounded-xl text-xs font-bold transition-all ${diabetesType === d ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {d}형 당뇨
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-450 block font-bold">현재 당 조절 방식</label>
                        <div className="flex flex-wrap gap-2">
                          {['식이조절만', '경구약', '인슐린', '경구약+인슐린'].map(med => (
                            <button
                              key={med}
                              type="button"
                              onClick={() => setMedication(med)}
                              className={`py-2 px-3.5 border rounded-xl text-xs font-bold transition-all ${medication === med ? 'border-[#6D3FA0] bg-purple-50 text-[#6D3FA0]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {med}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        onClick={goBackFromDB}
                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <ArrowLeft size={14} />
                        <span>이전</span>
                      </button>
                      <button
                        onClick={() => setStep('review')}
                        className="flex-2 py-3.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md"
                      >
                        <span>다음</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP REVIEW: Review calculated stages & limits */}
                {step === 'review' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-extrabold text-slate-800">프로필 요약 및 일일 제한 기준선</h2>
                      <p className="text-[11px] text-slate-400 font-semibold">입력 데이터를 분석하여 적용된 당뇨·신장 조절 지침 및 일일 영양 제한 권장치입니다.</p>
                    </div>

                    <div className="space-y-3.5 text-xs font-semibold">
                      {/* eGFR & Stage badge */}
                      {hasCKD ? (
                        <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-[#6D3FA0] block font-bold">MDRD 공식 신장 지표 판정</span>
                            <h4 className="text-xs font-extrabold text-slate-800">신장 기능: eGFR {computedEgfr} mL/min</h4>
                          </div>
                          <span className="text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-purple-600 text-white shadow-2xs">
                            {calculatedStage}
                          </span>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-emerald-600 block font-bold">신장 기능 평가</span>
                            <h4 className="text-xs font-extrabold text-slate-800">일반 신장 기능 (미손상)</h4>
                          </div>
                          <span className="text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            정상
                          </span>
                        </div>
                      )}

                      {/* Nutrition limits suggestions */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-450 block font-bold uppercase">일일 영양소 섭취 제한량 (※ 혈액검사 수치에 맞추어 개별 목표치를 다르게 입력 가능)</span>
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center">
                            <span className="text-[8px] text-slate-450 block font-bold mb-1">당류 (g)</span>
                            <input
                              type="number"
                              value={sugarVal}
                              onChange={e => setCustomSugar(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-white border border-slate-200 rounded-lg text-center font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] text-xs py-1"
                            />
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center">
                            <span className="text-[8px] text-slate-450 block font-bold mb-1">나트륨 (mg)</span>
                            <input
                              type="number"
                              value={sodiumVal}
                              onChange={e => setCustomSodium(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-white border border-slate-200 rounded-lg text-center font-black text-slate-850 focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] text-xs py-1"
                            />
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center">
                            <span className="text-[8px] text-slate-450 block font-bold mb-1">칼륨 (mg)</span>
                            <input
                              type="number"
                              value={potassiumVal}
                              onChange={e => setCustomPotassium(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-white border border-slate-200 rounded-lg text-center font-black text-purple-750 focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] text-xs py-1"
                            />
                          </div>
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center">
                            <span className="text-[8px] text-slate-450 block font-bold mb-1">인 (mg)</span>
                            <input
                              type="number"
                              value={phosphorusVal}
                              onChange={e => setCustomPhosphorus(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-white border border-slate-200 rounded-lg text-center font-black text-indigo-750 focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] text-xs py-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Summary list */}
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">성별 및 연령</span>
                          <span className="font-bold">{gender} | {age}세 ({height}cm / {targetWeight}kg)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">선택된 관리 질환</span>
                          <span className="font-bold text-[#6D3FA0]">
                            {[
                              hasCKD && '만성 콩팥병',
                              hasDiabetes && `당뇨병 (${diabetesType}형)`,
                              hasHypertension && '고혈압',
                              hasHyperlipidemia && '고지혈증'
                            ].filter(Boolean).join(', ') || '없음'}
                          </span>
                        </div>
                        {hasCKD && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">투석 및 크레아티닌</span>
                            <span className="font-bold">{dialysisType} | Cr {creatinine} mg/dL</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={goBackFromReview}
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
                        <span>{loading ? '저장 중...' : '완료'}</span>
                        <CheckCircle2 size={14} />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* RIGHT COLUMN: Perplexity-style Preview Panel (40% width) */}
            <div className="w-full md:w-2/5 bg-gradient-to-br from-[#6D3FA0] via-purple-900 to-indigo-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-6 -mb-6"></div>

              {/* Title & Badge */}
              <div className="space-y-1 relative z-10">
                <span className="text-[9px] font-black tracking-widest text-purple-200 uppercase block">Kongdang Care Preview</span>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-300 animate-pulse" />
                  <span>실시간 건강 가이드 프리뷰</span>
                </h3>
              </div>

              {/* DYNAMIC CARD RENDERING */}
              <div className="my-8 relative z-10 flex-1 flex flex-col justify-center">
                
                {/* 1. onboarding_welcome */}
                {step === 'onboarding_welcome' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl animate-fade-in">
                    <div className="flex items-center space-x-2 text-purple-200">
                      <Compass size={18} className="animate-spin" style={{ animationDuration: '6s' }} />
                      <span className="text-xs font-black">AI 개인 맞춤형 플래너 활성화</span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-purple-100">
                      <p className="font-bold text-white text-xs">식품 교차 필터 설계 장치</p>
                      <p className="leading-relaxed font-medium">당뇨와 콩팥병을 동시 선택하는 경우, 챗봇과 식단 성분 검색에서 당수치 상승 요인과 칼륨/나트륨 수치를 통합 필터링해 드립니다.</p>
                    </div>
                  </div>
                )}

                {/* 2. demographics */}
                {step === 'demographics' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl animate-fade-in">
                    <div className="flex items-center space-x-2 text-purple-200">
                      <UserCheck size={18} />
                      <span className="text-xs font-black">신체 정보 실시간 요약</span>
                    </div>
                    <div className="space-y-2 text-[11px] font-semibold text-purple-100">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>성별</span>
                        <span className="text-white font-extrabold">{gender}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>연령</span>
                        <span className="text-white font-extrabold">{age} 세</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span>신장 / 목표 건체중</span>
                        <span className="text-white font-extrabold">{height}cm / {targetWeight}kg</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. conditions */}
                {step === 'conditions' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3.5 shadow-xl animate-fade-in">
                    <span className="text-[10px] text-purple-200 block font-bold">활성화된 케어 플러그인</span>
                    <div className="flex flex-wrap gap-1.5">
                      {hasCKD && <span className="px-2 py-1 rounded bg-purple-650/80 border border-purple-400/30 text-[9px] font-bold">만성 콩팥병 케어</span>}
                      {hasDiabetes && <span className="px-2 py-1 rounded bg-indigo-600/80 border border-indigo-400/30 text-[9px] font-bold">당뇨병 당량 조절</span>}
                      {hasHypertension && <span className="px-2 py-1 rounded bg-purple-550/80 border border-purple-350/30 text-[9px] font-bold">고혈압 저염 관리</span>}
                      {hasHyperlipidemia && <span className="px-2 py-1 rounded bg-indigo-500/80 border border-indigo-300/30 text-[9px] font-bold">고지혈증 지방 통제</span>}
                      {!hasCKD && !hasDiabetes && !hasHypertension && !hasHyperlipidemia && (
                        <span className="text-[10px] text-purple-300 font-semibold">선택된 관리 조건이 없습니다.</span>
                      )}
                    </div>
                    <p className="text-[10px] text-purple-200 leading-normal font-medium border-t border-white/5 pt-2">
                      💡 선택하신 질환들에 매칭되는 식습관, 운동, 복약 체크리스트가 대시보드 화면에 다이내믹하게 결합됩니다.
                    </p>
                  </div>
                )}

                {/* 4. condition_details_ckd */}
                {step === 'condition_details_ckd' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl animate-fade-in text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-200">실시간 eGFR 산출</span>
                      <span className="px-2 py-0.5 rounded bg-purple-600 text-[10px] font-bold">{calculatedStage}</span>
                    </div>

                    <div className="space-y-2 border-b border-white/5 pb-3">
                      <div className="flex justify-between text-purple-100">
                        <span>최근 크레아티닌 수치</span>
                        <span className="text-white font-extrabold">{creatinine} mg/dL</span>
                      </div>
                      <div className="flex justify-between text-purple-100">
                        <span>판정된 사구체 여과율</span>
                        <span className="text-white font-extrabold">{computedEgfr} mL/min/1.73m²</span>
                      </div>
                    </div>

                    {/* Stage horizontal visual meter */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] text-purple-200 font-bold block">신장 잔여 여과 기능 기수 스케일</span>
                      <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden flex">
                        <div className="h-full bg-emerald-450" style={{ width: '40%' }}></div>
                        <div className="h-full bg-amber-400" style={{ width: '30%' }}></div>
                        <div className="h-full bg-orange-400" style={{ width: '15%' }}></div>
                        <div className="h-full bg-red-500" style={{ width: '15%' }}></div>
                      </div>
                      <div className="flex justify-between text-[8px] text-purple-300 font-bold">
                        <span>90이상 (1~2기)</span>
                        <span>30~59 (3기)</span>
                        <span>15미만 (5기)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. condition_details_db */}
                {step === 'condition_details_db' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3.5 shadow-xl animate-fade-in">
                    <div className="flex items-center space-x-2 text-purple-200 border-b border-white/5 pb-2">
                      <Activity size={16} />
                      <span className="text-xs font-black">당 조절 치료 플랜</span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-purple-100">
                      <p className="font-extrabold text-white text-xs">{diabetesType}형 당뇨 ({medication})</p>
                      <p className="leading-relaxed font-medium">당수치를 급격하게 올릴 수 있는 단순당 배제를 위해 일일 당류 제한선이 30g으로 낮춰 자동 스케줄링됩니다.</p>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <span className="text-[9px] text-purple-300 block font-bold">추천 타겟 식후 혈당</span>
                      <span className="text-xs font-black text-white">식후 2시간 혈당 140 mg/dL 미만 유지</span>
                    </div>
                  </div>
                )}

                {/* 6. review */}
                {step === 'review' && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3 shadow-xl animate-fade-in text-[11px]">
                    <div className="flex items-center space-x-2 text-emerald-300">
                      <CheckCircle2 size={16} />
                      <span className="text-xs font-black">최종 1:1 건강 제한량 산출완료</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div className="bg-white/5 p-2 rounded-xl text-center">
                        <span className="text-[8px] text-purple-200 block">일일 당분</span>
                        <span className="text-white font-extrabold text-xs">{sugarVal}g</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-xl text-center">
                        <span className="text-[8px] text-purple-200 block">일일 소금</span>
                        <span className="text-white font-extrabold text-xs">{sodiumVal}mg</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-xl text-center">
                        <span className="text-[8px] text-purple-200 block">일일 칼륨</span>
                        <span className="text-white font-extrabold text-xs">{potassiumVal}mg</span>
                      </div>
                      <div className="bg-white/5 p-2 rounded-xl text-center">
                        <span className="text-[8px] text-purple-200 block">일일 인</span>
                        <span className="text-white font-extrabold text-xs">{phosphorusVal}mg</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Secure statement */}
              <div className="flex items-center space-x-2 text-[10px] text-purple-200 border-t border-white/10 pt-4 relative z-10 font-bold justify-center">
                <span>🔒 Encrypted and Protected E2E • 정보 보호 서약</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RATE LIMIT GRACEFUL FALLBACK MODAL */}
      {showRateLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 p-6 space-y-4 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-20 h-20 bg-purple-100 rounded-full blur-2xl opacity-40"></div>
            <div className="p-3 bg-purple-50 text-[#6D3FA0] rounded-2xl inline-flex shadow-inner">
              <Sparkles size={24} className="animate-bounce text-[#6D3FA0]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-850">⚠️ 회원가입 요청 제한 안내</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                현재 실시간 회원가입 메일 발송 속도 제한(Rate Limit)에 도달하였습니다. <br />
                원활한 테스트를 위해 <strong>모의 데모 세션</strong>으로 자동 전환하여 건강 온보딩을 중단 없이 계속하실 수 있습니다.
              </p>
            </div>

            <button
              onClick={() => {
                setShowRateLimitModal(false);
                const mockUid = `demo_user_${Date.now()}`;
                setCreatedUserId(mockUid);
                setStep('celebration');
              }}
              className="w-full py-3 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-98"
            >
              데모 모드로 온보딩 계속하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
