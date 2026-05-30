'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { Intent } from '../../lib/types/chat';
import { Loader2, Bot } from 'lucide-react';

export function ChatWindow() {
  const [activeIntent, setActiveIntent] = useState<Intent>('general');
  const [activeSources, setActiveSources] = useState<any[]>([]);
  const [messageMeta, setMessageMeta] = useState<Record<string, { agentType: Intent; sources: any[] }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: '/api/chat',
    onResponse(response) {
      // 응답 헤더에서 에이전트 종류 및 출처 획득
      const agentType = (response.headers.get('X-Agent-Type') || 'general') as Intent;
      const sourcesHeader = response.headers.get('X-Agent-Sources');
      
      let parsedSources = [];
      if (sourcesHeader) {
        try {
          parsedSources = JSON.parse(sourcesHeader);
        } catch (e) {
          console.error('Failed to parse sources header:', e);
        }
      }

      setActiveIntent(agentType);
      setActiveSources(parsedSources);
    },
  });

  // 메시지 리스트에 변화가 생겼을 때, 가장 최근 추가된 어시스턴트 메시지에 메타데이터 바인딩
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !messageMeta[lastMessage.id]) {
        setMessageMeta(prev => ({
          ...prev,
          [lastMessage.id]: {
            agentType: activeIntent,
            sources: activeSources,
          }
        }));
      }
    }
    // 스크롤 아래로 내리기
    scrollToBottom();
  }, [messages, activeIntent, activeSources]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExampleClick = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 border border-slate-100 rounded-2xl shadow-sm overflow-hidden max-w-4xl mx-auto w-full">
      {/* 챗봇 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-800 to-purple-700 text-white shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-white/10 rounded-xl">
            <Bot size={22} className="text-purple-100" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide">콩당콩당 AI 케어 파트너</h2>
            <p className="text-[10px] text-purple-200">만성 신장병(CKD) & 당뇨(DM) 맞춤형 멀티에이전트 RAG</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-semibold text-purple-100">에이전트 대기 중</span>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 animate-fade-in">
            <div className="p-4 bg-purple-50 rounded-full border border-purple-100 shadow-sm text-purple-700 animate-bounce">
              <Bot size={36} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-800 mb-1">안녕하세요! 콩당콩당 챗봇입니다.</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                콩팥병 및 당뇨 관리를 위한 식단/의학 전문 정보와 국가 복지 지원 혜택을 통합하여 맞춤형으로 안내해 드립니다.
              </p>
            </div>
          </div>
        ) : (
          messages.map(m => {
            const meta = messageMeta[m.id] || { agentType: 'general' as Intent, sources: [] };
            return (
              <MessageBubble
                key={m.id}
                role={m.role === 'user' ? 'user' : 'assistant'}
                content={m.content}
                agentType={m.role === 'assistant' ? meta.agentType : undefined}
                sources={m.role === 'assistant' ? meta.sources : undefined}
              />
            );
          })
        )}

        {/* 로딩 표시 */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex justify-start items-center space-x-2 p-3 bg-white border border-slate-100 rounded-2xl rounded-tl-none max-w-xs shadow-sm">
            <Loader2 size={16} className="text-purple-600 animate-spin" />
            <span className="text-xs text-slate-500 font-medium">답변을 생각하는 중...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력바 */}
      <div className="bg-white">
        <InputBar
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          onExampleClick={handleExampleClick}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
