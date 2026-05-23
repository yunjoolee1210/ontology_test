// Diet log API (Supabase 버전) — 식이관리/식단 기록
// diet_logs 테이블 + diet-images 스토리지 버킷 사용. 별도 백엔드 불필요.
// 참고: 이미지→AI 영양분석은 LLM이 필요해 별도(서버리스)로 추가 예정. 여기선 기록 저장/조회만.

import { supabase } from '../lib/supabase';

const BUCKET = 'diet-images';

export interface DietLogRow {
  log_id: string;
  dish_name: string;
  meal_type: string;
  image_url: string;
  confidence?: number;
  nutrients?: {
    calories: number; protein: number; fat: number; carbohydrate: number;
    sodium: number; potassium: number; phosphorus: number;
  };
  logged_at?: string;
}

/** 내 식단 기록 목록 */
export const listDietLogs = async (limit = 20): Promise<DietLogRow[]> => {
  const { data, error } = await supabase
    .from('diet_logs')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    log_id: r.id,
    dish_name: r.food_name || '식사',
    meal_type: r.meal_type || 'lunch',
    image_url: r.image_url || '',
    nutrients: (r.nutrients && Object.keys(r.nutrients).length) ? r.nutrients : undefined,
    logged_at: r.logged_at,
  }));
};

/** 식단 기록 추가 (이미지는 Supabase Storage 업로드) */
export const addDietLog = async (p: {
  mealType: string;
  dishName?: string;
  imageFile?: File | null;
}): Promise<DietLogRow> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');

  let imageUrl = '';
  if (p.imageFile) {
    const MAX = 5 * 1024 * 1024;
    if (p.imageFile.size > MAX) throw new Error('파일 크기는 5MB를 초과할 수 없습니다.');
    const ext = (p.imageFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${auth.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, p.imageFile, { contentType: p.imageFile.type, upsert: false });
    if (upErr) throw new Error(upErr.message);
    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('diet_logs')
    .insert({
      user_id: auth.user.id,
      logged_at: now,
      meal_type: p.mealType,
      food_name: p.dishName || '식사',
      image_url: imageUrl,
      nutrients: {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  return {
    log_id: data.id,
    dish_name: data.food_name,
    meal_type: data.meal_type,
    image_url: data.image_url,
    nutrients: undefined,
    logged_at: data.logged_at,
  };
};
