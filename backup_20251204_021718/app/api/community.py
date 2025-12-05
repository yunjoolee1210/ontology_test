# Community API endpoints (posts and comments)
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import shutil
from pathlib import Path
import os

from app.models.community import Post, PostCreate, PostUpdate, PostType, Comment, CommentCreate, CommentUpdate
from app.db.connection import db
from app.api.dependencies import get_current_user, get_current_user_optional
from app.db.user_manager import user_db_manager

router = APIRouter()

# ============================================================================
# Helper Functions
# ============================================================================

def serialize_post(post: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dictionary."""
    if post:
        post["id"] = str(post.pop("_id"))
        for field in ["createdAt", "updatedAt", "lastActivityAt"]:
            if field in post and isinstance(post[field], datetime):
                post[field] = post[field].isoformat()
    return post


def serialize_comment(comment: dict) -> dict:
    """Convert MongoDB comment document to JSON-serializable dictionary."""
    if comment:
        comment["id"] = str(comment.pop("_id"))
        for field in ["createdAt", "updatedAt"]:
            if field in comment and isinstance(comment[field], datetime):
                comment[field] = comment[field].isoformat()
        comment["author"] = {
            "id": comment.get("userId", ""),
            "name": comment.get("authorName", ""),
            "profileImage": None
        }
        comment["authorId"] = comment.get("userId", "")
    return comment


async def get_user_info(user_id: str) -> dict:
    """Get user info from database."""
    await user_db_manager.connect()
    user = await user_db_manager.get_user_by_id(user_id)
    if user:
        return {
            "id": user_id,
            "name": user.get("nickname") or user.get("name") or "사용자",
            "role": user.get("role", "user")
        }
    return {"id": user_id, "name": "사용자", "role": "user"}


async def check_delete_permission(user_id: str, author_id: str) -> bool:
    """
    Check if user can delete the resource.
    Returns True if user is author OR admin.
    """
    if user_id == author_id:
        return True

    user_info = await get_user_info(user_id)
    return user_info.get("role") == "admin"


async def check_update_permission(user_id: str, author_id: str) -> bool:
    """
    Check if user can update the resource.
    Returns True only if user is the author.
    """
    return user_id == author_id


# ============================================================================
# POST Endpoints
# ============================================================================

@router.get("/posts")
def get_posts(
    limit: int = Query(20, ge=1, le=50, description="Number of posts to fetch"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination (last post ID)"),
    postType: Optional[PostType] = Query(None, description="Filter by post type"),
    sortBy: str = Query("lastActivityAt", description="Sort field: createdAt, likes, lastActivityAt")
):
    """
    Get posts with infinite scroll pagination.
    - Guest & User: Can read all posts (no authentication required)
    """
    collection = db["posts"]

    # Get featured posts to exclude from regular list
    featured_posts = list(collection.find(
        {"isPinned": True, "isDeleted": False}
    ).sort("createdAt", -1).limit(3))

    featured_ids = [post["_id"] for post in featured_posts]
    if len(featured_posts) < 3:
        remaining = 3 - len(featured_posts)
        popular_posts = list(collection.aggregate([
            {"$match": {"isDeleted": False, "_id": {"$nin": featured_ids}}},
            {"$addFields": {
                "popularity": {"$add": [
                    {"$ifNull": ["$viewCount", 0]},
                    {"$ifNull": ["$likes", 0]},
                    {"$ifNull": ["$commentCount", 0]}
                ]}
            }},
            {"$sort": {"popularity": -1}},
            {"$limit": remaining}
        ]))
        featured_ids.extend([post["_id"] for post in popular_posts])

    query = {"isDeleted": False, "_id": {"$nin": featured_ids}}

    if postType:
        query["postType"] = postType

    if cursor:
        try:
            query["_id"] = {"$lt": ObjectId(cursor)}
        except:
            raise HTTPException(status_code=400, detail="Invalid cursor")

    sort_field = sortBy if sortBy in ["createdAt", "likes", "lastActivityAt"] else "lastActivityAt"
    cursor_obj = collection.find(query).sort(sort_field, -1).limit(limit)
    posts = list(cursor_obj)
    serialized_posts = [serialize_post(post) for post in posts]
    next_cursor = serialized_posts[-1]["id"] if serialized_posts else None

    return {
        "posts": serialized_posts,
        "nextCursor": next_cursor,
        "hasMore": len(serialized_posts) == limit
    }


@router.get("/posts/featured")
def get_featured_posts():
    """Get top 3 featured posts (pinned + popular)."""
    collection = db["posts"]

    pinned_posts = list(collection.find(
        {"isPinned": True, "isDeleted": False}
    ).sort("createdAt", -1).limit(3))

    if len(pinned_posts) < 3:
        remaining = 3 - len(pinned_posts)
        pinned_ids = [post["_id"] for post in pinned_posts]
        popular_posts = list(collection.aggregate([
            {"$match": {"isDeleted": False, "_id": {"$nin": pinned_ids}}},
            {"$addFields": {
                "popularity": {"$add": [
                    {"$ifNull": ["$viewCount", 0]},
                    {"$ifNull": ["$likes", 0]},
                    {"$ifNull": ["$commentCount", 0]}
                ]}
            }},
            {"$sort": {"popularity": -1}},
            {"$limit": remaining}
        ]))
        pinned_posts.extend(popular_posts)

    return {"featuredPosts": [serialize_post(post) for post in pinned_posts]}


@router.get("/posts/{postId}")
async def get_post(
    postId: str,
    current_user_id: Optional[str] = Depends(get_current_user_optional)
):
    """
    Get a single post by ID with comments.
    - Guest & User: Can read (no authentication required)
    - Returns canEdit and canDelete flags based on user permissions
    """
    posts_collection = db["posts"]
    comments_collection = db["comments"]

    try:
        post = posts_collection.find_one({"_id": ObjectId(postId), "isDeleted": False})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment viewCount
    posts_collection.update_one(
        {"_id": ObjectId(postId)},
        {"$inc": {"viewCount": 1}}
    )
    post["viewCount"] = post.get("viewCount", 0) + 1

    # Get comments
    comments = list(comments_collection.find(
        {"postId": postId, "isDeleted": False}
    ).sort("createdAt", -1))

    serialized_post = serialize_post(post)
    serialized_comments = [serialize_comment(comment) for comment in comments]

    # Determine permissions
    can_edit = False
    can_delete = False
    liked_by_me = False

    if current_user_id:
        author_id = serialized_post.get("userId", "")
        can_edit = await check_update_permission(current_user_id, author_id)
        can_delete = await check_delete_permission(current_user_id, author_id)
        # TODO: Check if user has liked this post
        liked_by_me = False

    post_detail = {
        **serialized_post,
        "author": {
            "id": serialized_post.get("userId", ""),
            "name": serialized_post.get("authorName", ""),
            "profileImage": None
        },
        "authorId": serialized_post.get("userId", ""),
        "likedByMe": liked_by_me,
        "canEdit": can_edit,
        "canDelete": can_delete
    }

    return {"post": post_detail, "comments": serialized_comments}


@router.post("/posts", status_code=201)
async def create_post(
    post_data: PostCreate,
    current_user_id: str = Depends(get_current_user)
):
    """
    Create a new post.
    - Requires authentication (logged-in user or admin)
    - Image limited to 1
    """
    collection = db["posts"]

    # Limit to 1 image
    image_urls = post_data.imageUrls[:1] if post_data.imageUrls else []

    # Get user info
    user_info = await get_user_info(current_user_id)

    now = datetime.utcnow()
    post_doc = {
        "userId": current_user_id,
        "authorName": user_info["name"],
        "title": post_data.title,
        "content": post_data.content,
        "postType": post_data.postType,
        "imageUrls": image_urls,
        "thumbnailUrl": image_urls[0] if image_urls else None,
        "likes": 0,
        "commentCount": 0,
        "viewCount": 0,
        "createdAt": now,
        "updatedAt": now,
        "lastActivityAt": now,
        "isPinned": False,
        "isDeleted": False
    }

    result = collection.insert_one(post_doc)
    created_post = collection.find_one({"_id": result.inserted_id})

    return serialize_post(created_post)


@router.put("/posts/{postId}")
async def update_post(
    postId: str,
    post_data: PostUpdate,
    current_user_id: str = Depends(get_current_user)
):
    """
    Update an existing post.
    - Only the author can update (admin cannot update others' posts)
    - Image limited to 1
    """
    collection = db["posts"]

    try:
        post = collection.find_one({"_id": ObjectId(postId), "isDeleted": False})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check permission - only author can update
    if not await check_update_permission(current_user_id, post["userId"]):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 게시글 작성자만 수정할 수 있습니다.")

    now = datetime.utcnow()
    update_doc = {
        "updatedAt": now,
        "lastActivityAt": now
    }

    if post_data.title:
        update_doc["title"] = post_data.title
    if post_data.content:
        update_doc["content"] = post_data.content
    if post_data.imageUrls is not None:
        # Limit to 1 image
        image_urls = post_data.imageUrls[:1]
        update_doc["imageUrls"] = image_urls
        update_doc["thumbnailUrl"] = image_urls[0] if image_urls else None

    result = collection.update_one(
        {"_id": ObjectId(postId), "isDeleted": False},
        {"$set": update_doc}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    updated_post = collection.find_one({"_id": ObjectId(postId)})
    return serialize_post(updated_post)


@router.delete("/posts/{postId}", status_code=204)
async def delete_post(
    postId: str,
    current_user_id: str = Depends(get_current_user)
):
    """
    Delete a post (soft delete).
    - Author can delete their own post
    - Admin can delete any post
    """
    collection = db["posts"]

    try:
        post = collection.find_one({"_id": ObjectId(postId)})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check permission - author or admin
    if not await check_delete_permission(current_user_id, post["userId"]):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 게시글 작성자 또는 관리자만 삭제할 수 있습니다.")

    result = collection.update_one(
        {"_id": ObjectId(postId)},
        {"$set": {"isDeleted": True, "updatedAt": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    return None


# ============================================================================
# COMMENTS API
# ============================================================================

@router.post("/comments", status_code=201)
async def create_comment(
    comment_data: CommentCreate,
    current_user_id: str = Depends(get_current_user)
):
    """
    Create a new comment on a post.
    - Requires authentication
    """
    comments_collection = db["comments"]
    posts_collection = db["posts"]

    try:
        post = posts_collection.find_one({"_id": ObjectId(comment_data.postId), "isDeleted": False})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_info = await get_user_info(current_user_id)
    now = datetime.utcnow()

    comment_doc = {
        "postId": comment_data.postId,
        "userId": current_user_id,
        "authorName": user_info["name"],
        "content": comment_data.content,
        "createdAt": now,
        "updatedAt": now,
        "isDeleted": False
    }

    result = comments_collection.insert_one(comment_doc)

    posts_collection.update_one(
        {"_id": ObjectId(comment_data.postId)},
        {"$inc": {"commentCount": 1}, "$set": {"lastActivityAt": now}}
    )

    created_comment = comments_collection.find_one({"_id": result.inserted_id})
    return serialize_comment(created_comment)


@router.put("/comments/{commentId}")
async def update_comment(
    commentId: str,
    comment_data: CommentUpdate,
    current_user_id: str = Depends(get_current_user)
):
    """
    Update an existing comment.
    - Only the author can update
    """
    collection = db["comments"]

    try:
        comment = collection.find_one({"_id": ObjectId(commentId), "isDeleted": False})
    except:
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if not await check_update_permission(current_user_id, comment["userId"]):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 댓글 작성자만 수정할 수 있습니다.")

    result = collection.update_one(
        {"_id": ObjectId(commentId), "isDeleted": False},
        {"$set": {"content": comment_data.content, "updatedAt": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")

    updated_comment = collection.find_one({"_id": ObjectId(commentId)})
    return serialize_comment(updated_comment)


@router.delete("/comments/{commentId}", status_code=204)
async def delete_comment(
    commentId: str,
    current_user_id: str = Depends(get_current_user)
):
    """
    Delete a comment (soft delete).
    - Author can delete their own comment
    - Admin can delete any comment
    """
    comments_collection = db["comments"]
    posts_collection = db["posts"]

    try:
        comment = comments_collection.find_one({"_id": ObjectId(commentId), "isDeleted": False})
    except:
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if not await check_delete_permission(current_user_id, comment["userId"]):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 댓글 작성자 또는 관리자만 삭제할 수 있습니다.")

    comments_collection.update_one(
        {"_id": ObjectId(commentId)},
        {"$set": {"isDeleted": True, "updatedAt": datetime.utcnow()}}
    )

    posts_collection.update_one(
        {"_id": ObjectId(comment["postId"])},
        {"$inc": {"commentCount": -1}}
    )

    return None


# ============================================================================
# LIKES API
# ============================================================================

@router.post("/posts/{postId}/like", status_code=200)
async def like_post(
    postId: str,
    current_user_id: str = Depends(get_current_user)
):
    """
    Like a post.
    - Requires authentication
    """
    collection = db["posts"]

    try:
        result = collection.update_one(
            {"_id": ObjectId(postId), "isDeleted": False},
            {"$inc": {"likes": 1}}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    return {"message": "Post liked successfully"}


@router.delete("/posts/{postId}/like", status_code=200)
async def unlike_post(
    postId: str,
    current_user_id: str = Depends(get_current_user)
):
    """
    Unlike a post.
    - Requires authentication
    """
    collection = db["posts"]

    try:
        result = collection.update_one(
            {"_id": ObjectId(postId), "isDeleted": False},
            {"$inc": {"likes": -1}}
        )
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    return {"message": "Post unliked successfully"}


# ============================================================================
# IMAGE UPLOAD API
# ============================================================================

@router.post("/uploads", status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user)
):
    """
    Upload an image file.
    - Requires authentication
    - Only 1 image can be uploaded at a time
    - Allowed types: .jpg, .jpeg, .png, .gif, .webp
    - Max file size: 5MB
    """
    # Define allowed image file extensions
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_extension = Path(file.filename).suffix.lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Check file size (5MB limit)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB를 초과할 수 없습니다.")

    # Reset file position after reading
    await file.seek(0)

    # Ensure uploads directory exists
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)

    # Generate unique filename using timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{current_user_id[:8]}_{file.filename}"
    file_path = uploads_dir / unique_filename

    # Save file to disk
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {
        "url": f"/uploads/{unique_filename}",
        "filename": unique_filename
    }
