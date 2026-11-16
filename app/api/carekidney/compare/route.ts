import { NextRequest, NextResponse } from 'next/server';

// 브라우저 → (이 서버 라우트) → GCP CareKidney 온톨로지 API.
// API 주소·토큰은 서버 환경변수에만 있고 브라우저로 내려가지 않는다.
export const runtime = 'nodejs';
export const maxDuration = 60;   // 초. 느린 모델은 시간 초과가 날 수 있음

const API = process.env.CK_API_URL;      // 예: https://34-50-23-120.sslip.io
const TOKEN = process.env.CK_API_TOKEN;

export async function POST(req: NextRequest) {
  if (!API || !TOKEN) {
    return NextResponse.json({ detail: 'CK_API_URL / CK_API_TOKEN 미설정' }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.question !== 'string' || typeof body.model !== 'string'
      || !['plain', 'kg'].includes(body.condition)) {
    return NextResponse.json({ detail: '잘못된 요청' }, { status: 400 });
  }
  try {
    const r = await fetch(`${API}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': TOKEN },
      body: JSON.stringify({ question: body.question.slice(0, 500), model: body.model, condition: body.condition }),
      signal: AbortSignal.timeout(58_000),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({ detail: `API 응답 오류 (${r.status})` }));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? '60초 안에 응답이 없어요 (모델이 느림)' : String(e);
    return NextResponse.json({ detail: msg }, { status: 504 });
  }
}
