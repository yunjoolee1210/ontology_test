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
}

export interface HospitalFilter {
  region?: string;
  hasDialysis?: boolean;
  nightDialysis?: boolean;
  minMachines?: number;
  query?: string;
}

// 정적 데이터 실시간 필터링 헬퍼 함수
const getFilteredFallbackHospitals = (filter: HospitalFilter): Hospital[] => {
  let result = [...FALLBACK_HOSPITALS];
  
  if (filter.hasDialysis) {
    result = result.filter(h => h.has_dialysis_unit);
  }
  if (filter.nightDialysis) {
    result = result.filter(h => h.night_dialysis);
  }
  if (filter.minMachines && filter.minMachines > 0) {
    result = result.filter(h => h.dialysis_machines >= filter.minMachines);
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

    const { data, error } = await q.order('name').limit(500);
    
    // DB 에러가 발생하거나 데이터가 하나도 없을 때(적재되지 않음) 정적 데이터로 복구
    if (error || !data || data.length === 0) {
      if (error) console.error("Supabase query error:", error);
      console.warn("Using static fallback hospitals data due to empty database or query error.");
      return getFilteredFallbackHospitals(filter);
    }
    
    return data as Hospital[];
  } catch (err) {
    console.error("Failed to fetch hospitals from Supabase, falling back to static dataset:", err);
    return getFilteredFallbackHospitals(filter);
  }
};
