-- 병원 검진 기록(검진결과 OCR) — Supabase SQL Editor에 붙여넣고 RUN 1회
-- test_results 테이블(계정별) + RLS + 검진결과 이미지 스토리지 버킷
create table if not exists public.test_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  test_date    date,
  hospital_name text,
  lab_results  jsonb not null default '{}'::jsonb,  -- {field:{value,unit}}
  image_url    text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_tr_user on public.test_results (user_id, test_date desc);
alter table public.test_results enable row level security;
drop policy if exists tr_all_own on public.test_results;
create policy tr_all_own on public.test_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 검진결과 이미지 버킷
insert into storage.buckets (id, name, public) values ('test-images','test-images', true)
on conflict (id) do update set public = true;
drop policy if exists tr_img_read on storage.objects;
create policy tr_img_read on storage.objects for select using (bucket_id = 'test-images');
drop policy if exists tr_img_insert on storage.objects;
create policy tr_img_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'test-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists tr_img_delete on storage.objects;
create policy tr_img_delete on storage.objects for delete to authenticated
  using (bucket_id = 'test-images' and (storage.foldername(name))[1] = auth.uid()::text);
