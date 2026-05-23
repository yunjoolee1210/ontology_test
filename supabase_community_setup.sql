-- ============================================================================
-- CareGuide 커뮤니티 게시판 — Supabase 세팅 SQL
-- Supabase Dashboard > SQL Editor 에 붙여넣고 RUN 한 번만 실행하면 됩니다.
-- (테이블 + RLS 정책 + 카운터 RPC + 이미지 스토리지 버킷/정책)
-- 안전하게 여러 번 실행 가능(IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

-- 1) 게시글 테이블 -----------------------------------------------------------
create table if not exists public.community_posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  author_name      text not null default '사용자',
  title            text not null,
  content          text not null default '',
  post_type        text not null default 'BOARD'
                     check (post_type in ('BOARD','CHALLENGE','SURVEY')),
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
create index if not exists idx_cp_created  on public.community_posts (created_at desc);
create index if not exists idx_cp_type     on public.community_posts (post_type);
create index if not exists idx_cp_deleted  on public.community_posts (is_deleted);

-- 2) 댓글 테이블 -------------------------------------------------------------
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

-- 3) RLS (Row Level Security) ------------------------------------------------
alter table public.community_posts    enable row level security;
alter table public.community_comments enable row level security;

-- 읽기: 누구나(비로그인 포함) 가능
drop policy if exists cp_select on public.community_posts;
create policy cp_select on public.community_posts
  for select using (true);

-- 작성: 로그인 사용자가 본인 user_id 로만
drop policy if exists cp_insert on public.community_posts;
create policy cp_insert on public.community_posts
  for insert with check (auth.uid() = user_id);

-- 수정/삭제(소프트삭제 포함): 작성자 본인만
drop policy if exists cp_update on public.community_posts;
create policy cp_update on public.community_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cc_select on public.community_comments;
create policy cc_select on public.community_comments
  for select using (true);

drop policy if exists cc_insert on public.community_comments;
create policy cc_insert on public.community_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists cc_update on public.community_comments;
create policy cc_update on public.community_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) 카운터 RPC (SECURITY DEFINER 로 RLS 우회 — 조회수/좋아요/댓글수) --------
create or replace function public.cg_increment_views(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.community_posts set view_count = view_count + 1 where id = p_post_id;
$$;

create or replace function public.cg_adjust_likes(p_post_id uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.community_posts
     set likes = greatest(0, likes + p_delta)
   where id = p_post_id;
$$;

create or replace function public.cg_adjust_comment_count(p_post_id uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.community_posts
     set comment_count = greatest(0, comment_count + p_delta),
         last_activity_at = case when p_delta > 0 then now() else last_activity_at end
   where id = p_post_id;
$$;

-- 좋아요/조회수는 로그인 사용자(또는 익명)도 호출 가능해야 하므로 실행권한 부여
grant execute on function public.cg_increment_views(uuid)            to anon, authenticated;
grant execute on function public.cg_adjust_likes(uuid, integer)      to authenticated;
grant execute on function public.cg_adjust_comment_count(uuid, integer) to authenticated;

-- 5) 이미지 스토리지 버킷 + 정책 --------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-images', 'community-images', true)
on conflict (id) do update set public = true;

-- 공개 읽기
drop policy if exists cg_img_read on storage.objects;
create policy cg_img_read on storage.objects
  for select using (bucket_id = 'community-images');

-- 업로드: 로그인 사용자, 본인 폴더(user_id/...) 에만
drop policy if exists cg_img_insert on storage.objects;
create policy cg_img_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 본인 이미지 삭제 허용
drop policy if exists cg_img_delete on storage.objects;
create policy cg_img_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 완료. 이후 앱에서 글/댓글/이미지 작성이 동작합니다.
