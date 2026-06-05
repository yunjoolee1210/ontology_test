'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, ShieldAlert, Check, X, Shield, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'caregiver' | 'researcher';
  conditions: string[];
  status: 'active' | 'disabled';
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Mock users if database fetch fails or is empty
  const mockUsers: UserRecord[] = [
    { id: '1', email: 'patient1@email.com', name: '홍길동', role: 'patient', conditions: ['kidney', 'diabetes'], status: 'active', created_at: '2026-05-15' },
    { id: '2', email: 'caregiver1@email.com', name: '이순신', role: 'caregiver', conditions: ['kidney'], status: 'active', created_at: '2026-05-20' },
    { id: '3', email: 'researcher1@email.com', name: '김선생', role: 'researcher', conditions: ['diabetes'], status: 'active', created_at: '2026-05-25' },
    { id: '4', email: 'disabled_user@email.com', name: '박탈퇴', role: 'patient', conditions: ['kidney', 'diabetes'], status: 'disabled', created_at: '2026-05-10' },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Supabase user_profiles 및 users 조인 조회
      // ⚠️ Auth users 테이블은 RLS 보안상 직접 조회가 안 되므로 user_profiles를 우선 가져옴
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (profiles && profiles.length > 0) {
        // user_profiles에 매핑되는 users 정보(email) 가상 조인 또는 별도 스텁
        // 실제 운영 시 auth.users와 동기화된 public.users 테이블을 읽어야 함
        // 여기서는 profiles를 기반으로 UI 렌더링용 변환 진행
        const formatted: UserRecord[] = profiles.map(p => ({
          id: p.id,
          email: p.email || `${p.name || 'user'}@email.com`,
          name: p.name || '미설정',
          role: p.role as any,
          conditions: p.conditions || [],
          status: p.status || 'active',
          created_at: new Date(p.created_at).toLocaleDateString(),
        }));
        setUsers(formatted);
      } else {
        setUsers(mockUsers);
      }
    } catch (e) {
      console.warn('Supabase fetch failed or table missing. Fallback to mock users.', e);
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'patient' | 'caregiver' | 'researcher') => {
    try {
      // local state update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      // Supabase 저장 시도
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      // 감사 로그 생성 (admin_logs)
      await supabase.from('admin_logs').insert({
        action: 'ROLE_CHANGE',
        target_id: userId,
        details: `Role changed to ${newRole}`
      });

      alert('사용자 역할(Role)이 정상 변경되었습니다.');
    } catch (err) {
      console.error(err);
      alert('데이터베이스 변경 중 오류가 발생했으나, 임시 상태가 반영되었습니다.');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: 'active' | 'disabled') => {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));

      // Supabase user_profiles 업데이트 시도
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: nextStatus })
        .eq('id', userId);

      if (error) throw error;

      // 감사 로그 생성 (admin_logs)
      await supabase.from('admin_logs').insert({
        action: 'USER_STATUS_CHANGE',
        target_id: userId,
        details: `Status changed to ${nextStatus}`
      });

      alert(`사용자 상태가 [${nextStatus === 'active' ? '활성' : '비활성'}]으로 변경되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('상태 변경에 실패했습니다.');
    }
  };

  // 필터링된 사용자 목록
  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleLabels = {
    patient: '환자',
    caregiver: '보호자',
    researcher: '연구자',
  };

  const conditionLabels: Record<string, string> = {
    kidney: '신장병',
    diabetes: '당뇨병',
  };

  return (
    <div className="w-full py-4 space-y-6 animate-fade-in px-4">
      {/* 관리자 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Shield className="text-purple-700" />
            사용자 계정 관리관
          </h1>
          <p className="text-xs text-slate-400 mt-1">회원의 권한(Role), 관심질환 조건, 접속 활성화 여부 제어</p>
        </div>
        <button 
          onClick={fetchUsers}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-purple-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
        >
          <RefreshCw size={12} />
          다시 불러오기
        </button>
      </div>

      {/* 검색 바 */}
      <div className="flex max-w-md items-center relative">
        <input
          type="text"
          placeholder="이메일 또는 이름으로 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 transition-all"
        />
        <Search size={16} className="text-slate-400 absolute left-3.5 top-3.5" />
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4 sm:p-5">이름 (이메일)</th>
                <th className="p-4 sm:p-5">관심 질환</th>
                <th className="p-4 sm:p-5">권한(Role) 설정</th>
                <th className="p-4 sm:p-5 text-center">계정 상태</th>
                <th className="p-4 sm:p-5">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">사용자 계정 리스트 로딩 중...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">일치하는 사용자가 없습니다.</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 sm:p-5">
                      <div className="font-bold text-slate-800">{u.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{u.email}</div>
                    </td>
                    <td className="p-4 sm:p-5">
                      <div className="flex flex-wrap gap-1">
                        {u.conditions.map(c => (
                          <span key={c} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {conditionLabels[c] || c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 sm:p-5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600 text-slate-700 cursor-pointer"
                      >
                        <option value="patient">환자</option>
                        <option value="caregiver">간병인/보호자</option>
                        <option value="researcher">전문 연구자</option>
                      </select>
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.status)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${u.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100'}`}
                      >
                        {u.status === 'active' ? (
                          <>
                            <UserCheck size={12} />
                            정상(활성)
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={12} />
                            정지(비활성)
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-4 sm:p-5 text-slate-400 text-xs">{u.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
