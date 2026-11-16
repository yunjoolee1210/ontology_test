import { NextRequest, NextResponse } from 'next/server';

// CareKidney 온톨로지 비교 화면은 특허 출원 전 내부 검토용 → 비밀번호(Basic 인증) 뒤에만 둔다.
// Vercel 환경변수 CK_BASIC_USER / CK_BASIC_PASS 가 없으면 아예 열지 않는다.
export function middleware(req: NextRequest) {
  const user = process.env.CK_BASIC_USER;
  const pass = process.env.CK_BASIC_PASS;
  if (!user || !pass) {
    return new NextResponse('CK_BASIC_USER / CK_BASIC_PASS 미설정', { status: 503 });
  }
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    const [u, ...rest] = atob(header.slice(6)).split(':');
    if (u === user && rest.join(':') === pass) {
      const res = NextResponse.next();
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');   // 검색엔진 색인 금지
      return res;
    }
  }
  return new NextResponse('인증이 필요합니다', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="CareKidney internal", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/carekidney/:path*', '/api/carekidney/:path*'],
};
