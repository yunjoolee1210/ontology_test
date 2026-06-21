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
    <div className="mt-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 shadow-3xs">
      <div className="flex items-center space-x-1.5 mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          🔍 출처 ({sources.length})
        </span>
      </div>
      <ul className="space-y-1">
        {sources.map((src, idx) => (
          <li key={idx} className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors leading-relaxed">
            <span className="font-bold text-slate-400">{idx + 1}. </span>
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-purple-700 font-semibold text-slate-600"
              >
                {src.title}
              </a>
            ) : (
              <span className="font-semibold text-slate-700">{src.title}</span>
            )}
            {src.org && <span className="text-slate-400"> - {src.org}</span>}
            {src.doi && <span className="text-[9px] text-slate-400 ml-1">(DOI: {src.doi})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
