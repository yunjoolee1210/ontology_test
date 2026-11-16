'use client';

// CareKidney — 같은 모델의 '단독' vs '+온톨로지' 답변을 실시간으로 나란히 비교 (내부 검토용, 비밀번호 보호)
import React, { useEffect, useState } from 'react';

type Model = { id: string; label: string; provider: string };
type Check = { nutrient: string; value: number; limit: number; status: string };
type KgTrace = {
  parsed?: { stages?: string[] };
  food_match?: { name: string; reason?: string } | null;
  conclusion?: string | null;
  kg?: { 판정: string; 판정기준량: string; 판정근거: Check[]; 피해야할이유: string[] } | null;
};
type Result = { status: 'idle' | 'loading' | 'done' | 'error'; answer?: string; seconds?: number; error?: string; trace?: KgTrace };

const EXAMPLES = [
  '신장이식 후, 여성, 61세, 키 156, 몸무게 49, 육회 먹어도 돼?',
  '만성콩팥병 5기, 복막투석, 남성, 58세, 키 177, 몸무게 60, 곱창 먹어도 돼?',
  '만성콩팥병 5기, 혈액투석, 여성, 42세 키 173, 몸무게 58, 짬뽕 먹어도 돼?',
  '만성콩팥병 4기,여성, 64세, 키 160, 몸무게 53, 회 먹어도 돼?',
  '만성콩팥병 3기,남성, 36세, 키 178, 몸무게 63, 매운탕 먹어도 돼?',
  '만성콩팥병 2기,여성, 32세, 키 158, 몸무게 49, 떡볶이 먹어도 돼?',
  '만성콩팥병 1기,남성, 29세, 키 175, 몸무게 69, 마라탕 먹어도 돼?',
];
const DEFAULT_MODELS = ['gpt-4o-mini-2024-07-18', 'claude-haiku-5-5', 'gemini-3.5-flash-lite'];
const NUT_KO: Record<string, string> = { na_mg: '나트륨', k_mg: '칼륨', p_mg: '인', protein_g: '단백질', sugar_g: '당류', sugar_ratio: '당류/탄수화물' };
const LEVEL_STYLE: Record<string, string> = {
  '먹어도 됨': 'bg-emerald-100 text-emerald-800', '양을 줄이면 가능': 'bg-amber-100 text-amber-800',
  '피하는 게 좋음': 'bg-rose-100 text-rose-800', '판단 어려움': 'bg-slate-100 text-slate-700',
};

// **굵게** 와 줄바꿈만 처리 (HTML 주입 없이)
function Rich({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>)}
    </div>
  );
}

function Panel({ title, tone, r }: { title: string; tone: 'plain' | 'kg'; r?: Result }) {
  const head = tone === 'kg' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div className="flex flex-col border rounded-xl overflow-hidden bg-white min-h-[200px]">
      <div className={`px-3 py-2 text-xs font-semibold border-b flex justify-between ${head}`}>
        <span>{title}</span>
        {r?.seconds !== undefined && <span className="font-normal">{r.seconds}초</span>}
      </div>
      <div className="p-3 flex-1 overflow-auto max-h-[560px]">
        {!r || r.status === 'idle' ? <p className="text-xs text-slate-400">실행 전</p> : null}
        {r?.status === 'loading' && <p className="text-xs text-slate-500 animate-pulse">답변 생성 중…</p>}
        {r?.status === 'error' && <p className="text-xs text-rose-600 whitespace-pre-wrap">오류: {r.error}</p>}
        {r?.status === 'done' && r.trace && <Trace t={r.trace} />}
        {r?.status === 'done' && r.answer && <Rich text={r.answer} />}
      </div>
    </div>
  );
}

