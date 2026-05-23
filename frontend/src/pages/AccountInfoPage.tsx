import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { getMyProfile } from '../services/profileApi';
import { supabase } from '../lib/supabase';

export function AccountInfoPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState({
    email: '',
    password: '********'
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          navigate('/login');
          return;
        }

        const profile = await getMyProfile();
        const { data: auth } = await supabase.auth.getUser();
        setAccountInfo({
          email: profile?.email || auth.user?.email || '',
          password: '********'
        });
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handlePasswordChange = async () => {
    // TODO: 비밀번호 변경 로직 구현
    alert('비밀번호 변경 기능은 준비 중입니다.');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden">
          <MobileHeader title="계정정보" showProfile={false} showMenu={false} onBack={() => navigate('/mypage')} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C9B7]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader title="계정정보" showProfile={false} showMenu={false} onBack={() => navigate('/mypage')} />
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
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">계정정보</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-10 max-w-2xl mx-auto w-full">
          <div className="border border-[#E5E7EB] rounded-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#374151] mb-2">이메일</label>
              <input
                type="email"
                value={accountInfo.email}
                readOnly
                className="w-full p-4 rounded-xl border border-[#E5E7EB] bg-gray-50 text-[#9CA3AF] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#374151] mb-2">비밀번호</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={accountInfo.password}
                  readOnly
                  className="flex-1 p-4 rounded-xl border border-[#E5E7EB] bg-gray-50 text-[#9CA3AF] outline-none"
                />
                <button
                  onClick={handlePasswordChange}
                  className="px-5 rounded-xl bg-[#00C9B7] text-white font-bold text-sm whitespace-nowrap hover:bg-[#00B3A3] transition-colors"
                >
                  비밀번호 변경
                </button>
              </div>
            </div>
          </div>

          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => navigate('/mypage')}
            className="w-full mt-6 py-4 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-medium hover:bg-gray-50 transition-colors"
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
