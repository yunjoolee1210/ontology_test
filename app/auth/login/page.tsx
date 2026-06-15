'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Key, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';
import { CuteLogoIcon } from '../../../components/layout/GNB';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = () => {
    // 세션 초기화 및 데모 데이터 주입
    localStorage.setItem('kongdang_profile', JSON.stringify({
      role: 'patient',
      conditions: ['kidney', 'diabetes'],
      name: '데모 환우',
      email: 'demo@kongdang.com',
      gender: '남성',
      age: 65,
      height: 172,
      target_weight: 68,
      creatinine: 1.4,
      egfr: 51,
      ckd_stage: '3기',
      dialysis_type: '해당없음',
      diabetes_type: '2형 당뇨',
      medication: '경구 혈당강하제',
      other_conditions: ['고혈압'],
      limit_sugar: 30,
      limit_sodium: 2000,
      limit_potassium: 2000,
      limit_phosphorus: 800
    }));

    alert('데모 계정으로 로그인에 성공했습니다 (로컬 모드)!');
    router.push('/chat');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.toLowerCase().trim();
    // 데모/테스트용 계정 우회 처리
    const isDemoEmail = normalizedEmail.includes('demo') || normalizedEmail.endsWith('@test.com') || normalizedEmail.endsWith('@example.com');

    try {
      if (isDemoEmail) {
        localStorage.setItem('kongdang_profile', JSON.stringify({
          role: 'patient',
          conditions: ['kidney', 'diabetes'],
          name: normalizedEmail.split('@')[0] || '데모 환우',
          email: normalizedEmail,
          gender: '남성',
          age: 65,
          height: 172,
          target_weight: 68,
          creatinine: 1.4,
          egfr: 51,
          ckd_stage: '3기',
          dialysis_type: '해당없음',
          diabetes_type: '2형 당뇨',
          medication: '경구 혈당강하제',
          other_conditions: ['고혈압'],
          limit_sugar: 30,
          limit_sodium: 2000,
          limit_potassium: 2000,
          limit_phosphorus: 800
        }));

        alert(`테스트 계정(${normalizedEmail})으로 로그인에 성공했습니다 (로컬 모드)!`);
        router.push('/chat');
        return;
      }

      // 1. Supabase Auth 로그인 진행
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
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

      // 예외 발생 시의 2차 방어막 (오류가 났더라도 데모 계정이면 로그인 통과)
      if (isDemoEmail) {
        localStorage.setItem('kongdang_profile', JSON.stringify({
          role: 'patient',
          conditions: ['kidney', 'diabetes'],
          name: normalizedEmail.split('@')[0] || '데모 환우',
          email: normalizedEmail,
          gender: '남성',
          age: 65,
          height: 172,
          target_weight: 68,
          creatinine: 1.4,
          egfr: 51,
          ckd_stage: '3기',
          dialysis_type: '해당없음',
          diabetes_type: '2형 당뇨',
          medication: '경구 혈당강하제',
          other_conditions: ['고혈압'],
          limit_sugar: 30,
          limit_sodium: 2000,
          limit_potassium: 2000,
          limit_phosphorus: 800
        }));
        alert(`데모 모드로 로그인에 성공했습니다 (${normalizedEmail}).`);
        router.push('/chat');
        return;
      }

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
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-100 rounded-full blur-3xl opacity-60"></div>

        <div className="text-center space-y-2 relative">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#6D3FA0] to-[#4338CA] text-white shadow-md inline-flex">
            <CuteLogoIcon size={24} />
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

          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-3.5 bg-slate-50 border border-slate-200 text-[#6D3FA0] hover:bg-slate-100 rounded-xl text-sm font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
          >
            <span>데모 계정으로 로그인 (게스트용)</span>
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
