"""
건강 기록 API 라우터
CKD 환자 건강 정보 CRUD
"""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
import logging

from app.models.user import (
    HealthRecordCreate,
    HealthRecordResponse,
    HealthRecordUpdate
)
from app.db.user_manager import user_db_manager
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/health-records", tags=["health-records"])


def _format_record_response(record: dict) -> HealthRecordResponse:
    """MongoDB 문서를 응답 모델로 변환"""
    return HealthRecordResponse(
        record_id=str(record["_id"]),
        user_id=str(record["user_id"]),
        birth_year=record.get("birth_year"),
        gender=record.get("gender"),
        height=record.get("height"),
        weight=record.get("weight"),
        bmi=record.get("bmi"),
        ckd_stage=record.get("ckd_stage"),
        diagnosis_name=record.get("diagnosis_name"),
        diagnosis_code=record.get("diagnosis_code"),
        diagnosis_date=record.get("diagnosis_date"),
        diagnosing_hospital=record.get("diagnosing_hospital"),
        attending_physician=record.get("attending_physician"),
        is_dialysis=record.get("is_dialysis", False),
        dialysis_type=record.get("dialysis_type"),
        dialysis_frequency=record.get("dialysis_frequency"),
        dialysis_start_date=record.get("dialysis_start_date"),
        gfr=record.get("gfr"),
        creatinine=record.get("creatinine"),
        bun=record.get("bun"),
        potassium=record.get("potassium"),
        phosphorus=record.get("phosphorus"),
        albumin=record.get("albumin"),
        hemoglobin=record.get("hemoglobin"),
        has_diabetes=record.get("has_diabetes", False),
        has_hypertension=record.get("has_hypertension", False),
        has_heart_disease=record.get("has_heart_disease", False),
        other_conditions=record.get("other_conditions"),
        dietary_restrictions=record.get("dietary_restrictions"),
        daily_fluid_limit=record.get("daily_fluid_limit"),
        daily_protein_limit=record.get("daily_protein_limit"),
        daily_sodium_limit=record.get("daily_sodium_limit"),
        daily_potassium_limit=record.get("daily_potassium_limit"),
        daily_phosphorus_limit=record.get("daily_phosphorus_limit"),
        measured_at=record.get("measured_at"),
        created_at=record["created_at"],
        updated_at=record["updated_at"]
    )


# ==================== 건강 기록 생성 ====================
@router.post("/", response_model=HealthRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_health_record(
    record: HealthRecordCreate,
    user_id: str = Depends(get_current_user)
):
    """
    새 건강 기록 생성 API

    - 사용자의 건강 정보 저장
    - BMI 자동 계산
    """
    await user_db_manager.connect()

    # Enum 값 추출
    record_data = record.model_dump()
    if record_data.get("gender"):
        record_data["gender"] = record_data["gender"].value if hasattr(record_data["gender"], 'value') else record_data["gender"]
    if record_data.get("ckd_stage"):
        record_data["ckd_stage"] = record_data["ckd_stage"].value if hasattr(record_data["ckd_stage"], 'value') else record_data["ckd_stage"]

    try:
        record_id = await user_db_manager.create_health_record(user_id, record_data)

        # 생성된 기록 조회
        created_record = await user_db_manager.get_health_record(record_id)

        if not created_record:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="건강 기록 생성에 실패했습니다"
            )

        logger.info(f"✅ Health record created: {record_id} for user {user_id}")

        return _format_record_response(created_record)

    except Exception as e:
        logger.error(f"Error creating health record: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="건강 기록 생성 중 오류가 발생했습니다"
        )


# ==================== 건강 기록 목록 조회 ====================
@router.get("/", response_model=List[HealthRecordResponse])
async def get_health_records(
    limit: int = Query(default=10, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user)
):
    """
    건강 기록 목록 조회 API

    - 최신 기록순 정렬
    - 페이지네이션 지원
    """
    await user_db_manager.connect()

    records = await user_db_manager.get_user_health_records(
        user_id=user_id,
        limit=limit,
        skip=skip
    )

    return [_format_record_response(record) for record in records]


# ==================== 최신 건강 기록 조회 ====================
@router.get("/latest", response_model=Optional[HealthRecordResponse])
async def get_latest_health_record(user_id: str = Depends(get_current_user)):
    """
    최신 건강 기록 조회 API
    """
    await user_db_manager.connect()

    record = await user_db_manager.get_latest_health_record(user_id)

    if not record:
        return None

    return _format_record_response(record)


