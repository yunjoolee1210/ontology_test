// Vercel 서버리스 함수 — '새소식' (Supabase DB 적재 기반)
// 동작: ① Supabase news 테이블에서 읽어 반환  ② 마지막 적재가 오래됐으면(>6h)
//       RSS를 수집해 cg_upsert_news RPC로 적재(url 중복 무시) 후 다시 읽어 반환.
// → 한번 적재한 기사는 사라지지 않고 누적. (FastAPI/AI 불필요)
// 사전세팅: supabase_news_setup.sql 1회 실행 필요.

import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || '';
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY || '';
const sb = SB_URL && SB_ANON ? createClient(SB_URL, SB_ANON) : null;

const SOURCES = [
  { name: '보건복지부', url: 'https://www.korea.kr/rss/dept_mw.xml', category: 'policy' },
  { name: '식약처', url: 'https://www.korea.kr/rss/dept_mfds.xml', category: 'medical' },
  { name: 'KHIDI', url: 'https://www.khidi.or.kr/rss?menuId=MENU00100', category: 'medical' },
  {
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=%EC%8B%A0%EC%9E%A5%EB%B3%91+OR+%EC%BD%A9%ED%8C%A5%EB%B3%91+OR+%ED%88%AC%EC%84%9D+OR+%EC%8B%A0%EC%9E%A5%EC%9D%B4%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko',
    category: 'news',
  },
];

const KIDNEY_RE = /(신장|콩팥|투석|신부전|CKD|혈액투석|복막투석|신증|사구체|네프론|만성콩팥|kidney|dialysis|nephro)/i;

