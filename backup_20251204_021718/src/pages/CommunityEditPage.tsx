import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useLayout } from '../components/LayoutContext';
import * as communityApi from '../services/communityApi';

type CategoryType = '자유' | '챌린지' | '설문조사';

export function CommunityEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useLayout();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryType>('자유');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // Fetch existing post data
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
        const post = response.post;

        // Check if user can edit this post
        if (!post.canEdit) {
          alert('수정 권한이 없습니다.');
          navigate(`/community/detail/${id}`);
          return;
        }

        // Set form data from post
        const categoryName = communityApi.postTypeToCategory(post.postType) as CategoryType;
        setCategory(categoryName);
        setTitle(post.title);
        setContent(post.content);

        // Handle existing image
        if (post.imageUrls && post.imageUrls.length > 0) {
          setExistingImageUrl(post.imageUrls[0]);
          setImagePreview(post.imageUrls[0]);
        }
      } catch (err: any) {
        setError(err.message || '게시글을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB를 초과할 수 없습니다.');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setImageFile(file);
    setImageRemoved(false);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageRemoved(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (!id) return;

    setSubmitting(true);

    try {
      let imageUrls: string[] | undefined = undefined;

      // Determine image state
      if (imageRemoved) {
        // Image was explicitly removed
        imageUrls = [];
      } else if (imageFile) {
        // New image uploaded
        setUploading(true);
        try {
          const uploadResult = await communityApi.uploadImage(imageFile);
          imageUrls = [uploadResult.url];
        } catch (err: any) {
          alert(err.message || '이미지 업로드에 실패했습니다.');
          setSubmitting(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      } else if (existingImageUrl && !imageRemoved) {
        // Keep existing image
        imageUrls = [existingImageUrl];
      }

      // Update post
      await communityApi.updatePost(id, {
        title: title.trim(),
        content: content.trim(),
        imageUrls,
      });

      alert('게시글이 수정되었습니다!');
      navigate(`/community/detail/${id}`);
    } catch (err: any) {
      alert(err.message || '게시글 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-light)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#00C9B7]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--color-bg-light)' }}>
        <p className="text-[#9CA3AF] mb-4">{error}</p>
        <button
          onClick={() => navigate('/community')}
          className="px-4 py-2 bg-[#00C9B7] text-white rounded-lg"
        >
          목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-6" style={{ background: 'var(--color-bg-light)' }}>
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/community/detail/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} className="text-[#1F2937]" />
          </button>
          <h2 style={{ color: 'var(--color-text-primary)' }}>글 수정</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block mb-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                카테고리
              </label>
              <div className="flex flex-wrap gap-2">
                {(['자유', '챌린지', '설문조사'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                    style={{
                      background: category === cat ? 'var(--color-primary)' : 'var(--color-bg-input)',
                      color: category === cat ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                * 카테고리는 수정할 수 없습니다
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block mb-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="input-field w-full"
                maxLength={100}
                disabled={submitting}
              />
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {title.length}/100
              </p>
            </div>

            {/* Content */}
            <div>
              <label className="block mb-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                내용
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
                className="input-field w-full resize-none"
                rows={10}
                maxLength={2000}
                disabled={submitting}
              />
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {content.length}/2000
              </p>
            </div>

            {/* Image Upload (1개 제한) */}
            <div>
              <label className="block mb-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                이미지 (최대 1개, 5MB 이하)
              </label>

              {!imagePreview ? (
                <label
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ borderColor: 'var(--color-line-2)', background: 'var(--color-bg-input)' }}
                >
                  <ImageIcon size={32} color="var(--color-text-tertiary)" />
                  <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    이미지를 선택하거나 드래그하세요
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    JPG, PNG, GIF, WEBP (최대 5MB)
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={submitting}
                  />
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={submitting}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-50"
                  >
                    <X size={20} color="white" />
                  </button>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/community/detail/${id}`)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{
                  background: 'var(--color-bg-input)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                className="flex-1 py-3 rounded-xl font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #00C8B4 0%, #9F7AEA 100%)' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploading ? '이미지 업로드 중...' : '수정 중...'}
                  </>
                ) : (
                  '수정하기'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