# ==================== 특정 건강 기록 조회 ====================
@router.get("/{record_id}", response_model=HealthRecordResponse)
async def get_health_record(
    record_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    특정 건강 기록 조회 API
    """
    await user_db_manager.connect()

    record = await user_db_manager.get_health_record(record_id)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 기록을 찾을 수 없습니다"
        )

    # 소유자 확인
    if str(record["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다"
        )

    return _format_record_response(record)


# ==================== 건강 기록 수정 ====================
@router.put("/{record_id}", response_model=HealthRecordResponse)
async def update_health_record(
    record_id: str,
    update_data: HealthRecordUpdate,
    user_id: str = Depends(get_current_user)
):
    """
    건강 기록 수정 API

    - BMI 자동 재계산
    """
    await user_db_manager.connect()

    # 기존 기록 확인
    record = await user_db_manager.get_health_record(record_id)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 기록을 찾을 수 없습니다"
        )

    # 소유자 확인
    if str(record["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="수정 권한이 없습니다"
        )

    # None이 아닌 필드만 업데이트
    update_dict = {
        k: (v.value if hasattr(v, 'value') else v)
        for k, v in update_data.model_dump().items()
        if v is not None
    }

    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업데이트할 내용이 없습니다"
        )

    success = await user_db_manager.update_health_record(record_id, update_dict)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="건강 기록 수정에 실패했습니다"
        )

    # 수정된 기록 조회
    updated_record = await user_db_manager.get_health_record(record_id)

    logger.info(f"✅ Health record updated: {record_id}")

    return _format_record_response(updated_record)


# ==================== 건강 기록 삭제 ====================
@router.delete("/{record_id}", response_model=dict)
async def delete_health_record(
    record_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    건강 기록 삭제 API
    """
    await user_db_manager.connect()

    # 기존 기록 확인
    record = await user_db_manager.get_health_record(record_id)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 기록을 찾을 수 없습니다"
        )

    # 소유자 확인
    if str(record["user_id"]) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="삭제 권한이 없습니다"
        )

    success = await user_db_manager.delete_health_record(record_id, user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="건강 기록 삭제에 실패했습니다"
        )

    logger.info(f"✅ Health record deleted: {record_id}")

    return {
        "success": True,
        "message": "건강 기록이 삭제되었습니다"
    }


