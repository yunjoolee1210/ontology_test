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

// 썸네일 풀 (frontend/public/thumbnails/news/, 전부 640×360) — 콘텐츠 그룹별 다수 보유
const TN = (n: string) => `/thumbnails/news/${n}`;
const THUMB_GROUPS = {
  food: ['news_food-ingredients_thumbnail.jpg', 'news_food_thumbnail.jpg', 'news_fruit_thumbnail.jpg'].map(TN),
  institution: ['news_institution_thumbnail.jpg'].map(TN),
  exam: ['news_hospital-examination_thumbnail.jpg', 'news_hospital-patient_thumbnail.jpg', 'news_patient_thumbnail.jpg', 'news_patient-in-hospital_thumbnail.jpg'].map(TN),
  treat: ['news_hospital-paper_thumbnail.jpg', 'news_hospital_thumbnail.jpg', 'news_hospital-treatment_thumbnail.jpg', 'news_medicine_thumbnail.jpg', 'news_home-medicine_thumbnail.jpg'].map(TN),
  research: ['news_research_thumbnail.jpg', 'news_research-hospital_thumbnail.jpg', 'news_research-paper_thumbnail.jpg', 'news_research-people_thumbnail.jpg'].map(TN),
};
// 기사 내용(제목+요약)으로 그룹 선택 후, 그룹 내에서 인덱스로 순환 → 같은 주제도 다양한 썸네일.
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

// 실제 배포 일시 (KST, "YYYY.MM.DD HH:mm")
const fmtDateTime = (d: string | null): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const k = new Date(dt.getTime() + 9 * 3600 * 1000); // UTC→KST
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
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
          let title = stripHtml(pick(it.title));
          let link = '';
          if (typeof it.link === 'string') link = it.link;
          else if (Array.isArray(it.link)) link = it.link[0]?.['@_href'] || pick(it.link[0]);
          else link = it.link?.['@_href'] || pick(it.link) || pick(it.guid);
          const desc = stripHtml(pick(it.description) || pick(it.summary)).slice(0, 200);
          const pub = pick(it.pubDate) || pick(it.published) || pick(it.updated) || null;

          // 출처: Google News는 실제 언론사명 사용 (<source> 태그 또는 제목의 ' - 언론사' 접미사)
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

    // 신장 관련만, 유효 링크/제목만
    all = all.filter((x) => x.title && x.link && KIDNEY_RE.test(`${x.title} ${x.desc}`));
    // 베트남 매체/기사 제외
    all = all.filter((x) => !/vietnam|베트남|\.vn\b/i.test(`${x.source} ${x.title} ${x.link}`));
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
      time: fmtDateTime(x.pub),
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
