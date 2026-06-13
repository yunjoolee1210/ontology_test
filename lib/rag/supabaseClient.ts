import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/$/, '');
}
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface WelfareDocResult {
  id: string;
  content: string;
  org: string;
  url: string;
  rank: number;
  title?: string;
  disease?: 'CKD' | 'DM' | 'BOTH';
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