# ==================== CKD 단계별 권장 수치 ====================
@router.get("/recommendations/dietary", response_model=dict)
async def get_dietary_recommendations(user_id: str = Depends(get_current_user)):
    """
    CKD 단계별 식이 권장 수치 조회 API

    최신 건강 기록의 CKD 단계에 따른 권장 수치 제공
    """
    await user_db_manager.connect()

    record = await user_db_manager.get_latest_health_record(user_id)

    ckd_stage = record.get("ckd_stage", "unknown") if record else "unknown"

    # CKD 단계별 권장 수치 (일일 기준)
    recommendations = {
        "1": {
            "protein": {"min": 0.8, "max": 1.0, "unit": "g/kg/day"},
            "sodium": {"max": 2300, "unit": "mg"},
            "potassium": {"max": 4700, "unit": "mg"},
            "phosphorus": {"max": 1000, "unit": "mg"},
            "fluid": {"note": "제한 없음"},
            "description": "CKD 1단계: 신기능 정상, 단백뇨 있음"
        },
        "2": {
            "protein": {"min": 0.8, "max": 1.0, "unit": "g/kg/day"},
            "sodium": {"max": 2300, "unit": "mg"},
            "potassium": {"max": 4700, "unit": "mg"},
            "phosphorus": {"max": 1000, "unit": "mg"},
            "fluid": {"note": "제한 없음"},
            "description": "CKD 2단계: 경도 신기능 저하"
        },
        "3a": {
            "protein": {"min": 0.6, "max": 0.8, "unit": "g/kg/day"},
            "sodium": {"max": 2000, "unit": "mg"},
            "potassium": {"max": 3000, "unit": "mg"},
            "phosphorus": {"max": 800, "unit": "mg"},
            "fluid": {"note": "필요시 제한"},
            "description": "CKD 3a단계: 중등도 신기능 저하"
        },
        "3b": {
            "protein": {"min": 0.6, "max": 0.8, "unit": "g/kg/day"},
            "sodium": {"max": 2000, "unit": "mg"},
            "potassium": {"max": 2500, "unit": "mg"},
            "phosphorus": {"max": 800, "unit": "mg"},
            "fluid": {"note": "필요시 제한"},
            "description": "CKD 3b단계: 중등도-중증 신기능 저하"
        },
        "4": {
            "protein": {"min": 0.6, "max": 0.8, "unit": "g/kg/day"},
            "sodium": {"max": 1500, "unit": "mg"},
            "potassium": {"max": 2000, "unit": "mg"},
            "phosphorus": {"max": 700, "unit": "mg"},
            "fluid": {"max": 1500, "unit": "mL"},
            "description": "CKD 4단계: 중증 신기능 저하"
        },
        "5": {
            "protein": {"min": 0.6, "max": 0.8, "unit": "g/kg/day"},
            "sodium": {"max": 1500, "unit": "mg"},
            "potassium": {"max": 1500, "unit": "mg"},
            "phosphorus": {"max": 700, "unit": "mg"},
            "fluid": {"max": 1000, "unit": "mL"},
            "description": "CKD 5단계: 말기 신부전"
        },
        "dialysis": {
            "protein": {"min": 1.0, "max": 1.2, "unit": "g/kg/day"},
            "sodium": {"max": 2000, "unit": "mg"},
            "potassium": {"max": 2000, "unit": "mg"},
            "phosphorus": {"max": 1000, "unit": "mg"},
            "fluid": {"max": 1000, "unit": "mL", "note": "투석 간 체중 증가 고려"},
            "description": "투석 중: 단백질 섭취 증가 필요"
        },
        "unknown": {
            "description": "건강 기록에서 CKD 단계를 확인할 수 없습니다. 건강 기록을 업데이트해 주세요.",
            "note": "일반적인 건강한 식단을 권장합니다."
        }
    }

    result = recommendations.get(ckd_stage, recommendations["unknown"])

    return {
        "ckd_stage": ckd_stage,
        "recommendations": result,
        "disclaimer": "이 권장 수치는 일반적인 가이드라인입니다. 개인의 상태에 따라 다를 수 있으니 반드시 담당 의료진과 상담하세요."
    }


# ==================== 건강 기록 차트 데이터 ====================
@router.get("/chart/trends", response_model=dict)
async def get_health_trends(
    metric: str = Query(..., description="조회할 지표 (gfr, creatinine, potassium, phosphorus, hemoglobin, weight, bmi)"),
    limit: int = Query(default=30, ge=1, le=100, description="조회할 기록 수"),
    user_id: str = Depends(get_current_user)
):
    """
    건강 지표 추이 차트 데이터 API

    - 시간순 정렬된 지표 데이터 제공
    - 프론트엔드 차트 라이브러리용 형식
    """
    await user_db_manager.connect()

    # 허용된 지표 목록
    allowed_metrics = {
        "gfr": "사구체여과율 (GFR)",
        "creatinine": "크레아티닌",
        "bun": "혈중요소질소 (BUN)",
        "potassium": "칼륨",
        "phosphorus": "인",
        "albumin": "알부민",
        "hemoglobin": "헤모글로빈",
        "weight": "체중",
        "bmi": "BMI"
    }

    if metric not in allowed_metrics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 지표입니다. 사용 가능: {', '.join(allowed_metrics.keys())}"
        )

    # 건강 기록 조회 (오래된 순으로 정렬하여 차트에 표시)
    records = await user_db_manager.get_user_health_records(
        user_id=user_id,
        limit=limit,
        skip=0
    )

    # 시간순 정렬 (오래된 것부터)
    records.reverse()

    # 차트 데이터 형식으로 변환
    chart_data = []
    for record in records:
        value = record.get(metric)
        if value is not None:
            date = record.get("measured_at") or record.get("created_at")
            chart_data.append({
                "date": date.isoformat() if date else None,
                "value": value,
                "record_id": str(record["_id"])
            })

    # 통계 계산
    values = [d["value"] for d in chart_data if d["value"] is not None]
    stats = {}

    if values:
        stats = {
            "min": min(values),
            "max": max(values),
            "avg": round(sum(values) / len(values), 2),
            "latest": values[-1] if values else None,
            "count": len(values)
        }

        # 추세 계산 (최근 값과 이전 값 비교)
        if len(values) >= 2:
            change = values[-1] - values[-2]
            change_pct = (change / values[-2] * 100) if values[-2] != 0 else 0
            stats["change"] = round(change, 2)
            stats["change_percent"] = round(change_pct, 1)
            stats["trend"] = "up" if change > 0 else ("down" if change < 0 else "stable")

    # 정상 범위 정보
    normal_ranges = {
        "gfr": {"min": 90, "max": 120, "unit": "mL/min/1.73m²", "note": "90 이상이 정상"},
        "creatinine": {"min": 0.6, "max": 1.2, "unit": "mg/dL", "note": "성인 남성 기준"},
        "bun": {"min": 7, "max": 20, "unit": "mg/dL"},
        "potassium": {"min": 3.5, "max": 5.0, "unit": "mEq/L"},
        "phosphorus": {"min": 2.5, "max": 4.5, "unit": "mg/dL"},
        "albumin": {"min": 3.5, "max": 5.0, "unit": "g/dL"},
        "hemoglobin": {"min": 12.0, "max": 17.5, "unit": "g/dL", "note": "성인 남성 기준"},
        "weight": {"unit": "kg"},
        "bmi": {"min": 18.5, "max": 24.9, "unit": "kg/m²", "note": "정상 체중 범위"}
    }

    return {
        "metric": metric,
        "metric_name": allowed_metrics[metric],
        "data": chart_data,
        "stats": stats,
        "normal_range": normal_ranges.get(metric, {}),
        "total_records": len(chart_data)
    }


