import React from 'react';

export interface Source {
  title: string;
  url?: string;
  doi?: string;
  org?: string;
}

interface SourcePanelProps {
  sources: Source[];
}

export function SourcePanel({ sources }: SourcePanelProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      <div className="flex items-center space-x-1.5 mb-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          🔍 답변 근거 및 출처 ({sources.length})
        </span>
      </div>
      <ul className="space-y-2">
        {sources.map((src, idx) => (
          <li key={idx} className="text-xs text-slate-600 hover:text-slate-800 transition-colors">
            <span className="font-semibold text-slate-700">{idx + 1}. </span>
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-600 font-medium"
              >
                {src.title}
              </a>
            ) : (
              <span className="font-medium text-slate-800">{src.title}</span>
            )}
            {src.org && <span className="text-slate-500"> - {src.org}</span>}
            {src.doi && <span className="text-slate-400 block mt-0.5 ml-3">DOI: {src.doi}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
