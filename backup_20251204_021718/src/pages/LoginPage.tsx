import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLayout } from '../components/LayoutContext';

export function LoginPage(props: { onLogin?: () => void }) {
  const navigate = useNavigate();
  const { login } = useLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. 먼저 이메일이 등록되어 있는지 확인
      const checkResponse = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
      const checkData = await checkResponse.json();

      if (checkData.available) {
        // 이메일이 등록되어 있지 않음
        alert('회원에 등록되어 있지 않습니다. 회원가입을 통해 등록한 후 로그인 해주세요.');
        setIsLoading(false);
        return;
      }

      // 2. 로그인 시도
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        alert(loginData.detail || '로그인에 실패했습니다.');
        setIsLoading(false);
        return;
      }

      // 로그인 성공
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('accessToken', loginData.access_token);
      localStorage.setItem('refreshToken', loginData.refresh_token);
      localStorage.setItem('user', JSON.stringify(loginData.user));

      // LayoutContext 상태 업데이트
      login();

      if (props.onLogin) props.onLogin();
      navigate('/chat');
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{ background: 'var(--color-bg-white)' }}
    >
      {/* Back Button - Top Left */}
      <button
        onClick={() => navigate('/chat')}
        className="absolute top-6 left-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="메인으로 돌아가기"
      >
        <ChevronLeft className="text-[#1F2937]" size={24} strokeWidth={2} />
      </button>

      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Login Form */}
        <div className="space-y-6">
          <h1 className="text-center" style={{ color: '#1F2937', fontSize: '24px' }}>
            로그인
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="email" 
                className="block mb-2"
                style={{ fontSize: '14px', color: '#374151' }}
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 rounded-lg border transition-all duration-200"
                style={{
                  borderColor: '#E5E7EB',
                  background: 'white',
                  outline: 'none',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block mb-2"
                style={{ fontSize: '14px', color: '#374151' }}
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 rounded-lg border transition-all duration-200"
                style={{
                  borderColor: '#E5E7EB',
                  background: 'white',
                  outline: 'none',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(90deg, #00C9B7 0%, #9F7AEA 100%)',
                color: 'white',
                border: 'none',
                fontSize: '16px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 하단 링크 영역 - 아이디/비밀번호 찾기 & 회원가입 */}
          <div className="space-y-3 pt-2">
            {/* 아이디/비밀번호 찾기 */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  // TODO: 아이디/비밀번호 찾기 페이지로 이동
                  alert('아이디/비밀번호 찾기 기능은 준비 중입니다.');
                }}
                style={{ fontSize: '14px', color: '#6B7280' }}
                className="hover:underline transition-colors"
              >
                아이디/비밀번호 찾기
              </button>
            </div>

            {/* 구분선 */}
            <div className="flex items-center gap-3 px-8">
              <div className="flex-1 h-px" style={{ backgroundColor: '#E5E7EB' }}></div>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>또는</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#E5E7EB' }}></div>
            </div>

            {/* 회원가입 */}
            <div className="text-center">
              <button
                onClick={() => navigate('/signup')}
                style={{ fontSize: '14px', color: '#6B7280' }}
                className="transition-colors"
              >
                계정이 없으신가요? <span style={{ color: '#00C8B4', fontWeight: '500' }}>회원가입</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
