import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GNB } from '../components/layout/GNB';
import { Footer } from '../components/layout/Footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '콩당콩당 — 콩팥병·당뇨 복합 환자를 위한 의도 탐지 기반 멀티에이전트 AI 케어',
  description: '콩팥병(CKD)과 당뇨(DM) 환자들을 위한 최신 의학 연구 논문 검색 및 보건복지부 행정 지원 혜택을 제공하는 복합 에이전트 RAG 서비스입니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-800`}>
        <GNB />
        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
