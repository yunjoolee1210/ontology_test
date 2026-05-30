import React from 'react';

export function Footer() {
  return (
    <footer className="w-full bg-slate-50 border-t border-slate-100 py-6">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 space-y-3 md:space-y-0">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-700 bg-gradient-to-r from-[#6D3FA0] to-[#C0392B] bg-clip-text text-transparent">콩당콩당</span>
          <span>| 만성 콩팥병 및 당뇨 연계 의도 탐지 기반 멀티에이전트 케어</span>
        </div>
        <div className="flex space-x-4">
          <a href="#" className="hover:text-slate-800 transition-colors">이용약관</a>
          <a href="#" className="hover:text-slate-800 transition-colors">개인정보처리방침</a>
          <a href="#" className="hover:text-slate-800 transition-colors">의학적 책임 한계 고지</a>
        </div>
        <div>
          <span>&copy; {new Date().getFullYear()} Kongdang-Kongdang. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
