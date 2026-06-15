'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { GNB } from '../components/layout/GNB';
import { Footer } from '../components/layout/Footer';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === '/chat';

  if (isChat) {
    return (
      <div className="flex flex-col min-h-screen h-screen overflow-hidden bg-slate-50">
        <GNB />
        <main className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <GNB />
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
