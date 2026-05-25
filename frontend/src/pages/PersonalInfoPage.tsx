import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { getMyProfile, upsertMyProfile } from '../services/profileApi';

export function PersonalInfoPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userType, setUserType] = useState('일반인');
  const [personalInfo, setPersonalInfo] = useState({
    nickname: '',
    gender: '',
    birthDate: '',
    weight: '',
    height: ''
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
        if (profile) {
          setUserType(
            profile.userType === 'patient' ? '신장병 환우' :
            profile.userType === 'researcher' ? '연구자' : '일반인'
          );
          setPersonalInfo({
            nickname: profile.nickname || profile.name || '',
            gender: profile.gender || '',
            birthDate: profile.birthDate || '',
            weight: profile.weight?.toString() || '',
            height: profile.height?.toString() || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const profileValue = userType === '신장병 환우' ? 'patient' :
                           userType === '연구자' ? 'researcher' : 'general';

      await upsertMyProfile({
        nickname: personalInfo.nickname,
        userType: profileValue,
        gender: personalInfo.gender,
        birthDate: personalInfo.birthDate,
        weight: personalInfo.weight ? parseFloat(personalInfo.weight) : undefined,
        height: personalInfo.height ? parseFloat(personalInfo.height) : undefined
      });

      alert('저장되었습니다.');
      navigate('/mypage');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="lg:hidden">
          <MobileHeader title="개인정보" showProfile={false} showMenu={false} onBack={() => navigate('/mypage')} />
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
        <MobileHeader title="개인정보" showProfile={false} showMenu={false} onBack={() => navigate('/mypage')} />
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
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold text-[#1F2937]">개인정보</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-10 max-w-2xl mx-auto w-full">
          <div className="border border-[#E5E7EB] rounded-xl p-6">
            <div className="space-y-6 mb-8">
              {/* 사용자 유형 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-2">사용자 유형</label>
                <div className="flex gap-3">
                  {['일반인', '신장병 환우', '연구자'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setUserType(type)}
                      className={`flex-1 py-3 rounded-xl transition-colors text-base ${
                        userType === type
                          ? 'bg-[#E0F7FA] text-[#00C9B7] font-bold'
                          : 'bg-[#F8FAFC] text-[#4B5563]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 닉네임 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-2">닉네임</label>
                <input
                  type="text"
                  value={personalInfo.nickname}
                  onChange={(e) => setPersonalInfo({...personalInfo, nickname: e.target.value})}
                  placeholder="닉네임을 입력하세요"
                  className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:border-[#00C9B7] outline-none transition-colors"
                />
              </div>

              {/* 성별 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-2">성별</label>
                <div className="flex gap-3">
                  {['남성', '여성'].map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setPersonalInfo({...personalInfo, gender})}
                      className={`flex-1 py-3 rounded-xl transition-colors text-base ${
                        personalInfo.gender === gender
                          ? 'bg-[#E0F7FA] text-[#00C9B7] font-bold'
                          : 'bg-[#F8FAFC] text-[#4B5563]'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              {/* 생년월일 */}
              <div>
                <label className="block text-sm font-bold text-[#374151] mb-2">생년월일</label>
                <div className="relative">
                  <input
                    type="text"
                    value={personalInfo.birthDate}
                    onChange={(e) => setPersonalInfo({...personalInfo, birthDate: e.target.value})}
                    placeholder="YYYY-MM-DD"
                    className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:border-[#00C9B7] outline-none transition-colors pr-10"
                  />
                  <Calendar size={20} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" />
                </div>
              </div>

              {/* 키 / 체중 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-2">키 (cm)</label>
                  <input
                    type="number"
                    value={personalInfo.height}
                    onChange={(e) => setPersonalInfo({...personalInfo, height: e.target.value})}
                    className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:border-[#00C9B7] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#374151] mb-2">체중 (kg)</label>
                  <input
                    type="number"
                    value={personalInfo.weight}
                    onChange={(e) => setPersonalInfo({...personalInfo, weight: e.target.value})}
                    className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:border-[#00C9B7] outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/mypage')}
                className="flex-1 py-4 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-medium hover:bg-gray-50 transition-colors"
              >
                뒤로가기
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-4 rounded-xl text-white font-bold shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg, #00C9B7 0%, #7C3AED 100%)' }}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
