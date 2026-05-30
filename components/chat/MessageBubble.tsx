import React from 'react';
import { AgentBadge } from './AgentBadge';
import { SourcePanel, Source } from './SourcePanel';
import { Intent } from '../../lib/types/chat';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  agentType?: Intent;
  sources?: Source[];
}

export function MessageBubble({ role, content, agentType, sources }: MessageBubbleProps) {
  const isUser = role === 'user';

  // 텍스트를 마크다운 형태 및 줄바꿈 지원하도록 간단히 포맷팅
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // 볼드체 ** 텍스트 파싱
      let renderedLine = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      const match = boldRegex.exec(line);
      
      if (match) {
        const parts = line.split(/\*\*.*?\*\*/);
        return (
          <p key={i} className="min-h-[1.25rem]">
            {parts[0]}
            <strong className="font-semibold text-slate-900">{match[1]}</strong>
            {parts[1]}
          </p>
        );
      }

      return (
        <p key={i} className="min-h-[1.25rem]">
          {line}
        </p>
      );
    });
  };

  return (
    <div className={`flex w-full my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3.5 shadow-sm transition-all duration-300 ${
        isUser 
          ? 'bg-gradient-to-tr from-purple-700 to-purple-600 text-white rounded-tr-none' 
          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
      }`}>
        {/* Assistant Badge 표시 */}
        {!isUser && agentType && (
          <div className="mb-2">
            <AgentBadge type={agentType} />
          </div>
        )}

        <div className={`space-y-1 text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'}`}>
          {formatContent(content)}
        </div>

        {/* 출처 패널 표시 */}
        {!isUser && sources && sources.length > 0 && (
          <SourcePanel sources={sources} />
        )}
      </div>
    </div>
  );
}
