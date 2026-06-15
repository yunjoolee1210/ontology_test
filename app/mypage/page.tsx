'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Award, Heart, Shield, Settings, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

type Role = 'patient' | 'caregiver' | 'researcher';

export default function MyPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    role: Role;
    ckd_stage: string;
    dialysis_type: string;
    diabetes_type: string;
    medication: string;
    other_conditions: string[];
    points: number;
  }>({
    name: '게스트',
    email: '로그인하지 않음',
    role: 'patient',
    ckd_stage: '1기',
    dialysis_type: '해당없음',
    diabetes_type: '없음',
    medication: '식이조절만',
    other_conditions: [],
    points: 0,
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState<Role>('patient');
  const [editCkdStage, setEditCkdStage] = useState('1기');
  const [editDialysisType, setEditDialysisType] = useState('해당없음');
  const [editDiabetesType, setEditDiabetesType] = useState('없음');
  const [editMedication, setEditMedication] = useState('식이조절만');
  const [editOtherConditions, setEditOtherConditions] = useState<string[]>([]);
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
          ckd_stage: dbProfile?.ckd_stage || '1기',
          dialysis_type: dbProfile?.dialysis_type || '해당없음',
          diabetes_type: dbProfile?.diabetes_type || '없음',
          medication: dbProfile?.medication || '식이조절만',
          other_conditions: dbProfile?.other_conditions || [],
          points: dbProfile?.points || 100,
        };

        setProfile(loadedProfile);
        setEditRole(loadedProfile.role);
        setEditCkdStage(loadedProfile.ckd_stage);
        setEditDialysisType(loadedProfile.dialysis_type);
        setEditDiabetesType(loadedProfile.diabetes_type);
        setEditMedication(loadedProfile.medication);
        setEditOtherConditions(loadedProfile.other_conditions);
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
              ckd_stage: parsed.ckd_stage || '1기',
              dialysis_type: parsed.dialysis_type || '해당없음',
              diabetes_type: parsed.diabetes_type || '없음',
              medication: parsed.medication || '식이조절만',
              other_conditions: parsed.other_conditions || [],
              points: 0,
            };
            setProfile(loadedProfile);
            setEditRole(loadedProfile.role);
            setEditCkdStage(loadedProfile.ckd_stage);
            setEditDialysisType(loadedProfile.dialysis_type);
            setEditDiabetesType(loadedProfile.diabetes_type);
            setEditMedication(loadedProfile.medication);
            setEditOtherConditions(loadedProfile.other_conditions);
          } catch (e) {
            console.error(e);
          }
        }
      }
    };
    loadProfile();
  }, []);

  const handleConditionToggle = (cond: string) => {
    setEditOtherConditions(prev => 
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedProfile = { 
        ...profile, 
        role: editRole, 
        ckd_stage: editCkdStage,
        dialysis_type: editDialysisType,
        diabetes_type: editDiabetesType,
        medication: editMedication,
        other_conditions: editOtherConditions
      };
      
      // 1. LocalStorage 저장
      localStorage.setItem('kongdang_profile', JSON.stringify({
        role: editRole, 
        ckd_stage: editCkdStage,
        dialysis_type: editDialysisType,
        diabetes_type: editDiabetesType,
        medication: editMedication,
        other_conditions: editOtherConditions,
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
              ckd_stage: editCkdStage,
              dialysis_type: editDialysisType,
              diabetes_type: editDiabetesType,
              medication: editMedication,
              other_conditions: editOtherConditions,
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

  const ckdStages = ['1기', '2기', '3a', '3b', '4기', '5기(투석전)', '투석중'];
  const dialysisTypes = ['해당없음', '혈액투석', '복막투석', '신장이식 후'];
  const diabetesTypes = ['없음', '1형', '2형'];
  const medications = ['경구약', '인슐린', '경구약+인슐린', '식이조절만'];
  const otherConditionsList = ['고혈압', '고지혈증'];

  const isDemoUser = !isLoggedIn || profile.name === '테스트 환우' || profile.email.includes('test.com') || profile.email.includes('demo');

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
                {roleLabels[profile.role]} | CKD: {profile.ckd_stage} | 당뇨: {profile.diabetes_type !== '없음' ? `${profile.diabetes_type}` : '없음'}
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
              <span className="text-slate-400">만성 콩팥병(CKD) 단계</span>
              <span className="font-bold text-slate-800">{profile.ckd_stage}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">투석 여부 및 방법</span>
              <span className="font-bold text-slate-800">{profile.dialysis_type}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">당뇨 유형</span>
              <span className="font-bold text-slate-800">{profile.diabetes_type === '없음' ? '해당 없음' : `${profile.diabetes_type} 당뇨`}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">현재 당 조절 약물</span>
              <span className="font-bold text-slate-800">{profile.medication}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-slate-400">기타 만성 합병증</span>
              <span className="font-bold text-slate-800">{profile.other_conditions.join(', ') || '없음'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* 역할 변경 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">역할</label>
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

            {/* CKD 단계 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">콩팥병(CKD) 단계</label>
              <div className="flex flex-wrap gap-2">
                {ckdStages.map(stage => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setEditCkdStage(stage)}
                    className={`py-1.5 px-3 border rounded-xl text-xs font-semibold transition-all ${editCkdStage === stage ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            {/* 투석 방법 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">투석 여부/방법</label>
              <div className="grid grid-cols-4 gap-2">
                {dialysisTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditDialysisType(type)}
                    className={`py-2 px-1 border rounded-xl text-xs font-semibold transition-all ${editDialysisType === type ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 당뇨 유형 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">당뇨 유형</label>
              <div className="grid grid-cols-3 gap-2">
                {diabetesTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditDiabetesType(type)}
                    className={`py-2 px-3 border rounded-xl text-xs font-semibold transition-all ${editDiabetesType === type ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {type === '없음' ? '해당 없음' : `${type} 당뇨`}
                  </button>
                ))}
              </div>
            </div>

            {/* 약물 조절 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">당뇨 조절 약물</label>
              <div className="flex flex-wrap gap-2">
                {medications.map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => setEditMedication(med)}
                    className={`py-2 px-3 border rounded-xl text-xs font-semibold transition-all ${editMedication === med ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {med}
                  </button>
                ))}
              </div>
            </div>

            {/* 기타 질환 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">기타 동반 질환</label>
              <div className="grid grid-cols-2 gap-3">
                {otherConditionsList.map(cond => {
                  const isSelected = editOtherConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => handleConditionToggle(cond)}
                      className={`py-3 px-4 border rounded-2xl text-xs font-semibold text-left flex justify-between items-center transition-all ${isSelected ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span>{cond}</span>
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
        {isDemoUser && (
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="w-full py-3 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white hover:opacity-90 rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            🛡️ Ragas 대화평가 대시보드 (관리자)
          </button>
        )}
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
            className="w-full py-3 bg-purple-50 text-[#6D3FA0] hover:bg-purple-100 rounded-2xl text-xs font-bold transition-all border border-purple-100"
          >
            회원가입/로그인하고 Supabase 동기화하기
          </button>
        )}
      </div>
    </div>
  );
}
