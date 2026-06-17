'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, LogIn, LogOut, User, Menu, X } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

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
  const [user, setUser] = React.useState<any>(null);
  const [profileName, setProfileName] = React.useState<string>('');

  const mainMenuItems = [
    { name: 'AI 챗봇', path: '/chat', icon: MessageSquare },
    { name: '건강 대시보드', path: '/dashboard', icon: LayoutDashboard },
  ];

  React.useEffect(() => {
    // 최초 Auth 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 상태 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        localStorage.removeItem('kongdang_profile');
        setProfileName('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    // 로컬스토리지 프로필 정보 동기화
    const saved = localStorage.getItem('kongdang_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfileName(parsed.name || user?.email?.split('@')[0] || '사용자');
      } catch (e) {
        console.error(e);
      }
    } else if (user) {
      setProfileName(user.email?.split('@')[0] || '사용자');
    } else {
      setProfileName('');
    }
  }, [user, pathname]);

  const handleLogoutClick = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await supabase.auth.signOut();
      localStorage.removeItem('kongdang_profile');
      alert('로그아웃 되었습니다.');
      window.location.href = '/chat';
    }
  };

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
        <div className="hidden md:flex items-center space-x-6">
          <nav className="desktop-nav flex items-center space-x-1 md:space-x-2">
            {mainMenuItems.map((item) => {
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

          {/* 로그인/마이페이지/로그아웃 우측 영역 */}
          <div className="flex items-center space-x-2 border-l border-slate-100 pl-4">
            {user ? (
              <div className="flex items-center space-x-2.5">
                <Link
                  href="/mypage"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    pathname.startsWith('/mypage')
                      ? 'bg-purple-50 text-[#6D3FA0]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <User size={15} className="text-[#6D3FA0]" />
                  <span className="font-bold">{profileName} 님</span>
                </Link>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center space-x-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-200 active:scale-95"
              >
                <LogIn size={14} />
                <span>로그인</span>
              </Link>
            )}
          </div>
        </div>

        {/* Hamburger Button - Mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="mobile-hamburger md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-dropdown-custom absolute top-16 left-0 w-full bg-white border-b border-slate-100 shadow-md py-3 px-6 flex flex-col space-y-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {mainMenuItems.map((item) => {
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
          
          {/* 모바일 하단 로그인 분기 영역 */}
          <div className="border-t border-slate-100 pt-2.5 px-2">
            {user ? (
              <div className="flex flex-col space-y-2">
                <Link
                  href="/mypage"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-bold text-[#6D3FA0] bg-purple-50/50"
                >
                  <User size={15} />
                  <span>{profileName} 님 (마이페이지)</span>
                </Link>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogoutClick();
                  }}
                  className="flex items-center justify-center space-x-1.5 w-full py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>로그아웃</span>
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center space-x-2 w-full py-3 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all"
              >
                <LogIn size={15} />
                <span>로그인</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
