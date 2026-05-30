'use client';

import React from 'react';
import Link from 'next/link';
import { HeartPulse, Key, Mail, User, ShieldAlert, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    alert('회원가입 기능은 데모 버전입니다.');
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 animate-fade-in">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
        {/* 장식용 그라디언트 구 */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-100 rounded-full blur-3xl opacity-60"></div>

        <div className="text-center space-y-2 relative">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-md inline-flex">
            <HeartPulse size={24} className="animate-pulse" />
          </div>
          <h1 className="text-xl font-black text-slate-800">콩당콩당 회원가입</h1>
          <p className="text-xs text-slate-400">맞춤형 만성질환 챗봇 서비스를 지금 시작하세요</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4 relative">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이름</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="홍길동"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <User size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이메일 주소</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="example@email.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <Mail size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">비밀번호 설정</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="8자 이상 입력"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <Key size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="flex items-start space-x-2 text-[10px] text-slate-400 pt-1 leading-relaxed">
            <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>가입 즉시 콩당콩당 서비스 이용약관 및 의학적 책임 한계 고지 사항에 동의하게 됩니다.</span>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
          >
            <span>가입 완료</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4 flex justify-center space-x-2">
          <span>이미 계정이 있으신가요?</span>
          <Link href="/auth/login" className="font-bold text-[#6D3FA0] hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
