import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const API = process.env.CK_API_URL;
  const TOKEN = process.env.CK_API_TOKEN;
  if (!API || !TOKEN) {
    return NextResponse.json({ detail: 'CK_API_URL / CK_API_TOKEN 미설정' }, { status: 503 });
  }
  try {
    const r = await fetch(`${API}/models`, {
      headers: { 'X-API-Key': TOKEN }, signal: AbortSignal.timeout(10_000), cache: 'no-store',
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ detail: `온톨로지 API에 연결할 수 없어요: ${String(e)}` }, { status: 502 });
  }
}
