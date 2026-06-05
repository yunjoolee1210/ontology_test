'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Key, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Supabase Auth 로그인 진행
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const user = data.user;
      if (user) {
        // 2. user_profiles 테이블에서 프로필 로드
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role, conditions, name')
          .eq('id', user.id)
          .single();

        if (profile) {
          // 3. 로컬스토리지 동기화
          localStorage.setItem('kongdang_profile', JSON.stringify({
            role: profile.role,
            conditions: profile.conditions,
            name: profile.name,
            email: user.email,
          }));
        } else {
          // 프로필 정보가 없으면 기본 환자 + 신장병 셋팅
          localStorage.setItem('kongdang_profile', JSON.stringify({
            role: 'patient',
            conditions: ['kidney'],
            name: user.email?.split('@')[0] || '사용자',
            email: user.email,
          }));
        }

        alert('로그인에 성공했습니다!');
        router.push('/chat');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || '로그인 실패. 이메일 또는 비밀번호를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 animate-fade-in px-4">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-8 space-y-6 relative overflow-hidden">
        {/* 장식용 그라디언트 구 */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-100 rounded-full blur-3xl opacity-60"></div>

        <div className="text-center space-y-2 relative">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-md inline-flex">
            <HeartPulse size={24} className="animate-pulse" />
          </div>
          <h1 className="text-xl font-black text-slate-800">콩당콩당 서비스 로그인</h1>
          <p className="text-xs text-slate-400">콩팥병·당뇨 관리를 위한 스마트 에이전트 서비스</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이메일 주소</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <Mail size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">비밀번호</label>
              <a href="#" className="text-[10px] font-bold text-purple-600 hover:text-purple-800 transition-colors">비밀번호 찾기</a>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <Key size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
          >
            <span>{loading ? '로그인 중...' : '로그인'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4 flex justify-center space-x-2">
          <span>계정이 없으신가요?</span>
          <Link href="/auth/signup" className="font-bold text-[#6D3FA0] hover:underline">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
