-- ================================================================
-- 투석 병원 테이블 생성 + 시드 데이터
-- Supabase SQL Editor에서 실행
-- ================================================================

create table if not exists public.dialysis_hospitals (
  id                uuid    default gen_random_uuid() primary key,
  name              text    not null,
  address           text    not null default '',
  phone             text    not null default '',
  region            text    not null default '',
  dialysis_machines integer not null default 0,
  has_dialysis_unit boolean not null default false,
  night_dialysis    boolean not null default false,
  dialysis_days     text    not null default '',
  lat               double precision not null,
  lng               double precision not null,
  created_at        timestamptz default now()
);

alter table public.dialysis_hospitals enable row level security;
drop policy if exists "hospitals_public_read" on public.dialysis_hospitals;
create policy "hospitals_public_read" on public.dialysis_hospitals
  for select using (true);

-- ----------------------------------------------------------------
-- 인덱스
-- ----------------------------------------------------------------
create index if not exists dialysis_hospitals_region_idx  on public.dialysis_hospitals(region);
create index if not exists dialysis_hospitals_unit_idx    on public.dialysis_hospitals(has_dialysis_unit);
create index if not exists dialysis_hospitals_night_idx   on public.dialysis_hospitals(night_dialysis);
create index if not exists dialysis_hospitals_machines_idx on public.dialysis_hospitals(dialysis_machines);

-- ----------------------------------------------------------------
-- 시드 데이터 (주요 투석 병원 / Google Drive CSV 데이터 확인된 병원 포함)
-- ----------------------------------------------------------------
insert into public.dialysis_hospitals
  (name, address, phone, region, dialysis_machines, has_dialysis_unit, night_dialysis, dialysis_days, lat, lng)