function Trace({ t }: { t: KgTrace }) {
  const k = t.kg;
  return (
    <details className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-xs" open>
      <summary className="cursor-pointer px-2 py-1 font-semibold text-emerald-900">
        온톨로지 판정 근거
        {t.conclusion && <span className={`ml-2 rounded px-1.5 py-0.5 ${LEVEL_STYLE[t.conclusion] ?? ''}`}>{t.conclusion}</span>}
      </summary>
      <div className="px-2 pb-2 space-y-1 text-slate-700">
        <div>질환 단계: <b>{t.parsed?.stages?.join(', ') || '-'}</b> · 매칭 식품: <b>{t.food_match?.name ?? '찾지 못함'}</b>
          {k && <> · 기준량 {k.판정기준량} · 그래프 판정 <b>{k.판정}</b></>}</div>
        {k && k.판정근거.length > 0 && (
          <table className="w-full mt-1 border-collapse">
            <thead><tr className="text-left text-slate-500"><th className="py-0.5">영양소</th><th>함량</th><th>한 끼 허용</th><th>판정</th></tr></thead>
            <tbody>{k.판정근거.map((c) => (
              <tr key={c.nutrient} className="border-t border-emerald-100">
                <td className="py-0.5">{NUT_KO[c.nutrient] ?? c.nutrient}</td><td>{c.value?.toLocaleString()}</td>
                <td>{c.limit?.toLocaleString()}</td>
                <td className={c.status === '초과' ? 'text-rose-600 font-semibold' : 'text-emerald-700'}>{c.status}</td>
              </tr>))}
            </tbody>
          </table>)}
        {k && k.피해야할이유.length > 0 && <div className="text-rose-700">피해야 할 이유: {k.피해야할이유.join(' / ')}</div>}
      </div>
    </details>
  );
}

export default function CareKidneyComparePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<string[]>(DEFAULT_MODELS);
  const [question, setQuestion] = useState(EXAMPLES[2]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [loadError, setLoadError] = useState('');
  const [asked, setAsked] = useState('');

  useEffect(() => {
    fetch('/api/carekidney/models').then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? r.status);
      setModels(d);
    }).catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  const run = async () => {
    const q = question.trim();
    if (q.length < 2 || selected.length === 0) return;
    setAsked(q);
    const jobs = selected.flatMap((m) => (['plain', 'kg'] as const).map((c) => ({ m, c })));
    setResults(Object.fromEntries(jobs.map(({ m, c }) => [`${m}|${c}`, { status: 'loading' } as Result])));
    await Promise.all(jobs.map(async ({ m, c }) => {
      const key = `${m}|${c}`;
      try {
        const r = await fetch('/api/carekidney/compare', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, model: m, condition: c }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
        setResults((p) => ({ ...p, [key]: {
          status: 'done', answer: d.answer, seconds: d.seconds,
          trace: c === 'kg' ? { parsed: d.parsed, food_match: d.food_match, conclusion: d.conclusion, kg: d.kg } : undefined,
        } }));
      } catch (e) {
        setResults((p) => ({ ...p, [key]: { status: 'error', error: e instanceof Error ? e.message : String(e) } }));
      }
    }));
  };

  const busy = Object.values(results).some((r) => r.status === 'loading');
  const label = (id: string) => models.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CareKidney · 온톨로지 적용 비교</h1>
        <p className="text-sm text-slate-500 mt-1">
          같은 모델에 같은 질문을 보내 <b>단독</b>(질문만)과 <b>+온톨로지</b>(지식그래프 판정 근거) 답변을 나란히 비교합니다.
          내부 검토용 비공개 화면입니다 — 외부 공유 금지.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e, i) => (
            <button key={i} onClick={() => setQuestion(e)}
              className={`text-xs rounded-full border px-2.5 py-1 ${question === e ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100'}`}>
              Q{i + 1} {e.split(',').slice(-1)[0].replace(' 먹어도 돼?', '').trim()}
            </button>))}
        </div>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500}
          className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="예: 만성콩팥병 4기, 여성, 64세, 몸무게 53, 회 먹어도 돼?" />
        <div className="flex flex-wrap items-center gap-3">
          {loadError && <span className="text-xs text-rose-600">모델 목록을 불러오지 못했어요: {loadError}</span>}
          {models.map((m) => (
            <label key={m.id} className="flex items-center gap-1 text-xs text-slate-700">
              <input type="checkbox" checked={selected.includes(m.id)}
                onChange={(e) => setSelected((s) => e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id))} />
              {m.label}
            </label>))}
          <button onClick={run} disabled={busy || selected.length === 0}
            className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? '비교 중…' : '비교 실행'}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">모델 1개당 API 2회(단독·온톨로지) 호출 비용이 듭니다. Gemini 3.5 Flash 는 느려서 60초 시간 초과가 날 수 있어요.</p>
      </div>

      {asked && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">질문: <b>{asked}</b></p>
          {selected.map((m) => (
            <div key={m}>
              <h2 className="text-sm font-semibold text-slate-800 mb-1.5">{label(m)}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Panel title="단독 (질문만)" tone="plain" r={results[`${m}|plain`]} />
                <Panel title="+온톨로지 (그래프 판정 근거)" tone="kg" r={results[`${m}|kg`]} />
              </div>
            </div>))}
        </div>)}
    </div>
  );
}
