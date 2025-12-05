import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, ChevronDown } from 'lucide-react';

export function KidneyDiseaseStagePage() {
  const navigate = useNavigate();

  // 명세서 v3 기준 state (순서 및 코드값 변경 금지)
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

  const handleSave = () => {
    // 저장 데이터 구조
    const saveData = {
      diagnosisType,
      ckdStage,
      dialysisType,
      baseConditions,
      otherConditionMemo
    };
    console.log('저장 데이터:', saveData);
    alert('질환 정보가 수정되었습니다.');
    navigate('/mypage');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-white)' }}>
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b" style={{ borderColor: '#E5E7EB' }}>
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <ChevronLeft size={24} className="text-[#1F2937]" />
        </button>

        <h2 style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>질환정보 등록</h2>

        <div style={{ width: '40px' }} />
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          <div className="space-y-6">
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
                신장병 단계
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
                투석 여부
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

            {/* 5. 하단 안내 문구 */}
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.6' }}>
                💡 입력해 주신 프로필 기반으로 맞춤 콘텐츠를 제공해 드립니다.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full mt-8 py-4 rounded-xl text-white font-medium hover:opacity-90 transition-all"
            style={{
              background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)'
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
