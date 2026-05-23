import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { upsertMyProfile } from '../services/profileApi';

interface LayoutContextType {
  isDrawerOpen: boolean;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  openDrawer: () => void;
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // Initialize from localStorage - check both isLoggedIn flag and token existence
    const hasLoginFlag = localStorage.getItem('isLoggedIn') === 'true';
    const hasToken = !!localStorage.getItem('accessToken');
    return hasLoginFlag && hasToken;
  });

  // Supabase 세션과 로그인 상태 동기화 (+ 가입 시 보류해둔 프로필 첫 로그인 때 저장)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('accessToken', session.access_token);
        localStorage.setItem('refreshToken', session.refresh_token);
        const pending = localStorage.getItem('pendingProfile');
        if (pending) {
          try {
            await upsertMyProfile(JSON.parse(pending));
            localStorage.removeItem('pendingProfile');
          } catch (e) {
            console.error('보류 프로필 저장 실패:', e);
          }
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const toggleDrawer = () => setIsDrawerOpen(prev => !prev);
  const closeDrawer = () => setIsDrawerOpen(false);
  const openDrawer = () => setIsDrawerOpen(true);

  const login = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    supabase.auth.signOut().catch(() => {});
  };

  return (
    <LayoutContext.Provider value={{ 
      isDrawerOpen, 
      toggleDrawer, 
      closeDrawer, 
      openDrawer,
      isLoggedIn,
      login,
      logout
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
