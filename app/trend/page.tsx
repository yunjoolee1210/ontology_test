import React from 'react';
import { Flame, Star, TrendingUp, BookOpen, Link as LinkIcon } from 'lucide-react';

export default function TrendPage() {
  const trends = [
    {
      title: 'SGLT-2 억제제의 만성 콩팥병(CKD) 신장 보호 및 당뇨 연계 효과',
      source: 'NEJM (New England Journal of Medicine)',
      date: '2026년 5월',
      summary: '당뇨병성 신증 환자 군에서 사구체여과율(eGFR) 저하 지연 및 심혈관계 합병증 감소율이 대조군 대비 약 28% 개선된 최신 대규모 임상 연구 결과 요약.',
      hot: true,
    },
    {
      title: '보건복지부 요양비 급여 기준 확대 시행안 (복막투석 소모성 재료)',
      source: '국민건강보험공단',
      date: '2026년 4월',
      summary: '가정 내 복막투석 환자를 대상으로 소모성 재료(카테터, 소독 세트 등) 지원비 한도가 하루 12,000원으로 인상됨에 따른 신청 절차 안내.',
      hot: false,
    },
    {
      title: '만성 신부전증 4기 환자의 고칼륨혈증 관리를 위한 식이 제한 가이드라인',
      source: '대한신장학회 학술논문',
      date: '2026년 3월',
      summary: '혈청 칼륨 농도 조절을 위해 칼륨 함량이 높은 채소(시금치, 토마토 등)의 물에 담그기 전처리 가공법 및 섭취 상한선에 대한 의학적 타당성 검증.',
      hot: false,
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-purple-700">
          <TrendingUp size={24} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">최신 메디컬 & 복지 트렌드</h1>
        </div>
        <p className="text-sm text-slate-500">
          대한민국 콩팥병·당뇨 환자들을 위해 선별된 보건사회 복지 소식 및 최신 글로벌 학술 연구 요약 동향입니다.
        </p>
      </div>

      <div className="grid gap-6">
        {trends.map((item, idx) => (
          <div key={idx} className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">
            {item.hot && (
              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center space-x-1 shadow-sm">
                <Flame size={10} className="fill-white" />
                <span>HOT TREND</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-xs font-semibold text-purple-700 mb-2">
              <BookOpen size={14} />
              <span>{item.source}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400 font-normal">{item.date}</span>
            </div>
            <h2 className="text-base font-bold text-slate-800 group-hover:text-purple-700 transition-colors mb-3 pr-20">
              {item.title}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-50">
              {item.summary}
            </p>
            <div className="mt-4 flex justify-end">
              <button className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center space-x-1">
                <span>자세히 보기</span>
                <LinkIcon size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
