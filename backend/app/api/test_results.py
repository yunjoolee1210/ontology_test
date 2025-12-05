"""
검진결과 API - OCR 업로드, 확인, 저장
"""
import os
import uuid
import shutil
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from pydantic import BaseModel, Field
from bson import ObjectId

from app.api.dependencies import get_current_user
from app.services.ocr_service import extract_lab_results_from_images, get_all_normal_ranges
from app.db.user_manager import user_db_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/test-results", tags=["Test Results"])

# 업로드 디렉토리 - 기존 폴더 구조 패턴 준수: rsc/uploads/test-results/
BASE_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "rsc", "uploads")
UPLOAD_DIR = os.path.join(BASE_UPLOAD_DIR, "test-results")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== Pydantic Models ====================

class LabResultItem(BaseModel):
    """개별 검사 항목"""
    field_name: str
    value: Optional[float] = None
    unit: Optional[str] = None
    original_name: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: Optional[bool] = None


class OCRResultResponse(BaseModel):
    """OCR 결과 응답"""
    success: bool
    temp_id: Optional[str] = None  # 임시 저장 ID
    test_date: Optional[str] = None
    hospital_name: Optional[str] = None
    lab_results: dict = {}
    raw_results: list = []
    raw_text: Optional[str] = None
    confidence: Optional[float] = None
    image_count: int = 0
    error: Optional[str] = None


class ConfirmTestResultRequest(BaseModel):
    """검진결과 확인/저장 요청"""
    temp_id: str
    test_date: str  # YYYY-MM-DD
    hospital_name: Optional[str] = None
    lab_results: dict  # field_name: {value, unit}


class TestResultResponse(BaseModel):
    """검진결과 응답"""
    id: str
    user_id: str
    test_date: str
    hospital_name: Optional[str] = None
    lab_results: dict
    created_at: str
    updated_at: str


class TestResultListResponse(BaseModel):
    """검진결과 목록 응답"""
    success: bool
    results: List[dict]
    total: int


# ==================== 임시 저장소 ====================
# 실제 운영에서는 Redis 사용 권장
_temp_ocr_results = {}


# ==================== API Endpoints ====================

@router.post("/upload", response_model=OCRResultResponse)
async def upload_test_result_images(
    files: List[UploadFile] = File(..., description="검진결과지 이미지 파일들"),
    current_user: str = Depends(get_current_user)
):
    """
    검진결과지 이미지 업로드 및 OCR 처리

    - 여러 장의 이미지 업로드 가능
    - AI가 OCR로 텍스트 추출 후 검진 항목 파싱
    - 결과를 임시 저장하고 temp_id 반환
    """
    if not files:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    # 파일 저장 - rsc/uploads/test-results/{temp_id}/ 구조
    user_id = current_user
    temp_id = str(uuid.uuid4())
    upload_subdir = os.path.join(UPLOAD_DIR, temp_id)
    os.makedirs(upload_subdir, exist_ok=True)

    saved_paths = []
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

    try:
        file_index = 0
        for file in files:
            # 파일 확장자 검증
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed_extensions:
                continue

            # 파일 저장 - 순서 인덱스 포함: {index}_{uuid}.ext
            filename = f"{file_index:03d}_{uuid.uuid4().hex[:8]}{ext}"
            file_path = os.path.join(upload_subdir, filename)
            file_index += 1

            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            saved_paths.append(file_path)

        if not saved_paths:
            raise HTTPException(
                status_code=400,
                detail="유효한 이미지 파일이 없습니다. (jpg, jpeg, png, gif, webp만 허용)"
            )

        # OCR 처리
        ocr_result = await extract_lab_results_from_images(saved_paths)

        if not ocr_result.get("success"):
            return OCRResultResponse(
                success=False,
                error=ocr_result.get("error", "OCR 처리에 실패했습니다.")
            )

        # 임시 저장
        _temp_ocr_results[temp_id] = {
            "user_id": user_id,
            "ocr_result": ocr_result,
            "image_paths": saved_paths,
            "created_at": datetime.utcnow()
        }

        return OCRResultResponse(
            success=True,
            temp_id=temp_id,
            test_date=ocr_result.get("test_date"),
            hospital_name=ocr_result.get("hospital_name"),
            lab_results=ocr_result.get("lab_results", {}),
            raw_results=ocr_result.get("raw_results", []),
            raw_text=ocr_result.get("raw_text"),
            confidence=ocr_result.get("confidence"),
            image_count=len(saved_paths)
        )

    except Exception as e:
        # 오류 시 업로드된 파일 정리
        if os.path.exists(upload_subdir):
            shutil.rmtree(upload_subdir)
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"업로드 처리 중 오류: {str(e)}")


