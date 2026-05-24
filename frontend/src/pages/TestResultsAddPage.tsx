import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { analyzeImage, saveTestResult } from '../services/testResultsApi';

interface LabResult {
  value: number | null;
  unit: string;
  original_name: string;
  reference_range?: string;
  is_abnormal?: boolean;
}

interface OCRResult {
  success: boolean;
  temp_id?: string;
  test_date?: string;
  hospital_name?: string;
  lab_results: Record<string, LabResult>;
  raw_results?: any[];
  confidence?: number;
  image_count?: number;
  error?: string;
}

// 검사 항목 한글명
const LAB_ITEM_LABELS: Record<string, string> = {
  creatinine: '크레아티닌',
  bun: '혈중요소질소(BUN)',
  egfr: '사구체여과율(eGFR)',
  uric_acid: '요산',
  fasting_glucose: '공복혈당',
  hba1c: '당화혈색소(HbA1c)',
  total_cholesterol: '총콜레스테롤',
  hdl_cholesterol: 'HDL 콜레스테롤',
  ldl_cholesterol: 'LDL 콜레스테롤',
  triglycerides: '중성지방',
  sodium: '나트륨(Na)',
  potassium: '칼륨(K)',
  phosphorus: '인(P)',
  calcium: '칼슘(Ca)',
  hemoglobin: '헤모글로빈',
  rbc: '적혈구(RBC)',
  wbc: '백혈구(WBC)',
  platelet: '혈소판',
  ast: 'AST(GOT)',
  alt: 'ALT(GPT)',
  ggt: '감마GT(GGT)',
  albumin: '알부민',
  total_protein: '총단백',
  systolic_bp: '수축기혈압',
  diastolic_bp: '이완기혈압',
};

