import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Coins, Receipt } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';

const plans = [
  {
    id: 'free',
    name: '무료',
    price: 0,
    tokens: 1500,
    features: [
      'AI 챗봇 기본 이용',
      '커뮤니티 접근',
      '트렌드 뉴스 열람',
      '월 1,500 토큰 제공'
    ],
    popular: false
  },
  {
    id: 'basic',
    name: '베이직',
    price: 9900,
    tokens: 5000,
    features: [
      '무료 플랜 모든 기능',
      '맞춤 식단 추천',
      '건강 리포트 생성',
      '월 5,000 토큰 제공',
      '우선 고객 지원'
    ],
    popular: true
  },
  {
    id: 'pro',
    name: '프로',
    price: 19900,
    tokens: -1,
    features: [
      '베이직 플랜 모든 기능',
      '무제한 토큰',
      '연구 논문 전문 분석',
      '개인 맞춤 알림',
      '1:1 전문가 상담'
    ],
    popular: false
  }
];

const mockPaymentHistory = [
  {
    id: '1',
    date: '2025.11.15',
    plan: '베이직',
    amount: 9900,
    status: 'completed',
    tokens: 5000
  },
  {
    id: '2',
    date: '2025.10.15',
    plan: '베이직',
    amount: 9900,
    status: 'completed',
    tokens: 5000
  },
  {
    id: '3',
    date: '2025.09.15',
    plan: '무료',
    amount: 0,
    status: 'completed',
    tokens: 1500
  }
];

export function SubscriptionPage() {
  const navigate = useNavigate();
  const [currentPlan] = useState('basic');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSubscribe = (planId: string) => {
    if (planId === currentPlan) return;
    setSelectedPlan(planId);
    // TODO: 결제 로직 연동
    alert(`${plans.find(p => p.id === planId)?.name} 플랜으로 변경되었습니다.`);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="이용권 구매" />
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center h-16 px-6 border-b border-[#E5E7EB] relative">
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="마이페이지로 돌아가기"
        >
          <ChevronLeft size={24} className="text-[#1F2937]" />
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">이용권 구매</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-10">
        <div className="max-w-4xl mx-auto">
          {/* Current Token Info */}
          <div className="bg-gradient-to-r from-[#F2FFFD] to-[#F8F4FE] rounded-xl p-4 mb-8 border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coins size={24} className="text-[#00C9B7]" />
                <div>
                  <p className="text-sm font-medium text-[#1F2937]">현재 플랜: 베이직</p>
                  <p className="text-xs text-[#6B7280]">남은 토큰: 3,456개 / 다음 결제일: 2025.12.15</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: 플랜 정보 */}
          <section className="mb-10">
            <h2 className="text-lg font-bold text-[#1F2937] mb-4">플랜 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-5 transition-all ${
                    currentPlan === plan.id
                      ? 'border-[#00C9B7] bg-[#F0FDFA]'
                      : plan.popular
                      ? 'border-[#7C3AED] bg-white'
                      : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-3 py-1 text-xs font-bold text-white bg-[#7C3AED] rounded-full">
                        인기
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-[#1F2937] mb-1">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-2xl font-bold text-[#1F2937]">
                        {plan.price === 0 ? '무료' : `${plan.price.toLocaleString()}원`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-sm text-[#9CA3AF]">/월</span>
                      )}
                    </div>
                    <p className="text-sm text-[#00C9B7] mt-1">
                      {plan.tokens === -1 ? '무제한 토큰' : `월 ${plan.tokens.toLocaleString()} 토큰`}
                    </p>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#4B5563]">
                        <Check size={16} className="text-[#00C9B7] flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={currentPlan === plan.id}
                    className={`w-full py-3 rounded-xl font-medium transition-colors ${
                      currentPlan === plan.id
                        ? 'bg-gray-100 text-[#9CA3AF] cursor-not-allowed'
                        : plan.popular
                        ? 'text-white'
                        : 'bg-[#00C9B7] text-white hover:bg-[#00B3A3]'
                    }`}
                    style={
                      plan.popular && currentPlan !== plan.id
                        ? { background: 'linear-gradient(90deg, #00C9B7 0%, #7C3AED 100%)' }
                        : {}
                    }
                  >
                    {currentPlan === plan.id ? '현재 플랜' : '구독하기'}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer Note */}
            <div className="mt-4 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
              <p className="text-xs text-[#6B7280] text-center">
                베이직/프로 플랜은 매월 자동 결제됩니다. 구독은 언제든지 취소할 수 있으며, 취소 시 다음 결제일부터 적용됩니다.
              </p>
            </div>
          </section>

          {/* Section 2: 결제 이력 */}
          <section>
            <h2 className="text-lg font-bold text-[#1F2937] mb-4">결제 이력</h2>
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
              {mockPaymentHistory.length > 0 ? (
                <div className="divide-y divide-[#E5E7EB]">
                  {mockPaymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#F0FDFA] flex items-center justify-center">
                          <Receipt size={20} className="text-[#00C9B7]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">{payment.plan} 플랜</p>
                          <p className="text-xs text-[#9CA3AF]">{payment.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#1F2937]">
                          {payment.amount === 0 ? '무료' : `${payment.amount.toLocaleString()}원`}
                        </p>
                        <p className="text-xs text-[#00C9B7]">+{payment.tokens.toLocaleString()} 토큰</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-[#999999]">
                  <Receipt size={40} className="mb-3 opacity-30" />
                  <p>결제 이력이 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
