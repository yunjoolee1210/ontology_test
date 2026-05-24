// 새소식 조회 (Supabase 직접 — 빠른 로딩)
// RSS 수집/적재는 백그라운드 cron(/api/news)이 담당. 프론트는 DB만 읽는다.

import { supabase } from '../lib/supabase';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  category: string;
  url: string;
  time: string;
  published_at: string | null;
  image: string | null;
  relevance_score: number;
  keywords: string[];
}

const fmtDateTime = (d: string | null): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const k = new Date(dt.getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
};

export const listNews = async (limit = 24): Promise<NewsItem[]> => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.summary || '',
    source: r.source,
    category: r.category,
    url: r.url,
    time: fmtDateTime(r.published_at),
    published_at: r.published_at,
    image: r.thumbnail_url || null,
    relevance_score: 1,
    keywords: [],
  }));
};
