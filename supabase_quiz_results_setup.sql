-- 퀴즈 결과(계정 연동) — Supabase SQL Editor에 붙여넣고 RUN 1회
-- 사용자별 퀴즈 점수 저장 → 마이페이지/퀴즈미션에서 계정 기준으로 표시
create table if not exists public.quiz_results (
  user_id    uuid not null references auth.users(id) on delete cascade,
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  points     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_id)
);
alter table public.quiz_results enable row level security;
drop policy if exists qr_select on public.quiz_results;
create policy qr_select on public.quiz_results for select using (auth.uid() = user_id);
drop policy if exists qr_insert on public.quiz_results;
create policy qr_insert on public.quiz_results for insert with check (auth.uid() = user_id);
drop policy if exists qr_update on public.quiz_results;
create policy qr_update on public.quiz_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