@router.get("/chart/summary", response_model=dict)
async def get_health_summary(user_id: str = Depends(get_current_user)):
    """
    건강 지표 요약 대시보드 데이터 API

    - 최신 기록의 주요 지표
    - 각 지표의 상태 (정상/주의/위험)
    """
    await user_db_manager.connect()

    record = await user_db_manager.get_latest_health_record(user_id)

    if not record:
        return {
            "has_data": False,
            "message": "건강 기록이 없습니다. 첫 건강 기록을 등록해 주세요."
        }

    def get_status(value, min_val, max_val):
        """값의 상태 판단"""
        if value is None:
            return "unknown"
        if min_val <= value <= max_val:
            return "normal"
        elif value < min_val * 0.8 or value > max_val * 1.2:
            return "danger"
        else:
            return "warning"

    # 주요 지표 요약
    indicators = []

    # GFR
    gfr = record.get("gfr")
    if gfr is not None:
        gfr_status = "normal" if gfr >= 90 else ("warning" if gfr >= 60 else ("danger" if gfr >= 15 else "critical"))
        indicators.append({
            "name": "사구체여과율",
            "key": "gfr",
            "value": gfr,
            "unit": "mL/min/1.73m²",
            "status": gfr_status,
            "description": "신장 기능 지표"
        })

    # 크레아티닌
    creatinine = record.get("creatinine")
    if creatinine is not None:
        cr_status = get_status(creatinine, 0.6, 1.2)
        indicators.append({
            "name": "크레아티닌",
            "key": "creatinine",
            "value": creatinine,
            "unit": "mg/dL",
            "status": cr_status,
            "description": "신장 노폐물 배출 지표"
        })

    # 칼륨
    potassium = record.get("potassium")
    if potassium is not None:
        k_status = get_status(potassium, 3.5, 5.0)
        indicators.append({
            "name": "칼륨",
            "key": "potassium",
            "value": potassium,
            "unit": "mEq/L",
            "status": k_status,
            "description": "전해질 균형 지표"
        })

    # 인
    phosphorus = record.get("phosphorus")
    if phosphorus is not None:
        p_status = get_status(phosphorus, 2.5, 4.5)
        indicators.append({
            "name": "인",
            "key": "phosphorus",
            "value": phosphorus,
            "unit": "mg/dL",
            "status": p_status,
            "description": "뼈 건강 관련 지표"
        })

    # 헤모글로빈
    hemoglobin = record.get("hemoglobin")
    if hemoglobin is not None:
        hb_status = get_status(hemoglobin, 12.0, 17.5)
        indicators.append({
            "name": "헤모글로빈",
            "key": "hemoglobin",
            "value": hemoglobin,
            "unit": "g/dL",
            "status": hb_status,
            "description": "빈혈 관련 지표"
        })

    # BMI
    bmi = record.get("bmi")
    if bmi is not None:
        bmi_status = get_status(bmi, 18.5, 24.9)
        indicators.append({
            "name": "체질량지수",
            "key": "bmi",
            "value": bmi,
            "unit": "kg/m²",
            "status": bmi_status,
            "description": "체중 상태 지표"
        })

    # 전체 상태 요약
    status_counts = {"normal": 0, "warning": 0, "danger": 0, "critical": 0, "unknown": 0}
    for ind in indicators:
        status_counts[ind["status"]] = status_counts.get(ind["status"], 0) + 1

    overall_status = "good"
    if status_counts.get("critical", 0) > 0:
        overall_status = "critical"
    elif status_counts.get("danger", 0) > 0:
        overall_status = "needs_attention"
    elif status_counts.get("warning", 0) > 0:
        overall_status = "monitor"

    return {
        "has_data": True,
        "record_date": (record.get("measured_at") or record.get("created_at")).isoformat(),
        "ckd_stage": record.get("ckd_stage"),
        "diagnosis_name": record.get("diagnosis_name"),
        "indicators": indicators,
        "overall_status": overall_status,
        "status_summary": status_counts
    }


