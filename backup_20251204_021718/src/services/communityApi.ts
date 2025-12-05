// Community API Service
// Handles all communication with the backend community endpoints

const API_BASE = '/api/community';

// Types
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
  author: {
    id: string;
    name: string;
    profileImage: string | null;
  };
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
  author: {
    id: string;
    name: string;
    profileImage: string | null;
  };
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

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Helper function to get auth headers without Content-Type (for file uploads)
const getAuthHeadersForUpload = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Check if user is logged in
export const isLoggedIn = (): boolean => {
  return !!localStorage.getItem('accessToken');
};

// ============================================================================
// Posts API
// ============================================================================

/**
 * Get posts with pagination
 */
export const getPosts = async (
  limit = 20,
  cursor?: string,
  postType?: 'BOARD' | 'CHALLENGE' | 'SURVEY',
  sortBy = 'lastActivityAt'
): Promise<PostsResponse> => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('sortBy', sortBy);
  if (cursor) params.append('cursor', cursor);
  if (postType) params.append('postType', postType);

  const response = await fetch(`${API_BASE}/posts?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }
  return response.json();
};

/**
 * Get featured posts (top 3)
 */
export const getFeaturedPosts = async (): Promise<FeaturedPostsResponse> => {
  const response = await fetch(`${API_BASE}/posts/featured`);
  if (!response.ok) {
    throw new Error('Failed to fetch featured posts');
  }
  return response.json();
};

/**
 * Get single post with comments
 */
export const getPost = async (postId: string): Promise<PostDetailResponse> => {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Post not found');
    }
    throw new Error('Failed to fetch post');
  }
  return response.json();
};

/**
 * Create a new post (requires authentication)
 */
export const createPost = async (data: CreatePostData): Promise<Post> => {
  const response = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create post');
  }
  return response.json();
};

/**
 * Update a post (requires authentication, author only)
 */
export const updatePost = async (postId: string, data: UpdatePostData): Promise<Post> => {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    if (response.status === 403) {
      throw new Error('권한이 없습니다. 게시글 작성자만 수정할 수 있습니다.');
    }
    if (response.status === 404) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update post');
  }
  return response.json();
};

/**
 * Delete a post (requires authentication, author or admin)
 */
export const deletePost = async (postId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    if (response.status === 403) {
      throw new Error('권한이 없습니다. 게시글 작성자 또는 관리자만 삭제할 수 있습니다.');
    }
    if (response.status === 404) {
      throw new Error('게시글을 찾을 수 없습니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete post');
  }
};

// ============================================================================
// Comments API
// ============================================================================

/**
 * Create a comment (requires authentication)
 */
export const createComment = async (data: CreateCommentData): Promise<Comment> => {
  const response = await fetch(`${API_BASE}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create comment');
  }
  return response.json();
};

/**
 * Update a comment (requires authentication, author only)
 */
export const updateComment = async (commentId: string, data: UpdateCommentData): Promise<Comment> => {
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    if (response.status === 403) {
      throw new Error('권한이 없습니다. 댓글 작성자만 수정할 수 있습니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update comment');
  }
  return response.json();
};

/**
 * Delete a comment (requires authentication, author or admin)
 */
export const deleteComment = async (commentId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    if (response.status === 403) {
      throw new Error('권한이 없습니다. 댓글 작성자 또는 관리자만 삭제할 수 있습니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete comment');
  }
};

// ============================================================================
// Likes API
// ============================================================================

/**
 * Like a post (requires authentication)
 */
export const likePost = async (postId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    throw new Error('Failed to like post');
  }
};

/**
 * Unlike a post (requires authentication)
 */
export const unlikePost = async (postId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    throw new Error('Failed to unlike post');
  }
};

// ============================================================================
// Image Upload API
// ============================================================================

/**
 * Upload an image (requires authentication, max 5MB)
 */
export const uploadImage = async (file: File): Promise<UploadResponse> => {
  // Validate file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('파일 크기는 5MB를 초과할 수 없습니다.');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: getAuthHeadersForUpload(),
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload image');
  }

  return response.json();
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map postType to Korean category name
 */
export const postTypeToCategory = (postType: string): string => {
  const map: Record<string, string> = {
    'BOARD': '자유',
    'CHALLENGE': '챌린지',
    'SURVEY': '설문조사',
  };
  return map[postType] || postType;
};

/**
 * Map Korean category name to postType
 */
export const categoryToPostType = (category: string): 'BOARD' | 'CHALLENGE' | 'SURVEY' | undefined => {
  const map: Record<string, 'BOARD' | 'CHALLENGE' | 'SURVEY'> = {
    '자유': 'BOARD',
    '챌린지': 'CHALLENGE',
    '설문조사': 'SURVEY',
  };
  return map[category];
};

/**
 * Format date for display
 */
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

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