@router.get("/ocr-result/{temp_id}", response_model=OCRResultResponse)
async def get_ocr_result(
    temp_id: str,
    current_user: str = Depends(get_current_user)
):
    """임시 저장된 OCR 결과 조회"""
    user_id = current_user

    if temp_id not in _temp_ocr_results:
        raise HTTPException(status_code=404, detail="OCR 결과를 찾을 수 없습니다.")

    temp_data = _temp_ocr_results[temp_id]
    if temp_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    ocr_result = temp_data["ocr_result"]

    return OCRResultResponse(
        success=True,
        temp_id=temp_id,
        test_date=ocr_result.get("test_date"),
        hospital_name=ocr_result.get("hospital_name"),
        lab_results=ocr_result.get("lab_results", {}),
        raw_results=ocr_result.get("raw_results", []),
        raw_text=ocr_result.get("raw_text"),
        confidence=ocr_result.get("confidence"),
        image_count=ocr_result.get("image_count", 0)
    )


@router.post("/confirm")
async def confirm_and_save_test_result(
    request: ConfirmTestResultRequest,
    current_user: str = Depends(get_current_user)
):
    """
    사용자가 OCR 결과를 확인/수정 후 최종 저장

    - 사용자가 수정한 값으로 저장
    - MongoDB에 영구 저장
    - 프로필과 연동
    """
    user_id = current_user

    # 임시 데이터 확인
    if request.temp_id not in _temp_ocr_results:
        raise HTTPException(status_code=404, detail="OCR 결과를 찾을 수 없습니다. 다시 업로드해주세요.")

    temp_data = _temp_ocr_results[request.temp_id]
    if temp_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    try:
        # 날짜 파싱
        test_date = datetime.strptime(request.test_date, "%Y-%m-%d")

        # MongoDB에 저장
        await user_db_manager.connect()

        now = datetime.utcnow()
        doc = {
            "user_id": ObjectId(user_id),
            "test_date": test_date,
            "hospital_name": request.hospital_name,
            "lab_results": request.lab_results,
            "ocr_confidence": temp_data["ocr_result"].get("confidence"),
            "image_paths": temp_data["image_paths"],
            "created_at": now,
            "updated_at": now
        }

        result = await user_db_manager.db.test_results.insert_one(doc)

        # 임시 데이터 삭제
        del _temp_ocr_results[request.temp_id]

        logger.info(f"Test result saved: {result.inserted_id} for user {user_id}")

        return {
            "success": True,
            "message": "검진결과가 저장되었습니다.",
            "result_id": str(result.inserted_id)
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    except Exception as e:
        logger.error(f"Save error: {e}")
        raise HTTPException(status_code=500, detail=f"저장 중 오류: {str(e)}")


@router.get("/list", response_model=TestResultListResponse)
async def get_test_results(
    limit: int = 20,
    skip: int = 0,
    current_user: str = Depends(get_current_user)
):
    """사용자의 검진결과 목록 조회"""
    user_id = current_user

    try:
        await user_db_manager.connect()

        cursor = user_db_manager.db.test_results.find(
            {"user_id": ObjectId(user_id)}
        ).sort("test_date", -1).skip(skip).limit(limit)

        results = []
        async for doc in cursor:
            results.append({
                "id": str(doc["_id"]),
                "test_date": doc["test_date"].strftime("%Y-%m-%d"),
                "hospital_name": doc.get("hospital_name"),
                "lab_results": doc.get("lab_results", {}),
                "created_at": doc["created_at"].isoformat()
            })

        total = await user_db_manager.db.test_results.count_documents(
            {"user_id": ObjectId(user_id)}
        )

        return TestResultListResponse(
            success=True,
            results=results,
            total=total
        )

    except Exception as e:
        logger.error(f"List error: {e}")
        raise HTTPException(status_code=500, detail=f"조회 중 오류: {str(e)}")


@router.get("/{result_id}")
async def get_test_result(
    result_id: str,
    current_user: str = Depends(get_current_user)
):
    """특정 검진결과 상세 조회"""
    user_id = current_user

    try:
        await user_db_manager.connect()

        doc = await user_db_manager.db.test_results.find_one({
            "_id": ObjectId(result_id),
            "user_id": ObjectId(user_id)
        })

        if not doc:
            raise HTTPException(status_code=404, detail="검진결과를 찾을 수 없습니다.")

        return {
            "success": True,
            "result": {
                "id": str(doc["_id"]),
                "test_date": doc["test_date"].strftime("%Y-%m-%d"),
                "hospital_name": doc.get("hospital_name"),
                "lab_results": doc.get("lab_results", {}),
                "created_at": doc["created_at"].isoformat(),
                "updated_at": doc["updated_at"].isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Get error: {e}")
        raise HTTPException(status_code=500, detail=f"조회 중 오류: {str(e)}")


@router.delete("/{result_id}")
async def delete_test_result(
    result_id: str,
    current_user: str = Depends(get_current_user)
):
    """검진결과 삭제"""
    user_id = current_user

    try:
        await user_db_manager.connect()

        result = await user_db_manager.db.test_results.delete_one({
            "_id": ObjectId(result_id),
            "user_id": ObjectId(user_id)
        })

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="검진결과를 찾을 수 없습니다.")

        return {
            "success": True,
            "message": "검진결과가 삭제되었습니다."
        }

    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=f"삭제 중 오류: {str(e)}")


@router.get("/latest/summary")
async def get_latest_test_summary(
    current_user: str = Depends(get_current_user)
):
    """
    최신 검진결과 요약 조회 (프로필/챗봇 연동용)

    Agent 챗봇이나 식단케어에서 사용자의 최신 검진 수치를 참조할 때 사용
    """
    user_id = current_user

    try:
        await user_db_manager.connect()

        # 최신 검진결과 조회
        doc = await user_db_manager.db.test_results.find_one(
            {"user_id": ObjectId(user_id)},
            sort=[("test_date", -1)]
        )

        if not doc:
            return {
                "success": True,
                "has_results": False,
                "message": "저장된 검진결과가 없습니다."
            }

        # 정상 범위 정보 포함
        normal_ranges = get_all_normal_ranges()
        lab_results_with_ranges = {}

        for field_name, data in doc.get("lab_results", {}).items():
            lab_results_with_ranges[field_name] = {
                **data,
                "normal_range": normal_ranges.get(field_name)
            }

        return {
            "success": True,
            "has_results": True,
            "test_date": doc["test_date"].strftime("%Y-%m-%d"),
            "hospital_name": doc.get("hospital_name"),
            "lab_results": lab_results_with_ranges,
            "days_since_test": (datetime.utcnow() - doc["test_date"]).days
        }

    except Exception as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(status_code=500, detail=f"조회 중 오류: {str(e)}")


@router.get("/reference/normal-ranges")
async def get_normal_ranges():
    """모든 검사 항목의 정상 범위 조회"""
    return {
        "success": True,
        "normal_ranges": get_all_normal_ranges()
    }
