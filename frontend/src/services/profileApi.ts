// Profile API (Supabase 버전) — 회원/개인정보/질환정보
// profiles 테이블(=auth.users.id 기준)을 읽고 쓴다. 별도 백엔드 불필요.

import { supabase } from '../lib/supabase';

export interface DiseaseInfo {
  diagnosisType?: string;
  ckdStage?: string;
  dialysisType?: string;
  baseConditions?: string[];
  otherConditionMemo?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  userType: string | null;
  gender: string | null;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  diseaseInfo: DiseaseInfo;
  terms: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

type Row = Record<string, any>;

const rowToProfile = (r: Row): Profile => ({
  id: r.id,
  email: r.email ?? null,
  name: r.name ?? null,
  nickname: r.nickname ?? null,
  userType: r.user_type ?? null,
  gender: r.gender ?? null,
  birthDate: r.birth_date ?? null,
  height: r.height ?? null,
  weight: r.weight ?? null,
  diseaseInfo: r.disease_info ?? {},
  terms: r.terms ?? {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface ProfileInput {
  email?: string;
  name?: string;
  nickname?: string;
  userType?: string;
  gender?: string;
  birthDate?: string;
  height?: number;
  weight?: number;
  diseaseInfo?: DiseaseInfo;
  terms?: Record<string, any>;
}

const toRow = (p: ProfileInput): Row => {
  const r: Row = {};
  if (p.email !== undefined) r.email = p.email;
  if (p.name !== undefined) r.name = p.name;
  if (p.nickname !== undefined) r.nickname = p.nickname;
  if (p.userType !== undefined) r.user_type = p.userType;
  if (p.gender !== undefined) r.gender = p.gender;
  if (p.birthDate !== undefined) r.birth_date = p.birthDate;
  if (p.height !== undefined) r.height = p.height;
  if (p.weight !== undefined) r.weight = p.weight;
  if (p.diseaseInfo !== undefined) r.disease_info = p.diseaseInfo;
  if (p.terms !== undefined) r.terms = p.terms;
  return r;
};

/** 현재 로그인 사용자의 프로필 조회 (없으면 null) */
export const getMyProfile = async (): Promise<Profile | null> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProfile(data) : null;
};

/** 현재 로그인 사용자의 프로필 생성/수정 (upsert) */
export const upsertMyProfile = async (input: ProfileInput): Promise<Profile> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('로그인이 필요합니다.');
  const row = { id: auth.user.id, ...toRow(input), updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProfile(data);
};
