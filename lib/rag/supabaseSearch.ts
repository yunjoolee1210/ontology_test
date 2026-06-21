import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { supabase } from './supabaseClient';

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
    const { data, error } = await supabase.rpc('search_welfare', {
      query: query,
      match_count: matchCount,
    });

    if (error) {
      throw error;
    }

    let results = (data || []) as WelfareDocResult[];

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

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });

    const [{ embedding }] = embeddingResponse.data;

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: matchCount,
      table_name: tableName,
    });

    if (error) {
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
