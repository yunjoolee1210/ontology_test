'use client';

import React, { useState, useEffect } from 'react';
import { Search, Calendar, MessageSquare, Trash2, Shield, Eye, ArrowLeft, Bot, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

interface AdminSession {
  id: string;
  user_email: string;
  user_name: string;
  title: string;
  created_at: string;
}

interface AdminMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_type?: string;
  created_at: string;
}

export default function AdminChatHistoryPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Mock sessions/messages for demo fallback
  const mockSessions: AdminSession[] = [
    { id: 'session_1', user_email: 'patient1@email.com', user_name: '홍길동', title: '산정특례와 현미밥 조언', created_at: '2026-06-05T18:30:00Z' },
    { id: 'session_2', user_email: 'caregiver1@email.com', user_name: '이순신', title: 'SGLT2 부작용 문의', created_at: '2026-06-04T12:00:00Z' },
    { id: 'session_3', user_email: 'researcher1@email.com', user_name: '김선생', title: '당뇨 신장 최신 연구 결과', created_at: '2026-06-03T15:45:00Z' },
  ];

  const mockMessages: Record<string, AdminMessage[]> = {
    session_1: [
      { id: 'm1', role: 'user', content: '만성 신장병 3기 산정특례 혜택하고 현미밥 식단 먹어도 되나요?', created_at: '2026-06-05T18:30:01Z' },
      { id: 'm2', role: 'assistant', content: '의료복지 및 식단에 대한 복합 상담 답변입니다.\n\n1. 산정특례: 만성신부전증(투석) 환자는 본인부담금 10% 혜택을 받습니다.\n2. 현미밥 식단: 칼륨 조절이 필요한 3기 환자는 현미밥의 칼륨/인 함량이 높아 정밀 계량이 필요하며, 보통 백미밥이 권장됩니다.', agent_type: 'nutrition', created_at: '2026-06-05T18:30:15Z' },
    ],
    session_2: [
      { id: 'm3', role: 'user', content: '당뇨 혈당 치료약인 SGLT2 부작용에 대해 알려주세요.', created_at: '2026-06-04T12:00:01Z' },
      { id: 'm4', role: 'assistant', content: 'SGLT2 억제제(포시가 등)는 소변으로 포도당을 배출하는 약물입니다. 흔한 부작용으로 요로감염, 질염 및 탈수가 발생할 수 있으므로 하루 1.5L 이상의 충분한 수분 섭취가 필요합니다.', agent_type: 'drug', created_at: '2026-06-04T12:00:10Z' },
    ],
    session_3: [
      { id: 'm5', role: 'user', content: '당뇨병 신장 합병증 관련한 최신 PubMed 논문 요약해줘.', created_at: '2026-06-03T15:45:01Z' },
      { id: 'm6', role: 'assistant', content: '최근 당뇨병성 신증(DKD) 치료 가이드에 대한 2025 논문 요약입니다. 임상 연구 결과, 신규 신장 보호 인자(Finerenone)가 사구체 여과율 감소 속도를 현저히 늦춘다는 사실이 입증되었습니다.', agent_type: 'research', created_at: '2026-06-03T15:45:20Z' },
    ],
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      // Supabase chat_sessions 및 user_profiles 정보 조인 조회
      const { data: dbSessions, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          title,
          created_at,
          user_id,
          user_profiles (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (dbSessions && dbSessions.length > 0) {
        const formatted: AdminSession[] = dbSessions.map((s: any) => ({
          id: s.id,
          user_email: s.user_id ? '회원 계정' : '게스트 사용자',
          user_name: s.user_profiles?.name || '게스트',
          title: s.title || '대화 이력',
          created_at: s.created_at,
        }));
        setSessions(formatted);
      } else {
        setSessions(mockSessions);
      }
    } catch (e) {
      console.warn('Failed to fetch sessions from Supabase. Fallback to mock.', e);
      setSessions(mockSessions);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessionMessages = async (sessionId: string) => {
    setActiveSession(sessionId);
    setLoadingMessages(true);

    try {
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (dbMessages && dbMessages.length > 0) {
        setMessages(dbMessages as any);
      } else {
        setMessages(mockMessages[sessionId] || []);
      }
    } catch (e) {
      console.warn('Failed to fetch messages. Fallback to mock.', e);
      setMessages(mockMessages[sessionId] || []);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('해당 대화 기록 세션 및 포함된 메시지를 관리자 권한으로 영구 삭제하시겠습니까? (복구 불가)')) return;

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      // 감사 로그 생성 (admin_logs)
      await supabase.from('admin_logs').insert({
        action: 'MESSAGE_DELETE',
        target_id: sessionId,
        details: 'Admin deleted user chat session and messages'
      });

      alert('대화 세션이 성공적으로 영구 삭제되었습니다.');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      // Local state fallback delete to make UX smooth
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      alert('데이터베이스 삭제 처리가 스킵되었습니다. (로컬 뷰 갱신)');
    }
  };

  // 필터된 세션 목록
  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full py-4 space-y-6 animate-fade-in px-4">
      {/* 관리자 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Shield className="text-purple-700" />
            채팅 로그 조회관
          </h1>
          <p className="text-xs text-slate-400 mt-1">사용자와 에이전트 간의 실시간 대화 내용 감사 및 이력 관리</p>
        </div>
        <button 
          onClick={fetchSessions}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-purple-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
        >
          <RefreshCw size={12} />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 대화 세션 목록 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[450px]">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="제목, 사용자명 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white transition-all"
            />
            <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingSessions ? (
              <div className="text-center py-10 text-xs text-slate-400 font-semibold">대화 세션 목록 로딩 중...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">대화 내역이 존재하지 않습니다.</div>
            ) : (
              filteredSessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => fetchSessionMessages(s.id)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between group ${isActive ? 'border-purple-600 bg-purple-50/40 text-purple-700' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <MessageSquare size={16} className={isActive ? 'text-purple-600' : 'text-slate-400'} />
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold truncate pr-2">{s.title}</h4>
                        <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-1 font-semibold">
                          👤 {s.user_name} ({s.user_email.split('@')[0]})
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

        {/* 우측: 대화 메시지 상세 내용 */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[450px]">
          {!activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
              <Eye size={32} className="text-slate-200" />
              <div>
                <h3 className="text-xs font-bold text-slate-500">대화 이력 조회를 시작하세요</h3>
                <p className="text-[10px] text-slate-400 mt-1">좌측 대화 목록 중 하나를 클릭하면 대화 상세 내용이 감사 목적으로 노출됩니다.</p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">대화 내용을 불러오고 있습니다...</div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="pb-3 border-b border-slate-100 flex justify-between items-center mb-3">
                <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">
                  상담 상세 대화록 감사
                </span>
                <span className="text-[10px] text-slate-400">총 {messages.length}개 대화 메시지</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 font-semibold">대화 세션 내 메시지 정보가 없습니다.</div>
                ) : (
                  messages.map(m => {
                    const isUser = m.role === 'user';
                    return (
                      <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start space-x-2`}>
                        {!isUser && (
                          <div className="p-1.5 rounded-xl bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                            <Bot size={15} />
                          </div>
                        )}
                        <div className={`p-4 rounded-2xl max-w-md ${isUser ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                          {!isUser && m.agent_type && (
                            <span className="inline-block text-[9px] font-black uppercase text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md mb-1.5 border border-purple-200">
                              🤖 {m.agent_type} agent
                            </span>
                          )}
                          <p className="text-xs whitespace-pre-wrap leading-relaxed font-mono">{m.content}</p>
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
