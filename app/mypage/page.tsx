'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Award, Heart, Shield, Settings, ChevronRight, CheckCircle2, Save } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

type Role = 'patient' | 'caregiver' | 'researcher';
type Condition = 'kidney' | 'diabetes';

export default function MyPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    role: Role;
    conditions: Condition[];
    points: number;
  }>({
    name: '게스트',
    email: '로그인하지 않음',
    role: 'patient',
    conditions: ['kidney'],
    points: 0,
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState<Role>('patient');
  const [editConditions, setEditConditions] = useState<Condition[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      
      if (user) {
        setIsLoggedIn(true);
        const { data: dbProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const loadedProfile = {
          name: dbProfile?.name || user.email?.split('@')[0] || '사용자',
          email: user.email || '',
          role: (dbProfile?.role || 'patient') as Role,
          conditions: (dbProfile?.conditions || ['kidney']) as Condition[],
          points: dbProfile?.points || 100,
        };

        setProfile(loadedProfile);
        setEditRole(loadedProfile.role);
        setEditConditions(loadedProfile.conditions);
      } else {
        setIsLoggedIn(false);
        const saved = localStorage.getItem('kongdang_profile');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const loadedProfile = {
              name: parsed.name || '게스트 환우',
              email: parsed.email || '비로그인 상태',
              role: (parsed.role || 'patient') as Role,
              conditions: (parsed.conditions || ['kidney']) as Condition[],
              points: 0,
            };
            setProfile(loadedProfile);
            setEditRole(loadedProfile.role);
            setEditConditions(loadedProfile.conditions);
          } catch (e) {
            console.error(e);
          }
        }
      }
    };
    loadProfile();
  }, []);

  const handleConditionToggle = (cond: Condition) => {
    setEditConditions(prev => 
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const handleSave = async () => {
    if (editConditions.length === 0) {
      alert('관심 질환을 하나 이상 선택해 주세요.');
      return;
    }

    setSaving(true);
    try {
      const updatedProfile = { ...profile, role: editRole, conditions: editConditions };
      
      // 1. LocalStorage 저장
      localStorage.setItem('kongdang_profile', JSON.stringify({
        ...updatedProfile,
        name: profile.name,
        email: profile.email
      }));

      // 2. 로그인 상태 시 Supabase 저장
      if (isLoggedIn) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('user_profiles')
            .upsert({
              id: user.id,
              role: editRole,
              conditions: editConditions,
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
        }
      }

      setProfile(updatedProfile);
      setIsEditing(false);
      alert('건강 프로필 설정이 성공적으로 저장되었습니다!');
    } catch (e: any) {
      console.error(e);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('kongdang_profile');
    alert('로그아웃되었습니다.');
    router.push('/auth/login');
  };

  const roleLabels = {
    patient: '환자',
    caregiver: '간병인/보호자',
    researcher: '연구자',
  };

  const conditionLabels = {
    kidney: '신장병 (콩팥병)',
    diabetes: '당뇨병',
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 space-y-6 animate-fade-in px-4">
      {/* 프로필 요약 카드 */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white flex items-center justify-center shadow-lg">
            <User size={32} />
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-lg font-bold text-slate-800">{profile.name}님</h2>
            <p className="text-xs text-slate-400">{profile.email}</p>
            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-1.5">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                {roleLabels[profile.role]} | 관심: {profile.conditions.map(c => conditionLabels[c]).join(', ')}
              </span>
            </div>
          </div>
        </div>

        {isLoggedIn ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-50 text-center w-full sm:w-auto">
            <div className="flex justify-center items-center space-x-1 text-amber-600 mb-0.5">
              <Award size={14} className="fill-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">KONGDANG POINTS</span>
            </div>
            <div className="text-2xl font-black text-slate-800">{profile.points} P</div>
          </div>
        ) : (
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center w-full sm:w-auto">
            <span className="text-[10px] font-extrabold text-purple-700">게스트로 이용 중</span>
          </div>
        )}
      </div>

      {/* 건강 프로필 편집 섹션 */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Shield size={16} className="text-purple-600" />
            내 건강 프로필 정보 설정
          </h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-purple-600 hover:text-purple-800 font-bold"
            >
              프로필 변경
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1"
            >
              <Save size={12} />
              저장하기
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">사용자 역할</span>
              <span className="font-bold text-slate-800">{roleLabels[profile.role]}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">관심 만성질환</span>
              <span className="font-bold text-slate-800">
                {profile.conditions.map(c => conditionLabels[c]).join(', ')}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* 역할 변경 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">역할 변경</label>
              <div className="grid grid-cols-3 gap-2">
                {(['patient', 'caregiver', 'researcher'] as Role[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditRole(r)}
                    className={`py-2 px-3 border rounded-xl text-xs font-semibold transition-all ${editRole === r ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* 관심질환 변경 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">관심 질환 변경</label>
              <div className="grid grid-cols-2 gap-3">
                {(['kidney', 'diabetes'] as Condition[]).map(c => {
                  const isSelected = editConditions.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleConditionToggle(c)}
                      className={`py-3 px-4 border rounded-2xl text-xs font-semibold text-left flex justify-between items-center transition-all ${isSelected ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span>{conditionLabels[c]}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <CheckCircle2 size={10} className="fill-white text-purple-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 설정 및 계정 로그아웃 */}
      <div className="flex flex-col gap-3">
        {isLoggedIn ? (
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl text-xs font-bold transition-all border border-rose-100"
          >
            로그아웃
          </button>
        ) : (
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full py-3 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-2xl text-xs font-bold transition-all border border-purple-100"
          >
            회원가입/로그인하고 Supabase 동기화하기
          </button>
        )}
      </div>
    </div>
  );
}
