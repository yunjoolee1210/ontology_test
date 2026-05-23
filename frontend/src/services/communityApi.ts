// Community API Service (Supabase 버전)
// posts/comments → Supabase 테이블, 이미지 → Supabase Storage(community-images 버킷)
// 별도 FastAPI 백엔드 없이 Supabase + Vercel 만으로 동작한다.
// 필요한 DB/스토리지 세팅 SQL: 프로젝트 루트의 supabase_community_setup.sql 참고.

import { supabase } from '../lib/supabase';

const POSTS = 'community_posts';
const COMMENTS = 'community_comments';
const BUCKET = 'community-images';

// ============================================================================
// Types (프론트 페이지가 쓰는 camelCase 형태 — 기존과 동일)
// ============================================================================
export interface Post {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  content: string;
  postType: 'BOARD' | 'CHALLENGE' | 'SURVEY';
  imageUrls: string[];
  thumbnailUrl: string | null;
  likes: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  isPinned: boolean;
  isDeleted: boolean;
}

export interface PostDetail extends Post {
  author: { id: string; name: string; profileImage: string | null };
  authorId: string;
  likedByMe: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; profileImage: string | null };
  authorId: string;
}

export interface PostsResponse {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeaturedPostsResponse {
  featuredPosts: Post[];
}

export interface PostDetailResponse {
  post: PostDetail;
  comments: Comment[];
}

export interface CreatePostData {
  title: string;
  content: string;
  postType: 'BOARD' | 'CHALLENGE' | 'SURVEY';
  imageUrls: string[];
}

export interface UpdatePostData {
  title?: string;
  content?: string;
  imageUrls?: string[];
}

export interface CreateCommentData {
  postId: string;
  content: string;
}

export interface UpdateCommentData {
  content: string;
}

export interface UploadResponse {
  url: string;
  filename: string;
}

// ============================================================================
// Helpers
// ============================================================================

type Row = Record<string, any>;

const rowToPost = (r: Row): Post => ({
  id: r.id,
  userId: r.user_id,
  authorName: r.author_name ?? '사용자',
  title: r.title ?? '',
  content: r.content ?? '',
  postType: r.post_type,
  imageUrls: r.image_urls ?? [],
  thumbnailUrl: r.thumbnail_url ?? null,
  likes: r.likes ?? 0,
  commentCount: r.comment_count ?? 0,
  viewCount: r.view_count ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastActivityAt: r.last_activity_at,
  isPinned: r.is_pinned ?? false,
  isDeleted: r.is_deleted ?? false,
});

const rowToComment = (r: Row): Comment => ({
  id: r.id,
  postId: r.post_id,
  userId: r.user_id,
  authorName: r.author_name ?? '사용자',
  content: r.content ?? '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  author: { id: r.user_id, name: r.author_name ?? '사용자', profileImage: null },
  authorId: r.user_id,
});

// 현재 로그인 사용자 (없으면 null)
const getUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

const displayName = (user: any): string =>
  user?.user_metadata?.nickname ||
  user?.user_metadata?.name ||
  (user?.email ? user.email.split('@')[0] : '사용자');

// Supabase Storage는 이미 절대 public URL을 돌려주므로 그대로 사용한다.
export const resolveImageUrl = (url: string | null | undefined): string => url || '';

export const isLoggedIn = (): boolean => !!localStorage.getItem('accessToken');

// ============================================================================
// Posts
// ============================================================================

export const getPosts = async (
  limit = 20,
  cursor?: string,
  postType?: 'BOARD' | 'CHALLENGE' | 'SURVEY',
  _sortBy = 'lastActivityAt'
): Promise<PostsResponse> => {
  let q = supabase
    .from(POSTS)
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (postType) q = q.eq('post_type', postType);
  if (cursor) q = q.lt('created_at', cursor);

  const { data, error } = await q;
  if (error) throw new Error(error.message || 'Failed to fetch posts');

  const posts = (data ?? []).map(rowToPost);
  const nextCursor = posts.length ? posts[posts.length - 1].createdAt : null;
  return { posts, nextCursor, hasMore: posts.length === limit };
};

export const getFeaturedPosts = async (): Promise<FeaturedPostsResponse> => {
  const { data, error } = await supabase
    .from(POSTS)
    .select('*')
    .eq('is_deleted', false)
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message || 'Failed to fetch featured posts');
  return { featuredPosts: (data ?? []).map(rowToPost) };
};

