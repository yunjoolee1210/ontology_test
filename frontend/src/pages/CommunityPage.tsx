import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { useLayout } from '../components/LayoutContext';
import * as communityApi from '../services/communityApi';

type CategoryType = '전체' | '자유' | '챌린지' | '설문조사';

export function CommunityPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useLayout();
  const [posts, setPosts] = useState<communityApi.Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('전체');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current user ID from localStorage
  const getCurrentUserId = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id;
    } catch {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  // Get user role from localStorage
  const getUserRole = () => {
    // For now, check if there's a stored role. In production, decode from JWT or fetch from API
    return localStorage.getItem('userRole') || 'user';
  };

  const userRole = getUserRole();
  const isAdmin = userRole === 'admin';

  // Fetch posts
  const fetchPosts = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setNextCursor(null);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const postType = selectedCategory === '전체'
        ? undefined
        : communityApi.categoryToPostType(selectedCategory);

      const response = await communityApi.getPosts(
        20,
        reset ? undefined : nextCursor || undefined,
        postType
      );

      if (reset) {
        setPosts(response.posts);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
      }
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (err) {
      setError('게시글을 불러오는데 실패했습니다.');
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, nextCursor]);

  // Initial load and category change
  useEffect(() => {
    fetchPosts(true);
  }, [selectedCategory]);

  // Handle like
  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    try {
      await communityApi.likePost(postId);
      setPosts(prev => prev.map(post =>
        post.id === postId ? { ...post, likes: post.likes + 1 } : post
      ));
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  // Handle edit
  const handleEdit = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    navigate(`/community/edit/${postId}`);
  };

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await communityApi.deletePost(postId);
      setPosts(prev => prev.filter(post => post.id !== postId));
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  };

  // Handle create button click
  const handleCreateClick = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    navigate('/community/create');
  };

  // Check if user can edit/delete
  const canEdit = (post: communityApi.Post) => {
    return currentUserId && post.userId === currentUserId;
  };

  const canDelete = (post: communityApi.Post) => {
    return (currentUserId && post.userId === currentUserId) || isAdmin;
  };

  // Load more posts
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#FFFFFF' }}>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader
          title="커뮤니티"
          showMenu={true}
          showProfile={true}
        />
      </div>

      <div className="p-6 lg:max-w-[832px] mx-auto pb-24 lg:pb-6">
        {/* Category Tabs */}
        <div className="border-b mb-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex gap-6">
            {(['전체', '자유', '챌린지'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="relative pb-3 transition-all duration-200"
                style={{
                  color: selectedCategory === cat ? '#00C9B7' : '#9CA3AF',
                  fontSize: '15px',
                  fontWeight: selectedCategory === cat ? '600' : '400'
                }}
              >
                {cat}
                {selectedCategory === cat && (
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: '2px', background: '#9F7AEA' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C9B7]" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-20 text-[#9CA3AF]">
            <p>{error}</p>
            <button
              onClick={() => fetchPosts(true)}
              className="mt-4 px-4 py-2 bg-[#00C9B7] text-white rounded-lg"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20 text-[#9CA3AF]">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>아직 게시글이 없습니다.</p>
          </div>
        )}

        {/* Posts */}
        {!loading && !error && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/community/detail/${post.id}`)}
                  className="card hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ background: '#D1D5DB' }}
                    >
                      {post.authorName?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {post.authorName}
                        </span>
                      </div>
                      <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        {communityApi.formatDate(post.createdAt)}
                      </span>
                    </div>
                    {/* Edit/Delete Buttons */}
                    {canEdit(post) && (
                      <button
                        onClick={(e) => handleEdit(e, post.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit2 size={16} color="#6B7280" />
                      </button>
                    )}
                    {canDelete(post) && (
                      <button
                        onClick={(e) => handleDelete(e, post.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: '#F2FFFD', color: '#00C8B4' }}
                    >
                      {communityApi.postTypeToCategory(post.postType)}
                    </span>
                  </div>

                  <h3 style={{ color: 'var(--color-text-primary)', fontSize: '11pt', lineHeight: '1.4' }}>
                    {post.title}
                  </h3>
                  <p
                    className="mb-3 line-clamp-2"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontSize: '10pt',
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {post.content}
                  </p>

                  {post.thumbnailUrl && (
                    <img
                      src={post.thumbnailUrl}
                      alt={post.title}
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                  )}

                  <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    <button
                      onClick={(e) => handleLike(e, post.id)}
                      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                    >
                      <Heart size={18} />
                      <span>{post.likes}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={18} />
                      <span>{post.commentCount}</span>
                    </div>
                    <button className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                      <Share2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    '더 보기'
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Floating Create Button */}
        <button
          onClick={handleCreateClick}
          className="fixed bottom-24 lg:bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all z-50"
          style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
        >
          <Plus size={28} color="white" />
        </button>
      </div>
    </div>
  );
}