// 카테고리별 그룹핑
const LAB_CATEGORIES = {
  '신장 기능': ['creatinine', 'bun', 'egfr', 'uric_acid'],
  '혈당': ['fasting_glucose', 'hba1c'],
  '지질': ['total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'triglycerides'],
  '전해질': ['sodium', 'potassium', 'phosphorus', 'calcium'],
  '혈액': ['hemoglobin', 'rbc', 'wbc', 'platelet'],
  '간기능': ['ast', 'alt', 'ggt'],
  '단백질': ['albumin', 'total_protein'],
  '혈압': ['systolic_bp', 'diastolic_bp'],
};

export function TestResultsAddPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [editedResults, setEditedResults] = useState<Record<string, LabResult>>({});
  const [testDate, setTestDate] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload');

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(f =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
    );

    if (validFiles.length === 0) {
      alert('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)');
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);

    // 미리보기 생성
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // 파일 삭제
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // OCR 업로드 및 분석
  const handleUpload = async () => {
    if (files.length === 0) {
      alert('검진결과지 이미지를 선택해주세요.');
      return;
    }

    setUploading(true);

    try {
      // 첫 이미지를 OpenAI 비전으로 OCR 분석
      const data = await analyzeImage(files[0]);
      setOcrResult(data);
      setEditedResults(data.lab_results || {});
      setTestDate(data.test_date || '');
      setHospitalName(data.hospital_name || '');
      setStep('review');
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 검사 수치 수정
  const handleValueChange = (fieldName: string, value: string) => {
    setEditedResults(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value: value ? parseFloat(value) : null,
      }
    }));
  };

  // 최종 저장
  const handleSave = async () => {
    if (!testDate) {
      alert('검진 날짜를 입력해주세요.');
      return;
    }

    if (!ocrResult?.temp_id) {
      alert('OCR 결과가 없습니다. 다시 업로드해주세요.');
      return;
    }

    setSaving(true);

    try {
      await saveTestResult({
        test_date: testDate,
        hospital_name: hospitalName || null,
        lab_results: editedResults,
        imageFile: files[0],
      });
      navigate('/mypage/test-results');
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 업로드 단계 렌더링
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* 이미지 업로드 영역 */}
      <div>
        <label className="block mb-3 font-medium text-[#1F2937]">
          검진결과지 이미지
        </label>
        <label
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:opacity-70 transition-opacity"
          style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}
        >
          <Upload size={40} color="#9CA3AF" />
          <p className="mt-3 text-sm text-[#6B7280]">
            이미지를 선택하거나 드래그하세요
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            여러 장 업로드 가능 (jpg, png, gif, webp)
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
        </label>
      </div>

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[#1F2937]">
            선택된 이미지 ({previews.length}장)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X size={14} color="white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 업로드 버튼 */}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="w-full py-4 rounded-xl font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            AI가 검진결과를 분석 중입니다...
          </>
        ) : (
          <>
            <Upload size={20} />
            검진결과 분석하기
          </>
        )}
      </button>
    </div>
  );

  // 결과 확인/수정 단계 렌더링
  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* 신뢰도 표시 */}
      {ocrResult?.confidence && (
        <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">AI 분석 완료</p>
            <p className="text-sm text-blue-700">
              신뢰도: {Math.round((ocrResult.confidence || 0) * 100)}% - 아래 내용을 확인하고 수정해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="space-y-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-[#374151]">
            검진 날짜 *
          </label>
          <input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] focus:border-[#00C9B7] outline-none"
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-[#374151]">
            병원명
          </label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            placeholder="병원명을 입력하세요"
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] focus:border-[#00C9B7] outline-none"
          />
        </div>
      </div>

      {/* 검사 항목별 결과 */}
      <div className="space-y-6">
        {Object.entries(LAB_CATEGORIES).map(([category, fields]) => {
          const hasResults = fields.some(f => editedResults[f]?.value !== undefined);
          if (!hasResults) return null;

          return (
            <div key={category}>
              <h3 className="font-semibold text-[#1F2937] mb-3 pb-2 border-b border-[#E5E7EB]">
                {category}
              </h3>
              <div className="space-y-3">
                {fields.map(fieldName => {
                  const result = editedResults[fieldName];
                  if (!result || result.value === undefined) return null;

                  return (
                    <div key={fieldName} className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-sm text-[#374151]">
                          {LAB_ITEM_LABELS[fieldName] || fieldName}
                        </span>
                        {result.is_abnormal && (
                          <span className="ml-2 text-xs text-red-500">이상</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={result.value ?? ''}
                          onChange={(e) => handleValueChange(fieldName, e.target.value)}
                          className={`w-24 px-3 py-2 text-right rounded-lg border ${
                            result.is_abnormal ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB]'
                          } focus:border-[#00C9B7] outline-none`}
                        />
                        <span className="text-sm text-[#6B7280] w-16">
                          {result.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={() => setStep('upload')}
          className="flex-1 py-4 rounded-xl font-medium bg-[#F3F4F6] text-[#6B7280]"
        >
          다시 업로드
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !testDate}
          className="flex-1 py-4 rounded-xl font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Check size={20} />
              확인 및 저장
            </>
          )}
        </button>
      </div>
    </div>
  );

  // 완료 단계 렌더링
  const renderCompleteStep = () => (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <Check size={40} className="text-green-500" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#1F2937] mb-2">
          저장 완료
        </h2>
        <p className="text-[#6B7280]">
          검진결과가 성공적으로 저장되었습니다.
        </p>
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={() => navigate('/mypage')}
          className="flex-1 py-3 rounded-xl font-medium bg-[#F3F4F6] text-[#6B7280]"
        >
          마이페이지
        </button>
        <button
          onClick={() => {
            setStep('upload');
            setFiles([]);
            setPreviews([]);
            setOcrResult(null);
            setEditedResults({});
            setTestDate('');
            setHospitalName('');
          }}
          className="flex-1 py-3 rounded-xl font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
        >
          추가 등록
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="lg:hidden">
        <MobileHeader
          title="검진결과 등록"
          onBack={() => navigate('/mypage/test-results')}
        />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/mypage/test-results')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft size={24} className="text-[#1F2937]" />
            </button>
            <h1 className="text-xl font-bold text-[#1F2937]">검진결과 등록</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 pb-24 lg:pb-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['upload', 'review', 'complete'].map((s, index) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-[#00C9B7] text-white'
                    : index < ['upload', 'review', 'complete'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {index < ['upload', 'review', 'complete'].indexOf(step) ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </div>
              {index < 2 && (
                <div
                  className={`w-12 h-1 rounded ${
                    index < ['upload', 'review', 'complete'].indexOf(step)
                      ? 'bg-green-500'
                      : 'bg-[#E5E7EB]'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        {step === 'upload' && renderUploadStep()}
        {step === 'review' && renderReviewStep()}
        {step === 'complete' && renderCompleteStep()}
      </div>
    </div>
  );
}
