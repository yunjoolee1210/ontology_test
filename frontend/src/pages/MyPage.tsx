import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LogOut, XCircle, User, Star, Coins, CreditCard, ChevronRight, Bell, UserCircle, Heart, Target, Bookmark } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { useLayout } from '../components/LayoutContext';
import { getMyProfile } from '../services/profileApi';

export function MyPage() {
  const navigate = useNavigate();
  const { logout } = useLayout();
  const [, setIsLoading] = useState(true);

  // Form States
  const [accountInfo, setAccountInfo] = useState({
    email: '',
    userType: '일반인'
  });

  const [personalInfo, setPersonalInfo] = useState({
    nickname: ''
  });

  // 신규 회원 정보 상태
  const [userStats, setUserStats] = useState({
    points: 0,
    knowledgeLevel: 0,
    tokens: 1500,
    tokensUsed: 0,
    subscription: null as string | null,
    role: 'user'
  });

  // 알림 설정 상태
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          navigate('/login');
          return;
        }

        const profile = await getMyProfile();
        if (profile) {
          // 계정 정보 설정
          setAccountInfo({
            email: profile.email || '',
            userType: profile.userType === 'patient' ? '신장병 환우' :
                      profile.userType === 'researcher' ? '연구자' : '일반인'
          });

          // 개인 정보 설정
          setPersonalInfo({
            nickname: profile.nickname || profile.name || ''
          });

          // points/tokens 등 게임화 필드는 현재 Supabase 스키마 외 → 기본값 유지
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/chat');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader 
          title="마이페이지" 
          showProfile={false}
          showMenu={false}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full">
          {/* Profile Card */}
          <div className="bg-gradient-to-r from-[#F2FFFD] to-[#F8F4FE] rounded-xl p-6 mb-8 border border-[#E5E7EB]">
            <div className="flex items-center gap-4 mb-4">
              {/* Profile Icon */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C9B7] to-[#9F7AEA] flex items-center justify-center flex-shrink-0">
                <User size={24} color="white" strokeWidth={2} />
              </div>

              {/* Nickname and User Type */}
              <div className="flex flex-col flex-1">
                <span className="text-lg font-bold text-[#1F2937]">{personalInfo.nickname}</span>
                <span className="text-sm text-[#6B7280]">{accountInfo.userType}</span>
              </div>

              {/* Notification Icon */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2 hover:bg-white/50 rounded-lg transition-colors"
                aria-label="알림"
              >
                <Bell size={24} color="#6B7280" strokeWidth={2} />
                {/* Notification Badge */}
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full" style={{ background: '#00C9B7' }}></span>
              </button>
            </div>

            {/* User Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Points */}
              <div className="flex items-center gap-1.5">
                <Star size={14} className="text-[#FFB84D]" strokeWidth={2} />
                <span className="text-xs text-[#666666]">포인트</span>
                <span className="text-sm font-bold text-[#1F2937]">{userStats.points}P</span>
              </div>

              {/* Level */}
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-[#9F7AEA] flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">L</span>
                </div>
                <span className="text-xs text-[#666666]">지식레벨</span>
                <span className="text-sm font-bold text-[#1F2937]">
                  {userStats.knowledgeLevel > 0 ? `Lv${userStats.knowledgeLevel}` : '-'}
                </span>
              </div>

              {/* Tokens */}
              <div className="flex items-center gap-1.5">
                <Coins size={14} className="text-[#00C9B7]" strokeWidth={2} />
                <span className="text-xs text-[#666666]">토큰</span>
                <span className="text-sm font-bold text-[#1F2937]">
                  {userStats.tokens === -1
                    ? '무제한'
                    : Math.max(0, userStats.tokens - userStats.tokensUsed)}
                </span>
              </div>

              {/* Subscription */}
              <div className="flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#9CA3AF]" strokeWidth={2} />
                <span className="text-xs text-[#666666]">구독</span>
                <span className="text-sm text-[#9CA3AF]">{userStats.subscription || '-'}</span>
              </div>
            </div>
          </div>

          {/* Menu Section */}
          <div className="space-y-3 mb-8">
            {/* 계정정보 */}
            <button
              onClick={() => navigate('/mypage/account')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserCircle size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">계정정보</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 개인정보 */}
            <button
              onClick={() => navigate('/mypage/personal')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <User size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">개인정보</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 질환정보 */}
            <button
              onClick={() => navigate('/mypage/disease')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Heart size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">질환정보</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 병원 검진 기록 */}
            <button
              onClick={() => navigate('/mypage/test-results')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">병원 검진 기록</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 목표 수치 기록 */}
            <button
              onClick={() => navigate('/mypage/goals')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Target size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">목표 수치 기록</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 즐겨찾기 */}
            <button
              onClick={() => navigate('/mypage/bookmark')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bookmark size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">즐겨찾기</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 이용권 구매 */}
            <button
              onClick={() => navigate('/mypage/subscription')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">이용권 구매</span>
              </div>
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <span className="text-sm">자세히 보기</span>
                <ChevronRight size={16} />
              </div>
            </button>

            {/* 알림설정 */}
            <div className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <Bell size={24} className="text-[#00C9B7]" />
                <span className="text-base font-medium text-[#1F2937]">알림설정</span>
              </div>
              <button
                onClick={() => setNotificationEnabled(!notificationEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notificationEnabled ? 'bg-[#00C9B7]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notificationEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Logout / Withdrawal Buttons */}
          <div className="border-t border-[#F3F4F6] pt-6 mb-8">
            <div className="flex gap-3">
               <button
                 onClick={() => {
                    logout();
                    navigate('/chat');
                 }}
                 className="flex-1 py-3 flex items-center justify-center gap-2 text-[#EF4444] bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
               >
                 <XCircle size={16} />
                 회원탈퇴
               </button>
               <button
                 onClick={handleLogout}
                 className="flex-1 py-3 flex items-center justify-center gap-2 text-[#4B5563] bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
               >
                 <LogOut size={18} />
                 로그아웃
               </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
