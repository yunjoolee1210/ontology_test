import React from 'react';
import { AgentBadge } from './AgentBadge';
import { SourcePanel, Source } from './SourcePanel';
import { Intent } from '../../lib/types/chat';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  agentType?: Intent;
  sources?: Source[];
  onActionClick?: (actionType: string) => void;
}

export function MessageBubble({ role, content, agentType, sources, onActionClick }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Parse custom links like [식단 에이전트로 연결](#action-nutrition)
  const parseActionLinks = (line: string) => {
    const actionRegex = /\[(.*?)\]\(#action-(.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = actionRegex.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      
      const label = match[1];
      const actionType = match[2];
      
      parts.push(
        <button
          key={match.index}
          onClick={() => onActionClick && onActionClick(actionType)}
          className="mx-1 px-3 py-1 bg-purple-50 text-[#6D3FA0] border border-purple-200 rounded-lg text-xs font-bold hover:bg-[#6D3FA0] hover:text-white transition-all shadow-xs my-1"
        >
          {label}
        </button>
      );
      
      lastIndex = actionRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts.length > 0 ? parts : line;
  };

  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Check for list items
      const isListItem = line.trim().startsWith('- ') || line.trim().match(/^\d+\.\s/);
      
      // Parse bold text
      let renderedLine: React.ReactNode = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      
      if (line.includes('**')) {
        const parts = [];
        let lastIndex = 0;
        let match;
        
        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          parts.push(<strong key={match.index} className="font-bold text-slate-900">{match[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        renderedLine = parts;
      }

      // Check if line contains action buttons
      if (typeof renderedLine === 'string' && renderedLine.includes('#action-')) {
        renderedLine = parseActionLinks(renderedLine);
      } else if (Array.isArray(renderedLine)) {
        renderedLine = renderedLine.map(part => {
          if (typeof part === 'string' && part.includes('#action-')) {
            return parseActionLinks(part);
          }
          return part;
        });
      }

      // Identify risk tags and add beautiful background highlight if needed
      let lineClass = "min-h-[1.25rem] my-0.5";
      if (line.includes('🚨') || line.includes('위험도: 응급')) {
        lineClass += " p-2 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-950 font-medium";
      } else if (line.includes('🔴') || line.includes('위험도: 위험')) {
        lineClass += " p-2 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-amber-950 font-medium";
      } else if (line.includes('🟡') || line.includes('위험도: 주의')) {
        lineClass += " p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md text-yellow-950";
      } else if (line.includes('🟢') || line.includes('위험도: 정상')) {
        lineClass += " p-2 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-md text-emerald-950";
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
          {formatContent(content)}
        </div>

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
