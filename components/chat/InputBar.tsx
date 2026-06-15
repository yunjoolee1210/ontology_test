import React from 'react';
import { Send } from 'lucide-react';

interface InputBarProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onExampleClick: (text: string) => void;
  isLoading: boolean;
}

export function InputBar({
  input,
  handleInputChange,
  handleSubmit,
  onExampleClick,
  isLoading,
}: InputBarProps) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-3 bg-white border-t border-slate-100 shadow-lg md:rounded-t-2xl">


      {/* 입력 필드 */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="신장·당뇨 논문, 의료 복지 혜택을 질문해 보세요..."
          disabled={isLoading}
          maxLength={500}
          className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-white transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 p-2 rounded-lg bg-gradient-to-tr from-purple-700 to-purple-600 text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shadow-md"
        >
          <Send size={18} />
        </button>
      </form>
      <div className="flex justify-between items-center mt-2 px-1 text-[10px] text-slate-400">
        <span>최대 500자 입력 가능</span>
        <span>에이전트가 Pinecone & Supabase 실시간 데이터를 탐색합니다</span>
      </div>
    </div>
  );
}
