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

-- 4. 사용자 테이블 (demo/stub 및 기본 Supabase Auth 연동용)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'disabled'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 사용자 프로필 테이블 (Role & Conditions)
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'patient', -- 'patient' | 'caregiver' | 'researcher'
  conditions    TEXT[] NOT NULL DEFAULT '{}',    -- 'kidney' | 'diabetes' 복수 선택
  ckd_stage     TEXT,
  dialysis_type TEXT,
  diabetes_type TEXT,
  medication    TEXT,
  other_conditions TEXT[] DEFAULT '{}',
  points        INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 채팅 세션 테이블
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            TEXT PRIMARY KEY, -- sessionId (Client-generated or timestamp-based string)
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 비로그인 시 NULL 가능
  title         TEXT DEFAULT '새로운 대화',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role          TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content       TEXT NOT NULL,
  agent_type    TEXT,          -- 'medical' | 'nutrition' | 'welfare' | 'research' | 'drug' | 'lifestyle' | 'general'
  sources       JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 대화 평가 피드백 테이블 (AI 답변 개선용)
CREATE TABLE IF NOT EXISTS conversation_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  message_id    UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  rating        INT CHECK (rating >= 1 AND rating <= 5),
  tags          TEXT[] DEFAULT '{}', -- good, excellent, hallucination, incorrect, unsafe, irrelevant, incomplete
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 관리자 감사 로그 테이블
CREATE TABLE IF NOT EXISTS admin_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL, -- 'ROLE_CHANGE' | 'USER_DISABLE' | 'FEEDBACK_SAVE' | 'MESSAGE_DELETE' 등
  target_id     TEXT,
  details       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- Row-Level Security (RLS) 정책 정의 (보안 강화)
-- =================================================================

-- 1) user_profiles 테이블 RLS 설정
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for signup" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow individual read" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Allow individual update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2) chat_sessions 테이블 RLS 설정
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual session insert" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow individual session select" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow individual session delete" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 3) chat_messages 테이블 RLS 설정
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow session message insert" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR chat_sessions.user_id IS NULL)
    )
  );

CREATE POLICY "Allow session message select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR chat_sessions.user_id IS NULL)
    )
  );
