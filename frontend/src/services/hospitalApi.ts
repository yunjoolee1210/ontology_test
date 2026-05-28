import { supabase } from '../lib/supabase';
import { FALLBACK_HOSPITALS } from '../data/fallbackHospitals';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  region: string;
  dialysis_machines: number;
  has_dialysis_unit: boolean;
  night_dialysis: boolean;
  dialysis_days: string;
  naver_map_url: string;
  lat: number;
  lng: number;
  hira_grade?: string;
  ksn_certified?: string;
  ksn_cert_date?: string;
  specialist_count?: number;
  specialists?: string;
  nephrology_doctor?: string;
  is_dialysis_specialist?: number;
}

// FALLBACK_HOSPITALS의 중복된 id("hospital_0") 문제를 동적으로 고유하게 매핑하여 해결
const uniqueFallbackHospitals: Hospital[] = FALLBACK_HOSPITALS.map((h, idx) => ({
  ...h,
  id: `hospital_${idx}`
}));

export interface HospitalFilter {
  region?: string;
  hasDialysis?: boolean;
  nightDialysis?: boolean;
  minMachines?: number;
  query?: string;
}

// 정적 데이터 실시간 필터링 헬퍼 함수
const getFilteredFallbackHospitals = (filter: HospitalFilter): Hospital[] => {
  let result = [...uniqueFallbackHospitals];
  
  if (filter.hasDialysis) {
    result = result.filter(h => h.has_dialysis_unit);
  }
  if (filter.nightDialysis) {
    result = result.filter(h => h.night_dialysis);
  }
  const minMachines = filter.minMachines;
  if (minMachines && minMachines > 0) {
    result = result.filter(h => h.dialysis_machines >= minMachines);
  }
  if (filter.region && filter.region !== '전체') {
    result = result.filter(h => h.region === filter.region);
  }
  if (filter.query) {
    const clean = filter.query.toLowerCase();
    result = result.filter(h => 
      (h.name && h.name.toLowerCase().includes(clean)) || 
      (h.address && h.address.toLowerCase().includes(clean))
    );
  }
  
  return result;
};

export const listHospitals = async (filter: HospitalFilter = {}): Promise<Hospital[]> => {
  try {
    // VITE_SUPABASE_URL이 설정되어 있지 않거나 placeholder인 경우 즉시 정적 폴백 반환
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project.supabase.co');
    if (isPlaceholder) {
      console.warn("Supabase connection is using fallback placeholder URL. Using static fallback data.");
      return getFilteredFallbackHospitals(filter);
    }

    let q = supabase.from('dialysis_hospitals').select('*');

    if (filter.hasDialysis) q = q.eq('has_dialysis_unit', true);
    if (filter.nightDialysis) q = q.eq('night_dialysis', true);
    if (filter.minMachines && filter.minMachines > 0) q = q.gte('dialysis_machines', filter.minMachines);
    if (filter.region && filter.region !== '전체') q = q.eq('region', filter.region);
    if (filter.query) q = q.or(`name.ilike.%${filter.query}%,address.ilike.%${filter.query}%`);

    const { data, error } = await q.order('name');
    
    // DB 에러가 발생하거나 데이터가 충분히 적재되지 않았을 때(1500개 미만) 정적 1,523개 fallback 데이터로 복구
    if (error || !data || data.length < 1500) {
      if (error) console.error("Supabase query error:", error);
      console.warn(`Using static fallback hospitals data (count: ${data?.length || 0}) due to incomplete database or query error.`);
      return getFilteredFallbackHospitals(filter);
    }
    
    return data as Hospital[];
  } catch (err) {
    console.error("Failed to fetch hospitals from Supabase, falling back to static dataset:", err);
    return getFilteredFallbackHospitals(filter);
  }
};

// ── 신규: 자체 리뷰 & 평점 시스템 모델 및 API ──
export interface HospitalReview {
  id: string;
  hospital_id: string;
  user_id: string;
  author_name: string;
  rating: number;
  content: string;
  created_at: string;
}

