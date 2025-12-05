"""
레시피 API - CKD 환자를 위한 저칼륨/저인 레시피 관리
"""
import logging
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from bson import ObjectId

from app.api.dependencies import get_current_user, get_current_user_optional
from app.db.user_manager import user_db_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recipes", tags=["Recipes"])


# ==================== Pydantic Models ====================

class RecipeNutrients(BaseModel):
    """레시피 영양소 정보"""
    calories: int
    potassium: int
    phosphorus: int
    protein: int
    sodium: int


class RecipeBase(BaseModel):
    """레시피 기본 정보"""
    name: str
    name_en: str
    category: str  # "low-potassium" | "low-phosphorus"
    cooking_time: str
    servings: str
    nutrients: RecipeNutrients
    ingredients: List[str]
    steps: List[str]
    tips: str


class RecipeResponse(RecipeBase):
    """레시피 응답"""
    id: str
    slug: str  # SEO-friendly URL slug (e.g., "tofu-egg-steam")
    image_url: str
    created_at: Optional[str] = None


class RecipeListResponse(BaseModel):
    """레시피 목록 응답"""
    success: bool
    recipes: List[RecipeResponse]
    total: int


# ==================== API Endpoints ====================

@router.get("", response_model=RecipeListResponse)
async def get_recipes(
    category: Optional[str] = Query(None, description="카테고리 필터: low-potassium, low-phosphorus"),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0)
):
    """
    레시피 목록 조회 (공개 API - 인증 불필요)
    """
    try:
        await user_db_manager.connect()

        query = {}
        if category:
            query["category"] = category

        cursor = user_db_manager.db.recipes.find(query).sort("created_at", -1).skip(skip).limit(limit)

        recipes = []
        async for doc in cursor:
            recipes.append(RecipeResponse(
                id=str(doc["_id"]),
                slug=doc.get("slug", doc["name_en"].replace("_", "-")),
                name=doc["name"],
                name_en=doc["name_en"],
                category=doc["category"],
                cooking_time=doc["cooking_time"],
                servings=doc["servings"],
                nutrients=RecipeNutrients(**doc["nutrients"]),
                ingredients=doc["ingredients"],
                steps=doc["steps"],
                tips=doc["tips"],
                image_url=doc["image_url"],
                created_at=doc.get("created_at", datetime.utcnow()).isoformat()
            ))

        total = await user_db_manager.db.recipes.count_documents(query)

        return RecipeListResponse(
            success=True,
            recipes=recipes,
            total=total
        )

    except Exception as e:
        logger.error(f"Get recipes error: {e}")
        raise HTTPException(status_code=500, detail=f"레시피 조회 실패: {str(e)}")


@router.get("/by-slug/{slug}", response_model=RecipeResponse)
async def get_recipe_by_slug(slug: str):
    """
    레시피 상세 조회 by slug (SEO-friendly URL)
    예: /api/recipes/by-slug/tofu-egg-steam
    """
    try:
        await user_db_manager.connect()

        doc = await user_db_manager.db.recipes.find_one({"slug": slug})

        if not doc:
            raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")

        return RecipeResponse(
            id=str(doc["_id"]),
            slug=doc.get("slug", doc["name_en"].replace("_", "-")),
            name=doc["name"],
            name_en=doc["name_en"],
            category=doc["category"],
            cooking_time=doc["cooking_time"],
            servings=doc["servings"],
            nutrients=RecipeNutrients(**doc["nutrients"]),
            ingredients=doc["ingredients"],
            steps=doc["steps"],
            tips=doc["tips"],
            image_url=doc["image_url"],
            created_at=doc.get("created_at", datetime.utcnow()).isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get recipe by slug error: {e}")
        raise HTTPException(status_code=500, detail=f"레시피 조회 실패: {str(e)}")


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str):
    """
    레시피 상세 조회 by ID (공개 API)
    """
    try:
        await user_db_manager.connect()

        doc = await user_db_manager.db.recipes.find_one({"_id": ObjectId(recipe_id)})

        if not doc:
            raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")

        return RecipeResponse(
            id=str(doc["_id"]),
            slug=doc.get("slug", doc["name_en"].replace("_", "-")),
            name=doc["name"],
            name_en=doc["name_en"],
            category=doc["category"],
            cooking_time=doc["cooking_time"],
            servings=doc["servings"],
            nutrients=RecipeNutrients(**doc["nutrients"]),
            ingredients=doc["ingredients"],
            steps=doc["steps"],
            tips=doc["tips"],
            image_url=doc["image_url"],
            created_at=doc.get("created_at", datetime.utcnow()).isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get recipe error: {e}")
        raise HTTPException(status_code=500, detail=f"레시피 조회 실패: {str(e)}")


# ==================== User Favorites ====================

@router.post("/{recipe_id}/favorite")
async def add_favorite(
    recipe_id: str,
    current_user: str = Depends(get_current_user)
):
    """레시피 즐겨찾기 추가"""
    try:
        await user_db_manager.connect()

        # 레시피 존재 확인
        recipe = await user_db_manager.db.recipes.find_one({"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")

        # 이미 즐겨찾기인지 확인
        existing = await user_db_manager.db.recipe_favorites.find_one({
            "user_id": ObjectId(current_user),
            "recipe_id": ObjectId(recipe_id)
        })

        if existing:
            return {"success": True, "message": "이미 즐겨찾기에 추가되어 있습니다."}

        # 즐겨찾기 추가
        await user_db_manager.db.recipe_favorites.insert_one({
            "user_id": ObjectId(current_user),
            "recipe_id": ObjectId(recipe_id),
            "created_at": datetime.utcnow()
        })

        return {"success": True, "message": "즐겨찾기에 추가되었습니다."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add favorite error: {e}")
        raise HTTPException(status_code=500, detail=f"즐겨찾기 추가 실패: {str(e)}")


@router.delete("/{recipe_id}/favorite")
async def remove_favorite(
    recipe_id: str,
    current_user: str = Depends(get_current_user)
):
    """레시피 즐겨찾기 삭제"""
    try:
        await user_db_manager.connect()

        result = await user_db_manager.db.recipe_favorites.delete_one({
            "user_id": ObjectId(current_user),
            "recipe_id": ObjectId(recipe_id)
        })

        if result.deleted_count == 0:
            return {"success": True, "message": "즐겨찾기에 없는 레시피입니다."}

        return {"success": True, "message": "즐겨찾기에서 삭제되었습니다."}

    except Exception as e:
        logger.error(f"Remove favorite error: {e}")
        raise HTTPException(status_code=500, detail=f"즐겨찾기 삭제 실패: {str(e)}")


@router.get("/user/favorites")
async def get_user_favorites(
    current_user: str = Depends(get_current_user)
):
    """사용자의 즐겨찾기 레시피 ID 목록 조회"""
    try:
        await user_db_manager.connect()

        cursor = user_db_manager.db.recipe_favorites.find({
            "user_id": ObjectId(current_user)
        })

        favorite_ids = []
        async for doc in cursor:
            favorite_ids.append(str(doc["recipe_id"]))

        return {
            "success": True,
            "favorites": favorite_ids
        }

    except Exception as e:
        logger.error(f"Get favorites error: {e}")
        raise HTTPException(status_code=500, detail=f"즐겨찾기 조회 실패: {str(e)}")
