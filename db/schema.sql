-- 콩당콩당 데이터베이스 스키마 정의 (Supabase PostgreSQL)

-- 1. 의료복지 혜택 공공 데이터 테이블
CREATE TABLE IF NOT EXISTS welfare_documents (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  title       TEXT,
  org         TEXT,      -- '보건복지부'|'식약처'|'심평원' 등
  category    TEXT,
  disease     TEXT,      -- 'CKD'|'DM'|'BOTH'
  url         TEXT,
  fts         TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Full-Text Search (FTS) 인덱스 생성
CREATE INDEX IF NOT EXISTS welfare_fts_idx ON welfare_documents USING GIN(fts);

-- 2. PubMed 논문 캐시 테이블
CREATE TABLE IF NOT EXISTS pubmed_cache (
  pmid        TEXT PRIMARY KEY,
  title       TEXT,
  abstract    TEXT,
  doi         TEXT,
  journal     TEXT,
  pub_year    INT,
  disease_tag TEXT,      -- 'CKD'|'DM'|'BOTH'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 의료복지 FTS 검색 RPC 함수 정의
CREATE OR REPLACE FUNCTION search_welfare(
  query TEXT, match_count INT DEFAULT 5
)
RETURNS TABLE(id TEXT, content TEXT, org TEXT, url TEXT, rank REAL)
LANGUAGE SQL AS $$
  SELECT id, content, org, url,
    ts_rank(fts, plainto_tsquery('simple', query)) AS rank
  FROM welfare_documents
  WHERE fts @@ plainto_tsquery('simple', query)
  ORDER BY rank DESC LIMIT match_count;
$$;