export const getPost = async (postId: string): Promise<PostDetailResponse> => {
  const { data: post, error } = await supabase
    .from(POSTS)
    .select('*')
    .eq('id', postId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to fetch post');
  if (!post) throw new Error('Post not found');

  // 조회수 증가 (RLS 우회 RPC)
  await supabase.rpc('cg_increment_views', { p_post_id: postId });

  const { data: comments } = await supabase
    .from(COMMENTS)
    .select('*')
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  const user = await getUser();
  const isOwner = !!user && user.id === post.user_id;
  const isAdmin = user?.user_metadata?.role === 'admin';

  const detail: PostDetail = {
    ...rowToPost({ ...post, view_count: (post.view_count ?? 0) + 1 }),
    author: { id: post.user_id, name: post.author_name ?? '사용자', profileImage: null },
    authorId: post.user_id,
    likedByMe: false,
    canEdit: isOwner,
    canDelete: isOwner || isAdmin,
  };

  return { post: detail, comments: (comments ?? []).map(rowToComment) };
};

export const createPost = async (data: CreatePostData): Promise<Post> => {
  const user = await getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const imageUrls = (data.imageUrls ?? []).slice(0, 1);
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from(POSTS)
    .insert({
      user_id: user.id,
      author_name: displayName(user),
      title: data.title,
      content: data.content,
      post_type: data.postType,
      image_urls: imageUrls,
      thumbnail_url: imageUrls[0] ?? null,
      likes: 0,
      comment_count: 0,
      view_count: 0,
      is_pinned: false,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message || 'Failed to create post');
  return rowToPost(row);
};

export const updatePost = async (postId: string, data: UpdatePostData): Promise<Post> => {
  const now = new Date().toISOString();
  const patch: Row = { updated_at: now, last_activity_at: now };
  if (data.title !== undefined) patch.title = data.title;
  if (data.content !== undefined) patch.content = data.content;
  if (data.imageUrls !== undefined) {
    const imageUrls = data.imageUrls.slice(0, 1);
    patch.image_urls = imageUrls;
    patch.thumbnail_url = imageUrls[0] ?? null;
  }

  const { data: row, error } = await supabase
    .from(POSTS)
    .update(patch)
    .eq('id', postId)
    .eq('is_deleted', false)
    .select()
    .maybeSingle();

  if (error) {
    if ((error as any).code === '42501') throw new Error('권한이 없습니다. 게시글 작성자만 수정할 수 있습니다.');
    throw new Error(error.message || 'Failed to update post');
  }
  if (!row) throw new Error('게시글을 찾을 수 없거나 수정 권한이 없습니다.');
  return rowToPost(row);
};

export const deletePost = async (postId: string): Promise<void> => {
  const { error } = await supabase
    .from(POSTS)
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) {
    if ((error as any).code === '42501') throw new Error('권한이 없습니다. 게시글 작성자 또는 관리자만 삭제할 수 있습니다.');
    throw new Error(error.message || 'Failed to delete post');
  }
};

// ============================================================================
// Comments
// ============================================================================

export const createComment = async (data: CreateCommentData): Promise<Comment> => {
  const user = await getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from(COMMENTS)
    .insert({
      post_id: data.postId,
      user_id: user.id,
      author_name: displayName(user),
      content: data.content,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message || 'Failed to create comment');

  // 댓글 수 +1, 마지막 활동시각 갱신 (RLS 우회 RPC)
  await supabase.rpc('cg_adjust_comment_count', { p_post_id: data.postId, p_delta: 1 });

  return rowToComment(row);
};

export const updateComment = async (commentId: string, data: UpdateCommentData): Promise<Comment> => {
  const { data: row, error } = await supabase
    .from(COMMENTS)
    .update({ content: data.content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('is_deleted', false)
    .select()
    .maybeSingle();

  if (error) {
    if ((error as any).code === '42501') throw new Error('권한이 없습니다. 댓글 작성자만 수정할 수 있습니다.');
    throw new Error(error.message || 'Failed to update comment');
  }
  if (!row) throw new Error('댓글을 찾을 수 없거나 수정 권한이 없습니다.');
  return rowToComment(row);
};

export const deleteComment = async (commentId: string): Promise<void> => {
  // 댓글 수 감소를 위해 post_id 먼저 조회
  const { data: existing } = await supabase
    .from(COMMENTS)
    .select('post_id')
    .eq('id', commentId)
    .maybeSingle();

  const { error } = await supabase
    .from(COMMENTS)
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) {
    if ((error as any).code === '42501') throw new Error('권한이 없습니다. 댓글 작성자 또는 관리자만 삭제할 수 있습니다.');
    throw new Error(error.message || 'Failed to delete comment');
  }

  if (existing?.post_id) {
    await supabase.rpc('cg_adjust_comment_count', { p_post_id: existing.post_id, p_delta: -1 });
  }
};

// ============================================================================
// Likes (RLS 우회 RPC — 본인 글이 아니어도 좋아요 가능)
// ============================================================================

export const likePost = async (postId: string): Promise<void> => {
  const { error } = await supabase.rpc('cg_adjust_likes', { p_post_id: postId, p_delta: 1 });
  if (error) throw new Error(error.message || 'Failed to like post');
};

export const unlikePost = async (postId: string): Promise<void> => {
  const { error } = await supabase.rpc('cg_adjust_likes', { p_post_id: postId, p_delta: -1 });
  if (error) throw new Error(error.message || 'Failed to unlike post');
};

// ============================================================================
// Image Upload (Supabase Storage)
// ============================================================================

export const uploadImage = async (file: File): Promise<UploadResponse> => {
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error('파일 크기는 5MB를 초과할 수 없습니다.');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)');
  }

  const user = await getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Failed to upload image');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, filename: path };
};

// ============================================================================
// Utilities
// ============================================================================

export const postTypeToCategory = (postType: string): string => {
  const map: Record<string, string> = { BOARD: '자유', CHALLENGE: '챌린지', SURVEY: '설문조사' };
  return map[postType] || postType;
};

export const categoryToPostType = (
  category: string
): 'BOARD' | 'CHALLENGE' | 'SURVEY' | undefined => {
  const map: Record<string, 'BOARD' | 'CHALLENGE' | 'SURVEY'> = {
    자유: 'BOARD',
    챌린지: 'CHALLENGE',
    설문조사: 'SURVEY',
  };
  return map[category];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};
