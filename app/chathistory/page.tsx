'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Calendar, Trash2, ArrowRight, CornerDownRight, Search } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  agent_type?: string;
  created_at: string;
}

export default function ChatHistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadSessions = async () => {
      setLoadingSessions(true);
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      
      if (user) {
        setIsLoggedIn(true);
        // Supabase에서 대화 세션 조회
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setSessions(data);
        }
      } else {
        // 비로그인 시 localStorage에서 세션 정보 로드
        setIsLoggedIn(false);
        const localSessions = localStorage.getItem('kongdang_local_sessions');
        if (localSessions) {
          try {
            setSessions(JSON.parse(localSessions));
          } catch (e) {
            console.error(e);
          }
        }
      }
      setLoadingSessions(false);
    };
    loadSessions();
  }, []);

  const fetchMessages = async (sessionId: string) => {
    setActiveSession(sessionId);
    setLoadingMessages(true);

    if (isLoggedIn) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          agent_type: m.agent_type,
          created_at: m.created_at
        })));
      }
    } else {
      const localMsgKey = `kongdang_local_msg_${sessionId}`;
      const savedMsgs = localStorage.getItem(localMsgKey);
      if (savedMsgs) {
        try {
          setMessages(JSON.parse(savedMsgs));
        } catch (e) {
          console.error(e);
        }
      } else {
        setMessages([]);
      }
    }
    setLoadingMessages(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('대화 기록을 정말 삭제하시겠습니까?')) return;

    try {
      if (isLoggedIn) {
        const { error } = await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', sessionId);
        if (error) throw error;
      } else {
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        localStorage.setItem('kongdang_local_sessions', JSON.stringify(updated));
        localStorage.removeItem(`kongdang_local_msg_${sessionId}`);
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
      alert('삭제 완료되었습니다.');
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 필터된 세션 목록
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-4 animate-fade-in px-4">
      <div className="text-center md:text-left mb-6">
        <h1 className="text-2xl font-black text-slate-800 flex items-center justify-center md:justify-start gap-2">
          <MessageSquare className="text-purple-600" />
          내 대화 기록 이력 조회
        </h1>
        <p className="text-xs text-slate-400 mt-1">이전에 AI 에어 코치와 진행했던 상담 내용을 확인할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 좌측: 세션 목록 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="세션 제목 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white transition-all"
            />
            <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingSessions ? (
              <div className="text-center py-10 text-xs text-slate-400">대화 목록을 조회하는 중...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">조회된 대화 내역이 없습니다.</div>
            ) : (
              filteredSessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => fetchMessages(s.id)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between group ${isActive ? 'border-purple-600 bg-purple-50/40 text-purple-700' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <MessageSquare size={16} className={isActive ? 'text-purple-600' : 'text-slate-400'} />
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold truncate pr-2">{s.title}</h4>
                        <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 우측/중앙: 메시지 내용 */}
        <div className="md:col-span-2 bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
          {!activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
              <MessageSquare size={32} className="text-slate-200" />
              <div>
                <h3 className="text-xs font-bold text-slate-500">대화 내용을 선택해 주세요.</h3>
                <p className="text-[10px] text-slate-400 mt-1">좌측 대화 목록을 선택하면 상세 상담 이력이 여기에 표시됩니다.</p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">메시지 내용을 불러오고 있습니다...</div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="pb-3 border-b border-slate-100 flex justify-between items-center mb-3">
                <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
                  상담 이력 상세보기
                </span>
                <span className="text-[10px] text-slate-400">총 {messages.length}개 메시지</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">대화 세션 내 메시지가 없습니다.</div>
                ) : (
                  messages.map(m => {
                    const isUser = m.role === 'user';
                    return (
                      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start space-x-2`}>
                        {!isUser && (
                          <div className="p-1 rounded-lg bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                            <CornerDownRight size={14} />
                          </div>
                        )}
                        <div className={`p-4 rounded-2xl max-w-md ${isUser ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                          {!isUser && m.agent_type && (
                            <span className="inline-block text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-xs mb-1.5">
                              🤖 {m.agent_type} agent
                            </span>
                          )}
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          <span className={`text-[8px] mt-1.5 block text-right ${isUser ? 'text-purple-200' : 'text-slate-400'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
