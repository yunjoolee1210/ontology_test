import React from 'react';
import { AgentBadge } from './AgentBadge';
import { SourcePanel, Source } from './SourcePanel';
import { Intent } from '../../lib/types/chat';
import { HospitalSearchTab } from './HospitalSearchTab';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  agentType?: Intent;
  sources?: Source[];
  onActionClick?: (actionType: string) => void;
  onSuggestionClick?: (prompt: string) => void;
}

export function MessageBubble({ role, content, agentType, sources, onActionClick, onSuggestionClick }: MessageBubbleProps) {
  const isUser = role === 'user';

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

        {/* 병원 정보 검색 위젯 임베딩 */}
        {!isUser && agentType === 'hospital' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <HospitalSearchTab />
          </div>
        )}

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
      </div>
    </div>
  );
}
