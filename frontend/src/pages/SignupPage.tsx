import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { upsertMyProfile } from '../services/profileApi';

type Step = 0 | 1 | 2 | 3;

interface TermsData {
  service_terms: { title: string; required: boolean; content: string };
  privacy_required: { title: string; required: boolean; content: string };
  privacy_optional: { title: string; required: boolean; content: string };
  marketing: { title: string; required: boolean; content: string };
}

// 욕설 필터 리스트 (한국어 + 영어)
const PROFANITY_LIST = [
  // 한국어 욕설
  '시발', '씨발', '씨바', '시바', '씹', '좆', '존나', '졸라', '병신', '멍청', '바보', '개새끼',
  '새끼', '지랄', '닥쳐', '꺼져', '엿먹어', '미친', '또라이', '찐따', '한남', '한녀',
  '보지', '자지', '섹스', '야동', '느금마', '니미', '니엄마', '엄창', '애미', '애비',
  '쓰레기', '걸레', '창녀', '매춘', '성매매', '호구', '등신', '장애인', '불구',
  // 변형된 욕설
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄹ', 'ㅈㄴ', 'ㅁㅊ', 'ㄲㅈ', 'ㄴㄱㅁ',
  // 영어 욕설
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'crap', 'dick', 'cock',
  'penis', 'vagina', 'pussy', 'whore', 'slut', 'nigger', 'faggot', 'retard',
  // 추가 필터
  'admin', 'administrator', '관리자', '운영자'
];

// 닉네임 욕설 검사 함수
const containsProfanity = (nickname: string): boolean => {
  const lowerNickname = nickname.toLowerCase().replace(/\s/g, '');
  return PROFANITY_LIST.some(word => lowerNickname.includes(word.toLowerCase()));
};

// 약관 기본값 (백엔드 없이 동작 — /api/terms/all 미배포 대응)
const DEFAULT_TERMS: TermsData = {
  service_terms: {
    title: '서비스 이용약관',
    required: true,
    content:
      '본 약관은 CareKidney(케어가이드) 서비스 이용에 관한 조건·절차와 회원·회사의 권리·의무를 규정합니다. 본 서비스는 만성콩팥병 환자를 위한 정보 제공을 목적으로 하며, 제공되는 정보는 의학적 진단·처방을 대체하지 않습니다. 회원은 관련 법령과 본 약관을 준수해야 합니다.',
  },
  privacy_required: {
    title: '개인정보 수집·이용 동의 (필수)',
    required: true,
    content:
      '회원가입 및 서비스 제공을 위해 이메일, 닉네임, 성별, 생년월일, 신체정보(키/체중), 질환정보를 수집·이용합니다. 수집된 정보는 서비스 제공 목적 외로 사용하지 않으며, 회원 탈퇴 시 관련 법령에 따라 파기합니다.',
  },
  privacy_optional: {
    title: '개인정보 수집·이용 동의 (선택)',
    required: false,
    content:
      '맞춤형 콘텐츠 제공 및 통계 분석을 위한 선택적 개인정보 수집·이용에 동의합니다. 동의하지 않아도 기본 서비스 이용이 가능합니다.',
  },
  marketing: {
    title: '마케팅 정보 수신 동의 (선택)',
    required: false,
    content:
      '이벤트, 신규 기능, 건강 정보 등의 마케팅 알림 수신에 동의합니다. 동의하지 않아도 서비스 이용이 가능하며, 언제든지 수신을 거부할 수 있습니다.',
  },
};

