'use client';

import React from 'react';
import { Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ModelsPage() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 text-center space-y-6 animate-fade-in px-4">
      <div className="p-4 rounded-3xl bg-blue-50 text-blue-700 inline-flex border border-blue-100 shadow-sm animate-bounce">
        <Layers size={36} />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800">에이전트 LLM 모델 가중치 허브</h1>
        <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Coming Soon</p>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-xs leading-relaxed">
        신장병·당뇨병 및 의료복지 혜택 가이드 이해에 특화된 BGE 임베딩과 리랭커 모델의 온디바이스 다운로드 및 서빙 레포지토리가 개발 중입니다.
      </div>

      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-700 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={12} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
