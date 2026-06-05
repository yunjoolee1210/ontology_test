'use client';

import React from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RagPage() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 text-center space-y-6 animate-fade-in px-4">
      <div className="p-4 rounded-3xl bg-amber-50 text-amber-700 inline-flex border border-amber-100 shadow-sm animate-bounce">
        <Search size={36} />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800">Hybrid RAG 분석 파이프라인</h1>
        <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Coming Soon</p>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-xs leading-relaxed">
        PubMed 실시간 문헌 정보와 Pinecone 벡터 데이터베이스의 시맨틱 유사도를 역순위합(RRF) 알고리즘으로 조율하는 RAG 제어판이 구축될 예정입니다.
      </div>

      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-amber-700 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={12} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
