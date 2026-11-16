import type { Metadata } from 'next';

// 내부 검토용 화면: 검색엔진 색인 금지
export const metadata: Metadata = {
  title: 'CareKidney 온톨로지 비교 (내부)',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
