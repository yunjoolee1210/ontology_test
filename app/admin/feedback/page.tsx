'use client';

import React, { useState, useEffect } from 'react';
import { Search, Star, MessageSquare, CheckCircle, AlertTriangle, ShieldCheck, Download, RefreshCw, Save } from 'lucide-react';
import { supabase } from '../../../lib/rag/supabaseClient';

interface FeedbackSession {
  id: string;
  user_name: string;
  title: string;
  created_at: string;
}

interface FeedbackMessagePair {
  id: string; // assistant message id
  question: string;
  answer: string;
  agent_type?: string;
  rating?: number;
  tags?: string[];
  comment?: string;
}

export default function AdminFeedbackPage() {
  const [sessions, setSessions] = useState<FeedbackSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [msgPairs, setMsgPairs] = useState<FeedbackMessagePair[]>([]);
  const [activePairIdx, setActivePairIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // 평가 패널 상태
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const tagsList = [
    { id: 'good', label: '👍 Good (도움됨)' },
    { id: 'excellent', label: '🌟 Excellent (우수함)' },
    { id: 'hallucination', label: '⚠️ Hallucination (환각/거짓)' },
    { id: 'incorrect', label: '❌ Incorrect (틀린 정보)' },
    { id: 'unsafe', label: '🚨 Unsafe (위험한 정보)' },
    { id: 'irrelevant', label: '🧭 Irrelevant (무관한 답변)' },
    { id: 'incomplete', label: '📊 Incomplete (미완성 답변)' },
  ];

  // Mock data for demo
  const mockSessions: FeedbackSession[] = [
    { id: 'session_1', user_name: '홍길동', title: '산정특례와 현미밥 조언', created_at: '2026-06-05T18:30:00Z' },
    { id: 'session_2', user_name: '이순신', title: 'SGLT2 부작용 문의', created_at: '2026-06-04T12:00:00Z' },
  ];

  const mockPairs: Record<string, FeedbackMessagePair[]> = {
    session_1: [
      {
        id: 'm_assist_1',
        question: '만성 신장병 3기 산정특례 혜택하고 현미밥 식단 먹어도 되나요?',
        answer: '의료복지 및 식단에 대한 복합 상담 답변입니다.\n\n1. 산정특례: 만성신부전증(투석) 환자는 본인부담금 10% 혜택을 받습니다.\n2. 현미밥 식단: 칼륨 조절이 필요한 3기 환자는 현미밥의 칼륨/인 함량이 높아 정밀 계량이 필요하며, 보통 백미밥이 권장됩니다.',
        agent_type: 'nutrition',
        rating: 5,
        tags: ['good', 'excellent'],
        comment: '산정특례 요약 및 3기 칼륨/인 제한 설명이 매우 정확하고 상세함.'
      }
    ],
    session_2: [
      {
        id: 'm_assist_2',
        question: '당뇨 혈당 치료약인 SGLT2 부작용에 대해 알려주세요.',
        answer: 'SGLT2 억제제(포시가 등)는 소변으로 포도당을 배출하는 약물입니다. 흔한 부작용으로 요로감염, 질염 및 탈수가 발생할 수 있으므로 하루 1.5L 이상의 충분한 수분 섭취가 필요합니다.',
        agent_type: 'drug',
        rating: 4,
        tags: ['good'],
        comment: '부작용 설명은 우수하나 기전 설명이 다소 짧음.'
      }
    ]
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data: dbSessions, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          title,
          created_at,
          user_profiles (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (dbSessions && dbSessions.length > 0) {
        const formatted: FeedbackSession[] = dbSessions.map((s: any) => ({
          id: s.id,
          user_name: s.user_profiles?.name || '게스트',
          title: s.title || '대화 이력',
          created_at: s.created_at,
        }));
        setSessions(formatted);
      } else {
        setSessions(mockSessions);
      }
    } catch (e) {
      console.warn('Failed to fetch feedback sessions. Fallback to mock.', e);
      setSessions(mockSessions);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessionQA = async (sessionId: string) => {
    setActiveSession(sessionId);
    setLoadingMessages(true);
    setActivePairIdx(null);

    try {
      // 1. 해당 세션의 전체 메시지 조회
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (dbMessages && dbMessages.length > 0) {
        // Q&A 페어 매핑
        const pairs: FeedbackMessagePair[] = [];
        for (let i = 0; i < dbMessages.length; i++) {
          if (dbMessages[i].role === 'assistant') {
            const questionMsg = dbMessages[i - 1]?.content || '질문 유실';
            const assistantMsgId = dbMessages[i].id;
            
            // 피드백 데이터가 있는지 조회
            const { data: fb } = await supabase
              .from('conversation_feedback')
              .select('*')
              .eq('message_id', assistantMsgId)
              .single();

            pairs.push({
              id: assistantMsgId,
              question: questionMsg,
              answer: dbMessages[i].content,
              agent_type: dbMessages[i].agent_type,
              rating: fb?.rating || undefined,
              tags: fb?.tags || [],
              comment: fb?.comment || '',
            });
          }
        }
        setMsgPairs(pairs);
        if (pairs.length > 0) {
          selectPair(0, pairs);
        }
      } else {
        const pairs = mockPairs[sessionId] || [];
        setMsgPairs(pairs);
        if (pairs.length > 0) {
          selectPair(0, pairs);
        }
      }
    } catch (e) {
      console.warn('Failed to load QA pairs. Fallback to mock.', e);
      const pairs = mockPairs[sessionId] || [];
      setMsgPairs(pairs);
      if (pairs.length > 0) {
        selectPair(0, pairs);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectPair = (idx: number, pairsList: FeedbackMessagePair[] = msgPairs) => {
    setActivePairIdx(idx);
    const pair = pairsList[idx];
    if (pair) {
      setRating(pair.rating || 5);
      setSelectedTags(pair.tags || []);
      setComment(pair.comment || '');
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSaveFeedback = async () => {
    if (activePairIdx === null || !activeSession) return;
    const activePair = msgPairs[activePairIdx];
    if (!activePair) return;

    setSaving(true);
    try {
      // Supabase conversation_feedback 저장/업서트 시도
      const { error } = await supabase
        .from('conversation_feedback')
        .upsert({
          session_id: activeSession,
          message_id: activePair.id,
          rating,
          tags: selectedTags,
          comment,
          updated_at: new Date().toISOString()
        }, { onConflict: 'message_id' });

      if (error) throw error;

      // 감사 로그 생성 (admin_logs)
      await supabase.from('admin_logs').insert({
        action: 'FEEDBACK_SAVE',
        target_id: activePair.id,
        details: `Saved feedback rating ${rating} with tags: ${selectedTags.join(', ')}`
      });

      // 로컬 리스트 데이터 갱신
      setMsgPairs(prev => prev.map((p, i) => 
        i === activePairIdx 
          ? { ...p, rating, tags: selectedTags, comment } 
          : p
      ));

      alert('피드백 및 모델 평가가 안전하게 저장되었습니다.');
    } catch (err) {
      console.error(err);
      // Local state fallback update
      setMsgPairs(prev => prev.map((p, i) => 
        i === activePairIdx 
          ? { ...p, rating, tags: selectedTags, comment } 
          : p
      ));
      alert('데이터베이스 피드백 테이블이 활성화되어 있지 않으나 로컬 메모리에 임시 적용되었습니다.');
    } finally {
      setSaving(false);
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
            <CheckCircle className="text-purple-700" />
            AI 답변 품질 평가 및 피드백 콘솔
          </h1>
          <p className="text-xs text-slate-400 mt-1">에이전트 별 답변 정확성을 검증하고 파인튜닝용 인간 피드백(RLHF) 저장</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* 파인튜닝 Export 버튼 (비활성화 상태) */}
          <button
            disabled
            title="향후 LoRA/Fine-tuning 학습을 위해 평가 완료된 데이터를 JSONL 형식으로 추출합니다 (현재는 준비 중)"
            className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl cursor-not-allowed opacity-60 font-semibold"
          >
            <Download size={14} />
            Fine-tuning JSONL 추출 (준비중)
          </button>
          <button 
            onClick={fetchSessions}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-purple-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition-all"
          >
            <RefreshCw size={12} />
            세션 갱신
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 좌측: 세션 목록 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="세션, 사용자명 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white transition-all"
            />
            <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingSessions ? (
              <div className="text-center py-10 text-xs text-slate-400">대화 세션 목록 로드 중...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">피드백 대상 세션이 없습니다.</div>
            ) : (
              filteredSessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => fetchSessionQA(s.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isActive ? 'border-purple-600 bg-purple-50/40 text-purple-700 font-bold' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50 text-slate-700'}`}
                  >
                    <h4 className="text-xs truncate pr-1">{s.title}</h4>
                    <span className="text-[9px] text-slate-400 block mt-1 font-semibold">👤 {s.user_name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 중앙: 대화 질의응답 (Q&A) 선택 및 상세 뷰 */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[480px] overflow-hidden">
          {!activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
              <MessageSquare size={32} className="text-slate-200 animate-pulse" />
              <div>
                <h3 className="text-xs font-bold text-slate-500">피드백 평가 대상을 선택해 주세요</h3>
                <p className="text-[10px] text-slate-400 mt-1">좌측 리스트에서 세션을 선택하면 평가할 수 있는 대화쌍이 활성화됩니다.</p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">Q&A 목록을 로드하고 있습니다...</div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              {/* 세션 내 Q&A 셀렉터 */}
              <div className="flex gap-2 pb-3 border-b border-slate-100 overflow-x-auto flex-shrink-0">
                {msgPairs.map((pair, idx) => {
                  const isSelected = activePairIdx === idx;
                  const hasFb = pair.rating !== undefined;
                  return (
                    <button
                      key={pair.id}
                      onClick={() => selectPair(idx)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-bold shrink-0 transition-all ${isSelected ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm' : hasFb ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    >
                      질의 {idx + 1} {hasFb && '✓'}
                    </button>
                  );
                })}
              </div>

              {/* 활성화된 Q&A 상세 정보 */}
              {activePairIdx !== null && msgPairs[activePairIdx] ? (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {/* 질문 */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">User Question</span>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-800 leading-relaxed font-mono">
                      {msgPairs[activePairIdx].question}
                    </div>
                  </div>

                  {/* 답변 */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">AI Synthesized Response</span>
                      {msgPairs[activePairIdx].agent_type && (
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                          ⚙️ {msgPairs[activePairIdx].agent_type} agent
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                      {msgPairs[activePairIdx].answer}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400">대화 페어가 없습니다.</div>
              )}
            </div>
          )}
        </div>

        {/* 우측: 평가 및 피드백 작성 패널 */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-md flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
          {activePairIdx === null ? (
            <div className="flex-1 flex items-center justify-center text-center text-[10px] text-slate-400 px-4 leading-relaxed">
              피드백 패널 비활성화 상태입니다. 대화쌍을 먼저 선택해 주세요.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* 1. 만족도 별점 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase block">1. 답변 정확도 평점 (1~5)</label>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRating(val)}
                        className="p-1 text-slate-300 hover:text-amber-500 hover:scale-110 transition-all cursor-pointer"
                      >
                        <Star 
                          size={24} 
                          className={rating >= val ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} 
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-600 ml-2">{rating}점</span>
                  </div>
                </div>

                {/* 2. 에러 유무 태그 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase block">2. 에이전트 평가 태그</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsList.map(tag => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleTagToggle(tag.id)}
                          className={`text-[10px] px-2.5 py-1 rounded-xl border font-bold transition-all cursor-pointer ${isSelected ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 코멘트 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase block">3. 관리자 종합 피드백 코멘트</label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="인간 피드백 평가 세부 내용을 기록하세요..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-1 focus:ring-purple-600 focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSaveFeedback}
                disabled={saving}
                className="w-full py-3 bg-gradient-to-tr from-[#6D3FA0] to-purple-700 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {saving ? (
                  <span>피드백 저장 중...</span>
                ) : (
                  <>
                    <Save size={14} />
                    <span>평가 피드백 영구 저장</span>
                  </>
                )}
              </button>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