// 썸네일 풀 (frontend/public/thumbnails/news/, 전부 640×360) — 콘텐츠 그룹별 다수 보유
const TN = (n: string) => `/thumbnails/news/${n}`;
const THUMB_GROUPS = {
  food: ['news_food-ingredients_thumbnail.jpg', 'news_food_thumbnail.jpg', 'news_fruit_thumbnail.jpg'].map(TN),
  institution: ['news_institution_thumbnail.jpg'].map(TN),
  exam: ['news_hospital-examination_thumbnail.jpg', 'news_hospital-patient_thumbnail.jpg', 'news_patient_thumbnail.jpg', 'news_patient-in-hospital_thumbnail.jpg'].map(TN),
  treat: ['news_hospital-paper_thumbnail.jpg', 'news_hospital_thumbnail.jpg', 'news_hospital-treatment_thumbnail.jpg', 'news_medicine_thumbnail.jpg', 'news_home-medicine_thumbnail.jpg'].map(TN),
  research: ['news_research_thumbnail.jpg', 'news_research-hospital_thumbnail.jpg', 'news_research-paper_thumbnail.jpg', 'news_research-people_thumbnail.jpg'].map(TN),
};
const pickThumb = (title: string, desc: string, idx: number): string => {
  const t = `${title} ${desc}`;
  let g = THUMB_GROUPS.research;
  if (/식단|음식|영양|칼륨|나트륨|단백질|식이|과일|채소|저염|저칼륨|레시피|먹거리/.test(t)) g = THUMB_GROUPS.food;
  else if (/복지|정책|지원|보험|급여|제도|예산|보건복지부|장애|등록|혜택|국회|법안/.test(t)) g = THUMB_GROUPS.institution;
  else if (/연구|논문|학회|발표|저널|규명|study|research/i.test(t)) g = THUMB_GROUPS.research;
  else if (/검사|진단|건강검진|크레아티닌|eGFR|환자|난민/.test(t)) g = THUMB_GROUPS.exam;
  else if (/신약|치료|약물|이식|수술|투석|임상|요법|의약품|허가|처방|병원/.test(t)) g = THUMB_GROUPS.treat;
  return g[idx % g.length];
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const stripHtml = (s: string) => String(s || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const pick = (v: any): string => (typeof v === 'string' ? v : (v?.['#text'] ?? '')).toString();

// 실제 배포 일시 (KST, "YYYY.MM.DD HH:mm")
const fmtDateTime = (d: string | null): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const k = new Date(dt.getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
};

// RSS 수집 → 적재용 아이템 배열 생성
async function buildItems(): Promise<any[]> {
  const results = await Promise.allSettled(
    SOURCES.map(async (s) => {
      const r = await fetch(s.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; CareKidneyBot/1.0)' } });
      if (!r.ok) throw new Error(`${s.name} ${r.status}`);
      const doc = parser.parse(await r.text());
      let items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
      if (!Array.isArray(items)) items = [items];
      return items.map((it: any) => {
        let title = stripHtml(pick(it.title));
        let link = '';
        if (typeof it.link === 'string') link = it.link;
        else if (Array.isArray(it.link)) link = it.link[0]?.['@_href'] || pick(it.link[0]);
        else link = it.link?.['@_href'] || pick(it.link) || pick(it.guid);
        const desc = stripHtml(pick(it.description) || pick(it.summary)).slice(0, 200);
        const pub = pick(it.pubDate) || pick(it.published) || pick(it.updated) || '';
        let outlet = s.name;
        if (s.name === 'Google News') {
          const realSrc = pick(it.source).trim();
          const m = title.match(/^(.*)\s[-–—]\s([^-–—]+)$/);
          if (realSrc) { outlet = realSrc; if (m) title = m[1].trim(); }
          else if (m) { title = m[1].trim(); outlet = m[2].trim(); }
        }
        return { source: outlet, category: s.category, title, link, desc, pub };
      });
    })
  );

  let all: any[] = [];
  for (const r of results) if (r.status === 'fulfilled') all = all.concat(r.value);

  all = all.filter((x) => x.title && x.link && KIDNEY_RE.test(`${x.title} ${x.desc}`));
  all = all.filter((x) => !/vietnam|베트남|\.vn\b/i.test(`${x.source} ${x.title} ${x.link}`));
  const seen = new Set<string>();
  all = all.filter((x) => (seen.has(x.link) ? false : (seen.add(x.link), true)));
  all.sort((a, b) => new Date(b.pub || 0).getTime() - new Date(a.pub || 0).getTime());
  all = all.slice(0, 40);

  return all.map((x, i) => ({
    title: x.title,
    summary: x.desc,
    url: x.link,
    source: x.source,
    category: x.category,
    thumbnail_url: pickThumb(x.title, x.desc, i),
    published_at: x.pub ? new Date(x.pub).toISOString() : '',
  }));
}

const rowToNews = (r: any) => ({
  id: r.id,
  title: r.title,
  description: r.summary || '',
  source: r.source,
  category: r.category,
  url: r.url,
  time: fmtDateTime(r.published_at),
  published_at: r.published_at,
  image: r.thumbnail_url,
  relevance_score: 1,
  keywords: [] as string[],
});

export default async function handler(_req: any, res: any) {
  try {
    // Supabase 미설정 시: 라이브 RSS로라도 동작(임시)
    if (!sb) {
      const items = await buildItems();
      res.setHeader('Cache-Control', 's-maxage=3600');
      res.status(200).json({ success: true, news: items.slice(0, 24).map((x, i) => ({ ...rowToNews({ ...x, id: `live_${i}` }) })) });
      return;
    }

    // 1) DB에서 읽기
    let { data: rows } = await sb.from('news').select('*').order('published_at', { ascending: false }).limit(24);

    // 2) 최근 적재가 6시간 넘었거나 비어있으면 RSS 수집 후 적재
    const fresh =
      rows && rows.length > 0 &&
      rows.some((r: any) => r.scraped_at && Date.now() - new Date(r.scraped_at).getTime() < 6 * 3600 * 1000);

    if (!fresh) {
      const items = await buildItems();
      if (items.length) {
        await sb.rpc('cg_upsert_news', { p_items: items });
        ({ data: rows } = await sb.from('news').select('*').order('published_at', { ascending: false }).limit(24));
      }
    }

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json({ success: true, news: (rows || []).map(rowToNews) });
  } catch (e: any) {
    res.status(200).json({ success: false, news: [], error: e?.message || 'unknown' });
  }
}