@router.get("/chart/comparison", response_model=dict)
async def get_health_comparison(
    months: int = Query(default=6, ge=1, le=24, description="비교할 기간 (개월)"),
    user_id: str = Depends(get_current_user)
):
    """
    기간별 건강 지표 비교 API

    - 현재 vs N개월 전 비교
    - 주요 지표의 변화량 제공
    """
    from datetime import datetime, timedelta
    from bson import ObjectId

    await user_db_manager.connect()

    now = datetime.utcnow()
    past_date = now - timedelta(days=months * 30)

    # 최신 기록
    latest = await user_db_manager.get_latest_health_record(user_id)

    if not latest:
        return {
            "has_data": False,
            "message": "건강 기록이 없습니다."
        }

    # 과거 기록 (지정 기간 근처의 가장 가까운 기록)
    past_record = await user_db_manager.db.health_records.find_one(
        {
            "user_id": ObjectId(user_id),
            "created_at": {"$lte": past_date}
        },
        sort=[("created_at", -1)]
    )

    if not past_record:
        return {
            "has_data": True,
            "has_comparison": False,
            "current": _format_record_response(latest),
            "message": f"{months}개월 전 기록이 없습니다."
        }

    # 비교 지표
    comparison_metrics = ["gfr", "creatinine", "potassium", "phosphorus", "hemoglobin", "weight", "bmi"]
    comparisons = []

    for metric in comparison_metrics:
        current_val = latest.get(metric)
        past_val = past_record.get(metric)

        if current_val is not None and past_val is not None:
            change = current_val - past_val
            change_pct = (change / past_val * 100) if past_val != 0 else 0

            # 지표별 개선 방향 판단
            improvement_direction = {
                "gfr": "up",  # GFR은 높을수록 좋음
                "creatinine": "down",  # 크레아티닌은 낮을수록 좋음
                "potassium": "stable",  # 칼륨은 정상 범위 유지
                "phosphorus": "down",  # 인은 낮을수록 좋음
                "hemoglobin": "up",  # 헤모글로빈은 높을수록 좋음 (범위 내)
                "weight": "stable",
                "bmi": "stable"
            }

            is_improved = False
            direction = improvement_direction.get(metric, "stable")
            if direction == "up":
                is_improved = change > 0
            elif direction == "down":
                is_improved = change < 0

            comparisons.append({
                "metric": metric,
                "current": current_val,
                "past": past_val,
                "change": round(change, 2),
                "change_percent": round(change_pct, 1),
                "trend": "up" if change > 0 else ("down" if change < 0 else "stable"),
                "is_improved": is_improved
            })

    return {
        "has_data": True,
        "has_comparison": True,
        "period_months": months,
        "current_date": (latest.get("measured_at") or latest.get("created_at")).isoformat(),
        "past_date": (past_record.get("measured_at") or past_record.get("created_at")).isoformat(),
        "comparisons": comparisons
    }
