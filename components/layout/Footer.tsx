'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export function Footer() {
  const [isResearcher, setIsResearcher] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('kongdang_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'researcher') {
          setIsResearcher(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  return (
    <footer className="w-full bg-slate-50 border-t border-slate-100 py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 space-y-3 md:space-y-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-700 bg-gradient-to-r from-[#6D3FA0] to-[#C0392B] bg-clip-text text-transparent">콩당콩당</span>
          <span>| 만성 콩팥병 및 당뇨 연계 의도 탐지 기반 멀티에이전트 케어</span>
        </div>
        <div className="flex space-x-4 items-center">
          <a href="#" className="hover:text-slate-800 transition-colors">이용약관</a>
          <a href="#" className="hover:text-slate-800 transition-colors">개인정보처리방침</a>
          <a href="#" className="hover:text-slate-800 transition-colors">의학적 책임 한계 고지</a>
          {isResearcher && (
            <Link href="/admin/dashboard" className="text-purple-600 hover:text-purple-800 font-bold border-l border-slate-200 pl-4 transition-colors">
              관리 콘솔
            </Link>
          )}
        </div>
        <div>
          <span>&copy; {new Date().getFullYear()} Kongdang-Kongdang. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
