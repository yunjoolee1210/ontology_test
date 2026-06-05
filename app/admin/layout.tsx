'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users, MessageSquare, CheckCircle } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: '대시보드', path: '/admin/dashboard', icon: BarChart3 },
    { name: '사용자 관리', path: '/admin/users', icon: Users },
    { name: '채팅 기록 감사', path: '/admin/chathistory', icon: MessageSquare },
    { name: '품질 평가 피드백', path: '/admin/feedback', icon: CheckCircle },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* 관리자 서브 네비게이션 탭 바 */}
      <div className="flex border-b border-slate-200 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center space-x-1.5 px-5 py-3 border-b-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'border-purple-700 text-purple-700 font-extrabold bg-purple-50/10'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
      
      {/* 서브 페이지 콘텐츠 */}
      <div>{children}</div>
    </div>
  );
}
