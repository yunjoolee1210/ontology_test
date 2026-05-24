// 병원 검진 기록 API (Supabase + OCR 서버리스)
// 이미지 OCR 분석 → /api/ocr-analyze, 저장/조회 → Supabase test_results (계정별)
// 사전세팅: supabase_test_results_setup.sql

import { supabase } from '../lib/supabase';

const BUCKET = 'test-images';

export interface TestResult {
  id: string;
  test_date: string;
  hospital_name?: string;
  lab_results: Record<string, { value: number; unit: string }>;
  image_url?: string;
  created_at: string;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/** 이미지 OCR 분석 (수치 추출) */
export const analyzeImage = async (file: File) => {
  const image = await fileToDataUrl(file);
  const res = await fetch('/api/ocr-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '분석에 실패했습니다.');
  return data; // { lab_results, test_date, hospital_name, temp_id, confidence }
};

/** 검진 기록 저장 (이미지 Storage 업로드 + 행 추가) */
export const saveTestResult = async (p: {
  test_date: string;
  hospital_name?: string | null;
  lab_results: Record<string, any>;
  imageFile?: File | null;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  let imageUrl: string | null = null;
  if (p.imageFile) {
    const ext = (p.imageFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, p.imageFile, { contentType: p.imageFile.type, upsert: false });
    if (!upErr) imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // lab_results 정규화: {field:{value,unit}} 만 저장
  const clean: Record<string, { value: number; unit: string }> = {};
  for (const [k, v] of Object.entries(p.lab_results || {})) {
    const val = (v as any)?.value;
    if (val !== null && val !== undefined && val !== '') {
      clean[k] = { value: Number(val), unit: (v as any)?.unit || '' };
    }
  }

  const { error } = await supabase.from('test_results').insert({
    user_id: user.id,
    test_date: p.test_date,
    hospital_name: p.hospital_name || null,
    lab_results: clean,
    image_url: imageUrl,
  });
  if (error) throw new Error(error.message);
};

export const listTestResults = async (): Promise<TestResult[]> => {
  const { data, error } = await supabase.from('test_results').select('*').order('test_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as TestResult[];
};

export const getTestResult = async (id: string): Promise<TestResult | null> => {
  const { data, error } = await supabase.from('test_results').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TestResult) || null;
};

export const updateTestResult = async (id: string, patch: { test_date?: string; hospital_name?: string | null; lab_results?: Record<string, any> }) => {
  const { error } = await supabase.from('test_results').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
};

export const deleteTestResult = async (id: string) => {
  const { error } = await supabase.from('test_results').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
