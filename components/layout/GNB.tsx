'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, LogIn, Menu, X } from 'lucide-react';

export function CuteLogoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block transition-transform duration-350 group-hover:scale-110"
    >
      {/* Cute rounded heart */}
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
      {/* Cute smiling face overlay */}
      <circle cx="9" cy="9.5" r="1.2" fill="#6D3FA0" />
      <circle cx="15" cy="9.5" r="1.2" fill="#6D3FA0" />
      <path
        d="M10.5 13c.5.8 2.5.8 3 0"
        stroke="#6D3FA0"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function GNB() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [menuItems, setMenuItems] = React.useState([
    { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
    { name: '건강 대시보드', path: '/dashboard', icon: LayoutDashboard },
    { name: '로그인', path: '/auth/login', icon: LogIn },
  ]);

  React.useEffect(() => {
    // 콩당 프로필이 존재할 시 로그인/마이페이지 분기
    const saved = localStorage.getItem('kongdang_profile');
    if (saved) {
      setMenuItems([
        { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
        { name: '건강 대시보드', path: '/dashboard', icon: LayoutDashboard },
        { name: '마이페이지', path: '/mypage', icon: LogIn },
      ]);
    } else {
      setMenuItems([
        { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
        { name: '건강 대시보드', path: '/dashboard', icon: LayoutDashboard },
        { name: '로그인', path: '/auth/login', icon: LogIn },
      ]);
    }
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-100 shadow-sm backdrop-blur-md bg-white/95">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-[#6D3FA0] to-[#4338CA] text-white shadow-md group-hover:scale-105 transition-all">
            <CuteLogoIcon size={20} />
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[#6D3FA0] to-[#4338CA] bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
            콩당콩당
          </span>
        </Link>

        {/* GNB 메뉴 - Desktop */}
        <nav className="desktop-nav space-x-1 md:space-x-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-1.5 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 ${
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

        {/* Hamburger Button - Mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="mobile-hamburger p-2 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-dropdown-custom absolute top-16 left-0 w-full bg-white border-b border-slate-100 shadow-md py-2 px-6 flex flex-col space-y-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl text-xs md:text-sm font-semibold transition-all duration-205 ${
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
        </div>
      )}
    </header>
  );
}