values
  -- 서울 (야간투석 포함)
  ('서울대학교병원',              '서울특별시 종로구 대학로 101',               '02-2072-2114', '서울', 0,  true,  false, '',              37.5794, 126.9990),
  ('세브란스병원',                '서울특별시 서대문구 연세로 50-1',            '02-2228-1234', '서울', 0,  true,  false, '',              37.5621, 126.9414),
  ('삼성서울병원',                '서울특별시 강남구 일원로 81',                '02-3410-2114', '서울', 0,  true,  false, '',              37.4885, 127.0856),
  ('서울아산병원',                '서울특별시 송파구 올림픽로43길 88',          '02-3010-3114', '서울', 0,  true,  false, '',              37.5261, 127.1078),
  ('강동경희대학교의대병원',      '서울특별시 강동구 동남로 892',               '02-440-7000',  '서울', 0,  true,  true,  '월, 수, 금',   37.5424, 127.1494),
  ('경희대학교병원',              '서울특별시 동대문구 경희대로 23',            '02-958-8114',  '서울', 0,  true,  true,  '월~토',        37.5968, 127.0540),
  ('고려대학교 안암병원',         '서울특별시 성북구 고려대로 73',              '02-920-5114',  '서울', 0,  true,  true,  '월, 수, 금',   37.5876, 127.0269),
  ('고려대학교 구로병원',         '서울특별시 구로구 구로동로 148',             '02-2626-1114', '서울', 0,  true,  true,  '월, 수, 금',   37.4979, 126.8572),
  ('가톨릭대학교 서울성모병원',   '서울특별시 서초구 반포대로 222',             '02-2258-5745', '서울', 0,  true,  false, '',              37.5008, 127.0012),
  ('가톨릭대학교 여의도성모병원', '서울특별시 영등포구 63로 10',               '02-3779-1114', '서울', 0,  true,  true,  '월, 수, 금',   37.5181, 126.9245),
  ('순천향대학교 서울병원',       '서울특별시 용산구 대사관로 59',              '02-709-9114',  '서울', 0,  true,  true,  '월~토',        37.5373, 126.9764),
  ('노원을지대학교병원',          '서울특별시 노원구 한글비석로 68',            '1899-0001',    '서울', 0,  true,  true,  '월, 수, 금',   37.6570, 127.0597),
  ('동서요양병원',                '서울특별시 성북구 길음로 19',                '02-944-7700',  '서울', 0,  true,  true,  '월~토',        37.6065, 127.0234),
  ('서울제일요양병원',            '서울특별시 양천구 목동동로 257',             '02-2603-0001', '서울', 0,  true,  true,  '월~토',        37.5233, 126.8697),

  -- 경기
  ('분당서울대학교병원',          '경기도 성남시 분당구 구미로 173번길 82',     '031-787-7114', '경기', 0,  true,  false, '',              37.3514, 127.1186),
  ('아주대학교병원',              '경기도 수원시 영통구 월드컵로 164',          '031-219-5114', '경기', 0,  true,  false, '',              37.2820, 127.0445),
  ('순천향대학교 부천병원',       '경기도 부천시 조마루로 170',                '032-621-5114', '경기', 0,  true,  true,  '월~토',        37.5027, 126.7671),
  ('가톨릭대학교 의정부성모병원', '경기도 의정부시 천보로 271',                '031-820-3114', '경기', 0,  true,  true,  '월~토',        37.7413, 127.0523),
  ('한림대학교성심병원',          '경기도 안양시 동안구 관평로 170번길 22',    '031-380-1114', '경기', 0,  true,  false, '',              37.3890, 126.9508),
  ('근로복지공단안산병원',        '경기도 안산시 단원구 적금로 114',            '031-500-1234', '경기', 0,  true,  true,  '월, 수, 금',   37.3277, 126.8283),

  -- 인천
  ('인하대학교병원',              '인천광역시 중구 인항로 27',                  '032-890-2114', '인천', 0,  true,  false, '',              37.4501, 126.6502),
  ('가천대학교 길병원',           '인천광역시 남동구 남동대로774번길 21',       '1577-2299',    '인천', 0,  true,  false, '',              37.4439, 126.7070),
  ('(사)모퉁이복지재단 인천재활의원', '인천광역시 미추홀구 인주대로 290',      '032-861-0102', '인천', 55, true,  false, '',              37.4519, 126.6686),

  -- 부산
  ('부산대학교병원',              '부산광역시 서구 구덕로 179',                 '051-240-7000', '부산', 0,  true,  false, '',              35.1070, 129.0175),
  ('동아대학교병원',              '부산광역시 서구 대신공원로 26',              '051-240-2400', '부산', 0,  true,  true,  '월~토',        35.0984, 128.9965),
  ('고신대학교 복음병원',         '부산광역시 서구 감천로 262',                 '051-990-6114', '부산', 0,  true,  false, '',              35.0993, 129.0058),
  ('인제대학교 부산백병원',       '부산광역시 부산진구 복지로 75',              '051-890-6000', '부산', 0,  true,  false, '',              35.1569, 129.0585),

  -- 대구
  ('경북대학교병원',              '대구광역시 중구 동덕로 130',                 '053-200-5114', '대구', 0,  true,  false, '',              35.8695, 128.6010),
  ('계명대학교 동산병원',         '대구광역시 달서구 달구벌대로 1035',          '053-250-7114', '대구', 0,  true,  true,  '월, 수, 금',   35.8527, 128.5067),
  ('대구가톨릭대학교병원',        '대구광역시 남구 두류공원로17길 33',          '053-650-4114', '대구', 0,  true,  true,  '월, 수, 금',   35.8502, 128.5828),
  ('영남대학교병원',              '대구광역시 남구 현충로 170',                 '053-620-3114', '대구', 0,  true,  false, '',              35.8462, 128.6023),

  -- 광주
  ('전남대학교병원',              '광주광역시 동구 제봉로 42',                  '062-220-5114', '광주', 0,  true,  false, '',              35.1440, 126.9269),
  ('조선대학교병원',              '광주광역시 동구 필문대로 365',               '062-220-3114', '광주', 0,  true,  false, '',              35.1450, 126.9321),

  -- 대전
  ('충남대학교병원',              '대전광역시 중구 문화로 282',                 '042-280-7114', '대전', 0,  true,  false, '',              36.3227, 127.4199),
  ('을지대학교 대전병원',         '대전광역시 서구 둔산서로 95',                '042-611-3000', '대전', 0,  true,  false, '',              36.3521, 127.3840),

  -- 울산
  ('울산대학교병원',              '울산광역시 동구 전하로 877',                 '052-250-7000', '울산', 0,  true,  false, '',              35.5378, 129.3771),

  -- 경남
  ('양산부산대학교병원',          '경상남도 양산시 물금읍 금오로 20',           '055-360-2000', '경남', 0,  true,  false, '',              35.3390, 129.0101),

  -- 경북
  ('안동성소병원',                '경상북도 안동시 앙실로 11',                  '054-858-2000', '경북', 0,  true,  true,  '월, 수, 금',   36.5683, 128.7186),

  -- 충북
  ('(사)대한신장복지회 대신의원', '충청북도 청주시 청원구 충청대로 93',         '043-224-0825', '충북', 42, true,  false, '',              36.6648, 127.4929),
  ('충북대학교병원',              '충청북도 청주시 서원구 1순환로 776',         '043-269-6114', '충북', 0,  true,  false, '',              36.6260, 127.4568),

  -- 충남
  ('순천향대학교 천안병원',       '충청남도 천안시 동남구 순천향6길 31',        '041-570-2114', '충남', 0,  true,  true,  '월~토',        36.8155, 127.1595),
  ('단국대학교병원',              '충청남도 천안시 동남구 망향로 201',          '041-550-6114', '충남', 0,  true,  false, '',              36.8216, 127.1569),

  -- 전남
  ('화순전남대학교병원',          '전라남도 화순군 화순읍 서양로 322',          '061-379-7114', '전남', 0,  true,  false, '',              35.0622, 126.9872),

  -- 전북
  ('전북대학교병원',              '전북특별자치도 전주시 덕진구 건지로 20',     '063-250-1114', '전북', 0,  true,  false, '',              35.8460, 127.1308),

  -- 강원
  ('원주세브란스기독병원',        '강원특별자치도 원주시 일산로 20',            '033-741-0114', '강원', 0,  true,  false, '',              37.3444, 127.9456),
  ('강릉아산병원',                '강원특별자치도 강릉시 사천면 방동길 38',     '033-610-3114', '강원', 0,  true,  false, '',              37.7667, 128.9072),

  -- 제주
  ('제주대학교병원',              '제주특별자치도 제주시 아란13길 15',          '064-717-1114', '제주', 0,  true,  false, '',              33.4856, 126.4796),
  ('한라병원',                    '제주특별자치도 제주시 도령로 65',            '064-740-5000', '제주', 0,  true,  false, '',              33.5055, 126.5045)
