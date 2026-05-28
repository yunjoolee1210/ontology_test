-- ================================================================
-- 레시피 코치 기능 확장 마이그레이션
-- Supabase SQL Editor에서 실행
-- ================================================================

-- 1. recipes 테이블 컬럼 추가
alter table public.recipes
  add column if not exists likes_count    integer default 0,
  add column if not exists dislikes_count integer default 0,
  add column if not exists is_user_submitted boolean default false,
  add column if not exists submitted_by  uuid references auth.users(id) on delete set null;

-- ----------------------------------------------------------------
-- 2. recipe_votes (좋아요 / 싫어요)
-- ----------------------------------------------------------------
create table if not exists public.recipe_votes (
  id         uuid default gen_random_uuid() primary key,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  vote_type  text not null check (vote_type in ('like', 'dislike')),
  created_at timestamp with time zone default now(),
  unique(recipe_id, user_id)
);

alter table public.recipe_votes enable row level security;
drop policy if exists "votes_select" on public.recipe_votes;
drop policy if exists "votes_insert" on public.recipe_votes;
drop policy if exists "votes_update" on public.recipe_votes;
drop policy if exists "votes_delete" on public.recipe_votes;
create policy "votes_select" on public.recipe_votes for select using (true);
create policy "votes_insert" on public.recipe_votes for insert with check (auth.uid() = user_id);
create policy "votes_update" on public.recipe_votes for update using (auth.uid() = user_id);
create policy "votes_delete" on public.recipe_votes for delete using (auth.uid() = user_id);

-- 투표 수 자동 반영 트리거
create or replace function sync_recipe_vote_counts()
returns trigger language plpgsql as $$
declare
  target_id uuid;
begin
  target_id := coalesce(NEW.recipe_id, OLD.recipe_id);
  update public.recipes set
    likes_count    = (select count(*) from public.recipe_votes where recipe_id = target_id and vote_type = 'like'),
    dislikes_count = (select count(*) from public.recipe_votes where recipe_id = target_id and vote_type = 'dislike')
  where id = target_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_recipe_votes on public.recipe_votes;
create trigger trg_recipe_votes
  after insert or update or delete on public.recipe_votes
  for each row execute function sync_recipe_vote_counts();

-- ----------------------------------------------------------------
-- 3. recipe_products (재료 → 제품 링크)
-- ----------------------------------------------------------------
create table if not exists public.recipe_products (
  id                  uuid default gen_random_uuid() primary key,
  ingredient_keyword  text not null unique,  -- 재료 키워드 (ex: '저염간장')
  product_name        text not null,          -- 제품명 (ex: '겐타 저나트륨 간장 500ml')
  coupang_url         text not null,          -- 쿠팡 파트너스 링크 (실제 링크로 교체 필요)
  created_at          timestamp with time zone default now()
);

alter table public.recipe_products enable row level security;
drop policy if exists "products_select" on public.recipe_products;
create policy "products_select" on public.recipe_products for select using (true);

-- 샘플 제품 데이터 (쿠팡 파트너스 실제 링크로 교체 필요)
insert into public.recipe_products (ingredient_keyword, product_name, coupang_url) values
  ('저염간장', '겐타 저나트륨 간장 500ml', 'https://link.coupang.com/a/recipe-soy'),
  ('들깨가루', '청정원 국산 들깨가루 300g', 'https://link.coupang.com/a/recipe-sesame'),
  ('저염된장', '청정원 저염 된장 500g', 'https://link.coupang.com/a/recipe-miso'),
  ('가쓰오부시', '마루상 가쓰오부시 30g', 'https://link.coupang.com/a/recipe-katsuo'),
  ('다시마', '청정원 국산 다시마 40g', 'https://link.coupang.com/a/recipe-kelp')
on conflict (ingredient_keyword) do nothing;

-- ----------------------------------------------------------------
-- 4. recipes 테이블 RLS (아직 미적용인 경우)
-- ----------------------------------------------------------------
alter table public.recipes enable row level security;
drop policy if exists "recipes_select" on public.recipes;
drop policy if exists "recipes_insert_user" on public.recipes;
create policy "recipes_select" on public.recipes for select using (true);
-- 로그인 사용자가 본인 레시피 등록 (is_user_submitted = true 강제)
create policy "recipes_insert_user" on public.recipes for insert
  with check (auth.uid() = submitted_by and is_user_submitted = true);

-- ----------------------------------------------------------------
-- 5. Storage 버킷 정책 (대시보드에서 수동 설정 필요)
-- ----------------------------------------------------------------
-- Supabase 대시보드 > Storage > recipe-images 버킷:
--   [Policies] > New Policy:
--     - SELECT: 모든 사용자 허용 (public)
--     - INSERT: authenticated 사용자만 허용
--       조건: bucket_id = 'recipe-images'

-- ----------------------------------------------------------------
-- 7. recipe_comments (레시피 댓글)
-- ----------------------------------------------------------------
create table if not exists public.recipe_comments (
  id          uuid default gen_random_uuid() primary key,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '익명',
  content     text not null check (char_length(content) >= 1 and char_length(content) <= 500),
  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone default now()
);

alter table public.recipe_comments enable row level security;
drop policy if exists "comments_select"        on public.recipe_comments;
drop policy if exists "comments_insert"        on public.recipe_comments;
drop policy if exists "comments_update_own"    on public.recipe_comments;
drop policy if exists "comments_delete_own"    on public.recipe_comments;
create policy "comments_select"     on public.recipe_comments for select using (true);
create policy "comments_insert"     on public.recipe_comments for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on public.recipe_comments for update using (auth.uid() = user_id);
create policy "comments_delete_own" on public.recipe_comments for delete using (auth.uid() = user_id);
