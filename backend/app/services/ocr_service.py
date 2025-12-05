"""
OCR 서비스 - 검진결과지 이미지에서 텍스트 추출 및 데이터 파싱
OpenAI Vision API 사용
"""
import os
import base64
import re
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# OpenAI 클라이언트
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 검진 항목 매핑 (한글 -> 영문 필드명)
LAB_ITEM_MAPPING = {
    # 신장 기능
    "크레아티닌": "creatinine",
    "Creatinine": "creatinine",
    "혈청크레아티닌": "creatinine",
    "BUN": "bun",
    "혈중요소질소": "bun",
    "요소질소": "bun",
    "eGFR": "egfr",
    "사구체여과율": "egfr",
    "GFR": "egfr",
    "요산": "uric_acid",
    "Uric Acid": "uric_acid",

    # 혈당
    "공복혈당": "fasting_glucose",
    "혈당": "fasting_glucose",
    "Glucose": "fasting_glucose",
    "HbA1c": "hba1c",
    "당화혈색소": "hba1c",

    # 지질
    "총콜레스테롤": "total_cholesterol",
    "콜레스테롤": "total_cholesterol",
    "Cholesterol": "total_cholesterol",
    "HDL": "hdl_cholesterol",
    "HDL콜레스테롤": "hdl_cholesterol",
    "LDL": "ldl_cholesterol",
    "LDL콜레스테롤": "ldl_cholesterol",
    "중성지방": "triglycerides",
    "TG": "triglycerides",
    "Triglyceride": "triglycerides",

    # 전해질
    "나트륨": "sodium",
    "Na": "sodium",
    "Sodium": "sodium",
    "칼륨": "potassium",
    "K": "potassium",
    "Potassium": "potassium",
    "인": "phosphorus",
    "P": "phosphorus",
    "Phosphorus": "phosphorus",
    "칼슘": "calcium",
    "Ca": "calcium",
    "Calcium": "calcium",

    # 혈액검사
    "헤모글로빈": "hemoglobin",
    "Hb": "hemoglobin",
    "Hemoglobin": "hemoglobin",
    "적혈구": "rbc",
    "RBC": "rbc",
    "백혈구": "wbc",
    "WBC": "wbc",
    "혈소판": "platelet",
    "PLT": "platelet",
    "Platelet": "platelet",

    # 간기능
    "AST": "ast",
    "GOT": "ast",
    "ALT": "alt",
    "GPT": "alt",
    "감마GT": "ggt",
    "r-GT": "ggt",
    "GGT": "ggt",

    # 단백질
    "알부민": "albumin",
    "Albumin": "albumin",
    "총단백": "total_protein",
    "단백질": "total_protein",

    # 혈압
    "수축기혈압": "systolic_bp",
    "최고혈압": "systolic_bp",
    "이완기혈압": "diastolic_bp",
    "최저혈압": "diastolic_bp",
}

# 정상 범위 (참고용)
NORMAL_RANGES = {
    "creatinine": {"min": 0.6, "max": 1.2, "unit": "mg/dL"},
    "bun": {"min": 7, "max": 20, "unit": "mg/dL"},
    "egfr": {"min": 90, "max": 999, "unit": "mL/min/1.73m²"},
    "fasting_glucose": {"min": 70, "max": 100, "unit": "mg/dL"},
    "hba1c": {"min": 4.0, "max": 5.6, "unit": "%"},
    "total_cholesterol": {"min": 0, "max": 200, "unit": "mg/dL"},
    "hdl_cholesterol": {"min": 40, "max": 999, "unit": "mg/dL"},
    "ldl_cholesterol": {"min": 0, "max": 130, "unit": "mg/dL"},
    "triglycerides": {"min": 0, "max": 150, "unit": "mg/dL"},
    "sodium": {"min": 136, "max": 145, "unit": "mEq/L"},
    "potassium": {"min": 3.5, "max": 5.0, "unit": "mEq/L"},
    "phosphorus": {"min": 2.5, "max": 4.5, "unit": "mg/dL"},
    "calcium": {"min": 8.5, "max": 10.5, "unit": "mg/dL"},
    "hemoglobin": {"min": 12.0, "max": 17.5, "unit": "g/dL"},
    "ast": {"min": 0, "max": 40, "unit": "U/L"},
    "alt": {"min": 0, "max": 40, "unit": "U/L"},
    "albumin": {"min": 3.5, "max": 5.0, "unit": "g/dL"},
    "systolic_bp": {"min": 90, "max": 120, "unit": "mmHg"},
    "diastolic_bp": {"min": 60, "max": 80, "unit": "mmHg"},
}


