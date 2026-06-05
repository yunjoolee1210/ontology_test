'use client';

import React from 'react';
import { Network, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function OntologyPage() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 text-center space-y-6 animate-fade-in px-4">
      <div className="p-4 rounded-3xl bg-indigo-50 text-indigo-700 inline-flex border border-indigo-100 shadow-sm animate-bounce">
        <Network size={36} />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800">의학 지식 온톨로지</h1>
        <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Coming Soon</p>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-xs leading-relaxed">
        만성 신장병(CKD) 및 당뇨병(DM)의 학술적 용어와 환자 일상어의 관계를 맵핑하는 의학 의미망 온톨로지 대시보드가 준비 중입니다.
      </div>

      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-700 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={12} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
