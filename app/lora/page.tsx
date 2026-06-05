'use client';

import React from 'react';
import { Cpu, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoraPage() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 text-center space-y-6 animate-fade-in px-4">
      <div className="p-4 rounded-3xl bg-purple-50 text-purple-700 inline-flex border border-purple-100 shadow-sm animate-bounce">
        <Cpu size={36} />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-slate-800">LoRA 파인튜닝 엔진</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-purple-600">Coming Soon</p>
      </div>

      <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-md text-slate-500 text-xs leading-relaxed">
        BGE-M3 임베딩 모델과 BGE-Reranker-Large 모델의 미세조정(LoRA Fine-tuning) 가중치 체크포인트 관리 및 배포 자동화 기능이 현재 개발 중에 있습니다.
      </div>

      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-purple-700 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft size={12} />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
