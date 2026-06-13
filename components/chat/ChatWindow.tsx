'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { Intent, UserProfile } from '../../lib/types/chat';
import { Loader2, Bot, Heart, ShieldAlert, BookOpen, Compass, Search, Plus, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export function ChatWindow() {
  const [activeIntent, setActiveIntent] = useState<Intent>('general');
  const [activeSources, setActiveSources] = useState<any[]>([]);
  const [messageMeta, setMessageMeta] = useState<Record<string, { agentType: Intent; sources: any[]; riskLevel?: string }>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [sessionId, setSessionId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 대화 세션 목록 로드
  const loadSessions = async (uid: string) => {
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setSessions(data);
      }
    } catch (e) {
      console.error('Error loading sessions:', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  // 로컬스토리지 및 세션 정보 로딩
  useEffect(() => {
    // 1. 프로필 정보 로드
    const saved = localStorage.getItem('kongdang_profile');
    if (saved) {
      try {
        setUserProfile(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    // 2. 세션 ID 생성 또는 조회
    let activeSId = localStorage.getItem('kongdang_active_session_id');
    if (!activeSId) {
      activeSId = `session_${Date.now()}`;
      localStorage.setItem('kongdang_active_session_id', activeSId);
    }
    setSessionId(activeSId);

    // 3. 로그인 정보 조회
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        setUserId(user.id);
        loadSessions(user.id);
        
        // DB에서 프로필 최신정보 동기화
        const { data: dbProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (dbProfile) {
          const loadedProfile = {
            ...dbProfile,
            ckd_stage: dbProfile.ckd_stage,
            dialysis_type: dbProfile.dialysis_type,
            diabetes_type: dbProfile.diabetes_type,
            medication: dbProfile.medication,
            other_conditions: dbProfile.other_conditions
          };
          setUserProfile(loadedProfile);
          localStorage.setItem('kongdang_profile', JSON.stringify(loadedProfile));
        }
      }
    };
    checkUser();
  }, []);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    setMessages
  } = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    body: {
      sessionId: sessionId,
      userId: userId,
      user_profile: userProfile,
    },
    onResponse(response) {
      const agentType = (response.headers.get('X-Agent-Type') || 'general') as Intent;
      const sourcesHeader = response.headers.get('X-Agent-Sources');
      
      let parsedSources = [];
      if (sourcesHeader) {
        try {
          parsedSources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch (e) {
          console.error('Failed to parse sources header:', e);
        }
      }

      setActiveIntent(agentType);
      setActiveSources(parsedSources);
    },
  });

  // 메시지 리스트에 변화가 생겼을 때 메타데이터 바인딩
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

      // 비로그인 상태일 때 로컬 세션 & 메시지 이력 갱신
      const saveLocalHistory = async () => {
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        if (!user && sessionId) {
          const localSessions = localStorage.getItem('kongdang_local_sessions');
          let sessionList = localSessions ? JSON.parse(localSessions) : [];
          if (!sessionList.some((s: any) => s.id === sessionId)) {
            sessionList = [{
              id: sessionId,
              title: messages[0]?.content.substring(0, 30) || '새로운 대화',
              created_at: new Date().toISOString()
            }, ...sessionList];
            localStorage.setItem('kongdang_local_sessions', JSON.stringify(sessionList));
          }
          const localMsgKey = `kongdang_local_msg_${sessionId}`;
          localStorage.setItem(localMsgKey, JSON.stringify(messages));
        }
      };
      saveLocalHistory();
    }
    scrollToBottom();
  }, [messages, activeIntent, activeSources, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 대화 새로 시작
  const handleNewChat = () => {
    const newSId = `session_${Date.now()}`;
    setSessionId(newSId);
    localStorage.setItem('kongdang_active_session_id', newSId);
    setMessages([]);
    setMessageMeta({});
    setInput('');
  };

  // 특정 세션 대화 불러오기
  const handleSelectSession = async (sId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role as any,
          content: m.content
        })));
        
        const newMeta: Record<string, { agentType: Intent; sources: any[] }> = {};
        data.forEach(m => {
          if (m.role === 'assistant') {
            newMeta[m.id] = {
              agentType: (m.agent_type || 'general') as Intent,
              sources: m.sources || []
            };
          }
        });
        setMessageMeta(newMeta);
      }
      setSessionId(sId);
      localStorage.setItem('kongdang_active_session_id', sId);
    } catch (e) {
      console.error('Failed to load session messages:', e);
    }
  };

  // 대화 삭제
  const handleDeleteSession = async (sId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('대화 기록을 정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sId);
      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sId));
      if (sessionId === sId) {
        handleNewChat();
      }
      alert('삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 첫 발화 시 세션 목록 자동 새로고침
  useEffect(() => {
    if (messages.length === 1 && userId) {
      const timer = setTimeout(() => {
        loadSessions(userId);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [messages.length, userId]);

  const handleExampleClick = (text: string) => {
    setInput(text);
  };

  // 5대 워크플로우 명세 (Perplexity Health 스타일)
  const workflows = [
    {
      id: 'medical',
      icon: '🩺',
      title: '증상 문진',
      desc: '신부전 거품뇨, 부종, 발저림 등 구어체 증상 위험도 판정',
      prompt: '다리가 퉁퉁 붓고 최근에 소변에 거품이 많아졌는데, 병원에 가야 하나요?'
    },
    {
      id: 'welfare',
      icon: '🏛️',
      title: '복지 / 보험',
      desc: '건강보험 산정특례(V코드), 신장 장애등록 및 급여 지원 신청',
      prompt: '투석 치료를 받게 되었는데 받을 수 있는 본인부담금 감면이나 산정특례 혜택이 어떻게 되나요?'
    },
    {
      id: 'research',
      icon: '🔬',
      title: '연구 / 신약',
      desc: 'SGLT2, GLP-1 등 최신 신장보호 신약의 부작용 및 급여 여부',
      prompt: 'SGLT2 억제제 신약이 콩팥을 보호한다고 하던데, 투석 환자도 복용 가능한가요?'
    },
    {
      id: 'nutrition',
      icon: '🥗',
      title: '식단 / 운동',
      desc: '당뇨·신장·고혈압 3중 안심 식품 판정 및 저칼륨 한식 요리법',
      prompt: '바나나와 두부, 김치를 먹어도 괜찮은지 성분 판정해주고 대안 식단을 제안해줘.'
    },
    {
      id: 'hospital',
      icon: '🏥',
      title: '병원 찾기',
      desc: '투석 전문 의원, 야간투석 가능 기관 및 대학병원 의뢰 절차',
      prompt: '근처에 야간 투석실을 운영하거나 투석 전문 신장내과가 있는 병원이 어디인가요?'
    }
  ];

  // Inter-agent navigation handler (e.g. clicking [식단 에이전트 연결])
  const handleActionClick = (actionType: string) => {
    console.log('Action navigate to:', actionType);
    let targetPrompt = '';
    if (actionType === 'nutrition' || actionType === 'diet') {
      targetPrompt = '현재 제 건강 상태와 복약 상태에 맞는 맞춤형 한식 식단 계획과 저칼륨 조리 팁을 상세히 짜주세요.';
    } else if (actionType === 'hospital') {
      targetPrompt = '현재 제 투석 방법과 콩팥 단계를 고려했을 때 방문하기 좋은 집 근처 신장내과 전문의가 있는 병원 리스트를 추천해주세요.';
    } else if (actionType === 'welfare') {
      targetPrompt = '제가 받을 수 있는 신장 건강보험 산정특례 혜택과 구비서류를 한번 더 꼼꼼히 정리해 주세요.';
    } else {
      targetPrompt = '이 증상과 관련해서 추가 관리법을 자세하게 알려주세요.';
    }

    // Trigger chat request automatically
    append({
      role: 'user',
      content: targetPrompt
    });
  };

  return (
    <div className={`flex w-full h-[calc(100vh-120px)] bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-lg mx-auto ${userId ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {/* LNB Sidebar - Only show when logged in */}
      {userId && (
        <div className="w-64 bg-slate-50 border-r border-slate-100 flex flex-col h-full shrink-0">
          {/* New Chat Button */}
          <div className="p-4 border-b border-slate-100">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span>새 대화 시작</span>
            </button>
          </div>

          {/* Search bar inside sidebar */}
          <div className="px-4 py-2 border-b border-slate-100/50">
            <div className="relative">
              <input
                type="text"
                placeholder="대화 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 focus:bg-white border border-transparent focus:border-purple-300 rounded-xl text-[11px] focus:outline-none transition-all text-slate-700"
              />
              <Search size={12} className="text-slate-400 absolute left-2.5 top-2" />
            </div>
          </div>

          {/* Chat Sessions list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {loadingSessions ? (
              <div className="text-center py-8 text-xs text-slate-400">목록 불러오는 중...</div>
            ) : sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">대화가 없습니다.</div>
            ) : (
              sessions
                .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(s => {
                  const isActive = sessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                        isActive
                          ? 'border-purple-200 bg-purple-50/60 text-purple-700 font-bold'
                          : 'border-transparent hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden flex-1 mr-2">
                        <MessageSquare size={14} className={isActive ? 'text-purple-600' : 'text-slate-400'} />
                        <div className="overflow-hidden flex-1">
                          <p className="text-[11px] truncate">{s.title || '새로운 대화'}</p>
                          <span className="text-[8px] text-slate-400 block mt-0.5">
                            {new Date(s.created_at).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="p-1 rounded-md text-slate-350 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* 챗봇 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 text-[#6D3FA0] rounded-2xl">
              <Bot size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">콩당콩당 AI 케어 파트너</h2>
              <p className="text-[10px] text-slate-400 font-semibold">만성 콩팥병(CKD) & 당뇨(DM) 복합 만성질환 통합 RAG 챗봇</p>
            </div>
          </div>
          
          {userProfile && (
            <div className="hidden sm:flex items-center text-[10px] font-bold text-purple-700 bg-purple-50/80 border border-purple-100 px-3 py-1.5 rounded-xl shadow-2xs">
              콩팥: {userProfile.ckd_stage || '미지정'} | 투석: {userProfile.dialysis_type || '해당없음'} | 당뇨: {userProfile.diabetes_type !== '없음' ? `${userProfile.diabetes_type}` : '없음'}
            </div>
          )}
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gradient-to-b from-white to-slate-50/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full py-8 space-y-6 animate-fade-in">
              <div className="text-center space-y-2 max-w-lg">
                <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">무엇이든 물어보세요</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  만성 콩팥병(CKD)과 당뇨병(DM) 맞춤형 의학 검증 데이터, 복지 혜택, 식단 지침, 그리고 전문 병원 매칭 서비스를 원스톱으로 지원합니다.
                </p>
              </div>

              {/* Health Workflows Cards */}
              <div className="w-full max-w-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {workflows.map(wf => (
                    <button
                      key={wf.id}
                      onClick={() => handleExampleClick(wf.prompt)}
                      className="flex flex-col text-left p-4 bg-white border border-slate-100 rounded-3xl hover:border-purple-200 hover:shadow-md hover:scale-[1.01] transition-all duration-300 group relative overflow-hidden shadow-xs"
                    >
                      <span className="text-2xl mb-2.5 block">{wf.icon}</span>
                      <h5 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                        {wf.title}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed group-hover:text-slate-500">
                        {wf.desc}
                      </p>
                    </button>
                  ))}
                </div>
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
                  onActionClick={handleActionClick}
                />
              );
            })
          )}

          {/* 로딩 표시 */}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex justify-start items-center space-x-2.5 p-4 bg-white border border-slate-100 rounded-3xl rounded-tl-none max-w-xs shadow-md animate-pulse">
              <Loader2 size={16} className="text-purple-600 animate-spin" />
              <span className="text-xs text-slate-400 font-semibold">전문 에이전트 분석 중...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 입력바 */}
        <div className="bg-white border-t border-slate-100 p-4">
          <InputBar
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            onExampleClick={handleExampleClick}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