def encode_image_to_base64(image_path: str) -> str:
    """이미지 파일을 base64로 인코딩"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def get_image_media_type(image_path: str) -> str:
    """이미지 파일의 미디어 타입 반환"""
    ext = os.path.splitext(image_path)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    return media_types.get(ext, "image/jpeg")


async def extract_lab_results_from_images(image_paths: List[str]) -> Dict[str, Any]:
    """
    여러 검진결과지 이미지에서 OCR로 데이터 추출

    Args:
        image_paths: 이미지 파일 경로 리스트

    Returns:
        Dict containing:
        - test_date: 검진 날짜
        - hospital_name: 병원명
        - lab_results: 검사 항목별 수치
        - raw_text: 원본 추출 텍스트
        - confidence: 신뢰도
    """
    try:
        # 이미지들을 base64로 인코딩
        image_contents = []
        for path in image_paths:
            if os.path.exists(path):
                base64_image = encode_image_to_base64(path)
                media_type = get_image_media_type(path)
                image_contents.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{base64_image}",
                        "detail": "high"
                    }
                })

        if not image_contents:
            return {
                "success": False,
                "error": "유효한 이미지 파일이 없습니다."
            }

        # OpenAI Vision API 호출
        prompt = """이 검진결과지 이미지에서 다음 정보를 추출해주세요.

반드시 아래 JSON 형식으로만 응답해주세요:

{
    "test_date": "YYYY-MM-DD 형식의 검진 날짜 (찾을 수 없으면 null)",
    "hospital_name": "병원명 (찾을 수 없으면 null)",
    "lab_results": [
        {
            "item_name": "검사 항목명 (한글)",
            "value": 수치값 (숫자만),
            "unit": "단위",
            "reference_range": "정상 범위 (있으면)"
        }
    ],
    "raw_text": "이미지에서 추출한 주요 텍스트"
}

다음 검사 항목을 특히 주의해서 찾아주세요:
- 신장기능: 크레아티닌, BUN, eGFR, 요산
- 혈당: 공복혈당, HbA1c
- 지질: 총콜레스테롤, HDL, LDL, 중성지방
- 전해질: 나트륨, 칼륨, 인, 칼슘
- 혈액: 헤모글로빈, 적혈구, 백혈구, 혈소판
- 간기능: AST, ALT, GGT
- 단백질: 알부민, 총단백
- 혈압: 수축기, 이완기

수치값은 반드시 숫자로만 입력하고, 단위는 별도로 기재해주세요."""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    *image_contents
                ]
            }
        ]

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=4096,
            temperature=0.1
        )

        response_text = response.choices[0].message.content

        # JSON 파싱
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            extracted_data = json.loads(json_match.group())
        else:
            extracted_data = {"raw_text": response_text, "lab_results": []}

        # 검사 항목 정규화
        normalized_results = {}
        for item in extracted_data.get("lab_results", []):
            item_name = item.get("item_name", "")
            value = item.get("value")
            unit = item.get("unit", "")

            # 매핑된 필드명 찾기
            field_name = None
            for korean_name, english_name in LAB_ITEM_MAPPING.items():
                if korean_name in item_name or item_name in korean_name:
                    field_name = english_name
                    break

            if field_name and value is not None:
                try:
                    numeric_value = float(value) if value else None
                    normalized_results[field_name] = {
                        "value": numeric_value,
                        "unit": unit,
                        "original_name": item_name,
                        "reference_range": item.get("reference_range"),
                        "is_abnormal": _check_if_abnormal(field_name, numeric_value)
                    }
                except (ValueError, TypeError):
                    pass

        return {
            "success": True,
            "test_date": extracted_data.get("test_date"),
            "hospital_name": extracted_data.get("hospital_name"),
            "lab_results": normalized_results,
            "raw_results": extracted_data.get("lab_results", []),
            "raw_text": extracted_data.get("raw_text", ""),
            "confidence": 0.85,  # 기본 신뢰도
            "image_count": len(image_paths)
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        return {
            "success": False,
            "error": "OCR 결과 파싱에 실패했습니다.",
            "raw_text": response_text if 'response_text' in locals() else ""
        }
    except Exception as e:
        logger.error(f"OCR extraction error: {e}")
        return {
            "success": False,
            "error": f"OCR 처리 중 오류: {str(e)}"
        }


def _check_if_abnormal(field_name: str, value: float) -> Optional[bool]:
    """정상 범위를 벗어났는지 확인"""
    if field_name not in NORMAL_RANGES or value is None:
        return None

    normal = NORMAL_RANGES[field_name]
    return value < normal["min"] or value > normal["max"]


def get_normal_range(field_name: str) -> Optional[Dict]:
    """검사 항목의 정상 범위 반환"""
    return NORMAL_RANGES.get(field_name)


def get_all_normal_ranges() -> Dict:
    """모든 검사 항목의 정상 범위 반환"""
    return NORMAL_RANGES.copy()
