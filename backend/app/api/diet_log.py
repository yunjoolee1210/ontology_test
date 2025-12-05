"""
식단 기록 API - 이미지 업로드 및 FatSecret API를 통한 음식 인식
"""
import os
import uuid
import shutil
import logging
import re
import base64
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pydantic import BaseModel
from bson import ObjectId

from app.api.dependencies import get_current_user
from app.db.user_manager import user_db_manager
from app.services.fatsecret_service import get_fatsecret_service, recognize_food_from_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/diet-log", tags=["Diet Log"])

# 업로드 디렉토리 - rsc/uploads/diet-log/
BASE_UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "rsc" / "uploads"
DIET_LOG_UPLOAD_DIR = BASE_UPLOAD_DIR / "diet-log"
DIET_LOG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ==================== Pydantic Models ====================

class NutrientInfo(BaseModel):
    """영양소 정보"""
    calories: float = 0.0
    protein: float = 0.0
    fat: float = 0.0
    carbohydrate: float = 0.0
    sodium: float = 0.0
    potassium: float = 0.0
    phosphorus: float = 0.0
    calcium: float = 0.0
    fiber: float = 0.0


class FoodItem(BaseModel):
    """인식된 음식 항목"""
    name: str
    amount: Optional[float] = None
    unit: str = "g"
    nutrients: Optional[Dict[str, float]] = None


class DietLogResponse(BaseModel):
    """식단 기록 응답"""
    success: bool
    log_id: Optional[str] = None
    image_url: Optional[str] = None
    dish_name: Optional[str] = None
    ai_recognized_name: Optional[str] = None
    confidence: Optional[float] = None
    nutrients: Optional[NutrientInfo] = None
    ingredients: Optional[List[FoodItem]] = None
    food_count: int = 0
    recognition_source: str = "none"  # "fatsecret", "openai", "manual", "none"
    error: Optional[str] = None


class DietLogUpdateRequest(BaseModel):
    """식단 기록 수정 요청 (요리명 직접 입력)"""
    dish_name: str


# ==================== Helper Functions ====================

def sanitize_filename(name: str) -> str:
    """파일명에 사용할 수 있도록 문자열 정리"""
    # 특수문자 제거, 공백은 언더스코어로
    sanitized = re.sub(r'[^\w\s가-힣-]', '', name)
    sanitized = re.sub(r'\s+', '_', sanitized.strip())
    return sanitized[:50] if sanitized else "unknown"


# ==================== API Endpoints ====================