on conflict do nothing;


-- ================================================================
-- 전체 CSV 데이터 임포트 방법 (로컬에서 실행)
-- ================================================================
-- 1. Google Drive에서 hospital_pharmacy_dialysis_2025.csv 다운로드
-- 2. 아래 Python 스크립트를 로컬에서 실행:
--
-- import pandas as pd
-- from supabase import create_client
--
-- SUPABASE_URL = "https://qcisckvrfhnzpsulrufe.supabase.co"
-- SUPABASE_KEY = "<service_role_key>"
-- client = create_client(SUPABASE_URL, SUPABASE_KEY)
--
-- df = pd.read_csv("hospital_pharmacy_dialysis_2025.csv")
-- dialysis = df[df["has_dialysis_unit"] == True].copy()
-- dialysis = dialysis.dropna(subset=["lat", "lng"])
--
-- for _, row in dialysis.iterrows():
--     client.table("dialysis_hospitals").upsert({
--         "name": row["name"],
--         "address": row["address"],
--         "phone": str(row.get("phone", "")),
--         "region": row.get("region", ""),
--         "dialysis_machines": int(row.get("dialysis_machines", 0) or 0),
--         "has_dialysis_unit": bool(row.get("has_dialysis_unit", False)),
--         "night_dialysis": bool(row.get("night_dialysis", False)),
--         "dialysis_days": str(row.get("dialysis_days", "") or ""),
--         "lat": float(row["lat"]),
--         "lng": float(row["lng"]),
--     }, on_conflict="name,address").execute()
-- ================================================================
