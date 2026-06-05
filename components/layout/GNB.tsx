'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulse, MessageSquare, LineChart, Users, LogIn, Shield } from 'lucide-react';

export function GNB() {
  const pathname = usePathname();
  const [menuItems, setMenuItems] = React.useState([
    { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
    { name: '트렌드', path: '/trend', icon: LineChart },
    { name: '커뮤니티', path: '/community', icon: Users },
    { name: '로그인', path: '/auth/login', icon: LogIn },
  ]);

  React.useEffect(() => {
    // 콩당 프로필이 연구자(researcher)거나 관리자일 경우 관리 콘솔 추가 노출
    const saved = localStorage.getItem('kongdang_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'researcher') {
          setMenuItems([
            { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
            { name: '트렌드', path: '/trend', icon: LineChart },
            { name: '커뮤니티', path: '/community', icon: Users },
            { name: '관리 콘솔', path: '/admin/dashboard', icon: Shield },
            { name: '마이페이지', path: '/mypage', icon: LogIn },
          ]);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    // 기본 게스트/일반 유저 메뉴
    setMenuItems([
      { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
      { name: '트렌드', path: '/trend', icon: LineChart },
      { name: '커뮤니티', path: '/community', icon: Users },
      { name: '마이페이지', path: '/mypage', icon: LogIn },
    ]);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-100 shadow-sm backdrop-blur-md bg-white/95">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-md group-hover:scale-105 transition-all">
            <HeartPulse size={20} className="animate-pulse" />
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[#6D3FA0] to-[#C0392B] bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
            콩당콩당
          </span>
        </Link>

        {/* GNB 메뉴 */}
        <nav className="flex space-x-1 sm:space-x-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-50 text-[#6D3FA0]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
