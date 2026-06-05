'use client';

import React from 'react';
import { Database, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DatasetsPage() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 text-center space-y-6 animate-fade-in px-4">
      <div className="p-4 rounded-3xl bg-emerald-50 text-emerald-700 inline-flex border border-emerald-100 shadow-sm animate-bounce">
        <Database size={36} />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800">학습용 데이터셋 통합 저장소</h1>
        <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Coming Soon</p>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-xs leading-relaxed">
        에이전트 정확도 개선용 RLHF 원천 데이터 및 파인튜닝용 정제 말뭉치 데이터셋 다운로드 센터가 준비 중입니다.
      </div>

      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={12} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
