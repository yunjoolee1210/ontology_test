'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, LayoutDashboard, ShieldAlert, Bot, Sparkles, Heart } from 'lucide-react';
import { CuteLogoIcon } from '../../components/layout/GNB';

export default function HomeLandingPage() {
  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-6 space-y-16 animate-fade-in text-slate-800">
      {/* 1. Hero Section */}
      <div className="text-center space-y-6 pt-4">
        <div className="p-4 rounded-3xl bg-gradient-to-tr from-[#6D3FA0] to-[#C0392B] text-white shadow-xl inline-flex animate-bounce">
          <CuteLogoIcon size={40} />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-[#6D3FA0] via-purple-700 to-[#C0392B] bg-clip-text text-transparent">
            콩당콩당
          </h1>
          <p className="text-base sm:text-lg font-bold text-slate-650 max-w-xl mx-auto leading-relaxed">
            콩팥병·당뇨 복합 환자를 위한 의도 탐지 기반 멀티에이전트 AI 케어 파트너
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            만성 신장병(CKD)과 당뇨병(DM) 맞춤형 의학 검증 데이터, 복지 혜택, 식단 지침, 그리고 전문 병원 매칭 서비스를 편리한 대화형 인터페이스로 지원합니다.
          </p>
        </div>

        {/* CTA 버튼 그룹 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/chat"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#6D3FA0] to-purple-800 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-2 shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <MessageSquare size={16} />
            <span>AI 챗봇과 대화 시작하기</span>
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            <LayoutDashboard size={16} className="text-[#C0392B]" />
            <span>건강 대시보드로 이동</span>
          </Link>
        </div>
      </div>

      {/* 2. Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {[
          {
            title: '🩺 증상 문진 에이전트',
            desc: '구어체 증상의 임상 표준 의학 용어 매핑 및 4단계 위험도 분류',
            details: '부종, 거품뇨 등 흔히 호소하는 증상들을 분석하고 방문 권장 기한과 행동 대처 요령을 즉각 조언합니다.'
          },
          {
            title: '🥗 맞춤 식단 및 생활 가이드',
            desc: '신장 단계별 칼륨/인 섭취 한도 및 당뇨 환자 운동 조언',
            details: '바나나, 김치 등 특정 식품의 안전 등급 판정과 함께 대체 한식 식품 추천 및 저칼륨 조리 팁을 제공합니다.'
          },
          {
            title: '🏛️ 보건복지 혜택 연계',
            desc: '산정특례 V코드 등록 및 신장장애인 급여 지원 안내',
            details: '투석 개시 전후로 받을 수 있는 본인부담금 경감 제도와 소모성 재료비 환급 방법, 신청 시 구비서류를 정리해 줍니다.'
          },
          {
            title: '🏥 투석 전문 병원 탐색',
            desc: '위치 정보 기반 혈액/복막/야간 투석실 운영 기관 실시간 안내',
            details: '내 주변 반경 5km 이내의 투석 의료기관 리스트를 조회하고, 혈액/복막/야간 투석실 보유 여부를 편리하게 확인하세요.'
          }
        ].map((feat, idx) => (
          <div
            key={idx}
            className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-2.5 hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full blur-3xl opacity-40"></div>
            <h4 className="text-sm font-black text-slate-800">{feat.title}</h4>
            <p className="text-[11px] font-bold text-[#6D3FA0]">{feat.desc}</p>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">{feat.details}</p>
          </div>
        ))}
      </div>

      {/* 3. Medical Warning Disclaimer */}
      <div className="p-5 bg-red-50/50 border border-red-100 rounded-3xl flex items-start space-x-3.5 shadow-2xs">
        <ShieldAlert size={20} className="text-[#C0392B] shrink-0 mt-0.5" />
        <div className="space-y-1 text-left">
          <h5 className="text-xs font-black text-[#C0392B]">의료적 주의 고지</h5>
          <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
            콩당콩당 서비스는 건강 관리 및 의학 정보 탐색 보조 목적으로만 사용되며, 의사의 전문적인 진료나 진단을 대신할 수 없습니다. 증상이 심각하거나 응급 상황인 경우 반드시 119에 연락하거나 상급 종합병원의 응급실을 내원하시기 바랍니다.
          </p>
        </div>
      </div>
    </div>
  );
}