export type NewHospitalReview = Omit<HospitalReview, 'id' | 'user_id' | 'author_name' | 'created_at'>;

// 로컬스토리지 헬퍼 (Supabase 환경설정 전 혹은 데모 구동을 위한 복구 폴백)
const getLocalReviews = (hospitalId: string): HospitalReview[] => {
  const key = `reviews_${hospitalId}`;
  const saved = localStorage.getItem(key);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
};

const addLocalReview = (review: NewHospitalReview): HospitalReview => {
  const key = `reviews_${review.hospital_id}`;
  const current = getLocalReviews(review.hospital_id);
  const newRev: HospitalReview = {
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    hospital_id: review.hospital_id,
    user_id: 'local_user',
    author_name: '방문자',
    rating: review.rating,
    content: review.content,
    created_at: new Date().toISOString()
  };
  
  current.unshift(newRev);
  localStorage.setItem(key, JSON.stringify(current));
  return newRev;
};

const deleteLocalReview = (reviewId: string, hospitalId: string): void => {
  const key = `reviews_${hospitalId}`;
  const current = getLocalReviews(hospitalId);
  const updated = current.filter(r => r.id !== reviewId);
  localStorage.setItem(key, JSON.stringify(updated));
};

// 1. 리뷰 조회 API
export const listHospitalReviews = async (hospitalId: string): Promise<HospitalReview[]> => {
  try {
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project.supabase.co');
    if (isPlaceholder) {
      return getLocalReviews(hospitalId);
    }
    
    const { data, error } = await supabase
      .from('dialysis_hospital_reviews')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.warn("Supabase fetch failed for reviews, falling back to LocalStorage:", error.message);
      return getLocalReviews(hospitalId);
    }
    
    return (data || []).map(r => ({
      id: r.id,
      hospital_id: r.hospital_id,
      user_id: r.user_id,
      author_name: r.author_name,
      rating: r.rating,
      content: r.content,
      created_at: r.created_at
    }));
  } catch (e) {
    console.error("Error fetching reviews:", e);
    return getLocalReviews(hospitalId);
  }
};

// 2. 리뷰 작성 API (로그인 권한 필수, 비로그인 시 로컬 저장 또는 로그인 유도)
export const addHospitalReview = async (review: NewHospitalReview): Promise<HospitalReview> => {
  try {
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project.supabase.co');
    if (isPlaceholder) {
      return addLocalReview(review);
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인 필요');
    
    // profiles 테이블에서 유저 닉네임 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, name')
      .eq('id', user.id)
      .single();
      
    const authorName = profile?.nickname || profile?.name || '사용자';
    
    const { data, error } = await supabase
      .from('dialysis_hospital_reviews')
      .insert({
        hospital_id: review.hospital_id,
        user_id: user.id,
        author_name: authorName,
        rating: review.rating,
        content: review.content
      })
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    return {
      id: data.id,
      hospital_id: data.hospital_id,
      user_id: data.user_id,
      author_name: data.author_name,
      rating: data.rating,
      content: data.content,
      created_at: data.created_at
    };
  } catch (e: any) {
    if (e.message === '로그인 필요') throw e;
    console.warn("Adding review to Supabase failed, saving to LocalStorage:", e.message);
    return addLocalReview(review);
  }
};

// 3. 리뷰 삭제 API
export const deleteHospitalReview = async (reviewId: string, hospitalId: string): Promise<void> => {
  try {
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder-project.supabase.co');
    if (isPlaceholder) {
      deleteLocalReview(reviewId, hospitalId);
      return;
    }
    
    const { error } = await supabase
      .from('dialysis_hospital_reviews')
      .delete()
      .eq('id', reviewId);
      
    if (error) {
      console.warn("Failed to delete review from Supabase, removing locally if matching:", error.message);
      deleteLocalReview(reviewId, hospitalId);
    }
  } catch (e) {
    console.error("Error deleting review:", e);
    deleteLocalReview(reviewId, hospitalId);
  }
};
