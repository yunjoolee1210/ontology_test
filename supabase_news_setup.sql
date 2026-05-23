-- ============================================================================
-- 새소식 DB 적재 — Supabase SQL Editor에 붙여넣고 RUN 1회 (여러 번 실행 안전)
-- news 테이블(url unique로 중복 방지) + 공개 읽기 RLS + 안전 적재 RPC
-- ============================================================================

create table if not exists public.news (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  summary       text,
  url           text unique not null,        -- 중복 방지 키
  source        text not null,               -- 실제 언론사명
  category      text,
  thumbnail_url text,
  published_at  timestamptz,                 -- 실제 배포일시
  scraped_at    timestamptz not null default now()
);
create index if not exists idx_news_published on public.news (published_at desc);

alter table public.news enable row level security;
drop policy if exists news_select on public.news;
create policy news_select on public.news for select using (true);  -- 누구나 읽기(공개)

-- 적재 RPC: RLS 우회(SECURITY DEFINER), 이미 있는 url은 무시 → 기존 기록 보존
create or replace function public.cg_upsert_news(p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.news (title, summary, url, source, category, thumbnail_url, published_at)
  select x.title, x.summary, x.url, x.source, x.category, x.thumbnail_url,
         nullif(x.published_at, '')::timestamptz
  from jsonb_to_recordset(p_items) as x(
    title text, summary text, url text, source text, category text, thumbnail_url text, published_at text
  )
  where x.url is not null and x.title is not null
  on conflict (url) do nothing;
  get diagnostics n = row_count;
  return n;
end; $$;
grant execute on function public.cg_upsert_news(jsonb) to anon, authenticated;
