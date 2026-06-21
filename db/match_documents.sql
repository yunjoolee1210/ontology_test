-- =================================================================
-- 콩당콩당 - pgvector 및 papers 테이블 정의 + match_documents RPC 정의
-- =================================================================

-- 1. pgvector Extension 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. papers 테이블 생성 (논문 및 기타 지침 정보 보관)
CREATE TABLE IF NOT EXISTS papers (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  content     TEXT NOT NULL,
  org         TEXT,
  url         TEXT,
  doi         TEXT,
  disease     TEXT,      -- 'CKD'|'DM'|'BOTH'
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. welfare_documents 테이블에 embedding 컬럼 추가 (존재하지 않을 경우만 추가)
ALTER TABLE welfare_documents ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- 4. 다중 테이블 매칭을 수행하는 match_documents RPC 함수 정의
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  table_name TEXT DEFAULT 'papers'
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  org TEXT,
  url TEXT,
  doi TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  IF table_name = 'welfare_documents' THEN
    RETURN QUERY
    SELECT 
      w.id,
      w.title,
      w.content,
      w.org,
      w.url,
      NULL::TEXT AS doi,
      (1 - (w.embedding <=> query_embedding))::FLOAT AS similarity
    FROM welfare_documents w
    WHERE 1 - (w.embedding <=> query_embedding) > match_threshold
    ORDER BY w.embedding <=> query_embedding
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT 
      p.id,
      p.title,
      p.content,
      p.org,
      p.url,
      p.doi,
      (1 - (p.embedding <=> query_embedding))::FLOAT AS similarity
    FROM papers p
    WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;
