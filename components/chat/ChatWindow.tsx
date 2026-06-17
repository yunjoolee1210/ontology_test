'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { Intent, UserProfile } from '../../lib/types/chat';
import { Loader2, Bot, Heart, ShieldAlert, BookOpen, Compass, Search, Plus, Trash2, MessageSquare, Settings, Menu, X } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export function ChatWindow() {
  const [activeIntentA, setActiveIntentA] = useState<Intent>('general');
  const [activeSourcesA, setActiveSourcesA] = useState<any[]>([]);
  const [activeMessageIdA, setActiveMessageIdA] = useState<string>('');
  const [messageMetaA, setMessageMetaA] = useState<Record<string, { agentType: Intent; sources: any[]; dbMessageId?: string }>>({});

  const [activeIntentB, setActiveIntentB] = useState<Intent>('general');
  const [activeSourcesB, setActiveSourcesB] = useState<any[]>([]);
  const [activeMessageIdB, setActiveMessageIdB] = useState<string>('');
  const [messageMetaB, setMessageMetaB] = useState<Record<string, { agentType: Intent; sources: any[]; dbMessageId?: string }>>({});

  const [activeIntentC, setActiveIntentC] = useState<Intent>('general');
  const [activeSourcesC, setActiveSourcesC] = useState<any[]>([]);
  const [activeMessageIdC, setActiveMessageIdC] = useState<string>('');
  const [messageMetaC, setMessageMetaC] = useState<Record<string, { agentType: Intent; sources: any[]; dbMessageId?: string }>>({});

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [sessionId, setSessionId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'A' | 'B' | 'C'>('C');

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

  // 비로그인 사용자용 로컬 세션 목록 로드
  const loadLocalSessions = () => {
    const localSessions = localStorage.getItem('kongdang_local_sessions');
    if (localSessions) {
      try {
        setSessions(JSON.parse(localSessions));
      } catch (e) {
        console.error('Error loading local sessions:', e);
      }
    } else {
      setSessions([]);
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

        // JWT Access Token 조회 추가
        const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (session) {
          setAccessToken(session.access_token);
        }
        
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
      } else {
        loadLocalSessions();
      }
    };
    checkUser();

    // 데스크톱 화면의 경우 사이드바 기본 열림 설정
    if (window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  // 3가지 모델용 useChat 훅 선언
  const chatA = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    body: {
      sessionId: sessionId ? `${sessionId}_A` : '',
      userId: userId,
      user_profile: userProfile,
      ragMode: 'Rag',
      accessToken: accessToken,
    },
    onResponse(response) {
      const agentType = (response.headers.get('X-Agent-Type') || 'general') as Intent;
      const sourcesHeader = response.headers.get('X-Agent-Sources');
      const msgId = response.headers.get('X-Message-ID') || '';
      let parsedSources = [];
      if (sourcesHeader) {
        try {
          parsedSources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch (e) {
          console.error('Failed to parse sources header:', e);
        }
      }
      setActiveIntentA(agentType);
      setActiveSourcesA(parsedSources);
      setActiveMessageIdA(msgId);
    },
  });

  const chatB = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    body: {
      sessionId: sessionId ? `${sessionId}_B` : '',
      userId: userId,
      user_profile: userProfile,
      ragMode: 'Rag+Ontology',
      accessToken: accessToken,
    },
    onResponse(response) {
      const agentType = (response.headers.get('X-Agent-Type') || 'general') as Intent;
      const sourcesHeader = response.headers.get('X-Agent-Sources');
      const msgId = response.headers.get('X-Message-ID') || '';
      let parsedSources = [];
      if (sourcesHeader) {
        try {
          parsedSources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch (e) {
          console.error('Failed to parse sources header:', e);
        }
      }
      setActiveIntentB(agentType);
      setActiveSourcesB(parsedSources);
      setActiveMessageIdB(msgId);
    },
  });

  const chatC = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    body: {
      sessionId: sessionId ? `${sessionId}_C` : '',
      userId: userId,
      user_profile: userProfile,
      ragMode: 'Rag+Ontology+Lora',
      accessToken: accessToken,
    },
    onResponse(response) {
      const agentType = (response.headers.get('X-Agent-Type') || 'general') as Intent;
      const sourcesHeader = response.headers.get('X-Agent-Sources');
      const msgId = response.headers.get('X-Message-ID') || '';
      let parsedSources = [];
      if (sourcesHeader) {
        try {
          parsedSources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch (e) {
          console.error('Failed to parse sources header:', e);
        }
      }
      setActiveIntentC(agentType);
      setActiveSourcesC(parsedSources);
      setActiveMessageIdC(msgId);
    },
  });

  // 메시지 리스트 변화 시 메타데이터 바인딩 - A
  useEffect(() => {
    if (chatA.messages.length > 0) {
      const lastMessage = chatA.messages[chatA.messages.length - 1];
      if (lastMessage.role === 'assistant' && !messageMetaA[lastMessage.id]) {
        setMessageMetaA(prev => ({
          ...prev,
          [lastMessage.id]: {
            agentType: activeIntentA,
            sources: activeSourcesA,
            dbMessageId: activeMessageIdA,
          }
        }));
      }
    }
  }, [chatA.messages, activeIntentA, activeSourcesA, activeMessageIdA]);

  // 메시지 리스트 변화 시 메타데이터 바인딩 - B
  useEffect(() => {
    if (chatB.messages.length > 0) {
      const lastMessage = chatB.messages[chatB.messages.length - 1];
      if (lastMessage.role === 'assistant' && !messageMetaB[lastMessage.id]) {
        setMessageMetaB(prev => ({
          ...prev,
          [lastMessage.id]: {
            agentType: activeIntentB,
            sources: activeSourcesB,
            dbMessageId: activeMessageIdB,
          }
        }));
      }
    }
  }, [chatB.messages, activeIntentB, activeSourcesB, activeMessageIdB]);

  // 메시지 리스트 변화 시 메타데이터 바인딩 - C
  useEffect(() => {
    if (chatC.messages.length > 0) {
      const lastMessage = chatC.messages[chatC.messages.length - 1];
      if (lastMessage.role === 'assistant' && !messageMetaC[lastMessage.id]) {
        setMessageMetaC(prev => ({
          ...prev,
          [lastMessage.id]: {
            agentType: activeIntentC,
            sources: activeSourcesC,
            dbMessageId: activeMessageIdC,
          }
        }));
      }
    }
  }, [chatC.messages, activeIntentC, activeSourcesC, activeMessageIdC]);

  // 로컬 세션 및 메시지 이력 저장 (A 기준)
  useEffect(() => {
    if (chatA.messages.length > 0) {
      const saveLocalHistory = async () => {
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        if (!user && sessionId) {
          const localSessions = localStorage.getItem('kongdang_local_sessions');
          let sessionList = localSessions ? JSON.parse(localSessions) : [];
          if (!sessionList.some((s: any) => s.id === sessionId)) {
            sessionList = [{
              id: sessionId,
              title: chatA.messages[0]?.content.substring(0, 30) || '새로운 대화',
              created_at: new Date().toISOString()
            }, ...sessionList];
            localStorage.setItem('kongdang_local_sessions', JSON.stringify(sessionList));
            setSessions(sessionList);
          }
          const localMsgKey = `kongdang_local_msg_${sessionId}`;
          localStorage.setItem(localMsgKey, JSON.stringify(chatA.messages));

          // 메타데이터 저장
          const localMetaKey = `kongdang_local_meta_${sessionId}`;
          localStorage.setItem(localMetaKey, JSON.stringify({
            metaA: messageMetaA,
            metaB: messageMetaB,
            metaC: messageMetaC
          }));
        }
      };
      saveLocalHistory();
    }
    scrollToBottom();
  }, [chatA.messages, sessionId, messageMetaA, messageMetaB, messageMetaC]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 대화 새로 시작
  const handleNewChat = () => {
    const newSId = `session_${Date.now()}`;
    setSessionId(newSId);
    localStorage.setItem('kongdang_active_session_id', newSId);
    
    chatA.setMessages([]);
    chatB.setMessages([]);
    chatC.setMessages([]);
    
    setMessageMetaA({});
    setMessageMetaB({});
    setMessageMetaC({});
    
    chatA.setInput('');

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // 특정 세션 대화 불러오기
  const handleSelectSession = async (sId: string) => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    
    if (!userId) {
      // 비로그인 (게스트): 로컬스토리지에서 복원
      const localMsgKey = `kongdang_local_msg_${sId}`;
      const savedMsgs = localStorage.getItem(localMsgKey);
      if (savedMsgs) {
        try {
          const formattedMessages = JSON.parse(savedMsgs);
          chatA.setMessages(formattedMessages);
          chatB.setMessages(formattedMessages);
          chatC.setMessages(formattedMessages);

          const localMetaKey = `kongdang_local_meta_${sId}`;
          const savedMeta = localStorage.getItem(localMetaKey);
          if (savedMeta) {
            const parsedMeta = JSON.parse(savedMeta);
            setMessageMetaA(parsedMeta.metaA || {});
            setMessageMetaB(parsedMeta.metaB || {});
            setMessageMetaC(parsedMeta.metaC || {});
          } else {
            setMessageMetaA({});
            setMessageMetaB({});
            setMessageMetaC({});
          }
        } catch (e) {
          console.error('Failed to parse local messages:', e);
        }
      }
      setSessionId(sId);
      localStorage.setItem('kongdang_active_session_id', sId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formattedMessages = data.map(m => ({
          id: m.id,
          role: m.role as any,
          content: m.content
        }));
        
        chatA.setMessages(formattedMessages);
        chatB.setMessages(formattedMessages);
        chatC.setMessages(formattedMessages);
        
        const newMeta: Record<string, { agentType: Intent; sources: any[]; dbMessageId?: string }> = {};
        data.forEach(m => {
          if (m.role === 'assistant') {
            newMeta[m.id] = {
              agentType: (m.agent_type || 'general') as Intent,
              sources: m.sources || [],
              dbMessageId: m.id
            };
          }
        });
        
        setMessageMetaA(newMeta);
        setMessageMetaB(newMeta);
        setMessageMetaC(newMeta);
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
    
    if (!userId) {
      // 비로그인 (게스트): 로컬스토리지에서 삭제
      const localSessions = localStorage.getItem('kongdang_local_sessions');
      if (localSessions) {
        try {
          let sessionList = JSON.parse(localSessions);
          sessionList = sessionList.filter((s: any) => s.id !== sId);
          localStorage.setItem('kongdang_local_sessions', JSON.stringify(sessionList));
          setSessions(sessionList);
          
          localStorage.removeItem(`kongdang_local_msg_${sId}`);
          localStorage.removeItem(`kongdang_local_meta_${sId}`);
        } catch (err) {
          console.error('Failed to delete local session:', err);
        }
      }
      if (sessionId === sId) {
        handleNewChat();
      }
      alert('삭제되었습니다.');
      return;
    }

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

  // 첫 발화 시 세션 목록 자동 새로고침 (A 기준)
  useEffect(() => {
    if (chatA.messages.length === 1) {
      if (userId) {
        const timer = setTimeout(() => {
          loadSessions(userId);
        }, 800);
        return () => clearTimeout(timer);
      } else {
        loadLocalSessions();
      }
    }
  }, [chatA.messages.length, userId]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userPrompt = chatA.input.trim();
    if (!userPrompt) return;

    const userMsg = { role: 'user' as const, content: userPrompt };
    chatA.append(userMsg);
    chatB.append(userMsg);
    chatC.append(userMsg);
    chatA.setInput('');
  };

  const handleExampleClick = (text: string) => {
    const userMsg = { role: 'user' as const, content: text };
    chatA.append(userMsg);
    chatB.append(userMsg);
    chatC.append(userMsg);
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

    const userMsg = { role: 'user' as const, content: targetPrompt };
    chatA.append(userMsg);
    chatB.append(userMsg);
    chatC.append(userMsg);
  };

  const handleSuggestionClick = (prompt: string) => {
    const userMsg = { role: 'user' as const, content: prompt };
    chatA.append(userMsg);
    chatB.append(userMsg);
    chatC.append(userMsg);
  };

  return (
    <div className="flex w-full h-full bg-white overflow-hidden relative">
      {/* LNB Sidebar Backdrop for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* LNB Sidebar */}
      <div
        className={`bg-slate-50 border-r border-slate-100 flex flex-col h-full shrink-0 transition-all duration-300 z-50
          ${isSidebarOpen 
            ? 'fixed inset-y-0 left-0 w-60 translate-x-0 md:relative md:translate-x-0' 
            : 'fixed inset-y-0 left-0 w-60 -translate-x-full md:relative md:w-0 md:translate-x-0 md:overflow-hidden'
          }
        `}
      >
        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center space-x-2 py-3 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>새 대화 시작</span>
          </button>
          
          {/* Close Sidebar Button for Mobile Drawer */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2.5 rounded-xl hover:bg-slate-200 text-slate-550 transition-colors"
          >
            <X size={16} />
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
                      className="p-1 rounded-md text-slate-355 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* 챗봇 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-xs gap-4 shrink-0">
          <div className="flex items-center space-x-3">
            {/* Sidebar toggle menu button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95"
              aria-label="Toggle LNB Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="p-2 bg-purple-50 text-[#6D3FA0] rounded-2xl hidden xs:block">
              <Bot size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">콩당콩당 AI 케어 파트너 - 모델 3중 비교 뷰</h2>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold hidden sm:block">동일 질문에 대해 RAG, Ontology, LoRA 미세조정 답변을 실시간 비교합니다.</p>
            </div>
          </div>
        </div>

        {/* Mobile active panel tabs */}
        <div className="flex md:hidden bg-slate-100 p-1 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setActivePanel('A')}
            className={`flex-1 py-2 text-xs font-bold text-center rounded-xl transition-all ${
              activePanel === 'A' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-550'
            }`}
          >
            RAG
          </button>
          <button
            onClick={() => setActivePanel('B')}
            className={`flex-1 py-2 text-xs font-bold text-center rounded-xl transition-all ${
              activePanel === 'B' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-550'
            }`}
          >
            온톨로지
          </button>
          <button
            onClick={() => setActivePanel('C')}
            className={`flex-1 py-2 text-xs font-bold text-center rounded-xl transition-all ${
              activePanel === 'C' ? 'bg-[#6D3FA0] text-white shadow-sm' : 'text-slate-555'
            }`}
          >
            LoRA (추천)
          </button>
        </div>

        {/* 3-Panel Horizontal/Mobile Switchable View */}
        <div className="flex-1 flex overflow-hidden divide-x divide-slate-100 bg-white">
          
          {/* Panel A: 일반 RAG 챗봇 (40% width on desktop) */}
          <div
            className={`w-full md:w-[40%] flex flex-col h-full overflow-hidden bg-white relative
              ${activePanel === 'A' ? 'flex' : 'hidden md:flex'}
            `}
          >
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Group A: RAG</span>
              <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">Standard RAG</span>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {chatA.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-full py-8 space-y-4 text-center">
                  <div className="p-4 bg-purple-50/60 border border-purple-100/30 rounded-3xl space-y-2 max-w-sm">
                    <span className="text-[9px] font-black text-[#6D3FA0] bg-purple-100/80 px-2.5 py-0.5 rounded-md inline-block">
                      Group A: RAG
                    </span>
                    <h3 className="text-xs font-black text-slate-800">기준 정보 대화</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      질문을 하단 입력창에 적어주세요. 3개 에이전트 모델 패널로 자동 연동되어 동시에 답변이 생성됩니다.
                    </p>
                  </div>

                  {/* 2 Quick Start Buttons */}
                  <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                    <button
                      onClick={() => handleExampleClick("최근 소변에 거품이 나고 몸이 붓는데 분석해줘.")}
                      className="p-3 bg-white border border-slate-100 rounded-2xl hover:border-purple-250 hover:shadow-xs transition-all text-left space-y-1 shadow-3xs cursor-pointer text-[10px]"
                    >
                      <span className="text-sm">🩺</span>
                      <h4 className="font-bold text-slate-800">증상 문진 시작하기</h4>
                      <p className="text-slate-400 font-semibold leading-relaxed">거품뇨, 부종 등 증상의 위험도/긴급도 진단</p>
                    </button>

                    <button
                      onClick={() => handleExampleClick("투석 전문 병원 정보를 알려주세요.")}
                      className="p-3 bg-white border border-slate-100 rounded-2xl hover:border-purple-250 hover:shadow-xs transition-all text-left space-y-1 shadow-3xs cursor-pointer text-[10px]"
                    >
                      <span className="text-sm">🏥</span>
                      <h4 className="font-bold text-slate-800">주변 병원 정보 찾기</h4>
                      <p className="text-slate-400 font-semibold leading-relaxed">혈액/복막/야간 투석 병원 검색 및 매칭</p>
                    </button>
                  </div>
                </div>
              ) : (
                chatA.messages.map(m => {
                  const meta = messageMetaA[m.id] || { agentType: 'general' as Intent, sources: [], dbMessageId: '' };
                  return (
                    <MessageBubble
                      key={m.id}
                      role={m.role === 'user' ? 'user' : 'assistant'}
                      content={m.content}
                      agentType={m.role === 'assistant' ? meta.agentType : undefined}
                      sources={m.role === 'assistant' ? meta.sources : undefined}
                      onActionClick={handleActionClick}
                      onSuggestionClick={handleSuggestionClick}
                      dbMessageId={m.role === 'assistant' ? (meta.dbMessageId || m.id) : undefined}
                      sessionId={m.role === 'assistant' ? `${sessionId}_A` : undefined}
                    />
                  );
                })
              )}

              {/* 로딩 표시 */}
              {chatA.isLoading && chatA.messages.length > 0 && chatA.messages[chatA.messages.length - 1].role === 'user' && (
                <div className="flex justify-start items-center space-x-2.5 p-3 bg-white border border-slate-100 rounded-3xl rounded-tl-none max-w-xs shadow-xs animate-pulse">
                  <Loader2 size={14} className="text-purple-600 animate-spin" />
                  <span className="text-[10px] text-slate-400 font-semibold">RAG 검색 및 생성 중...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Panel B: RAG + Ontology 챗봇 (30% width on desktop) */}
          <div
            className={`w-full md:w-[30%] flex flex-col h-full overflow-hidden bg-slate-50/20
              ${activePanel === 'B' ? 'flex' : 'hidden md:flex'}
            `}
          >
            <div className="bg-purple-50/20 border-b border-slate-100 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Group B: RAG + Ontology</span>
              <span className="text-[9px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-bold">Standard Mapped</span>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {chatB.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-full py-8 text-center">
                  <div className="p-4 bg-purple-50/40 border border-purple-100/30 rounded-3xl space-y-2 max-w-xs">
                    <span className="text-[9px] font-black text-purple-700 bg-purple-100/60 px-2.5 py-0.5 rounded-md inline-block">
                      Group B: RAG + Ontology
                    </span>
                    <h3 className="text-xs font-black text-slate-800">의학 표준 지식 매핑</h3>
                    <p className="text-[10px] text-slate-455 leading-relaxed font-semibold">
                      임상 의학 표준 온톨로지를 결합하여 표준화된 건강 지식 기반 답변을 확인합니다.
                    </p>
                  </div>
                </div>
              ) : (
                chatB.messages.map(m => {
                  const meta = messageMetaB[m.id] || { agentType: 'general' as Intent, sources: [], dbMessageId: '' };
                  return (
                    <MessageBubble
                      key={m.id}
                      role={m.role === 'user' ? 'user' : 'assistant'}
                      content={m.content}
                      agentType={m.role === 'assistant' ? meta.agentType : undefined}
                      sources={m.role === 'assistant' ? meta.sources : undefined}
                      onActionClick={handleActionClick}
                      onSuggestionClick={handleSuggestionClick}
                      dbMessageId={m.role === 'assistant' ? (meta.dbMessageId || m.id) : undefined}
                      sessionId={m.role === 'assistant' ? `${sessionId}_B` : undefined}
                    />
                  );
                })
              )}

              {/* 로딩 표시 */}
              {chatB.isLoading && chatB.messages.length > 0 && chatB.messages[chatB.messages.length - 1].role === 'user' && (
                <div className="flex justify-start items-center space-x-2.5 p-3 bg-white border border-slate-100 rounded-3xl rounded-tl-none max-w-xs shadow-xs animate-pulse">
                  <Loader2 size={14} className="text-purple-600 animate-spin" />
                  <span className="text-[10px] text-slate-400 font-semibold">의학 용어 표준 매핑 중...</span>
                </div>
              )}
            </div>
          </div>

          {/* Panel C: RAG + Ontology + LoRA 파인튜닝 (30% width on desktop) */}
          <div
            className={`w-full md:w-[30%] flex flex-col h-full overflow-hidden bg-purple-50/5
              ${activePanel === 'C' ? 'flex' : 'hidden md:flex'}
            `}
          >
            <div className="bg-purple-100/10 border-b border-slate-100 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-purple-900 uppercase tracking-wider">Group C: LoRA Fine-tuning</span>
              <span className="text-[9px] bg-gradient-to-r from-[#6D3FA0] to-purple-600 text-white px-2 py-0.5 rounded-md font-bold">Fine-tuned (추천)</span>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {chatC.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-full py-8 text-center">
                  <div className="p-4 bg-purple-100/20 border border-purple-200/20 rounded-3xl space-y-2 max-w-xs">
                    <span className="text-[9px] font-black text-white bg-gradient-to-r from-[#6D3FA0] to-purple-600 px-2.5 py-0.5 rounded-md inline-block">
                      Group C: LoRA Fine-tuning
                    </span>
                    <h3 className="text-xs font-black text-slate-800">환우 대화 미세조정</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      환우들의 실제 대화 데이터를 학습해 고도로 친절한 말투와 정밀한 복합 만성질환 섭취 제한 가이드를 제시합니다.
                    </p>
                  </div>
                </div>
              ) : (
                chatC.messages.map(m => {
                  const meta = messageMetaC[m.id] || { agentType: 'general' as Intent, sources: [], dbMessageId: '' };
                  return (
                    <MessageBubble
                      key={m.id}
                      role={m.role === 'user' ? 'user' : 'assistant'}
                      content={m.content}
                      agentType={m.role === 'assistant' ? meta.agentType : undefined}
                      sources={m.role === 'assistant' ? meta.sources : undefined}
                      onActionClick={handleActionClick}
                      onSuggestionClick={handleSuggestionClick}
                      dbMessageId={m.role === 'assistant' ? (meta.dbMessageId || m.id) : undefined}
                      sessionId={m.role === 'assistant' ? `${sessionId}_C` : undefined}
                    />
                  );
                })
              )}

              {/* 로딩 표시 */}
              {chatC.isLoading && chatC.messages.length > 0 && chatC.messages[chatC.messages.length - 1].role === 'user' && (
                <div className="flex justify-start items-center space-x-2.5 p-3 bg-white border border-slate-100 rounded-3xl rounded-tl-none max-w-xs shadow-xs animate-pulse">
                  <Loader2 size={14} className="text-[#6D3FA0] animate-spin" />
                  <span className="text-[10px] text-slate-400 font-semibold">LoRA 케어 파트너 답변 중...</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Global Input Bar at the bottom */}
        <div className="bg-white border-t border-slate-100 py-3 px-4 shrink-0">
          <InputBar
            input={chatA.input}
            handleInputChange={chatA.handleInputChange}
            handleSubmit={handleCustomSubmit}
            onExampleClick={handleExampleClick}
            isLoading={chatA.isLoading || chatB.isLoading || chatC.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
