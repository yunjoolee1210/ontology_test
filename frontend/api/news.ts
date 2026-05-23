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

// 명세서 5종 고정 썸네일 (frontend/public/thumbnails/news/)
const THUMBS = {
  food: '/thumbnails/news/news_food-ingredients_thumbnail.jpg',          // 식이/영양
  institution: '/thumbnails/news/news_institution_thumbnail.jpg',        // 기관/복지/정책
  examination: '/thumbnails/news/news_hospital-examination_thumbnail.jpg',// 검사/진료
  paper: '/thumbnails/news/news_hospital-paper_thumbnail.jpg',           // 치료/의학/신약
  research: '/thumbnails/news/news_research_thumbnail.jpg',              // 연구/학술
};
// 기사 내용으로 썸네일 선택. 뚜렷한 카테고리(식이/복지/연구/검사)는 매칭하고,
// 나머지 '의료 일반'(투석/치료/이식/병원 등 대다수)은 의료계열 3종을 순환시켜
// 한 이미지로 몰리지 않게 다양성을 확보한다.
const pickThumb = (title: string, desc: string, idx: number): string => {
  const t = `${title} ${desc}`;
  if (/식단|음식|영양|칼륨|나트륨|단백질|식이|과일|채소|저염|저칼륨|레시피|먹거리/.test(t)) return THUMBS.food;
  if (/복지|정책|지원|보험|급여|제도|예산|보건복지부|장애|등록|혜택|국회|법안/.test(t)) return THUMBS.institution;
  if (/연구|논문|학회|발표|저널|규명|study|research/i.test(t)) return THUMBS.research;
  if (/검사|진단|건강검진|크레아티닌|eGFR|선별/.test(t)) return THUMBS.examination;
  // 의료 일반 → 3종 순환 (치료/검사/연구 썸네일 번갈아)
  const rotate = [THUMBS.paper, THUMBS.examination, THUMBS.research];
  return rotate[idx % rotate.length];
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
      image: pickThumb(x.title, x.desc, i),  // 기사 내용 기반 5종 썸네일 선택(다양성)
      relevance_score: 1,
      keywords: [] as string[],
    }));

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ success: true, news });
  } catch (e: any) {
    res.status(200).json({ success: false, news: [], error: e?.message || 'unknown' });
  }
}
