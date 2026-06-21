import React, { useState, useEffect } from 'react';
import { AgentBadge } from './AgentBadge';
import { SourcePanel, Source } from './SourcePanel';
import { Intent } from '../../lib/types/chat';

import { Star, Save } from 'lucide-react';
import { supabase } from '../../lib/rag/supabaseClient';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  agentType?: Intent;
  sources?: Source[];
  onActionClick?: (actionType: string) => void;
  onSuggestionClick?: (prompt: string) => void;
  dbMessageId?: string;
  sessionId?: string;
}

export function MessageBubble({ role, content, agentType, sources, onActionClick, onSuggestionClick, dbMessageId, sessionId }: MessageBubbleProps) {
  const isUser = role === 'user';
  
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    if (dbMessageId) {
      const loadFeedback = async () => {
        try {
          const { data, error } = await supabase
            .from('conversation_feedback')
            .select('*')
            .eq('message_id', dbMessageId)
            .single();
          if (!error && data) {
            setRating(data.rating || 5);
            setSelectedTags(data.tags || []);
            setComment(data.comment || '');
            setHasFeedback(true);
          }
        } catch (e) {
          console.error('Failed to load feedback:', e);
        }
      };
      loadFeedback();
    }
  }, [dbMessageId]);

  const tagsList = [
    { id: 'good', label: '👍 Good' },
    { id: 'excellent', label: '🌟 Excellent' },
    { id: 'hallucination', label: '⚠️ 환각' },
    { id: 'incorrect', label: '❌ 오답' },
    { id: 'unsafe', label: '🚨 위험' },
    { id: 'irrelevant', label: '🧭 무관' },
    { id: 'incomplete', label: '📊 미흡' },
  ];

  const handleSaveFeedback = async () => {
    if (!dbMessageId || !sessionId) return;
    setSaving(true);
    try {
      if (hasFeedback) {
        // 기존 피드백이 존재하는 경우 수정(UPDATE)
        const { error } = await supabase
          .from('conversation_feedback')
          .update({
            rating,
            tags: selectedTags,
            comment,
            updated_at: new Date().toISOString()
          })
          .eq('message_id', dbMessageId);
        if (error) throw error;
      } else {
        // 기존 피드백이 없는 경우 신규 등록(INSERT)
        const { error } = await supabase
          .from('conversation_feedback')
          .insert({
            session_id: sessionId,
            message_id: dbMessageId,
            rating,
            tags: selectedTags,
            comment,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      setHasFeedback(true);
      alert('평가가 안전하게 저장되었습니다!');
    } catch (e) {
      console.error(e);
      alert('평가 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Extract suggestions from content
  let cleanContent = content;
  let parsedSuggestions: { label: string; prompt: string }[] = [];
  
  if (content.includes('[SUGGESTIONS]')) {
    const parts = content.split('[SUGGESTIONS]');
    cleanContent = parts[0].trim();
    let suggestionsText = parts[1] || '';
    
    // Remove the closing tag if it exists
    suggestionsText = suggestionsText.replace('[/SUGGESTIONS]', '').trim();
    
    const lines = suggestionsText.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('-') || line.startsWith('*')) {
        const item = line.substring(1).trim();
        const colonIdx = item.indexOf(':');
        if (colonIdx !== -1) {
          const label = item.substring(0, colonIdx).trim();
          const prompt = item.substring(colonIdx + 1).trim();
          parsedSuggestions.push({ label, prompt });
        } else {
          parsedSuggestions.push({ label: item, prompt: item });
        }
      }
    }
  }

  const parseBold = (text: string): React.ReactNode[] => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold text-slate-900">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  const parseLinksAndBold = (text: string): React.ReactNode[] => {
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...parseBold(text.substring(lastIndex, match.index)));
      }

      const label = match[1];
      const url = match[2];

      if (url.startsWith('#action-')) {
        const actionType = url.replace('#action-', '');
        parts.push(
          <button
            key={`action-${match.index}`}
            onClick={() => onActionClick && onActionClick(actionType)}
            className="mx-1 px-3 py-1 bg-purple-50 text-[#6D3FA0] border border-purple-200 rounded-lg text-xs font-bold hover:bg-[#6D3FA0] hover:text-white transition-all shadow-xs my-1"
          >
            {label}
          </button>
        );
      } else {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-850 font-bold underline mx-0.5"
          >
            {label}
          </a>
        );
      }

      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(...parseBold(text.substring(lastIndex)));
    }

    return parts.length > 0 ? parts : [text];
  };

  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      let isHeader = false;
      let renderedLine: React.ReactNode = null;

      if (line.startsWith('#### ')) {
        isHeader = true;
        renderedLine = <h5 className="text-xs font-extrabold text-slate-900 mt-3 mb-1.5">{parseLinksAndBold(line.substring(5))}</h5>;
      } else if (line.startsWith('### ')) {
        isHeader = true;
        renderedLine = <h4 className="text-sm font-black text-slate-900 mt-4 mb-2">{parseLinksAndBold(line.substring(4))}</h4>;
      } else if (line.startsWith('## ')) {
        isHeader = true;
        renderedLine = <h3 className="text-base font-black text-slate-900 mt-5 mb-2.5">{parseLinksAndBold(line.substring(3))}</h3>;
      } else if (line.startsWith('# ')) {
        isHeader = true;
        renderedLine = <h2 className="text-lg font-black text-slate-900 mt-6 mb-3">{parseLinksAndBold(line.substring(2))}</h2>;
      }

      if (!isHeader) {
        renderedLine = parseLinksAndBold(line);
      }

      // Identify risk tags and add beautiful background highlight if needed
      let lineClass = "min-h-[1.25rem] my-0.5";
      if (line.includes('🚨') || line.includes('위험도: 응급')) {
        lineClass += " p-2.5 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-950 font-semibold my-2 shadow-2xs";
      } else if (line.includes('🔴') || line.includes('위험도: 위험')) {
        lineClass += " p-2.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl text-amber-950 font-semibold my-2 shadow-2xs";
      } else if (line.includes('🟡') || line.includes('위험도: 주의')) {
        lineClass += " p-2.5 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-xl text-yellow-950 my-2";
      } else if (line.includes('🟢') || line.includes('위험도: 정상')) {
        lineClass += " p-2.5 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-xl text-emerald-950 my-2";
      }

      return (
        <div key={i} className={lineClass}>
          {renderedLine}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[80%] rounded-3xl px-5 py-4 shadow-xs transition-all duration-300 ${
        isUser 
          ? 'bg-purple-800 text-white rounded-tr-none' 
          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-md'
      }`}>
        {/* Assistant Badge 표시 */}
        {!isUser && agentType && (
          <div className="mb-2 flex items-center justify-between">
            <AgentBadge type={agentType} />
          </div>
        )}

        <div className={`space-y-1.5 text-sm leading-relaxed ${isUser ? 'text-purple-50' : 'text-slate-700'}`}>
          {formatContent(cleanContent)}
        </div>



        {/* 제안/후속 질문 버튼 표시 */}
        {!isUser && parsedSuggestions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-150 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span>🎯 추천 후속 질문 & 다음 태스크</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsedSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => onSuggestionClick && onSuggestionClick(sug.prompt)}
                  className="text-xs px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-600 hover:text-white hover:border-purple-600 text-purple-700 font-semibold transition-all duration-200 shadow-2xs active:scale-[0.98] text-left"
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 출처 패널 표시 */}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-50">
            <SourcePanel sources={sources} />
          </div>
        )}

        {/* 모델 평가 피드백 영역 - 디폴트 접힘 상태 */}
        {!isUser && dbMessageId && sessionId && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(!isFeedbackOpen)}
                className="text-[10px] font-extrabold text-[#6D3FA0] hover:text-purple-900 transition-colors flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-purple-50/50"
              >
                <span>평가...</span>
                <span className="text-[8px] text-slate-400 font-normal">
                  {isFeedbackOpen ? '▲ 접기' : '▼ 펼치기'}
                </span>
                {hasFeedback && (
                  <span className="text-[9px] text-emerald-600 font-bold ml-1.5 flex items-center gap-0.5">
                    ✓ 완료
                  </span>
                )}
              </button>
            </div>

            {isFeedbackOpen && (
              <div className="mt-2.5 p-3 bg-slate-50/40 border border-slate-100 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* 별점 */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">평점 (1-5):</span>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRating(val)}
                        className="p-0.5 text-slate-200 hover:text-amber-500 transition-colors"
                      >
                        <Star
                          size={16}
                          className={rating >= val ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600">{rating}점</span>
                </div>

                {/* 태그 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 block">평가 태그:</span>
                  <div className="flex flex-wrap gap-1">
                    {tagsList.map(tag => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedTags(prev =>
                              prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-purple-600 bg-purple-50 text-purple-700' 
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 코멘트 입력 및 저장 버튼 */}
                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="피드백 코멘트를 입력하세요 (선택)..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:ring-1 focus:ring-[#6D3FA0] focus:border-[#6D3FA0] transition-all text-slate-700 shadow-2xs"
                  />
                  <button
                    onClick={handleSaveFeedback}
                    disabled={saving}
                    className="px-3 py-1.5 bg-[#6D3FA0] hover:bg-purple-800 text-white rounded-xl text-[10px] font-bold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1 shrink-0"
                  >
                    <Save size={10} />
                    <span>저장</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
