import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';

export function DiseaseInfoPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 질환정보 state (명세서 v3 기준 - 순서 및 코드값 변경 금지)
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

  // 2. 신장병 단계 옵션 (순서 변경 금지)
  const ckdStageOptions = [
    { label: '해당없음 / 잘 모름', value: 'NONE' },
    { label: '신장병 1~2기', value: 'CKD1_2' },
    { label: '신장병 3기', value: 'CKD3' },
    { label: '신장병 4기', value: 'CKD4' },
    { label: '신장병 5기', value: 'CKD5' },
    { label: '신장이식 후 관리 중', value: 'CKD_T' },
    { label: '급성신손상', value: 'AKI' }
  ];

  // 3. 투석 여부 옵션 (순서 변경 금지)
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

  const toggleBaseCondition = (value: string) => {
    setBaseConditions(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
    if (value === 'OTHER' && baseConditions.includes('OTHER')) {
      setOtherConditionMemo('');
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.disease_info) {
            setDiagnosisType(data.disease_info.diagnosisType || 'UNKNOWN');
            setCkdStage(data.disease_info.ckdStage || 'NONE');
            setDialysisType(data.disease_info.dialysisType || 'NONE');
            setBaseConditions(data.disease_info.baseConditions || []);
            setOtherConditionMemo(data.disease_info.otherConditionMemo || '');
          }
        } else if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('isLoggedIn');
          navigate('/login');
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          disease_info: {
            diagnosisType,
            ckdStage,
            dialysisType,
            baseConditions,
            otherConditionMemo
          }
        })
      });

      if (response.ok) {
        alert('저장되었습니다.');
        navigate('/mypage');
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden">
          <MobileHeader title="질환정보" showProfile={false} showMenu={false} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C9B7]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="질환정보" showProfile={false} showMenu={false} />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center h-16 px-6 border-b border-[#E5E7EB] relative">
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <ChevronLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">질환정보</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-10 max-w-2xl mx-auto w-full">
          <div className="border border-[#E5E7EB] rounded-xl p-6">
            <div className="space-y-6 mb-6">
              {/* 1. 병원 진단명 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-3">병원 진단명</label>
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

              {/* 2. 신장병 단계 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-3">신장병 단계</label>
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

              {/* 3. 투석 여부 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-3">투석 여부</label>
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

              {/* 4. 기저질환 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-3">
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
                          onChange={() => toggleBaseCondition(option.value)}
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

              {/* 하단 안내 문구 */}
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
              >
                <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.6' }}>
                  입력해 주신 프로필 기반으로 맞춤 콘텐츠를 제공해 드립니다.
                </p>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/mypage')}
                className="flex-1 py-4 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-medium hover:bg-gray-50 transition-colors"
              >
                뒤로가기
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-4 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg, #00C9B7 0%, #7C3AED 100%)' }}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
