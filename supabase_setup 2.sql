-- ============================================================================
-- CareKidney / CareGuide — Supabase 전체 세팅 SQL (마스터)
-- Supabase Dashboard > SQL Editor 에 붙여넣고 RUN 1회 (여러 번 실행해도 안전).
-- 포함: profiles(회원/개인정보/질환정보) · diet_logs(식이관리) · notifications(알림)
--        · community_posts/community_comments(커뮤니티) · Storage 버킷 · RLS · 카운터 RPC
-- 스택: Supabase + Vercel 만. (Docker/Mongo/Atlas/Render 불필요)
-- ============================================================================

-- ====================== 1. PROFILES (회원/개인정보/질환정보) ================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  name         text,
  nickname     text,
  user_type    text default 'general',          -- 환우/보호자 등
  gender       text,
  birth_date   text,
  height       numeric,
  weight       numeric,
  disease_info jsonb not null default '{}'::jsonb,  -- diagnosisType, ckdStage, dialysisType, baseConditions ...
  terms        jsonb not null default '{}'::jsonb,  -- 약관 동의 내역
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ====================== 2. DIET LOGS (식이관리) =============================
create table if not exists public.diet_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_at  timestamptz not null default now(),
  meal_type  text,                              -- 아침/점심/저녁/간식
  food_name  text,
  memo       text,
  image_url  text,
  nutrients  jsonb not null default '{}'::jsonb, -- 칼륨/인/나트륨/단백질 등
  created_at timestamptz not null default now()
);
create index if not exists idx_diet_user on public.diet_logs (user_id, logged_at desc);
alter table public.diet_logs enable row level security;
drop policy if exists diet_all_own on public.diet_logs;
create policy diet_all_own on public.diet_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ====================== 3. NOTIFICATIONS (알림) ============================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  body       text,
  type       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_noti_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists noti_all_own on public.notifications;
create policy noti_all_own on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ====================== 4. COMMUNITY (게시판) ==============================
create table if not exists public.community_posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  author_name      text not null default '사용자',
  title            text not null,
  content          text not null default '',
  post_type        text not null default 'BOARD' check (post_type in ('BOARD','CHALLENGE','SURVEY')),
  image_urls       text[] not null default '{}',
  thumbnail_url    text,
  likes            integer not null default 0,
  comment_count    integer not null default 0,
  view_count       integer not null default 0,
  is_pinned        boolean not null default false,
  is_deleted       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists idx_cp_created on public.community_posts (created_at desc);

create table if not exists public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '사용자',
  content     text not null,
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_cc_post on public.community_comments (post_id);

alter table public.community_posts    enable row level security;
alter table public.community_comments enable row level security;
drop policy if exists cp_select on public.community_posts;
create policy cp_select on public.community_posts for select using (true);
drop policy if exists cp_insert on public.community_posts;
create policy cp_insert on public.community_posts for insert with check (auth.uid() = user_id);
drop policy if exists cp_update on public.community_posts;
create policy cp_update on public.community_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists cc_select on public.community_comments;
create policy cc_select on public.community_comments for select using (true);
drop policy if exists cc_insert on public.community_comments;
create policy cc_insert on public.community_comments for insert with check (auth.uid() = user_id);
drop policy if exists cc_update on public.community_comments;
create policy cc_update on public.community_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 카운터 RPC (RLS 우회: 조회수/좋아요/댓글수)
create or replace function public.cg_increment_views(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.community_posts set view_count = view_count + 1 where id = p_post_id;
$$;
create or replace function public.cg_adjust_likes(p_post_id uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.community_posts set likes = greatest(0, likes + p_delta) where id = p_post_id;
$$;
create or replace function public.cg_adjust_comment_count(p_post_id uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.community_posts
     set comment_count = greatest(0, comment_count + p_delta),
         last_activity_at = case when p_delta > 0 then now() else last_activity_at end
   where id = p_post_id;
$$;
grant execute on function public.cg_increment_views(uuid)               to anon, authenticated;
grant execute on function public.cg_adjust_likes(uuid, integer)         to authenticated;
grant execute on function public.cg_adjust_comment_count(uuid, integer) to authenticated;

-- ====================== 5. STORAGE (이미지) ================================
insert into storage.buckets (id, name, public) values
  ('community-images','community-images', true),
  ('diet-images','diet-images', true)
on conflict (id) do update set public = true;

drop policy if exists img_read on storage.objects;
create policy img_read on storage.objects
  for select using (bucket_id in ('community-images','diet-images'));

drop policy if exists img_insert on storage.objects;
create policy img_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('community-images','diet-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists img_delete on storage.objects;
create policy img_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('community-images','diet-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 완료.