@router.post("/upload", response_model=DietLogResponse)
async def upload_diet_image(
    file: UploadFile = File(..., description="음식 이미지 파일"),
    dish_name: Optional[str] = Form(None, description="요리명 (선택, AI 인식 실패 시 직접 입력)"),
    meal_type: str = Form("lunch", description="식사 유형: breakfast, lunch, dinner, snack"),
    current_user: dict = Depends(get_current_user)
):
    """
    식단 이미지 업로드

    - 이미지 1장 업로드
    - FatSecret API로 음식명, 재료, 영양소 인식
    - 인식 실패 시 dish_name 직접 입력 가능
    - 파일명: {dish_name}_{timestamp}_{uuid8}.ext
    - 경로: rsc/uploads/diet-log/{log_id}/
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    # 파일 확장자 검증
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="유효한 이미지 파일이 아닙니다. (jpg, jpeg, png, gif, webp만 허용)"
        )

    # 파일 크기 검증
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB를 초과할 수 없습니다.")

    user_id = str(current_user["_id"])
    log_id = str(uuid.uuid4())

    # 폴더 생성: rsc/uploads/diet-log/{log_id}/
    upload_subdir = DIET_LOG_UPLOAD_DIR / log_id
    upload_subdir.mkdir(parents=True, exist_ok=True)

    try:
        # FatSecret API로 음식 인식
        ai_recognized_name = None
        confidence = 0.0
        nutrients_data = None
        ingredients_data = []
        food_count = 0
        recognition_source = "none"

        # 이미지를 base64로 인코딩
        image_b64 = base64.b64encode(contents).decode("utf-8")

        try:
            # FatSecret API 호출
            recognition_result = await recognize_food_from_image(image_b64)

            if recognition_result.get("success"):
                ai_recognized_name = recognition_result.get("dish_name")
                confidence = recognition_result.get("confidence", 0.85)
                food_count = recognition_result.get("food_count", 1)
                recognition_source = "fatsecret"

                # 영양소 정보 추출
                raw_nutrients = recognition_result.get("nutrients", {})
                if raw_nutrients:
                    nutrients_data = NutrientInfo(
                        calories=raw_nutrients.get("calories", 0),
                        protein=raw_nutrients.get("protein", 0),
                        fat=raw_nutrients.get("fat", 0),
                        carbohydrate=raw_nutrients.get("carbohydrate", 0),
                        sodium=raw_nutrients.get("sodium", 0),
                        potassium=raw_nutrients.get("potassium", 0),
                        phosphorus=raw_nutrients.get("phosphorus", 0),
                        calcium=raw_nutrients.get("calcium", 0),
                        fiber=raw_nutrients.get("fiber", 0)
                    )

                # 재료 정보 추출
                raw_ingredients = recognition_result.get("ingredients", [])
                for ing in raw_ingredients:
                    ingredients_data.append(FoodItem(
                        name=ing.get("name", ""),
                        amount=ing.get("amount"),
                        unit=ing.get("unit", "g"),
                        nutrients=ing.get("nutrients")
                    ))

                logger.info(f"✅ FatSecret recognized: {ai_recognized_name} (confidence: {confidence})")
            else:
                logger.warning(f"⚠️ FatSecret recognition failed: {recognition_result.get('error')}")

        except Exception as e:
            logger.error(f"FatSecret API error: {e}")
            # FatSecret 실패해도 업로드는 계속 진행

        # 최종 요리명 결정 (사용자 입력 > AI 인식 > unknown)
        final_dish_name = dish_name or ai_recognized_name or "unknown"
        sanitized_name = sanitize_filename(final_dish_name)

        # 사용자가 직접 입력한 경우
        if dish_name and dish_name != ai_recognized_name:
            recognition_source = "manual"

        # 파일명: {dish_name}_{timestamp}_{uuid8}.ext
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{sanitized_name}_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = upload_subdir / filename

        # 파일 저장
        with file_path.open("wb") as buffer:
            buffer.write(contents)

        image_url = f"/rsc/uploads/diet-log/{log_id}/{filename}"

        # MongoDB에 저장
        await user_db_manager.connect()

        now = datetime.utcnow()
        doc = {
            "user_id": ObjectId(user_id),
            "log_id": log_id,
            "dish_name": final_dish_name,
            "ai_recognized_name": ai_recognized_name,
            "confidence": confidence,
            "meal_type": meal_type,
            "image_path": str(file_path),
            "image_url": image_url,
            "nutrients": nutrients_data.model_dump() if nutrients_data else None,
            "ingredients": [ing.model_dump() for ing in ingredients_data] if ingredients_data else [],
            "food_count": food_count,
            "recognition_source": recognition_source,
            "logged_at": now,
            "created_at": now,
            "updated_at": now
        }

        result = await user_db_manager.db.diet_logs.insert_one(doc)

        logger.info(f"Diet log saved: {result.inserted_id} for user {user_id}, dish: {final_dish_name}")

        return DietLogResponse(
            success=True,
            log_id=log_id,
            image_url=image_url,
            dish_name=final_dish_name,
            ai_recognized_name=ai_recognized_name,
            confidence=confidence,
            nutrients=nutrients_data,
            ingredients=ingredients_data if ingredients_data else None,
            food_count=food_count,
            recognition_source=recognition_source
        )

    except Exception as e:
        # 오류 시 폴더 정리
        if upload_subdir.exists():
            shutil.rmtree(upload_subdir)
        logger.error(f"Diet log upload error: {e}")
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")


@router.put("/{log_id}/dish-name")
async def update_dish_name(
    log_id: str,
    request: DietLogUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    요리명 수정 (AI 인식 실패 시 사용자가 직접 입력)

    - 파일명도 함께 변경
    """
    user_id = str(current_user["_id"])

    try:
        await user_db_manager.connect()

        # 기존 기록 조회
        doc = await user_db_manager.db.diet_logs.find_one({
            "log_id": log_id,
            "user_id": ObjectId(user_id)
        })

        if not doc:
            raise HTTPException(status_code=404, detail="식단 기록을 찾을 수 없습니다.")

        old_path = Path(doc["image_path"])
        if not old_path.exists():
            raise HTTPException(status_code=404, detail="이미지 파일을 찾을 수 없습니다.")

        # 새 파일명 생성
        ext = old_path.suffix
        sanitized_name = sanitize_filename(request.dish_name)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        new_filename = f"{sanitized_name}_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
        new_path = old_path.parent / new_filename

        # 파일명 변경
        old_path.rename(new_path)

        new_image_url = f"/rsc/uploads/diet-log/{log_id}/{new_filename}"

        # DB 업데이트
        await user_db_manager.db.diet_logs.update_one(
            {"log_id": log_id, "user_id": ObjectId(user_id)},
            {"$set": {
                "dish_name": request.dish_name,
                "image_path": str(new_path),
                "image_url": new_image_url,
                "updated_at": datetime.utcnow()
            }}
        )

        logger.info(f"Diet log updated: {log_id}, new dish name: {request.dish_name}")

        return {
            "success": True,
            "message": "요리명이 수정되었습니다.",
            "dish_name": request.dish_name,
            "image_url": new_image_url
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update dish name error: {e}")
        raise HTTPException(status_code=500, detail=f"수정 실패: {str(e)}")


@router.get("/list")
async def get_diet_logs(
    date: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """사용자의 식단 기록 목록 조회"""
    user_id = str(current_user["_id"])

    try:
        await user_db_manager.connect()

        query = {"user_id": ObjectId(user_id)}

        # 날짜 필터
        if date:
            try:
                target_date = datetime.strptime(date, "%Y-%m-%d")
                next_date = target_date.replace(hour=23, minute=59, second=59)
                query["logged_at"] = {
                    "$gte": target_date,
                    "$lte": next_date
                }
            except ValueError:
                pass

        cursor = user_db_manager.db.diet_logs.find(query).sort("logged_at", -1).skip(skip).limit(limit)

        results = []
        async for doc in cursor:
            results.append({
                "log_id": doc["log_id"],
                "dish_name": doc["dish_name"],
                "meal_type": doc.get("meal_type", "lunch"),
                "image_url": doc["image_url"],
                "confidence": doc.get("confidence"),
                "nutrients": doc.get("nutrients"),
                "ingredients": doc.get("ingredients"),
                "food_count": doc.get("food_count", 0),
                "recognition_source": doc.get("recognition_source", "none"),
                "logged_at": doc["logged_at"].isoformat()
            })

        total = await user_db_manager.db.diet_logs.count_documents(query)

        return {
            "success": True,
            "results": results,
            "total": total
        }

    except Exception as e:
        logger.error(f"Get diet logs error: {e}")
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")


@router.delete("/{log_id}")
async def delete_diet_log(
    log_id: str,
    current_user: dict = Depends(get_current_user)
):
    """식단 기록 삭제"""
    user_id = str(current_user["_id"])

    try:
        await user_db_manager.connect()

        # 기록 조회
        doc = await user_db_manager.db.diet_logs.find_one({
            "log_id": log_id,
            "user_id": ObjectId(user_id)
        })

        if not doc:
            raise HTTPException(status_code=404, detail="식단 기록을 찾을 수 없습니다.")

        # 이미지 폴더 삭제
        upload_subdir = DIET_LOG_UPLOAD_DIR / log_id
        if upload_subdir.exists():
            shutil.rmtree(upload_subdir)

        # DB에서 삭제
        await user_db_manager.db.diet_logs.delete_one({
            "log_id": log_id,
            "user_id": ObjectId(user_id)
        })

        return {
            "success": True,
            "message": "식단 기록이 삭제되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete diet log error: {e}")
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")
