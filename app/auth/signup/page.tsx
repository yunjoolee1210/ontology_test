'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Key, Mail, User, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

type Role = 'patient' | 'caregiver' | 'researcher';
type Condition = 'kidney' | 'diabetes';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleCondition = (cond: Condition) => {
    setConditions(prev => 
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conditions.length === 0) {
      alert('관심 질환을 하나 이상 선택해 주세요.');
      return;
    }
    
    setLoading(true);

    try {
      // 1. Supabase Auth 회원가입
      // ⚠️ MVP 데모 편의상 email/password로 바로 가입 처리
      // 실제로는 auth.signUp을 진행한 뒤 user_profiles에 기록
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      });

      if (error) throw error;

      const user = data.user;
      if (user) {
        // 2. user_profiles 테이블에 추가 정보 업서트
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            name,
            role,
            conditions,
            points: 100, // 가입 축하 포인트
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          console.error('Profile creation failed:', profileError);
        }

        // 3. 로컬스토리지에도 함께 저장
        localStorage.setItem('kongdang_profile', JSON.stringify({ role, conditions }));

        alert('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');
        router.push('/auth/login');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || '회원가입 중 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-6 animate-fade-in px-4">
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

        <form onSubmit={handleSignup} className="space-y-5 relative">
          {/* 기본 계정 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">이름</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
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
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
                />
                <Mail size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">비밀번호 설정</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8자 이상 입력"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all"
              />
              <Key size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 역할 선택 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">당신은 누구신가요?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'patient', label: '환자' },
                { id: 'caregiver', label: '간병인/보호자' },
                { id: 'researcher', label: '연구자' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id as Role)}
                  className={`py-2 px-3 border rounded-xl text-xs font-semibold transition-all ${role === item.id ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 관심 질환 선택 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">관심 질환 (복수 선택 가능)</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'kidney', label: '신장병 (콩팥병)' },
                { id: 'diabetes', label: '당뇨병' }
              ].map(item => {
                const isSelected = conditions.includes(item.id as Condition);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCondition(item.id as Condition)}
                    className={`py-3 px-4 border rounded-2xl text-xs font-semibold text-left flex justify-between items-center transition-all ${isSelected ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>{item.label}</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <CheckCircle2 size={10} className="fill-white text-purple-600" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start space-x-2 text-[10px] text-slate-400 pt-1 leading-relaxed">
            <ShieldAlert size={14} className="text-[#C0392B] shrink-0 mt-0.5" />
            <span>가입 즉시 콩당콩당 서비스 이용약관 및 의학적 책임 한계 고지 사항에 동의하게 됩니다.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
          >
            <span>{loading ? '가입 진행 중...' : '가입 완료'}</span>
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
