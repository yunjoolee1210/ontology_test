// Vercel 서버리스 함수 — '새소식' (RSS 수집)
// 새소식_개발명세서 기반: 국내 공식기관 + Google News(한국) RSS를 수집해
// 신장병 관련 기사만 필터링, 카테고리/썸네일 매핑 후 반환. (FastAPI/AI 불필요)
// 응답은 CDN 캐시(s-maxage)로 성능 확보 — 매 요청 fetch 부담 감소.

import { XMLParser } from 'fast-xml-parser';

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

// 신장 관련 키워드 (공식기관 일반 보도자료에서 신장 관련만 추림)
const KIDNEY_RE = /(신장|콩팥|투석|신부전|CKD|혈액투석|복막투석|신증|사구체|네프론|만성콩팥|kidney|dialysis|nephro)/i;

const CATEGORY_IMG: Record<string, string> = {
  policy: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&h=360&fit=crop',
  medical: 'https://images.unsplash.com/photo-1581595219315-a187dd40c322?w=640&h=360&fit=crop',
  news: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=640&h=360&fit=crop',
  nutrition: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=640&h=360&fit=crop',
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const stripHtml = (s: string) => String(s || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const extractImg = (s: string): string | null => {
  const m = String(s || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
};

const relTime = (d: string | null): string => {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (day < 7) return `${day}일 전`;
  return new Date(d).toLocaleDateString('ko-KR');
};

const pick = (v: any): string => (typeof v === 'string' ? v : (v?.['#text'] ?? '')).toString();

export default async function handler(_req: any, res: any) {
  try {
    const results = await Promise.allSettled(
      SOURCES.map(async (s) => {
        const r = await fetch(s.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; CareKidneyBot/1.0)' } });
        if (!r.ok) throw new Error(`${s.name} ${r.status}`);
        const xml = await r.text();
        const doc = parser.parse(xml);
        let items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
        if (!Array.isArray(items)) items = [items];
        return items.map((it: any) => {
          const title = stripHtml(pick(it.title));
          let link = '';
          if (typeof it.link === 'string') link = it.link;
          else if (Array.isArray(it.link)) link = it.link[0]?.['@_href'] || pick(it.link[0]);
          else link = it.link?.['@_href'] || pick(it.link) || pick(it.guid);
          const desc = stripHtml(pick(it.description) || pick(it.summary)).slice(0, 200);
          const pub = pick(it.pubDate) || pick(it.published) || pick(it.updated) || null;
          const image =
            it['media:content']?.['@_url'] ||
            it['media:thumbnail']?.['@_url'] ||
            it.enclosure?.['@_url'] ||
            extractImg(pick(it.description)) ||
            null;
          return { source: s.name, category: s.category, title, link, desc, pub, image };
        });
      })
    );

    let all: any[] = [];
    for (const r of results) if (r.status === 'fulfilled') all = all.concat(r.value);

    // 신장 관련만, 유효 링크/제목만
    all = all.filter((x) => x.title && x.link && KIDNEY_RE.test(`${x.title} ${x.desc}`));
    // url 중복 제거
    const seen = new Set<string>();
    all = all.filter((x) => (seen.has(x.link) ? false : (seen.add(x.link), true)));
    // 최신순
    all.sort((a, b) => new Date(b.pub || 0).getTime() - new Date(a.pub || 0).getTime());
    all = all.slice(0, 24);

    const news = all.map((x, i) => ({
      id: `news_${i}_${hash(x.link)}`,
      title: x.title,
      description: x.desc,
      source: x.source,
      category: x.category,
      url: x.link,
      time: relTime(x.pub),
      published_at: x.pub ? new Date(x.pub).toISOString() : null,
      image: x.image || CATEGORY_IMG[x.category] || null,
      relevance_score: 1,
      keywords: [] as string[],
    }));

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ success: true, news });
  } catch (e: any) {
    res.status(200).json({ success: false, news: [], error: e?.message || 'unknown' });
  }
}
