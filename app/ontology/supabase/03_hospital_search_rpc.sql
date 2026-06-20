-- =========================================================
-- 병원 검색 RPC 함수 (v2: dialysis_type을 REQUIRED 슬롯으로 처리)
-- Neo4j 없이 Supabase 단일 쿼리로 "위치 기반 + 역량 필터" 처리
--
-- [v2에서 바뀐 것]
-- intent_slots에서 dialysis_type이 REQUIRED로 바뀐 것에 맞춰
-- search_hospitals_nearby()의 dialysis_type 관련 파라미터를 선택값(DEFAULT NULL)이
-- 아닌 필수 파라미터로 변경. 애플리케이션 레이어(에이전트)는 dialysis_type 슬롯이
-- 채워지기 전(REQUIRED 미충족 상태)에는 이 함수를 호출하지 않아야 한다 -
-- 즉 호출 시점 자체가 "필수 슬롯 충족 후"라는 게 함수 시그니처로 보장됨.
-- location은 원래부터 필수 파라미터(user_lat, user_lng)였으므로 변경 없음.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. 위치+투석종류 기반 병원 검색 (둘 다 REQUIRED, 야간투석/등급은 OPTIONAL)
CREATE OR REPLACE FUNCTION search_hospitals_nearby(
  user_lat DOUBLE PRECISION,        -- REQUIRED: 위치 없이는 호출 자체가 의미 없음
  user_lng DOUBLE PRECISION,        -- REQUIRED
  dialysis_type TEXT,                -- REQUIRED: 'hemodialysis'|'peritoneal'|'none' - 투석 종류별 검색대상이 다르므로 필수
  radius_meters INT DEFAULT 5000,
  require_night_dialysis BOOLEAN DEFAULT NULL,  -- OPTIONAL
  min_grade TEXT DEFAULT NULL,                   -- OPTIONAL, '1등급' 등 - NULL이면 등급 무관
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id INT, name TEXT, address TEXT, phone TEXT,
  hira_grade TEXT, ksn_certified BOOLEAN,
  has_dialysis_unit BOOLEAN, night_dialysis BOOLEAN,
  dialysis_machines INT, distance_m DOUBLE PRECISION,
  naver_map_url TEXT, kakao_map_url TEXT
)
LANGUAGE SQL AS $$
  SELECT
    h.id, h.name, h.address, h.phone,
    h.hira_grade, h.ksn_certified,
    h.has_dialysis_unit, h.night_dialysis,
    h.dialysis_machines,
    ST_Distance(h.location, ST_MakePoint(user_lng, user_lat)::geography) AS distance_m,
    h.naver_map_url, h.kakao_map_url
  FROM hospitals h
  WHERE ST_DWithin(h.location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
    -- dialysis_type='none'이면 투석 여부와 무관하게 검색(증상문진 등 비투석 목적의 병원 조회용 확장 여지)
    AND (dialysis_type = 'none' OR h.has_dialysis_unit = TRUE)
    AND (require_night_dialysis IS NULL OR h.night_dialysis = require_night_dialysis)
    AND (min_grade IS NULL OR h.hira_grade <= min_grade)  -- '1등급' < '2등급' 문자열 비교 주의, 운영시 등급 숫자컬럼 권장
  ORDER BY distance_m ASC
  LIMIT match_count;
$$;

-- 2. 병원 소개글 의미검색 (pgvector) - description_embedding 채워진 후 사용
CREATE OR REPLACE FUNCTION search_hospitals_semantic(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5
)
RETURNS TABLE(id INT, name TEXT, description TEXT, similarity FLOAT)
LANGUAGE SQL AS $$
  SELECT id, name, description,
    1 - (description_embedding <=> query_embedding) AS similarity
  FROM hospitals
  WHERE description_embedding IS NOT NULL
  ORDER BY description_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 3. 위치 + 의미검색 결합 (선택적 사용)
CREATE OR REPLACE FUNCTION search_hospitals_hybrid(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  query_embedding VECTOR(1536),
  radius_meters INT DEFAULT 5000,
  match_count INT DEFAULT 5
)
RETURNS TABLE(id INT, name TEXT, distance_m DOUBLE PRECISION, similarity FLOAT)
LANGUAGE SQL AS $$
  SELECT id, name,
    ST_Distance(location, ST_MakePoint(user_lng, user_lat)::geography) AS distance_m,
    1 - (description_embedding <=> query_embedding) AS similarity
  FROM hospitals
  WHERE ST_DWithin(location, ST_MakePoint(user_lng, user_lat)::geography, radius_meters)
    AND description_embedding IS NOT NULL
  ORDER BY distance_m ASC
  LIMIT match_count;
$$;