export function SignupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(0);

  // Step 0: Terms Agreement
  const [termsData, setTermsData] = useState<TermsData | null>(DEFAULT_TERMS);
  const [agreements, setAgreements] = useState({
    all: false,
    service: false,
    privacyRequired: false,
    privacyOptional: false,
    marketing: false
  });
  const [expandedTerms, setExpandedTerms] = useState<{[key: string]: boolean}>({});

  // Step 1: Account Info
  const [accountInfo, setAccountInfo] = useState({
    id: '',
    password: '',
    passwordConfirm: '',
    verified: false,
    userType: '신장병 환우',
    emailChecked: false
  });

  // Step 2: Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    nickname: '',
    gender: '',
    userType: '',
    birthDate: '',
    height: '',
    weight: '',
    nicknameChecked: false
  });

  // Step 3: Disease Info (명세서 v3 기준 - 순서 및 코드값 변경 금지)
  const [diagnosisType, setDiagnosisType] = useState<string>('UNKNOWN');
  const [ckdStage, setCkdStage] = useState<string>('NONE');
  const [dialysisType, setDialysisType] = useState<string>('NONE');
  const [baseConditions, setBaseConditions] = useState<string[]>([]);
  const [otherConditionMemo, setOtherConditionMemo] = useState<string>('');

  // 1. 병원 진단명 옵션 (순서 변경 금지)
  const diagnosisTypeOptions = [
    { label: '모름 / 진단 전', value: 'UNKNOWN' },
    { label: '당뇨성 신장병', value: 'DKD' },
    { label: '고혈압성 신장병', value: 'HTN_CKD' },
    { label: '사구체신염', value: 'GN' },
    { label: '다낭성 신장병 (유전성)', value: 'PKD' },
    { label: 'IgA 신증', value: 'IgAN' },
    { label: '루푸스 신염', value: 'LN' },
    { label: '기타', value: 'OTHER' }
  ];

  // 2. 신장병 단계 옵션 (순서 변경 금지, CKD3a/3b 나누기 금지, CKD1/2 나누기 금지)
  const ckdStageOptions = [
    { label: '해당없음 / 잘 모름', value: 'NONE' },
    { label: '신장병 1~2기', value: 'CKD1_2' },
    { label: '신장병 3기', value: 'CKD3' },
    { label: '신장병 4기', value: 'CKD4' },
    { label: '신장병 5기', value: 'CKD5' },
    { label: '신장이식 후 관리 중', value: 'CKD_T' },
    { label: '급성신손상', value: 'AKI' }
  ];

  // 3. 투석 여부 옵션 (순서 변경 금지, ckdStage와 독립적)
  const dialysisOptions = [
    { label: '투석 전', value: 'NONE' },
    { label: '혈액투석 중', value: 'HD' },
    { label: '복막투석 중', value: 'PD' }
  ];

  // 4. 기저질환 옵션 (순서 변경 금지, 복수 선택 가능)
  const baseConditionOptions = [
    { label: '당뇨병', value: 'DM' },
    { label: '고혈압', value: 'HTN' },
    { label: '심부전', value: 'HF' },
    { label: '통풍', value: 'GOUT' },
    { label: '기타', value: 'OTHER' }
  ];

  const handleBaseConditionToggle = (value: string) => {
    setBaseConditions(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  // Fetch terms data
  useEffect(() => {
    fetch('/api/terms/all')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setTermsData(data.terms);
        }
      })
      .catch(err => console.error('Failed to fetch terms:', err));
  }, []);

  // Handle all agreement toggle
  const handleAllAgreement = (checked: boolean) => {
    setAgreements({
      all: checked,
      service: checked,
      privacyRequired: checked,
      privacyOptional: checked,
      marketing: checked
    });
  };

  // Handle individual agreement toggle
  const handleAgreementChange = (key: keyof typeof agreements, checked: boolean) => {
    const newAgreements = { ...agreements, [key]: checked };

    // Check if all are checked
    const allChecked = newAgreements.service && newAgreements.privacyRequired &&
                       newAgreements.privacyOptional && newAgreements.marketing;
    newAgreements.all = allChecked;

    setAgreements(newAgreements);
  };

  // Toggle term content visibility
  const toggleTermContent = (key: string) => {
    setExpandedTerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  // 신장병 환우인 경우 필수 입력 검증
  // 투석 여부는 기본값 'NONE'(투석 전)이 유효한 선택이므로 항상 유효함
  const isPatient = personalInfo.userType === 'patient';
  const isRequiredFieldsValid = !isPatient || ckdStage !== 'NONE';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 신장병 환우인 경우 필수 입력 검증 (신장병 단계만 필수)
    if (isPatient) {
      if (ckdStage === 'NONE') {
        alert('신장병 단계를 선택해주세요.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Supabase Auth 회원가입
      const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
        email: accountInfo.id,
        password: accountInfo.password,
        options: {
          data: { name: personalInfo.nickname, nickname: personalInfo.nickname },
        },
      });

      if (signUpError) {
        alert(signUpError.message || '회원가입에 실패했습니다.');
        return;
      }

      // 프로필(개인정보/질환정보/약관) 저장 — 세션이 있어야 RLS 통과
      const profilePayload = {
        email: accountInfo.id,
        name: personalInfo.nickname,
        nickname: personalInfo.nickname,
        userType: personalInfo.userType || 'general',
        gender: personalInfo.gender,
        birthDate: personalInfo.birthDate,
        height: personalInfo.height ? Number(personalInfo.height) : undefined,
        weight: personalInfo.weight ? Number(personalInfo.weight) : undefined,
        diseaseInfo: {
          diagnosisType,
          ckdStage,
          dialysisType,
          baseConditions,
          otherConditionMemo: baseConditions.includes('OTHER') ? otherConditionMemo : undefined,
        },
        terms: {
          service_terms: agreements.service,
          privacy_required: agreements.privacyRequired,
          privacy_optional: agreements.privacyOptional,
          marketing: agreements.marketing,
        },
      };

      if (signUpResult.session) {
        // 즉시 세션 생성됨(이메일 인증 OFF) → 프로필 저장 후 로그인 페이지로
        try {
          await upsertMyProfile(profilePayload);
        } catch (e) {
          console.error('프로필 저장 실패:', e);
        }
        alert('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');
        navigate('/login');
      } else {
        // 이메일 인증 필요(세션 없음) → 인증 후 첫 로그인 시 저장하도록 보관
        localStorage.setItem('pendingProfile', JSON.stringify(profilePayload));
        alert('가입 확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.');
        navigate('/login');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromTerms = agreements.service && agreements.privacyRequired;

  // 만 19세 이상 검증 함수
  const validateAge = (birthDateString: string): boolean => {
    if (!birthDateString) return true; // 빈 문자열이면 검증 안 함

    const parts = birthDateString.split('-');
    // 모든 부분이 채워져야 검증
    if (parts.length !== 3 || parts.some(p => !p || p.trim() === '')) return true;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    // 유효한 숫자인지 확인
    if (isNaN(year) || isNaN(month) || isNaN(day)) return true;

    const birthDate = new Date(year, month - 1, day);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // 생일이 아직 안 지났으면 나이에서 1 빼기
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age >= 19;
  };

  // 생년월일 변경 시 나이 검증
  const handleBirthDateChange = (newBirthDate: string) => {
    // 먼저 상태 업데이트
    const updatedInfo = { ...personalInfo, birthDate: newBirthDate };
    setPersonalInfo(updatedInfo);

    // 모든 필드(년/월/일)가 입력되었을 때만 검증
    const parts = newBirthDate.split('-');
    if (parts.length === 3 && parts.every(p => p && p.trim() !== '')) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);

      // 유효한 숫자인지 확인
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        if (!validateAge(newBirthDate)) {
          alert('만 19세 이상만 회원 등록 및 서비스 이용이 가능합니다.');
          // 생년월일 초기화
          setPersonalInfo({ ...personalInfo, birthDate: '' });
        }
      }
    }
  };

  // 닉네임 중복 체크 및 욕설 필터
  const handleNicknameCheck = () => {
    if (!personalInfo.nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }

    // 욕설 검사
    if (containsProfanity(personalInfo.nickname)) {
      alert('부적절한 닉네임입니다. 다른 닉네임을 사용해주세요.');
      setPersonalInfo({ ...personalInfo, nickname: '', nicknameChecked: false });
      return;
    }

    // TODO: 닉네임 중복 체크 API 호출
    setPersonalInfo({ ...personalInfo, nicknameChecked: true });
    alert('사용 가능한 닉네임입니다.');
  };

  // 키/체중 validation
  const validateHeightWeight = (): boolean => {
    const height = personalInfo.height ? Number(personalInfo.height) : null;
    const weight = personalInfo.weight ? Number(personalInfo.weight) : null;

    if (height !== null && height <= 100) {
      const confirmed = window.confirm(
        `입력하신 키(${height}cm)가 상당히 낮습니다.\n입력하신 정보가 맞습니까?`
      );
      if (!confirmed) return false;
    }

    if (weight !== null && weight <= 30) {
      const confirmed = window.confirm(
        `입력하신 체중(${weight}kg)이 상당히 낮습니다.\n입력하신 정보가 맞습니까?`
      );
      if (!confirmed) return false;
    }

    return true;
  };

  // Step 2에서 다음 버튼 클릭 시 validation
  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();

    // 닉네임 욕설 검사 (중복 체크 안 했어도 검사)
    if (containsProfanity(personalInfo.nickname)) {
      alert('부적절한 닉네임입니다. 다른 닉네임을 사용해주세요.');
      setPersonalInfo({ ...personalInfo, nickname: '', nicknameChecked: false });
      return;
    }

    // 키/체중 validation
    if (!validateHeightWeight()) {
      return;
    }

    handleNextStep();
  };

  // 가입 취소 처리
  const handleCancelSignup = () => {
    const confirmed = window.confirm('회원가입을 취소하시겠습니까?\n입력하신 정보는 저장되지 않습니다.');
    if (confirmed) {
      navigate('/login');
    }
  };

  // Step 1 (계정 정보) validation
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();

    // 비밀번호 길이 검증
    if (accountInfo.password.length < 8) {
      alert('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    // 비밀번호 영문자 포함 검증
    if (!/[A-Za-z]/.test(accountInfo.password)) {
      alert('비밀번호는 최소 하나의 영문자를 포함해야 합니다.');
      return;
    }

    // 비밀번호 숫자 포함 검증
    if (!/\d/.test(accountInfo.password)) {
      alert('비밀번호는 최소 하나의 숫자를 포함해야 합니다.');
      return;
    }

    // 비밀번호 확인 검증
    if (accountInfo.password !== accountInfo.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    handleNextStep();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{ background: 'var(--color-bg-white)' }}
    >
      {/* Back Button */}
      <button
        onClick={() => currentStep === 0 ? navigate('/login') : handlePrevStep()}
        className="absolute top-6 left-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="뒤로 가기"
      >
        <ChevronLeft className="text-[#1F2937]" size={24} strokeWidth={2} />
      </button>

      <div className="w-full max-w-2xl space-y-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === currentStep ? 'w-12' : 'w-2'
              }`}
              style={{
                background: step <= currentStep
                  ? 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)'
                  : '#E5E7EB'
              }}
            />
          ))}
        </div>

        {/* Step 0: Terms Agreement */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h1 className="text-center" style={{ color: '#1F2937', fontSize: '24px', fontWeight: 'bold' }}>
              약관 동의
            </h1>

            {termsData ? (
              <div className="space-y-4">
                {/* All Agreement Checkbox */}
                <div
                  className="p-4 rounded-lg"
                  style={{ border: '2px solid #00C9B7', backgroundColor: '#F0FDFA' }}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={agreements.all}
                        onChange={(e) => handleAllAgreement(e.target.checked)}
                        className="w-5 h-5 rounded appearance-none border-2 cursor-pointer transition-all duration-200"
                        style={{
                          borderColor: agreements.all ? 'rgb(0, 201, 183)' : '#D1D5DB',
                          backgroundColor: agreements.all ? 'rgb(0, 201, 183)' : 'white'
                        }}
                      />
                      {agreements.all && (
                        <Check
                          size={14}
                          color="#FFFFFF"
                          strokeWidth={3}
                          className="absolute pointer-events-none"
                        />
                      )}
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F2937' }}>
                      서비스 전체 약관에 동의합니다.
                    </span>
                  </label>
                </div>

                {/* Individual Terms */}
                <div className="space-y-3">
                  {/* Service Terms */}
                  <TermItem
                    title={`(필수) ${termsData.service_terms.title}`}
                    content={termsData.service_terms.content}
                    checked={agreements.service}
                    onChange={(checked) => handleAgreementChange('service', checked)}
                    expanded={expandedTerms.service}
                    onToggle={() => toggleTermContent('service')}
                  />

                  {/* Privacy Required */}
                  <TermItem
                    title={`(필수) ${termsData.privacy_required.title}`}
                    content={termsData.privacy_required.content}
                    checked={agreements.privacyRequired}
                    onChange={(checked) => handleAgreementChange('privacyRequired', checked)}
                    expanded={expandedTerms.privacyRequired}
                    onToggle={() => toggleTermContent('privacyRequired')}
                  />

                  {/* Privacy Optional */}
                  <TermItem
                    title={`(선택) ${termsData.privacy_optional.title}`}
                    content={termsData.privacy_optional.content}
                    checked={agreements.privacyOptional}
                    onChange={(checked) => handleAgreementChange('privacyOptional', checked)}
                    expanded={expandedTerms.privacyOptional}
                    onToggle={() => toggleTermContent('privacyOptional')}
                  />

                  {/* Marketing */}
                  <TermItem
                    title={`(선택) ${termsData.marketing.title}`}
                    content={termsData.marketing.content}
                    checked={agreements.marketing}
                    onChange={(checked) => handleAgreementChange('marketing', checked)}
                    expanded={expandedTerms.marketing}
                    onToggle={() => toggleTermContent('marketing')}
                  />
                </div>

                {/* Button Group */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelSignup}
                    className="flex-1 py-3 rounded-lg transition-all duration-200"
                    style={{
                      background: '#F3F4F6',
                      color: '#6B7280',
                      border: '1px solid #E5E7EB',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    가입 취소
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!canProceedFromTerms}
                    className="flex-1 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: canProceedFromTerms
                        ? 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)'
                        : '#E5E7EB',
                      color: 'white',
                      border: 'none',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: canProceedFromTerms ? 'pointer' : 'not-allowed'
                    }}
                  >
                    다음
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p style={{ color: '#9CA3AF' }}>약관을 불러오는 중...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Account Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h1 className="text-center" style={{ color: '#1F2937', fontSize: '24px' }}>
              계정 정보 입력
            </h1>

            <form onSubmit={handleStep1Next} className="space-y-4">
              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  아이디 (이메일)
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={accountInfo.id}
                    onChange={(e) => setAccountInfo({ ...accountInfo, id: e.target.value })}
                    placeholder="이메일을 입력하세요"
                    className="flex-1 px-4 py-3 rounded-lg border"
                    style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: 이메일 중복 체크 API 호출
                      setAccountInfo({ ...accountInfo, emailChecked: true });
                      alert('사용 가능한 이메일입니다.');
                    }}
                    className="px-4 py-3 rounded-lg whitespace-nowrap transition-all duration-200"
                    style={{
                      background: accountInfo.emailChecked ? 'rgb(159, 122, 234)' : '#F3F4F6',
                      color: accountInfo.emailChecked ? 'white' : '#374151',
                      border: accountInfo.emailChecked ? '1px solid rgb(159, 122, 234)' : '1px solid #E5E7EB',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {accountInfo.emailChecked ? '확인완료' : '중복체크'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  비밀번호
                </label>
                <input
                  type="password"
                  value={accountInfo.password}
                  onChange={(e) => setAccountInfo({ ...accountInfo, password: e.target.value })}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 rounded-lg border"
                  style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                  required
                />
              </div>

              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={accountInfo.passwordConfirm}
                  onChange={(e) => setAccountInfo({ ...accountInfo, passwordConfirm: e.target.value })}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full px-4 py-3 rounded-lg border"
                  style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                  required
                />
              </div>

              {/* Button Group */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelSignup}
                  className="flex-1 py-3 rounded-lg transition-all duration-200"
                  style={{
                    background: '#F3F4F6',
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  가입 취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg"
                  style={{
                    background: 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  다음
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Personal Info */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h1 className="text-center" style={{ color: '#1F2937', fontSize: '24px' }}>
              개인 정보 입력
            </h1>

<form onSubmit={handleStep2Next} className="space-y-4">
              {/* User Type Selection */}
              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  사용자 유형 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { label: '일반인', value: 'general' },
                    { label: '신장병 환우', value: 'patient' },
                    { label: '연구자', value: 'researcher' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setPersonalInfo({ ...personalInfo, userType: type.value })}
                      className="flex-1 py-3 rounded-lg transition-all duration-200"
                      style={{
                        background: personalInfo.userType === type.value ? 'rgb(0, 201, 183)' : '#F3F4F6',
                        color: personalInfo.userType === type.value ? 'white' : '#6B7280',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  닉네임 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={personalInfo.nickname}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, nickname: e.target.value })}
                    placeholder="닉네임을 입력하세요"
                    className="flex-1 px-4 py-3 rounded-lg border"
                    style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleNicknameCheck}
                    className="px-4 py-3 rounded-lg whitespace-nowrap transition-all duration-200"
                    style={{
                      background: personalInfo.nicknameChecked ? 'rgb(159, 122, 234)' : '#F3F4F6',
                      color: personalInfo.nicknameChecked ? 'white' : '#374151',
                      border: personalInfo.nicknameChecked ? '1px solid rgb(159, 122, 234)' : '1px solid #E5E7EB',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {personalInfo.nicknameChecked ? '확인완료' : '중복체크'}
                  </button>
                </div>
              </div>

              {/* Gender Selection */}
              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  성별 <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="flex gap-2">
                  {['남성', '여성', '기타'].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setPersonalInfo({ ...personalInfo, gender: gender })}
                      className="flex-1 py-3 rounded-lg transition-all duration-200"
                      style={{
                        background: personalInfo.gender === gender ? 'rgb(0, 201, 183)' : '#F3F4F6',
                        color: personalInfo.gender === gender ? 'white' : '#6B7280',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                  생년월일 <span style={{ color: '#EF4444' }}>*</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '400', marginLeft: '8px' }}>
                    (만 19세 이상만 가입 가능)
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* 연도 선택 */}
                  <div className="relative">
                    <select
                      value={personalInfo.birthDate ? personalInfo.birthDate.split('-')[0] : ''}
                      onChange={(e) => {
                        const year = e.target.value;
                        const currentParts = personalInfo.birthDate ? personalInfo.birthDate.split('-') : ['', '', ''];
                        const newDate = year ? `${year}-${currentParts[1] || ''}-${currentParts[2] || ''}` : '';
                        handleBirthDateChange(newDate);
                      }}
                      className="w-full px-3 py-3 rounded-lg border appearance-none cursor-pointer"
                      style={{ borderColor: '#E5E7EB', fontSize: '14px', backgroundColor: 'white' }}
                      required
                    >
                      <option value="">년도</option>
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        const maxYear = currentYear - 18; // 올해 기준 18세까지 표시 (월/일에 따라 19세 미만일 수 있음)
                        const minYear = 1930;
                        const years = [];
                        for (let year = maxYear; year >= minYear; year--) {
                          years.push(
                            <option key={year} value={year}>{year}년</option>
                          );
                        }
                        return years;
                      })()}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                      style={{ color: '#6B7280' }}
                    />
                  </div>
                  {/* 월 선택 */}
                  <div className="relative">
                    <select
                      value={personalInfo.birthDate ? personalInfo.birthDate.split('-')[1] : ''}
                      onChange={(e) => {
                        const month = e.target.value;
                        const currentParts = personalInfo.birthDate ? personalInfo.birthDate.split('-') : ['', '', ''];
                        const newDate = month ? `${currentParts[0] || ''}-${month}-${currentParts[2] || ''}` : '';
                        handleBirthDateChange(newDate);
                      }}
                      className="w-full px-3 py-3 rounded-lg border appearance-none cursor-pointer"
                      style={{ borderColor: '#E5E7EB', fontSize: '14px', backgroundColor: 'white' }}
                      required
                    >
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {i + 1}월
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                      style={{ color: '#6B7280' }}
                    />
                  </div>
                  {/* 일 선택 */}
                  <div className="relative">
                    <select
                      value={personalInfo.birthDate ? personalInfo.birthDate.split('-')[2] : ''}
                      onChange={(e) => {
                        const day = e.target.value;
                        const currentParts = personalInfo.birthDate ? personalInfo.birthDate.split('-') : ['', '', ''];
                        const newDate = day ? `${currentParts[0] || ''}-${currentParts[1] || ''}-${day}` : '';
                        handleBirthDateChange(newDate);
                      }}
                      className="w-full px-3 py-3 rounded-lg border appearance-none cursor-pointer"
                      style={{ borderColor: '#E5E7EB', fontSize: '14px', backgroundColor: 'white' }}
                      required
                    >
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {i + 1}일
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                      style={{ color: '#6B7280' }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                    키 (cm)
                  </label>
                  <input
                    type="number"
                    value={personalInfo.height}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, height: e.target.value })}
                    placeholder="170"
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label className="block mb-2" style={{ fontSize: '14px', color: '#374151' }}>
                    체중 (kg)
                  </label>
                  <input
                    type="number"
                    value={personalInfo.weight}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, weight: e.target.value })}
                    placeholder="70"
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Button Group */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelSignup}
                  className="flex-1 py-3 rounded-lg transition-all duration-200"
                  style={{
                    background: '#F3F4F6',
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  가입 취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg"
                  style={{
                    background: 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  다음
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Disease Info (명세서 v3 기준 - 순서: 병원진단명→신장병단계→투석여부→기저질환) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h1 className="text-center" style={{ color: '#1F2937', fontSize: '24px' }}>
              질환정보 등록
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. 병원 진단명 (diagnosisType) - 드롭다운 (8개 옵션) */}
              <div>
                <label className="block mb-3" style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  병원 진단명
                </label>
                <div className="relative">
                  <select
                    value={diagnosisType}
                    onChange={(e) => setDiagnosisType(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border appearance-none cursor-pointer transition-all duration-200"
                    style={{
                      borderColor: diagnosisType !== 'UNKNOWN' ? '#00C9B7' : '#E5E7EB',
                      backgroundColor: 'white',
                      fontSize: '14px',
                      color: '#1F2937'
                    }}
                  >
                    {diagnosisTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={20}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    style={{ color: '#6B7280' }}
                  />
                </div>
              </div>

              {/* 2. 신장병 단계 (ckdStage) - 드롭다운 (7개 옵션) */}
              <div>
                <label className="block mb-3" style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  신장병 단계 {isPatient && <span style={{ color: '#EF4444' }}>*</span>}
                </label>
                <div className="relative">
                  <select
                    value={ckdStage}
                    onChange={(e) => setCkdStage(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border appearance-none cursor-pointer transition-all duration-200"
                    style={{
                      borderColor: ckdStage !== 'NONE' ? '#00C9B7' : '#E5E7EB',
                      backgroundColor: 'white',
                      fontSize: '14px',
                      color: '#1F2937'
                    }}
                  >
                    {ckdStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={20}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    style={{ color: '#6B7280' }}
                  />
                </div>
              </div>

              {/* 3. 투석 여부 (dialysisType) - 라디오버튼 (항상 표시, ckdStage와 독립적) */}
              <div>
                <label className="block mb-3" style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  투석 여부 {isPatient && <span style={{ color: '#EF4444' }}>*</span>}
                </label>
                <div className="space-y-2">
                  {dialysisOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200"
                      style={{
                        borderColor: dialysisType === option.value ? '#00C9B7' : '#E5E7EB',
                        backgroundColor: dialysisType === option.value ? '#F0FDFA' : 'white'
                      }}
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="dialysisType"
                          checked={dialysisType === option.value}
                          onChange={() => setDialysisType(option.value)}
                          className="w-5 h-5 appearance-none rounded-full border-2 cursor-pointer transition-all duration-200"
                          style={{
                            borderColor: dialysisType === option.value ? '#00C9B7' : '#D1D5DB',
                            backgroundColor: dialysisType === option.value ? '#00C9B7' : 'white'
                          }}
                        />
                        {dialysisType === option.value && (
                          <div className="absolute w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span style={{ fontSize: '14px', color: '#1F2937' }}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. 기저질환 (baseConditions) - 체크박스 (복수 선택 가능) */}
              <div>
                <label className="block mb-3" style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>
                  기저질환 <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '400' }}>(복수 선택 가능)</span>
                </label>
                <div className="space-y-2">
                  {baseConditionOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200"
                      style={{
                        borderColor: baseConditions.includes(option.value) ? '#00C9B7' : '#E5E7EB',
                        backgroundColor: baseConditions.includes(option.value) ? '#F0FDFA' : 'white'
                      }}
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={baseConditions.includes(option.value)}
                          onChange={() => handleBaseConditionToggle(option.value)}
                          className="w-5 h-5 appearance-none rounded border-2 cursor-pointer transition-all duration-200"
                          style={{
                            borderColor: baseConditions.includes(option.value) ? '#00C9B7' : '#D1D5DB',
                            backgroundColor: baseConditions.includes(option.value) ? '#00C9B7' : 'white'
                          }}
                        />
                        {baseConditions.includes(option.value) && (
                          <Check
                            size={14}
                            color="#FFFFFF"
                            strokeWidth={3}
                            className="absolute pointer-events-none"
                          />
                        )}
                      </div>
                      <span style={{ fontSize: '14px', color: '#1F2937' }}>{option.label}</span>
                    </label>
                  ))}
                </div>

                {/* 기타 선택 시 메모 입력 필드 */}
                {baseConditions.includes('OTHER') && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={otherConditionMemo}
                      onChange={(e) => setOtherConditionMemo(e.target.value)}
                      placeholder="기타 질환을 입력해주세요"
                      className="w-full px-4 py-3 rounded-lg border"
                      style={{ borderColor: '#E5E7EB', fontSize: '14px' }}
                    />
                  </div>
                )}
              </div>

              {/* 5. 하단 안내 문구 */}
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
              >
                <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.6' }}>
                  💡 입력해 주신 프로필 기반으로 맞춤 콘텐츠를 제공해 드립니다.
                </p>
              </div>

              {/* Button Group */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelSignup}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: '#F3F4F6',
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  가입 취소
                </button>
                <button
                  type="submit"
                  disabled={!isRequiredFieldsValid || isSubmitting}
                  className="flex-1 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isRequiredFieldsValid && !isSubmitting
                      ? 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)'
                      : '#E5E7EB',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  {isSubmitting ? '가입 처리 중...' : '가입 완료'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Term Item Component
function TermItem({
  title,
  content,
  checked,
  onChange,
  expanded,
  onToggle
}: {
  title: string;
  content: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-5 h-5 rounded appearance-none border-2 cursor-pointer transition-all duration-200"
                style={{
                  borderColor: checked ? 'rgb(0, 201, 183)' : '#D1D5DB',
                  backgroundColor: checked ? 'rgb(0, 201, 183)' : 'white'
                }}
              />
              {checked && (
                <Check
                  size={14}
                  color="#FFFFFF"
                  strokeWidth={3}
                  className="absolute pointer-events-none"
                />
              )}
            </div>
            <span style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500' }}>
              {title}
            </span>
          </label>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            type="button"
          >
            {expanded ? (
              <ChevronUp size={20} color="#6B7280" />
            ) : (
              <ChevronDown size={20} color="#6B7280" />
            )}
          </button>
        </div>

        {expanded && (
          <div
            className="mt-3 p-4 rounded-lg max-h-60 overflow-y-auto"
            style={{
              backgroundColor: '#F9FAFB',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#4B5563',
              whiteSpace: 'pre-wrap'
            }}
          >
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
