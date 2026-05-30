import React from 'react';
import Link from 'next/link';
import { Users, MessageSquare, Award, ArrowRight } from 'lucide-react';

export default function CommunityPage() {
  const posts = [
    {
      title: '만성 신부전 3기 직장 생활 꿀팁 및 식생활 조언 부탁드립니다.',
      author: '신장지킴이',
      date: '방금 전',
      comments: 5,
      likes: 12,
    },
    {
      title: '당뇨 합병증 신증 예방을 위한 하루 유산소 적정 강도 공유해요',
      author: '건강왕조',
      date: '2시간 전',
      comments: 3,
      likes: 8,
    },
    {
      title: '보건소 영양플러스 사업 당뇨환자 지원 자격 아시는 분 계신가요?',
      author: '보라둥이',
      date: '5시간 전',
      comments: 9,
      likes: 15,
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-8 animate-fade-in">
      {/* 퀴즈 배너 */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-800 to-indigo-800 text-white shadow-lg flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <div className="space-y-1 text-center md:text-left">
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-white/20 uppercase">
            <Award size={10} className="mr-0.5" />
            <span>DAILY CHALLENGE</span>
          </div>
          <h2 className="text-lg font-bold">신장 & 당뇨 퀴즈 챌린지</h2>
          <p className="text-xs text-purple-200">매일 신선한 건강 퀴즈 풀고 콩당 포인트를 적립해 보세요!</p>
        </div>
        <Link
          href="/community/quiz"
          className="px-5 py-2.5 bg-white text-purple-800 font-extrabold text-xs rounded-xl shadow-md hover:bg-purple-50 transition-all flex items-center space-x-1"
        >
          <span>퀴즈 시작하기</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-slate-800">
          <Users size={20} className="text-purple-600" />
          <h2 className="text-lg font-bold">환우들과 소통하는 커뮤니티</h2>
        </div>
        
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {posts.map((post, idx) => (
              <div key={idx} className="p-5 hover:bg-slate-50 transition-colors flex items-start justify-between cursor-pointer">
                <div className="space-y-1.5 pr-6">
                  <h3 className="text-sm font-bold text-slate-800 hover:text-purple-700 transition-colors">
                    {post.title}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span className="font-semibold text-slate-600">{post.author}</span>
                    <span>•</span>
                    <span>{post.date}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-50">
                  <span className="flex items-center space-x-1 text-purple-700">
                    <MessageSquare size={12} />
                    <span>{post.comments}</span>
                  </span>
                  <span>|</span>
                  <span>좋아요 {post.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
