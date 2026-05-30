import React from 'react';
import { User, Award, Heart, Shield, Settings, ChevronRight } from 'lucide-react';

export default function MyPage() {
  const userInfo = {
    name: '김콩당',
    email: 'user@kongdang.com',
    diseaseType: 'CKD 3기 + 당뇨',
    joinDate: '2026.05.01',
    points: 350,
  };

  const menuOptions = [
    { name: '의료 임상 데이터 및 복지 스크랩북', desc: '저장한 논문 출처 및 보건소 신청 리스트', icon: Heart },
    { name: '내 건강 프로필 설정', desc: '콩팥 단계(eGFR 기수), 당화혈색소 등 수치 설정', icon: Shield },
    { name: '환경 설정', desc: '알림 설정 및 계정 관리', icon: Settings },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto py-6 space-y-6 animate-fade-in">
      {/* 프로필 요약 카드 */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-700 text-white flex items-center justify-center shadow-lg">
            <User size={32} />
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-lg font-bold text-slate-800">{userInfo.name}님</h2>
            <p className="text-xs text-slate-400">{userInfo.email}</p>
            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                {userInfo.diseaseType}
              </span>
              <span className="text-[10px] text-slate-400">가입일: {userInfo.joinDate}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-50 text-center w-full sm:w-auto">
          <div className="flex justify-center items-center space-x-1 text-amber-600 mb-0.5">
            <Award size={14} className="fill-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-wider">KONGDANG POINTS</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{userInfo.points} P</div>
        </div>
      </div>

      {/* 설정 메뉴 */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-md overflow-hidden divide-y divide-slate-100">
        {menuOptions.map((opt, idx) => {
          const Icon = opt.icon;
          return (
            <div
              key={idx}
              className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 group-hover:scale-105 transition-transform">
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800">{opt.name}</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
