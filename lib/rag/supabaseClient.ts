import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/$/, '');
}
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export interface WelfareDocResult {
  id: string;
  content: string;
  org: string;
  url: string;
  rank: number;
  title?: string;
  disease?: 'CKD' | 'DM' | 'BOTH';
}

export interface VectorDocResult {
  id: string;
  title?: string;
  content: string;
  org?: string;
  url?: string;
  doi?: string;
  score?: number;
}

export async function searchWelfareDocs(
  query: string,
  diseaseFilter?: 'CKD' | 'DM' | 'BOTH',
  matchCount: number = 5
): Promise<WelfareDocResult[]> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase URL or Anon Key is missing. Returning empty array.');
      return [];
    }

    // search_welfare RPC 호출
    const { data, error } = await supabase.rpc('search_welfare', {
      query: query,
      match_count: matchCount,
    });

    if (error) {
      throw error;
    }

    let results = (data || []) as WelfareDocResult[];

    // 질병 필터가 주어졌다면 필터링 수행
    if (diseaseFilter && diseaseFilter !== 'BOTH') {
      results = results.filter(doc => 
        !doc.disease || doc.disease === diseaseFilter || doc.disease === 'BOTH'
      );
    }

    return results;
  } catch (error) {
    console.error('Error during Supabase welfare search:', error);
    return [];
  }
}

export async function searchSupabaseVectors(
  tableName: string,
  queryText: string,
  matchCount: number = 5
): Promise<VectorDocResult[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key missing in searchSupabaseVectors.');
      return [];
    }

    // 1. OpenAI를 사용하여 검색어 임베딩 생성 (1536 차원)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });

    const [{ embedding }] = embeddingResponse.data;

    // 2. Supabase pgvector RPC 호출 (match_documents)
    // 다른 개발자가 구축할 테이블(tableName)과 매칭하는 match_documents RPC 함수 호출
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: matchCount,
    });

    if (error) {
      // 아직 DB에 RPC 함수나 테이블이 준비되지 않았을 경우 경고만 출력하고 빈 배열 리턴 (Graceful Fallback)
      console.warn(`Supabase RPC match_documents failed for ${tableName} (it may not be deployed yet):`, error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title || '조회된 지침 정보',
      content: row.content || row.abstract || '',
      org: row.org || '공식 정보처',
      url: row.url || undefined,
      doi: row.doi || undefined,
      score: row.similarity ?? 0,
    }));
  } catch (error) {
    console.error('Error during Supabase vector search:', error);
    return [];
  }
}

