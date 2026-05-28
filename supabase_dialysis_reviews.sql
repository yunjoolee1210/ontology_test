-- ================================================================
-- dialysis_hospital_reviews (투석 병원 자체 리뷰 및 평점 테이블)
-- Supabase SQL Editor에서 실행
-- ================================================================

create table if not exists public.dialysis_hospital_reviews (
  id          uuid primary key default gen_random_uuid(),
  hospital_id text not null,                -- 병원 고유 식별자 (fallback의 hospital_1, 2... 또는 Supabase UUID 지원)
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '사용자',
  rating      integer not null check (rating >= 1 and rating <= 5),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- 빠른 조회를 위한 인덱스 생성
create index if not exists idx_dhr_hospital on public.dialysis_hospital_reviews(hospital_id);
create index if not exists idx_dhr_user     on public.dialysis_hospital_reviews(user_id);

-- RLS (Row Level Security) 설정
alter table public.dialysis_hospital_reviews enable row level security;

-- 정책 1: 누구나 리뷰를 읽을 수 있음 (비로그인 사용자 포함)
drop policy if exists dhr_select on public.dialysis_hospital_reviews;
create policy dhr_select on public.dialysis_hospital_reviews for select using (true);

-- 정책 2: 로그인한 인증된 사용자만 리뷰를 작성할 수 있음
drop policy if exists dhr_insert on public.dialysis_hospital_reviews;
create policy dhr_insert on public.dialysis_hospital_reviews for insert with check (auth.uid() = user_id);

-- 정책 3: 작성자 본인만 리뷰를 삭제할 수 있음
drop policy if exists dhr_delete on public.dialysis_hospital_reviews;
create policy dhr_delete on public.dialysis_hospital_reviews for delete using (auth.uid() = user_id);

-- RLS 권한 부여
grant select, insert, delete on public.dialysis_hospital_reviews to anon, authenticated;
