'use client';

import React, { useState } from 'react';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { HospitalSearchTab } from '../../components/chat/HospitalSearchTab';
import { MessageSquare, MapPin } from 'lucide-react';

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'hospital'>('chat');

  return (
    <div className="w-full max-w-6xl mx-auto py-4 px-4 flex flex-col space-y-4 text-slate-800">
      {/* 탭 네비게이션 */}
      <div className="flex border border-slate-200/60 p-1 bg-slate-100/80 rounded-2xl w-fit self-center sm:self-start">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'chat'
              ? 'bg-white text-[#6D3FA0] shadow-sm'
              : 'text-slate-500 hover:text-slate-850'
          }`}
        >
          <MessageSquare size={14} />
          <span>증상 문진 (AI 챗봇)</span>
        </button>
        <button
          onClick={() => setActiveTab('hospital')}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'hospital'
              ? 'bg-white text-[#6D3FA0] shadow-sm'
              : 'text-slate-500 hover:text-slate-850'
          }`}
        >
          <MapPin size={14} />
          <span>병원 정보</span>
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="w-full">
        {activeTab === 'chat' ? (
          <ChatWindow />
        ) : (
          <HospitalSearchTab />
        )}
      </div>
    </div>
  );
}
