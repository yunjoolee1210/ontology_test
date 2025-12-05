import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, Heart, MessageCircle, Share2, Send, Loader2 } from 'lucide-react';
import { MobileHeader } from '../components/MobileHeader';
import { useLayout } from '../components/LayoutContext';
import * as communityApi from '../services/communityApi';

export function CommunityDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useLayout();

  const [post, setPost] = useState<communityApi.PostDetail | null>(null);
  const [comments, setComments] = useState<communityApi.Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liked, setLiked] = useState(false);

  const iconStyle = { strokeWidth: 2 };

  // Get current user ID
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

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      if (!id) {
        setError('게시글 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await communityApi.getPost(id);
        setPost(response.post);
        setComments(response.comments);
        setLiked(response.post.likedByMe);
      } catch (err: any) {
        setError(err.message || '게시글을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  // Handle like
  const handleLike = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (!post) return;

    try {
      if (liked) {
        await communityApi.unlikePost(post.id);
        setPost(prev => prev ? { ...prev, likes: prev.likes - 1 } : null);
      } else {
        await communityApi.likePost(post.id);
        setPost(prev => prev ? { ...prev, likes: prev.likes + 1 } : null);
      }
      setLiked(!liked);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Handle comment submit
  const handleCommentSubmit = async () => {
    if (!comment.trim() || !post || !id) return;

    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    try {
      setSubmittingComment(true);
      const newComment = await communityApi.createComment({
        postId: id,
        content: comment.trim(),
      });

      setComments(prev => [newComment, ...prev]);
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
      setComment('');
    } catch (err: any) {
      alert(err.message || '댓글 작성에 실패했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle delete post
  const handleDelete = async () => {
    if (!post) return;

    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      setIsMenuOpen(false);
      return;
    }

    try {
      await communityApi.deletePost(post.id);
      alert('삭제되었습니다.');
      navigate('/community');
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.');
    }
    setIsMenuOpen(false);
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await communityApi.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount - 1 } : null);
    } catch (err: any) {
      alert(err.message || '댓글 삭제에 실패했습니다.');
    }
  };

  // Check if user can delete comment
  const canDeleteComment = (commentAuthorId: string) => {
    if (!currentUserId) return false;
    // User can delete own comment or if they're the post author
    return commentAuthorId === currentUserId;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <MobileHeader title="커뮤니티 상세" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00C9B7]" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <MobileHeader title="커뮤니티 상세" />
        <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
          <p>{error || '게시글을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate('/community')}
            className="mt-4 px-4 py-2 bg-[#00C9B7] text-white rounded-lg"
          >
            목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white relative">
      {/* Header */}
      <MobileHeader
        title="커뮤니티 상세"
        rightAction={
          (post.canEdit || post.canDelete) ? (
            <button onClick={() => setIsMenuOpen(true)} className="p-1">
              <MoreVertical size={24} color="#1F2937" style={iconStyle} />
            </button>
          ) : undefined
        }
      />

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto pb-[80px] lg:pb-0 no-scrollbar">
        <div className="p-5 max-w-3xl mx-auto">
          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
              {post.author.name?.[0] || '?'}
            </div>
            <div>
              <div className="text-sm font-medium text-[#1F2937]">{post.author.name}</div>
              <div className="text-xs text-[#999999]">{communityApi.formatDate(post.createdAt)}</div>
            </div>
            <div className="ml-auto px-2 py-1 bg-[#F5F5F5] rounded text-xs text-[#666666]">
              {communityApi.postTypeToCategory(post.postType)}
            </div>
          </div>

          {/* Post Title */}
          <h1 className="text-lg font-bold text-[#1F2937] mb-4">{post.title}</h1>

          {/* Post Content */}
          <div className="text-base text-[#1F2937] leading-[1.6] whitespace-pre-line mb-6">
            {post.content}
          </div>

          {/* Image */}
          {post.imageUrls && post.imageUrls.length > 0 && (
            <div className="w-full bg-gray-100 rounded-xl mb-6 overflow-hidden">
              <img
                src={post.imageUrls[0]}
                alt="Post image"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 border-b border-[#E0E0E0] pb-4 mb-6">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 ${liked ? 'text-red-500' : 'text-[#666666]'}`}
            >
              <Heart size={20} style={iconStyle} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{post.likes}</span>
            </button>
            <div className="flex items-center gap-1.5 text-[#666666]">
              <MessageCircle size={20} style={iconStyle} />
              <span className="text-sm">{post.commentCount}</span>
            </div>
            <button className="ml-auto text-[#666666]">
              <Share2 size={20} style={iconStyle} />
            </button>
          </div>

          {/* Comments Section */}
          <div className="mb-6">
            <h3 className="text-[16px] font-bold text-[#1F2937] mb-4">댓글 {post.commentCount}개</h3>
            <div className="space-y-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 text-xs font-medium">
                    {c.author.name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1F2937]">{c.author.name}</span>
                        <span className="text-xs text-[#999999]">{communityApi.formatDate(c.createdAt)}</span>
                      </div>
                      {canDeleteComment(c.authorId) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-[#999999] hover:text-red-500"
                        >
                          <MoreVertical size={16} style={iconStyle} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#1F2937] leading-[1.6]">{c.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-center text-[#9CA3AF] py-8">아직 댓글이 없습니다.</p>
              )}
            </div>
          </div>

          {/* Comment Input - Desktop */}
          <div className="hidden lg:block">
            <div className="bg-white border-t border-[#E0E0E0] pt-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 text-xs font-medium">
                  나
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={isLoggedIn ? '댓글을 입력하세요' : '로그인 후 댓글을 작성할 수 있습니다'}
                    className="w-full pl-4 pr-10 py-2.5 rounded-full border border-[#E0E0E0] text-sm outline-none focus:border-[#00C9B7] transition-colors"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={!isLoggedIn || submittingComment}
                    onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  />
                  <button
                    onClick={handleCommentSubmit}
                    className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full flex items-center justify-center transition-all"
                    disabled={!comment.trim() || submittingComment}
                    style={{
                      backgroundColor: comment.trim() && !submittingComment ? '#00C9B7' : '#E0E0E0',
                      color: 'white'
                    }}
                  >
                    {submittingComment ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Comment Input - Mobile */}
      <div className="fixed bottom-[64px] left-0 right-0 bg-white border-t border-[#E0E0E0] z-50 lg:hidden">
        <div className="flex items-center gap-3 p-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 text-xs font-medium">
            나
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={isLoggedIn ? '댓글을 입력하세요' : '로그인 후 댓글을 작성할 수 있습니다'}
              className="w-full pl-4 pr-10 py-2.5 rounded-full border border-[#E0E0E0] text-sm outline-none focus:border-[#00C9B7] transition-colors"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={!isLoggedIn || submittingComment}
              onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
            />
            <button
              onClick={handleCommentSubmit}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full flex items-center justify-center transition-all"
              disabled={!comment.trim() || submittingComment}
              style={{
                backgroundColor: comment.trim() && !submittingComment ? '#00C9B7' : '#E0E0E0',
                color: 'white'
              }}
            >
              {submittingComment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setIsMenuOpen(false)}>
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-4 space-y-2 animate-slide-up mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            {post.canEdit && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate(`/community/edit/${post.id}`);
                }}
                className="w-full py-3 text-center text-[#1F2937] font-medium border-b border-[#F3F4F6]"
              >
                수정하기
              </button>
            )}
            {post.canDelete && (
              <button
                onClick={handleDelete}
                className="w-full py-3 text-center text-[#EF4444] font-medium border-b border-[#F3F4F6]"
              >
                삭제하기
              </button>
            )}
            <button
              className="w-full py-3 text-center text-[#666666]"
              onClick={() => setIsMenuOpen(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
