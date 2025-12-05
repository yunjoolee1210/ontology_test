"""
FatSecret Image Recognition API Service
음식 이미지에서 음식명, 식재료, 영양소 정보를 추출하는 서비스
"""

import os
import ssl
import base64
import logging
import aiohttp
import certifi
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class FatSecretNutrient:
    """영양소 정보"""
    calories: float = 0.0
    carbohydrate: float = 0.0
    protein: float = 0.0
    fat: float = 0.0
    saturated_fat: float = 0.0
    polyunsaturated_fat: float = 0.0
    monounsaturated_fat: float = 0.0
    cholesterol: float = 0.0
    sodium: float = 0.0
    potassium: float = 0.0
    fiber: float = 0.0
    sugar: float = 0.0
    vitamin_a: float = 0.0
    vitamin_c: float = 0.0
    calcium: float = 0.0
    iron: float = 0.0


@dataclass
class FatSecretFoodItem:
    """인식된 음식 항목"""
    food_id: int
    food_name: str
    food_entry_name: str
    food_type: Optional[str] = None
    serving_description: Optional[str] = None
    metric_serving_amount: Optional[float] = None
    metric_serving_unit: Optional[str] = None
    nutrients: Optional[FatSecretNutrient] = None
    confidence: float = 0.0


class FatSecretService:
    """FatSecret API 서비스 클래스"""

    # API Endpoints
    TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
    IMAGE_RECOGNITION_URL = "https://platform.fatsecret.com/rest/image-recognition/v2"

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ):
        """
        FatSecret 서비스 초기화

        Args:
            client_id: FatSecret API Client ID (환경변수 FATSECRET_CLIENT_ID로도 설정 가능)
            client_secret: FatSecret API Client Secret (환경변수 FATSECRET_CLIENT_SECRET로도 설정 가능)
        """
        self.client_id = client_id or os.getenv("FATSECRET_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("FATSECRET_CLIENT_SECRET")

        if not self.client_id or not self.client_secret:
            logger.warning("FatSecret API credentials not configured")

        # Token caching
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    async def _get_access_token(self) -> str:
        """
        OAuth 2.0 액세스 토큰 획득 (캐싱 적용)

        Returns:
            str: 액세스 토큰
        """
        # 캐시된 토큰이 유효한지 확인
        if self._access_token and self._token_expires_at:
            if datetime.now() < self._token_expires_at - timedelta(minutes=5):
                return self._access_token

        if not self.client_id or not self.client_secret:
            raise ValueError("FatSecret API credentials not configured")

        # SSL 컨텍스트 설정 (certifi 인증서 사용)
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
            auth = aiohttp.BasicAuth(self.client_id, self.client_secret)
            data = {
                "grant_type": "client_credentials",
                "scope": "basic"  # Basic scope for standard API access
            }

            async with session.post(
                self.TOKEN_URL,
                auth=auth,
                data=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Token request failed: {response.status} - {error_text}")
                    raise Exception(f"Failed to get access token: {error_text}")

                token_data = await response.json()
                self._access_token = token_data["access_token"]
                expires_in = token_data.get("expires_in", 86400)  # Default 24 hours
                self._token_expires_at = datetime.now() + timedelta(seconds=expires_in)

                logger.info(f"FatSecret access token acquired, expires in {expires_in}s")
                return self._access_token

    async def recognize_food_image(
        self,
        image_data: str,
        include_food_data: bool = True,
        region: Optional[str] = None,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        음식 이미지 인식 API 호출

        Args:
            image_data: Base64 인코딩된 이미지 데이터 (data:image/... 접두사 제거된 순수 base64)
            include_food_data: 상세 음식 정보 포함 여부
            region: 지역 필터 (예: "US", "KR")
            language: 응답 언어

        Returns:
            Dict[str, Any]: API 응답 데이터
        """
        try:
            access_token = await self._get_access_token()

            # Base64 데이터 정리 (data:image/... 접두사 제거)
            if "," in image_data:
                image_data = image_data.split(",")[1]

            # 이미지 크기 검증 (최대 999,982 characters)
            if len(image_data) > 999982:
                raise ValueError("Image data exceeds maximum size (999,982 characters)")

            # 요청 본문 구성
            request_body = {
                "image_b64": image_data,
                "include_food_data": include_food_data
            }

            if region:
                request_body["region"] = region
            if language:
                request_body["language"] = language

            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # SSL 컨텍스트 설정 (certifi 인증서 사용)
            ssl_context = ssl.create_default_context(cafile=certifi.where())

            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
                async with session.post(
                    self.IMAGE_RECOGNITION_URL,
                    headers=headers,
                    json=request_body,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_data = await response.json()

                    if response.status != 200:
                        error_code = response_data.get("error", {}).get("code")
                        error_message = response_data.get("error", {}).get("message", "Unknown error")

                        if error_code == 211:
                            # No food detected
                            logger.warning("No food item detected in image")
                            return {
                                "success": False,
                                "error_code": 211,
                                "error": "음식이 감지되지 않았습니다. 다른 이미지를 시도해주세요.",
                                "foods": []
                            }

                        logger.error(f"Image recognition failed: {error_code} - {error_message}")
                        return {
                            "success": False,
                            "error_code": error_code,
                            "error": error_message,
                            "foods": []
                        }

                    # 성공 응답 파싱
                    parsed_result = self._parse_recognition_response(response_data)
                    parsed_result["success"] = True
                    parsed_result["raw_response"] = response_data

                    logger.info(f"Food recognition successful: {len(parsed_result['foods'])} items detected")
                    return parsed_result

        except aiohttp.ClientError as e:
            logger.error(f"HTTP request failed: {e}")
            return {
                "success": False,
                "error": f"네트워크 오류: {str(e)}",
                "foods": []
            }
        except Exception as e:
            logger.error(f"Food recognition error: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "foods": []
            }

    def _parse_recognition_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        API 응답 파싱

        Args:
            response: FatSecret API 응답

        Returns:
            파싱된 결과
        """
        foods = []
        food_responses = response.get("food_response", [])

        if not isinstance(food_responses, list):
            food_responses = [food_responses] if food_responses else []

        for item in food_responses:
            food_item = self._parse_food_item(item)
            if food_item:
                foods.append(food_item)

        # 전체 영양소 합계 계산
        total_nutrients = self._calculate_total_nutrients(foods)

        return {
            "foods": foods,
            "total_nutrients": total_nutrients,
            "food_count": len(foods)
        }

    def _parse_food_item(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        개별 음식 항목 파싱

        Args:
            item: 음식 항목 데이터

        Returns:
            파싱된 음식 정보
        """
        try:
            food_id = item.get("food_id", 0)
            food_entry_name = item.get("food_entry_name", "")

            # eaten 객체에서 상세 정보 추출
            eaten = item.get("eaten", {})
            food_name = eaten.get("food_name_singular") or eaten.get("food_name_plural") or food_entry_name

            # 영양소 정보
            nutritional_content = eaten.get("total_nutritional_content", {})
            nutrients = {
                "calories": float(nutritional_content.get("calories", 0) or 0),
                "carbohydrate": float(nutritional_content.get("carbohydrate", 0) or 0),
                "protein": float(nutritional_content.get("protein", 0) or 0),
                "fat": float(nutritional_content.get("fat", 0) or 0),
                "saturated_fat": float(nutritional_content.get("saturated_fat", 0) or 0),
                "polyunsaturated_fat": float(nutritional_content.get("polyunsaturated_fat", 0) or 0),
                "monounsaturated_fat": float(nutritional_content.get("monounsaturated_fat", 0) or 0),
                "cholesterol": float(nutritional_content.get("cholesterol", 0) or 0),
                "sodium": float(nutritional_content.get("sodium", 0) or 0),
                "potassium": float(nutritional_content.get("potassium", 0) or 0),
                "fiber": float(nutritional_content.get("fiber", 0) or 0),
                "sugar": float(nutritional_content.get("sugar", 0) or 0),
                "vitamin_a": float(nutritional_content.get("vitamin_a", 0) or 0),
                "vitamin_c": float(nutritional_content.get("vitamin_c", 0) or 0),
                "calcium": float(nutritional_content.get("calcium", 0) or 0),
                "iron": float(nutritional_content.get("iron", 0) or 0),
            }

            # 서빙 정보
            suggested_serving = item.get("suggested_serving", {})
            serving_description = suggested_serving.get("serving_description", "")
            metric_serving_amount = suggested_serving.get("metric_measure_amount")
            metric_serving_unit = suggested_serving.get("metric_serving_description", "")

            # 수량 정보
            units = eaten.get("units", 1)
            total_metric_amount = eaten.get("total_metric_amount")
            metric_description = eaten.get("metric_description", "g")

            # food 객체에서 추가 정보
            food_data = item.get("food", {})
            food_type = food_data.get("food_type", "")

            return {
                "food_id": food_id,
                "food_name": food_name,
                "food_entry_name": food_entry_name,
                "food_type": food_type,
                "serving_description": serving_description,
                "metric_serving_amount": metric_serving_amount,
                "metric_serving_unit": metric_serving_unit,
                "units": units,
                "total_metric_amount": total_metric_amount,
                "metric_description": metric_description,
                "nutrients": nutrients
            }

        except Exception as e:
            logger.error(f"Failed to parse food item: {e}")
            return None

    def _calculate_total_nutrients(self, foods: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        전체 음식의 영양소 합계 계산

        Args:
            foods: 음식 목록

        Returns:
            영양소 합계
        """
        total = {
            "calories": 0.0,
            "carbohydrate": 0.0,
            "protein": 0.0,
            "fat": 0.0,
            "saturated_fat": 0.0,
            "cholesterol": 0.0,
            "sodium": 0.0,
            "potassium": 0.0,
            "fiber": 0.0,
            "sugar": 0.0,
            "calcium": 0.0,
            "iron": 0.0,
        }

        for food in foods:
            nutrients = food.get("nutrients", {})
            for key in total:
                total[key] += nutrients.get(key, 0)

        # 소수점 2자리로 반올림
        return {k: round(v, 2) for k, v in total.items()}

    def convert_to_ckd_format(self, recognition_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        FatSecret 결과를 CKD 영양 분석 포맷으로 변환

        Args:
            recognition_result: FatSecret 인식 결과

        Returns:
            CKD 영양 분석 포맷 데이터
        """
        if not recognition_result.get("success") or not recognition_result.get("foods"):
            return {
                "success": False,
                "error": recognition_result.get("error", "인식된 음식이 없습니다."),
                "dish_name": None,
                "ingredients": [],
                "nutrients": None
            }

        foods = recognition_result["foods"]
        total_nutrients = recognition_result.get("total_nutrients", {})

        # 대표 음식명 (첫 번째 항목 또는 여러 항목 조합)
        if len(foods) == 1:
            dish_name = foods[0].get("food_name", "알 수 없는 음식")
        else:
            dish_name = ", ".join([f.get("food_name", "") for f in foods[:3]])
            if len(foods) > 3:
                dish_name += f" 외 {len(foods) - 3}개"

        # 식재료 목록
        ingredients = [
            {
                "name": f.get("food_name", ""),
                "amount": f.get("total_metric_amount"),
                "unit": f.get("metric_description", "g"),
                "nutrients": f.get("nutrients", {})
            }
            for f in foods
        ]

        # CKD 환자용 영양소 포맷 (나트륨, 칼륨, 인, 단백질 중심)
        ckd_nutrients = {
            "sodium": total_nutrients.get("sodium", 0),      # mg
            "potassium": total_nutrients.get("potassium", 0), # mg
            "phosphorus": 0,  # FatSecret API에서 제공하지 않음 - 추정 필요
            "protein": total_nutrients.get("protein", 0),     # g
            "calories": total_nutrients.get("calories", 0),
            "carbohydrate": total_nutrients.get("carbohydrate", 0),
            "fat": total_nutrients.get("fat", 0),
            "calcium": total_nutrients.get("calcium", 0),
            "fiber": total_nutrients.get("fiber", 0),
        }

        # 인(phosphorus) 추정 (단백질 기반 - 일반적으로 단백질 1g당 약 13-15mg의 인 함유)
        ckd_nutrients["phosphorus"] = round(ckd_nutrients["protein"] * 14, 2)

        return {
            "success": True,
            "dish_name": dish_name,
            "ingredients": ingredients,
            "nutrients": ckd_nutrients,
            "food_count": len(foods),
            "confidence": 0.85 if len(foods) > 0 else 0.0  # FatSecret은 confidence 미제공, 기본값 사용
        }


# 싱글톤 인스턴스
_fatsecret_service: Optional[FatSecretService] = None


def get_fatsecret_service() -> FatSecretService:
    """FatSecret 서비스 싱글톤 인스턴스 반환"""
    global _fatsecret_service
    if _fatsecret_service is None:
        _fatsecret_service = FatSecretService()
    return _fatsecret_service


async def recognize_food_with_openai(image_data: str) -> Dict[str, Any]:
    """
    OpenAI Vision API를 사용한 음식 인식 (FatSecret 대체)

    Args:
        image_data: Base64 인코딩된 이미지 데이터

    Returns:
        CKD 포맷의 인식 결과
    """
    import openai
    import json

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        return {
            "success": False,
            "error": "OpenAI API key not configured",
            "dish_name": None,
            "ingredients": [],
            "nutrients": None
        }

    client = openai.OpenAI(api_key=openai_api_key)

    try:
        # 이미지 데이터 형식 정리
        if "," in image_data:
            image_data = image_data.split(",")[1]

        prompt = """이 음식 이미지를 분석하고 다음 JSON 형식으로 응답해주세요:
{
    "dish_name": "음식 이름 (한국어)",
    "ingredients": [
        {"name": "재료명", "amount": 예상량(숫자), "unit": "g"}
    ],
    "nutrients": {
        "calories": 예상 칼로리(숫자),
        "protein": 단백질(g),
        "fat": 지방(g),
        "carbohydrate": 탄수화물(g),
        "sodium": 나트륨(mg),
        "potassium": 칼륨(mg),
        "phosphorus": 인(mg),
        "calcium": 칼슘(mg),
        "fiber": 식이섬유(g)
    },
    "confidence": 0.0-1.0 사이의 신뢰도
}

CKD(만성콩팥병) 환자를 위한 영양 분석이므로 나트륨, 칼륨, 인 수치를 정확하게 추정해주세요.
반드시 유효한 JSON만 응답하세요."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}",
                                "detail": "low"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000
        )

        response_text = response.choices[0].message.content.strip()

        # JSON 파싱
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        result = json.loads(response_text)

        return {
            "success": True,
            "dish_name": result.get("dish_name", "알 수 없는 음식"),
            "ingredients": result.get("ingredients", []),
            "nutrients": result.get("nutrients", {}),
            "food_count": len(result.get("ingredients", [])) or 1,
            "confidence": result.get("confidence", 0.8)
        }

    except json.JSONDecodeError as e:
        logger.error(f"OpenAI response JSON parse error: {e}")
        return {
            "success": False,
            "error": "음식 정보 파싱 실패",
            "dish_name": None,
            "ingredients": [],
            "nutrients": None
        }
    except Exception as e:
        logger.error(f"OpenAI Vision API error: {e}")
        return {
            "success": False,
            "error": str(e),
            "dish_name": None,
            "ingredients": [],
            "nutrients": None
        }


async def recognize_food_from_image(
    image_data: str,
    include_food_data: bool = True
) -> Dict[str, Any]:
    """
    음식 이미지 인식 헬퍼 함수

    FatSecret API를 먼저 시도하고, 실패하면 OpenAI Vision API를 사용

    Args:
        image_data: Base64 인코딩된 이미지 데이터
        include_food_data: 상세 음식 정보 포함 여부

    Returns:
        CKD 포맷으로 변환된 인식 결과
    """
    # FatSecret 시도
    service = get_fatsecret_service()
    result = await service.recognize_food_image(image_data, include_food_data)
    ckd_result = service.convert_to_ckd_format(result)

    # FatSecret이 음식을 인식했으면 반환
    if ckd_result.get("success") and ckd_result.get("dish_name"):
        logger.info(f"FatSecret recognized: {ckd_result.get('dish_name')}")
        return ckd_result

    # FatSecret 실패 시 OpenAI Vision으로 대체
    logger.info("FatSecret failed or no food detected, trying OpenAI Vision...")
    openai_result = await recognize_food_with_openai(image_data)

    if openai_result.get("success"):
        logger.info(f"OpenAI recognized: {openai_result.get('dish_name')}")

    return openai_result


async def recognize_food_from_file(
    file_path: str,
    include_food_data: bool = True
) -> Dict[str, Any]:
    """
    파일 경로에서 음식 이미지 인식

    Args:
        file_path: 이미지 파일 경로
        include_food_data: 상세 음식 정보 포함 여부

    Returns:
        CKD 포맷으로 변환된 인식 결과
    """
    try:
        with open(file_path, "rb") as f:
            image_bytes = f.read()

        image_data = base64.b64encode(image_bytes).decode("utf-8")
        return await recognize_food_from_image(image_data, include_food_data)

    except FileNotFoundError:
        return {
            "success": False,
            "error": f"파일을 찾을 수 없습니다: {file_path}",
            "dish_name": None,
            "ingredients": [],
            "nutrients": None
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "dish_name": None,
            "ingredients": [],
            "nutrients": None
        }
