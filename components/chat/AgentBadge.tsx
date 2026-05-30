import React from 'react';
import { Intent } from '../../lib/types/chat';

interface AgentBadgeProps {
  type: Intent;
}

export function AgentBadge({ type }: AgentBadgeProps) {
  switch (type) {
    case 'research':
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-sm animate-fade-in">
          <span className="w-2 h-2 mr-1.5 bg-purple-600 rounded-full animate-pulse"></span>
          📄 논문 분석 에이전트
        </span>
      );
    case 'welfare':
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm animate-fade-in">
          <span className="w-2 h-2 mr-1.5 bg-red-600 rounded-full animate-pulse"></span>
          🏥 의료복지 에이전트
        </span>
      );
    case 'general':
    default:
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">
          <span className="w-2 h-2 mr-1.5 bg-slate-500 rounded-full"></span>
          💬 일반 건강 코칭
        </span>
      );
  }
}
