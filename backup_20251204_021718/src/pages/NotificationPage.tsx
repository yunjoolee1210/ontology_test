import React, { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '../components/MobileHeader';

// Notification interface (API 응답 구조)
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
}

export function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 알림 목록 가져오기
  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('로그인이 필요합니다');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/notifications?page=1&page_size=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('알림을 불러오는데 실패했습니다');
      }

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  // 읽지 않은 알림 개수 가져오기
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(data.unread_count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // 로컬 상태 업데이트
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // 로컬 상태 업데이트
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return '방금 전';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}주 전`;
    const months = Math.floor(days / 30);
    return `${months}개월 전`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'welcome':
        return { label: '환영', color: 'bg-[#E0F2FE] text-[#0369A1]' };
      case 'quiz':
        return { label: '퀴즈', color: 'bg-[#FEF3C7] text-[#D97706]' };
      case 'reward':
        return { label: '보상', color: 'bg-[#D1FAE5] text-[#059669]' };
      case 'system':
        return { label: '시스템', color: 'bg-[#F3F4F6] text-[#6B7280]' };
      case 'announcement':
        return { label: '공지', color: 'bg-[#FEE2E2] text-[#DC2626]' };
      default:
        return { label: '알림', color: 'bg-[#F0FDFA] text-[#00C9B7]' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader
          title="알림"
          showMenu={true}
          showProfile={true}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">알림</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-[#00C9B7] text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-[#00C9B7] hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C9B7]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-[#6B7280]">
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 text-[#6B7280]">
              <p>알림이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const typeInfo = getTypeLabel(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                    className={`p-4 bg-white border rounded-xl transition-colors cursor-pointer ${
                      notification.is_read
                        ? 'border-[#E5E7EB] hover:bg-gray-50'
                        : 'border-[#00C9B7] bg-[#F0FDFA] hover:bg-[#E6FAF8]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          notification.is_read ? 'bg-[#E5E7EB]' : 'bg-[#00C9B7]'
                        }`}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-[#1F2937] flex-1">
                            {notification.title}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#6B7280] mb-2 break-words">
                          {notification.message}
                        </p>
                        <span className="text-xs text-[#9CA3AF]">
                          {getTimeAgo(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
