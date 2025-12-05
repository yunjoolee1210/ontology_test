"""
Nutrition Agent Implementation
영양 관리 기능 구현 - CKD 환자를 위한 식단 분석 (5가지 이미지 케이스 완벽 지원)
"""

import os
import logging
import json
from typing import Dict, Any, Optional, List
from openai import AsyncOpenAI
from ..base_agent import BaseAgent
from .prompts import (
    NUTRITION_SYSTEM_PROMPT,
    IMAGE_CLASSIFICATION_PROMPT,
    INGREDIENT_TO_DISH_PROMPT,
    MULTIPLE_INGREDIENTS_ANALYSIS_PROMPT,
    MULTIPLE_INGREDIENTS_TO_DISH_PROMPT,
    ALTERNATIVE_INGREDIENT_PROMPT,
    get_profile_instructions
)

# Lazy import RAG (only if needed)
try:
    from rag.nutrition_rag import NutritionRAG
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False

# MongoDB nutrition lookup
try:
    from tools.mongodb_nutrition_lookup import get_nutrition_lookup
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False

# Recipe generator
try:
    from tools.recipe_generator import get_recipe_generator
    RECIPE_GENERATOR_AVAILABLE = True
except ImportError:
    RECIPE_GENERATOR_AVAILABLE = False

# Recipe handler
try:
    from Agent.nutrition.recipe_handler import RecipeHandler
    RECIPE_HANDLER_AVAILABLE = True
except ImportError:
    RECIPE_HANDLER_AVAILABLE = False

# FatSecret food image recognition
try:
    from app.services.fatsecret_service import get_fatsecret_service, recognize_food_from_image
    FATSECRET_AVAILABLE = True
except ImportError:
    FATSECRET_AVAILABLE = False

logger = logging.getLogger(__name__)

# ============================================================
# CKD 환자용 1끼 영양소 제한량 (1일 제한량 ÷ 3)
# ============================================================
# 1일 제한량: 나트륨 2000mg, 칼륨 2000mg, 인 800mg, 단백질 50g, 칼슘 1000mg
PER_MEAL_LIMITS = {
    "sodium": 667,       # 나트륨: 2000 ÷ 3 ≈ 667mg
    "potassium": 667,    # 칼륨: 2000 ÷ 3 ≈ 667mg
    "phosphorus": 267,   # 인: 800 ÷ 3 ≈ 267mg
    "protein": 17,       # 단백질: 50 ÷ 3 ≈ 17g
    "calcium": 333,      # 칼슘: 1000 ÷ 3 ≈ 333mg
    "calories": 700,     # 칼로리: 2100 ÷ 3 = 700kcal
}

# 고염/고칼륨 음식에 대한 CKD 친화적 대체 요리 추천
CKD_ALTERNATIVE_DISHES = {
    "김치찌개": [
        {"name": "양배추 저염 간장 조림", "reason": "나트륨 80% 감소, 칼륨 50% 감소", "nutrients": {"sodium": 150, "potassium": 120, "phosphorus": 40, "protein": 3}},
        {"name": "무생채", "reason": "저염 드레싱 사용, 칼륨 배출 위해 물에 담가 조리", "nutrients": {"sodium": 80, "potassium": 100, "phosphorus": 30, "protein": 1}},
        {"name": "데친 콩나물 무침", "reason": "데치면 칼륨 40% 감소", "nutrients": {"sodium": 100, "potassium": 80, "phosphorus": 35, "protein": 4}},
    ],
    "된장찌개": [
        {"name": "양배추 저염 간장 조림", "reason": "나트륨 80% 감소", "nutrients": {"sodium": 150, "potassium": 120, "phosphorus": 40, "protein": 3}},
        {"name": "오이냉국", "reason": "저염 육수 사용", "nutrients": {"sodium": 120, "potassium": 90, "phosphorus": 25, "protein": 2}},
    ],
    "라면": [
        {"name": "저염 우동", "reason": "국물 반만 사용, 채소 추가", "nutrients": {"sodium": 400, "potassium": 150, "phosphorus": 80, "protein": 8}},
        {"name": "양배추 볶음면", "reason": "저염 소스 사용", "nutrients": {"sodium": 300, "potassium": 100, "phosphorus": 60, "protein": 6}},
    ],
    "default": [
        {"name": "양배추 저염 간장 조림", "reason": "저칼륨, 저나트륨 대표 요리", "nutrients": {"sodium": 150, "potassium": 120, "phosphorus": 40, "protein": 3}},
        {"name": "오이 무침", "reason": "저염 드레싱, 칼륨 낮음", "nutrients": {"sodium": 80, "potassium": 70, "phosphorus": 20, "protein": 1}},
        {"name": "애호박 볶음", "reason": "저칼륨 채소, 담백한 맛", "nutrients": {"sodium": 100, "potassium": 130, "phosphorus": 35, "protein": 2}},
    ]
}


class NutritionAgent(BaseAgent):
    """영양 관리 Agent - CKD 환자 맞춤형 식단 분석 (5가지 이미지 케이스 완벽 지원)"""

    def __init__(self):
        super().__init__(agent_type="nutrition")
        self.client = None
        self._client_initialized = False

        # RAG 시스템 (lazy initialization)
        self.rag = None
        self._rag_initialized = False

        # Recipe handler
        self.recipe_handler = None

        # FatSecret service (lazy initialization)
        self.fatsecret_service = None
        self._fatsecret_initialized = False

        # 멀티턴 대화 상태 저장 (session_id -> state)
        self.conversation_states = {}

    async def _ensure_client(self):
        """OpenAI 클라이언트 lazy initialization"""
        if not self._client_initialized:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("⚠️ OPENAI_API_KEY not found in environment")
                raise ValueError("OPENAI_API_KEY not configured")
            else:
                self.client = AsyncOpenAI(api_key=api_key)
                self._client_initialized = True
                logger.info("✅ OpenAI client initialized")

    def _ensure_rag(self):
        """RAG 시스템 lazy initialization"""
        if not self._rag_initialized and RAG_AVAILABLE:
            try:
                self.rag = NutritionRAG()
                self._rag_initialized = True
                logger.info("✅ NutritionRAG initialized")
            except Exception as e:
                logger.error(f"RAG initialization failed: {e}")
                self.rag = None
                self._rag_initialized = False

    def _ensure_fatsecret(self):
        """FatSecret 서비스 lazy initialization"""
        if not self._fatsecret_initialized and FATSECRET_AVAILABLE:
            try:
                self.fatsecret_service = get_fatsecret_service()
                self._fatsecret_initialized = True
                logger.info("✅ FatSecret service initialized")
            except Exception as e:
                logger.error(f"FatSecret initialization failed: {e}")
                self.fatsecret_service = None
                self._fatsecret_initialized = False

    def _get_conversation_state(self, session_id: str) -> Dict[str, Any]:
        """세션 대화 상태 가져오기"""
        if session_id not in self.conversation_states:
            self.conversation_states[session_id] = {
                "state": "initial",  # initial, awaiting_dish_selection, awaiting_ingredient_dish_selection
                "pending_candidates": None,
                "pending_dish_candidates": None,
                "last_image_data": None,
                "last_analysis_type": None
            }
        return self.conversation_states[session_id]

    def _update_conversation_state(self, session_id: str, updates: Dict[str, Any]):
        """세션 대화 상태 업데이트"""
        state = self._get_conversation_state(session_id)
        state.update(updates)
        self.conversation_states[session_id] = state

    async def process(
        self,
        user_input: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        영양 분석 처리 - 5가지 이미지 케이스 완벽 지원

        Args:
            user_input: 사용자 입력 (음식명 또는 질문)
            session_id: 세션 ID
            context: 추가 컨텍스트 (image_data 포함 가능)

        Returns:
            Dict[str, Any]: 영양 분석 결과
        """
        # Ensure clients initialized
        try:
            await self._ensure_client()
            self._ensure_rag()
            self._ensure_fatsecret()
        except ValueError as e:
            return self._error_response(str(e), session_id)

        tokens_used = self.estimate_context_usage(user_input)
        self.context_usage += tokens_used

        try:
            # 대화 상태 및 사용자 프로필 확인
            conv_state = self._get_conversation_state(session_id)
            has_image = context and context.get("has_image", False)
            image_data = context.get("image_data") if context else None
            user_profile = context.get("user_profile", "general") if context else "general"  # Extract user profile

            # 상태별 처리
            if conv_state["state"] == "awaiting_dish_selection":
                # 요리 선택 처리 (케이스 1: 단일 요리)
                result = await self._handle_dish_selection(
                    user_input, session_id, conv_state, user_profile
                )

            elif conv_state["state"] == "awaiting_ingredient_dish_selection":
                # 식재료 기반 요리 선택 처리 (케이스 2: 단일 식재료)
                result = await self._handle_ingredient_dish_selection(
                    user_input, session_id, conv_state, user_profile
                )

            elif has_image and image_data:
                # 새 이미지 업로드 → 5가지 케이스 분류 및 처리
                result = await self._handle_image_upload(
                    image_data, user_input, session_id, user_profile
                )

            else:
                # 텍스트만 있는 경우 → 레시피 요청 확인 후 처리
                result = await self._handle_text_input(
                    user_input, session_id, conv_state, user_profile
                )

            return {
                "response": result["response"],
                "type": "nutrition_analysis",
                "nutritionData": result.get("nutritionData"),
                "dishCandidates": result.get("dishCandidates"),
                "ingredientCandidates": result.get("ingredientCandidates"),
                "recommendedDishes": result.get("recommendedDishes"),
                "analysisType": result.get("analysisType"),
                "tokens_used": tokens_used,
                "status": "success",
                "agent_type": self.agent_type,
                "metadata": {
                    "session_id": session_id,
                    "has_image": has_image,
                    "conversation_state": conv_state["state"]
                }
            }

        except Exception as e:
            logger.error(f"Nutrition analysis error: {e}", exc_info=True)
            return self._error_response(str(e), session_id)

    async def _handle_image_upload(
        self,
        image_data: str,
        user_input: str,
        session_id: str,
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        이미지 업로드 처리 - FatSecret API 우선 사용, fallback으로 OpenAI Vision

        케이스 1: dish - 단일 요리 → Top-5 요리 후보
        케이스 2: ingredient_single - 단일 식재료 → 식재료명 + 추천 요리 Top-5
        케이스 3: ingredient_multiple - 복수 식재료 → 식재료 리스트 + 영양소 표 + 추천 요리 Top-5
        케이스 4: unclear - 판별 불가 → 에러 메시지
        케이스 5: irrelevant - 무관 이미지 → 에러 메시지
        """
        logger.info(f"🖼️ Image upload - analyzing with FatSecret API first")

        # Step 1: FatSecret API로 음식 인식 시도
        fatsecret_result = None
        if self.fatsecret_service and FATSECRET_AVAILABLE:
            try:
                fatsecret_result = await self._recognize_with_fatsecret(image_data)
                if fatsecret_result and fatsecret_result.get("success"):
                    logger.info(f"✅ FatSecret recognition successful: {fatsecret_result.get('dish_name')}")
                    return await self._handle_fatsecret_result(fatsecret_result, session_id)
                else:
                    logger.warning(f"⚠️ FatSecret recognition failed: {fatsecret_result.get('error', 'Unknown error')}")
            except Exception as e:
                logger.error(f"FatSecret API error: {e}", exc_info=True)

        # Step 2: FatSecret 실패 시 기존 OpenAI Vision으로 fallback
        logger.info("🔄 Falling back to OpenAI Vision classification")
        classification = await self._classify_image(image_data)
        analysis_type = classification.get("analysisType")
        logger.info(f"✅ Image classified as: {analysis_type}")

        # Step 3: 케이스별 처리
        if analysis_type == "dish":
            return await self._handle_case_dish(image_data, classification, session_id)

        elif analysis_type == "ingredient_single":
            return await self._handle_case_ingredient_single(classification, session_id)

        elif analysis_type == "ingredient_multiple":
            return await self._handle_case_ingredient_multiple(classification, session_id)

        elif analysis_type == "unclear":
            return {
                "response": "요리나 식재료로 판별하기 어려운 이미지입니다. 1개의 요리나 식재료 이미지를 업로드해주세요.",
                "nutritionData": None,
                "analysisType": "unclear"
            }

        elif analysis_type == "irrelevant":
            return {
                "response": "식이 영양 관리와 관련된 음식이나 식재료 사진을 업로드해 주세요.",
                "nutritionData": None,
                "analysisType": "irrelevant"
            }

        else:
            # 분류 실패 시 unclear로 처리
            return {
                "response": "이미지 분석에 실패했습니다. 다시 시도해주세요.",
                "nutritionData": None,
                "analysisType": "error"
            }

    async def _recognize_with_fatsecret(self, image_data: str) -> Dict[str, Any]:
        """
        FatSecret API를 사용한 음식 이미지 인식

        Args:
            image_data: Base64 인코딩된 이미지 데이터

        Returns:
            CKD 포맷으로 변환된 인식 결과
        """
        result = await self.fatsecret_service.recognize_food_image(
            image_data,
            include_food_data=True
        )
        return self.fatsecret_service.convert_to_ckd_format(result)

    async def _handle_fatsecret_result(
        self,
        fatsecret_result: Dict[str, Any],
        session_id: str
    ) -> Dict[str, Any]:
        """
        FatSecret 인식 결과 처리

        Args:
            fatsecret_result: FatSecret API 인식 결과 (CKD 포맷)
            session_id: 세션 ID

        Returns:
            영양 분석 결과
        """
        dish_name = fatsecret_result.get("dish_name", "알 수 없는 음식")
        ingredients = fatsecret_result.get("ingredients", [])
        nutrients = fatsecret_result.get("nutrients", {})
        food_count = fatsecret_result.get("food_count", 1)
        confidence = fatsecret_result.get("confidence", 0.85)

        # 단일 음식 vs 복수 음식 판단
        if food_count == 1:
            # 단일 음식 - 바로 영양 분석 결과 반환
            return await self._handle_fatsecret_single_food(
                dish_name, nutrients, ingredients, confidence, session_id
            )
        else:
            # 복수 음식 - 식재료 리스트 형태로 처리
            return await self._handle_fatsecret_multiple_foods(
                dish_name, ingredients, nutrients, session_id
            )

    async def _handle_fatsecret_single_food(
        self,
        dish_name: str,
        nutrients: Dict[str, float],
        ingredients: List[Dict[str, Any]],
        confidence: float,
        session_id: str
    ) -> Dict[str, Any]:
        """
        FatSecret 단일 음식 인식 결과 처리

        Args:
            dish_name: 음식명
            nutrients: 영양소 정보
            ingredients: 재료 정보
            confidence: 인식 신뢰도
            session_id: 세션 ID

        Returns:
            영양 분석 결과
        """
        # CKD 환자용 영양 데이터 생성 (1끼 제한량 기준)
        nutrition_data = {
            "dishName": dish_name,
            "nutrients": [
                {
                    "name": "나트륨",
                    "value": nutrients.get("sodium", 0),
                    "max": PER_MEAL_LIMITS["sodium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrients.get("sodium", 0), PER_MEAL_LIMITS["sodium"])
                },
                {
                    "name": "칼륨",
                    "value": nutrients.get("potassium", 0),
                    "max": PER_MEAL_LIMITS["potassium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrients.get("potassium", 0), PER_MEAL_LIMITS["potassium"])
                },
                {
                    "name": "인",
                    "value": nutrients.get("phosphorus", 0),
                    "max": PER_MEAL_LIMITS["phosphorus"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrients.get("phosphorus", 0), PER_MEAL_LIMITS["phosphorus"])
                },
                {
                    "name": "단백질",
                    "value": nutrients.get("protein", 0),
                    "max": PER_MEAL_LIMITS["protein"],
                    "unit": "g",
                    "status": self._get_nutrient_status(nutrients.get("protein", 0), PER_MEAL_LIMITS["protein"])
                },
                {
                    "name": "칼로리",
                    "value": nutrients.get("calories", 0),
                    "max": PER_MEAL_LIMITS["calories"],
                    "unit": "kcal",
                    "status": self._get_nutrient_status(nutrients.get("calories", 0), PER_MEAL_LIMITS["calories"])
                }
            ],
            "alternatives": [],
            "source": "FatSecret API",
            "guideline": f"신장병 환자 식사 원칙: 나트륨·칼륨·인 최대한 줄이기, 단백질은 적당히!\n\n⚠️ 반드시 전문 영양사나 의료진과 상담하세요"
        }

        # 위험 영양소 확인 및 동적 응답 생성
        danger_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "danger"]
        warning_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "warning"]

        response_parts = [f"📸 **{dish_name}**(으)로 인식되었습니다. (신뢰도: {round(confidence * 100)}%)"]

        if danger_nutrients:
            nutrient_names = ", ".join([n["name"] for n in danger_nutrients])
            response_parts.append(f"\n\n⚠️ {nutrient_names} 함량이 높아 주의가 필요해요.")
        elif warning_nutrients:
            nutrient_names = ", ".join([n["name"] for n in warning_nutrients])
            response_parts.append(f"\n\n💡 {nutrient_names} 함량이 조금 높으니 양을 조절하세요.")
        else:
            response_parts.append("\n\n✅ 신장병 환자분이 드셔도 비교적 안전한 메뉴예요!")

        return {
            "response": "".join(response_parts),
            "nutritionData": nutrition_data,
            "analysisType": "dish_fatsecret",
            "fatsecretData": {
                "dish_name": dish_name,
                "confidence": confidence,
                "ingredients": ingredients,
                "raw_nutrients": nutrients
            }
        }

    async def _handle_fatsecret_multiple_foods(
        self,
        dish_name: str,
        ingredients: List[Dict[str, Any]],
        total_nutrients: Dict[str, float],
        session_id: str
    ) -> Dict[str, Any]:
        """
        FatSecret 복수 음식 인식 결과 처리 (식재료 여러 개 감지)

        Args:
            dish_name: 조합된 음식명
            ingredients: 각 음식/재료별 정보
            total_nutrients: 총 영양소 합계
            session_id: 세션 ID

        Returns:
            영양 분석 결과
        """
        # 식재료 목록 생성
        ingredient_list = [ing.get("name", "") for ing in ingredients]
        ingredients_str = ", ".join(ingredient_list[:5])
        if len(ingredient_list) > 5:
            ingredients_str += f" 외 {len(ingredient_list) - 5}개"

        # 각 식재료별 영양 정보
        ingredient_nutrients = []
        for ing in ingredients[:5]:
            ing_nutrients = ing.get("nutrients", {})
            ingredient_nutrients.append({
                "name": ing.get("name", ""),
                "amount": ing.get("amount"),
                "unit": ing.get("unit", "g"),
                "sodium": ing_nutrients.get("sodium", 0),
                "potassium": ing_nutrients.get("potassium", 0),
                "phosphorus": round(ing_nutrients.get("protein", 0) * 14, 2),  # 추정
                "protein": ing_nutrients.get("protein", 0),
                "calories": ing_nutrients.get("calories", 0)
            })

        # 총 영양소 합계로 CKD 영양 데이터 생성 (1끼 제한량 기준)
        nutrition_data = {
            "dishName": dish_name,
            "nutrients": [
                {
                    "name": "나트륨",
                    "value": total_nutrients.get("sodium", 0),
                    "max": PER_MEAL_LIMITS["sodium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(total_nutrients.get("sodium", 0), PER_MEAL_LIMITS["sodium"])
                },
                {
                    "name": "칼륨",
                    "value": total_nutrients.get("potassium", 0),
                    "max": PER_MEAL_LIMITS["potassium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(total_nutrients.get("potassium", 0), PER_MEAL_LIMITS["potassium"])
                },
                {
                    "name": "인",
                    "value": total_nutrients.get("phosphorus", 0),
                    "max": PER_MEAL_LIMITS["phosphorus"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(total_nutrients.get("phosphorus", 0), PER_MEAL_LIMITS["phosphorus"])
                },
                {
                    "name": "단백질",
                    "value": total_nutrients.get("protein", 0),
                    "max": PER_MEAL_LIMITS["protein"],
                    "unit": "g",
                    "status": self._get_nutrient_status(total_nutrients.get("protein", 0), PER_MEAL_LIMITS["protein"])
                }
            ],
            "alternatives": [],
            "ingredientDetails": ingredient_nutrients,
            "source": "FatSecret API",
            "guideline": f"인식된 음식: {ingredients_str}\n\n⚠️ 반드시 전문 영양사나 의료진과 상담하세요"
        }

        return {
            "response": f"📸 인식된 음식: **{ingredients_str}**\n\n각 음식의 영양소 정보를 확인하세요!",
            "nutritionData": nutrition_data,
            "ingredientCandidates": ingredient_nutrients,
            "analysisType": "ingredient_multiple_fatsecret"
        }

    async def _classify_image(self, image_data: str) -> Dict[str, Any]:
        """
        이미지를 5가지 케이스로 분류

        Returns:
            {
                "analysisType": "dish" | "ingredient_single" | "ingredient_multiple" | "unclear" | "irrelevant",
                "primaryItem": "주요 항목명",
                "confidence": 0.0~1.0,
                "items": ["항목1", "항목2", ...],  # ingredient_multiple일 때만
                "message": "에러 메시지"  # unclear 또는 irrelevant일 때만
            }
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": IMAGE_CLASSIFICATION_PROMPT
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500,
                temperature=0.3
            )

            content = response.choices[0].message.content
            logger.info(f"🔍 Classification response: {content[:200]}")

            # JSON 파싱
            classification = self._extract_json(content)
            return classification

        except Exception as e:
            logger.error(f"Image classification failed: {e}", exc_info=True)
            return {
                "analysisType": "unclear",
                "message": "이미지 분석 중 오류가 발생했습니다."
            }

    async def _handle_case_dish(
        self,
        image_data: str,
        classification: Dict[str, Any],
        session_id: str
    ) -> Dict[str, Any]:
        """
        케이스 1: 단일 요리 이미지 처리

        바로 영양 분석 결과 + 신장병 단계별 안전 여부 + 대체 식재료 추천까지 제공

        Returns:
            {
                "response": "영양 분석 결과",
                "nutritionData": {영양소 정보 + 대체 식재료},
                "analysisType": "dish"
            }
        """
        dish_name = classification.get("primaryItem", "분석된 요리")
        confidence = classification.get("confidence", 0.8)
        ingredients = classification.get("items", [])

        logger.info(f"🍽️ Analyzing dish: {dish_name} (confidence: {confidence})")

        # RAG로 유사 음식 검색하여 영양 정보 획득
        dish_data = {}
        if self.rag:
            search_results = self.rag.search_by_text(dish_name, top_k=1)
            if search_results:
                dish_data = search_results[0]
                logger.info(f"✅ RAG found nutrition data for: {dish_name}")

        # 영양 분석 수행 (RAG 데이터 또는 추정치 사용)
        result = await self._analyze_dish_with_rag_data(dish_name, dish_data)

        # 응답에 인식 정보 추가
        recognition_info = f"📸 **{dish_name}**(으)로 인식되었습니다. (신뢰도: {round(confidence * 100)}%)\n\n"

        return {
            "response": recognition_info + result["response"],
            "nutritionData": result.get("nutritionData"),
            "analysisType": "dish",
            "recognizedDish": dish_name,
            "recognizedIngredients": ingredients,
            "confidence": confidence
        }

    async def _handle_case_ingredient_single(
        self,
        classification: Dict[str, Any],
        session_id: str
    ) -> Dict[str, Any]:
        """
        케이스 2: 단일 식재료 이미지 처리

        Returns:
            {
                "response": "식재료 확인 메시지 + 추천 요리 안내",
                "recommendedDishes": [추천 요리 4~5개],
                "analysisType": "ingredient_single"
            }
        """
        ingredient_name = classification.get("primaryItem", "식재료")
        logger.info(f"🥬 Single ingredient detected: {ingredient_name}")

        # 식재료로 만들 수 있는 CKD 친화적 요리 추천
        recommended_dishes = await self._recommend_dishes_for_ingredient(ingredient_name)

        # 대화 상태 업데이트
        self._update_conversation_state(session_id, {
            "state": "awaiting_ingredient_dish_selection",
            "pending_dish_candidates": recommended_dishes,
            "last_analysis_type": "ingredient_single"
        })

        return {
            "response": (
                f"첨부하신 이미지는 **{ingredient_name}**(으)로 보입니다.\n\n"
                f"{ingredient_name}를 사용해 신장병 식이 관리를 위한 추천 요리를 알려드릴게요!"
            ),
            "nutritionData": None,
            "recommendedDishes": recommended_dishes,
            "analysisType": "ingredient_single"
        }

    async def _handle_case_ingredient_multiple(
        self,
        classification: Dict[str, Any],
        session_id: str
    ) -> Dict[str, Any]:
        """
        케이스 3: 복수 식재료 이미지 처리

        Returns:
            {
                "response": "인식된 식재료 리스트",
                "ingredientCandidates": [식재료별 영양소 정보],
                "recommendedDishes": [추천 요리 Top 5],
                "analysisType": "ingredient_multiple"
            }
        """
        ingredients = classification.get("items", [])[:5]  # 최대 5개
        logger.info(f"🥕 Multiple ingredients detected: {ingredients}")

        # 식재료별 영양소 분석
        ingredients_analysis = await self._analyze_multiple_ingredients(ingredients)

        # 복수 식재료로 만들 수 있는 CKD 친화적 요리 추천
        recommended_dishes = await self._recommend_dishes_for_multiple_ingredients(ingredients)

        # 대화 상태 업데이트
        self._update_conversation_state(session_id, {
            "state": "awaiting_ingredient_dish_selection",
            "pending_dish_candidates": recommended_dishes,
            "last_analysis_type": "ingredient_multiple"
        })

        ingredients_str = ", ".join(ingredients)
        return {
            "response": f"인식된 식재료: **{ingredients_str}**\n\n각 식재료의 영양소 정보와 추천 요리를 확인하세요!",
            "nutritionData": None,
            "ingredientCandidates": ingredients_analysis,
            "recommendedDishes": recommended_dishes,
            "analysisType": "ingredient_multiple"
        }

    async def _recommend_dishes_for_ingredient(self, ingredient_name: str) -> List[Dict[str, Any]]:
        """단일 식재료로 만들 수 있는 CKD 친화적 요리 추천"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": INGREDIENT_TO_DISH_PROMPT.format(ingredient_name=ingredient_name)
                    }
                ],
                max_tokens=1500,
                temperature=0.7
            )

            content = response.choices[0].message.content
            data = self._extract_json(content)
            return data.get("recommendedDishes", [])[:5]

        except Exception as e:
            logger.error(f"Recommend dishes failed: {e}", exc_info=True)
            return []

    async def _analyze_multiple_ingredients(self, ingredients: List[str]) -> List[Dict[str, Any]]:
        """복수 식재료의 영양소 분석"""
        try:
            ingredients_str = ", ".join(ingredients)
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": MULTIPLE_INGREDIENTS_ANALYSIS_PROMPT.format(ingredients_list=ingredients_str)
                    }
                ],
                max_tokens=1000,
                temperature=0.5
            )

            content = response.choices[0].message.content
            data = self._extract_json(content)
            return data.get("ingredients", [])

        except Exception as e:
            logger.error(f"Analyze multiple ingredients failed: {e}", exc_info=True)
            return []

    async def _recommend_dishes_for_multiple_ingredients(self, ingredients: List[str]) -> List[Dict[str, Any]]:
        """복수 식재료로 만들 수 있는 CKD 친화적 요리 추천"""
        try:
            ingredients_str = ", ".join(ingredients)
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": MULTIPLE_INGREDIENTS_TO_DISH_PROMPT.format(ingredients_list=ingredients_str)
                    }
                ],
                max_tokens=1500,
                temperature=0.7
            )

            content = response.choices[0].message.content
            data = self._extract_json(content)
            return data.get("recommendedDishes", [])[:5]

        except Exception as e:
            logger.error(f"Recommend dishes for multiple ingredients failed: {e}", exc_info=True)
            return []

    async def _handle_dish_selection(
        self,
        user_input: str,
        session_id: str,
        conv_state: Dict[str, Any],
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        요리 선택 처리 (케이스 1: 단일 요리)

        Returns:
            - "네" 또는 요리명 → 영양 분석 결과
        """
        user_input_clean = user_input.strip()
        user_input_lower = user_input_clean.lower()

        candidates = conv_state.get("pending_candidates", [])

        # 1. 긍정 응답 - 첫 번째 후보 선택
        if any(keyword in user_input_lower for keyword in ["네", "맞", "yes", "응", "그래", "맞아"]):
            if candidates:
                logger.info("✅ User confirmed top dish")
                selected = candidates[0]
                dish_name = selected["dish_name"]
                dish_data = selected["dish_data"]

                # 영양 분석 수행
                result = await self._analyze_dish_with_rag_data(dish_name, dish_data)

                # 상태 초기화
                self._update_conversation_state(session_id, {
                    "state": "initial",
                    "pending_candidates": None
                })

                return result

        # 2. 후보 중 선택 - 요리명 직접 입력
        for candidate in candidates:
            if candidate["dish_name"] in user_input_clean or user_input_clean in candidate["dish_name"]:
                logger.info(f"✅ User selected: {candidate['dish_name']}")
                dish_name = candidate["dish_name"]
                dish_data = candidate["dish_data"]

                # 영양 분석 수행
                result = await self._analyze_dish_with_rag_data(dish_name, dish_data)

                # 상태 초기화
                self._update_conversation_state(session_id, {
                    "state": "initial",
                    "pending_candidates": None
                })

                return result

        # 3. 부정 또는 다른 입력 - RAG 텍스트 검색
        logger.info(f"📝 User provided different dish name: {user_input_clean}")
        if self.rag:
            search_results = self.rag.search_by_text(user_input_clean, top_k=1)
            if search_results:
                dish_data = search_results[0]
                dish_name = dish_data["dish_name"]

                logger.info(f"✅ RAG text search match: {dish_name}")

                # 영양 분석
                result = await self._analyze_dish_with_rag_data(dish_name, dish_data)

                # 상태 초기화
                self._update_conversation_state(session_id, {
                    "state": "initial",
                    "pending_candidates": None
                })

                return result

        # 4. RAG 검색 실패 - OpenAI로 분석
        logger.info("Using OpenAI for unknown dish")
        result = await self._analyze_text_query(user_input_clean, user_profile)

        # 상태 초기화
        self._update_conversation_state(session_id, {
            "state": "initial",
            "pending_candidates": None
        })

        return result

    async def _handle_ingredient_dish_selection(
        self,
        user_input: str,
        session_id: str,
        conv_state: Dict[str, Any],
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        식재료 기반 요리 선택 처리 (케이스 2, 3)

        Returns:
            - 요리 선택 → 영양 분석 결과
        """
        user_input_clean = user_input.strip()
        dish_candidates = conv_state.get("pending_dish_candidates", [])

        # 후보 중 선택
        for candidate in dish_candidates:
            dish_name = candidate.get("dishName", "")
            if dish_name in user_input_clean or user_input_clean in dish_name:
                logger.info(f"✅ User selected dish: {dish_name}")

                # 영양 분석 수행 (추정 영양소 사용)
                result = await self._analyze_dish_from_recommendation(candidate)

                # 상태 초기화
                self._update_conversation_state(session_id, {
                    "state": "initial",
                    "pending_dish_candidates": None
                })

                return result

        # 선택 실패 - 직접 텍스트 분석
        logger.info(f"📝 User provided different input: {user_input_clean}")
        result = await self._analyze_text_query(user_input_clean, user_profile)

        # 상태 초기화
        self._update_conversation_state(session_id, {
            "state": "initial",
            "pending_dish_candidates": None
        })

        return result

    async def _handle_text_query(
        self,
        user_input: str,
        session_id: str,
        conv_state: Dict[str, Any],
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        텍스트 쿼리 처리

        Returns:
            영양 분석 결과 또는 RAG 검색 결과
        """
        # RAG로 검색
        if self.rag:
            search_results = self.rag.search_by_text(user_input, top_k=1)
            if search_results:
                dish_data = search_results[0]
                dish_name = dish_data["dish_name"]

                # 영양 분석
                result = await self._analyze_dish_with_rag_data(dish_name, dish_data)
                return result

        # RAG 검색 실패 → OpenAI로 분석
        logger.info("Using OpenAI for text query")
        result = await self._analyze_text_query(user_input, user_profile)
        return result

    async def _analyze_dish_with_rag_data(
        self,
        dish_name: str,
        dish_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        RAG 데이터로 영양 분석 생성 + MongoDB 영양소 조회 + 대체 재료/레시피 추천

        Args:
            dish_name: 요리명
            dish_data: RAG 검색 결과 {ingredients, recipe, nutrition}

        Returns:
            영양 분석 결과
        """
        # Step 1: MongoDB에서 영양소 정보 조회 (우선)
        mongodb_nutrition = None
        if MONGODB_AVAILABLE:
            try:
                mongo_lookup = get_nutrition_lookup()
                mongodb_nutrition = mongo_lookup.lookup_food_nutrients(dish_name)
                if mongodb_nutrition:
                    logger.info(f"✅ Found nutrition data in MongoDB for: {dish_name}")
            except Exception as e:
                logger.warning(f"MongoDB lookup failed: {e}")

        # MongoDB 데이터가 있으면 우선 사용, 없으면 RAG 데이터 사용, 둘 다 없으면 OpenAI 추정
        if mongodb_nutrition:
            nutrition = mongodb_nutrition["nutrients"]
            logger.info(f"📊 Using MongoDB nutrition data: {nutrition}")
        elif dish_data.get("nutrition"):
            nutrition = dish_data.get("nutrition", {})
            logger.info(f"📊 Using RAG nutrition data: {nutrition}")
        else:
            # OpenAI로 영양소 추정
            nutrition = await self._estimate_nutrition_with_openai(dish_name)
            logger.info(f"📊 Using OpenAI estimated nutrition data: {nutrition}")

        ingredients = dish_data.get("ingredients", [])
        recipe = dish_data.get("recipe", "")

        # Step 2: 1일 1식 제한량 초과 여부 확인
        limit_check = None
        if MONGODB_AVAILABLE and nutrition:
            try:
                mongo_lookup = get_nutrition_lookup()
                limit_check = mongo_lookup.check_daily_limits(nutrition, meal_fraction=1/3)
                logger.info(f"🔍 Limit check: {limit_check['is_safe']}, exceeded: {limit_check['exceeded_nutrients']}")
            except Exception as e:
                logger.warning(f"Limit check failed: {e}")

        # Step 3: 제한량 초과 시 대체 식재료 및 레시피 추천
        alternatives = []
        alternative_recipes = []

        if limit_check and not limit_check["is_safe"]:
            # 초과된 영양소가 있는 경우
            exceeded = limit_check["exceeded_nutrients"]
            logger.info(f"⚠️ Exceeded nutrients: {exceeded}")

            # MongoDB에서 대체 식재료 검색
            if MONGODB_AVAILABLE:
                try:
                    mongo_lookup = get_nutrition_lookup()
                    alt_ingredients = mongo_lookup.search_alternative_ingredients(
                        exceeded_nutrients=exceeded,
                        exclude_foods=[dish_name]
                    )

                    if alt_ingredients:
                        logger.info(f"✅ Found {len(alt_ingredients)} alternative ingredients from MongoDB")

                        # Pinecone RAG에서 대체 식재료를 사용한 레시피 검색
                        if self.rag:
                            for alt_ing in alt_ingredients[:3]:  # 상위 3개만
                                alt_name = alt_ing["food_name"]
                                # RAG에서 해당 식재료를 사용하는 레시피 검색
                                alt_recipes = self.rag.search_by_text(alt_name, top_k=2)

                                for recipe_result in alt_recipes:
                                    alternative_recipes.append({
                                        "dish_name": recipe_result["dish_name"],
                                        "reason": f"{', '.join(exceeded)} 함량이 낮은 {alt_name} 사용",
                                        "nutrients": recipe_result.get("nutrition", {}),
                                        "ingredients": recipe_result.get("ingredients", [])
                                    })

                        # 대체 식재료 목록
                        alternatives = [
                            {
                                "original": dish_name,
                                "replacement": alt_ing["food_name"],
                                "reason": f"{', '.join(exceeded)} 함량이 낮음",
                                "nutrients": alt_ing["nutrients"]
                            }
                            for alt_ing in alt_ingredients[:5]  # 상위 5개
                        ]

                except Exception as e:
                    logger.error(f"Alternative search failed: {e}")

        # Fallback: 기존 방식으로도 대체 재료 추천
        if not alternatives:
            high_risk_ingredients = self._find_high_risk_ingredients(nutrition, ingredients)
            alternatives = await self._recommend_alternative_ingredients(dish_name, high_risk_ingredients)

        # Nutrition data 생성 (1끼 제한량 기준)
        # 고위험 음식인 경우 CKD_ALTERNATIVE_DISHES에서 대체 요리 추가
        if not alternative_recipes:
            dish_key = dish_name if dish_name in CKD_ALTERNATIVE_DISHES else "default"
            if dish_key in CKD_ALTERNATIVE_DISHES:
                alternative_recipes = CKD_ALTERNATIVE_DISHES[dish_key]

        nutrition_data = {
            "dishName": dish_name,
            "nutrients": [
                {
                    "name": "나트륨",
                    "value": nutrition.get("sodium", 500),
                    "max": PER_MEAL_LIMITS["sodium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrition.get("sodium", 500), PER_MEAL_LIMITS["sodium"])
                },
                {
                    "name": "칼륨",
                    "value": nutrition.get("potassium", 400),
                    "max": PER_MEAL_LIMITS["potassium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrition.get("potassium", 400), PER_MEAL_LIMITS["potassium"])
                },
                {
                    "name": "인",
                    "value": nutrition.get("phosphorus", 150),
                    "max": PER_MEAL_LIMITS["phosphorus"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrition.get("phosphorus", 150), PER_MEAL_LIMITS["phosphorus"])
                },
                {
                    "name": "단백질",
                    "value": nutrition.get("protein", 10),
                    "max": PER_MEAL_LIMITS["protein"],
                    "unit": "g",
                    "status": self._get_nutrient_status(nutrition.get("protein", 10), PER_MEAL_LIMITS["protein"])
                },
                {
                    "name": "칼슘",
                    "value": nutrition.get("calcium", 70),
                    "max": PER_MEAL_LIMITS["calcium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(nutrition.get("calcium", 70), PER_MEAL_LIMITS["calcium"])
                }
            ],
            "alternatives": alternatives,
            "alternative_recipes": alternative_recipes,  # 대체 레시피 추가
            "guideline": f"신장병 환자 식사 원칙: 나트륨·칼륨·인 최대한 줄이기, 단백질은 적당히, 수분도 조심!\n\n주재료: {', '.join(ingredients[:5]) if ingredients else '정보 없음'}\n조리 팁: {recipe[:100] if recipe else '데치기나 삶기로 조리하면 칼륨이 줄어들어요'}...\n\n⚠️ 반드시 전문 영양사나 의료진과 상담하세요"
        }

        # 동적 응답 생성 - 실제 영양소 수치 포함
        response_parts = []

        # 1. 영양소 상태 확인
        danger_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "danger"]
        warning_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "warning"]
        safe_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "safe"]

        # 2. 전체 안전 상태 판정
        if danger_nutrients:
            nutrient_names = ", ".join([n["name"] for n in danger_nutrients])
            response_parts.append(f"⚠️ **{dish_name}** - {nutrient_names} 함량이 높아 주의가 필요해요.\n")
        elif warning_nutrients:
            nutrient_names = ", ".join([n["name"] for n in warning_nutrients])
            response_parts.append(f"💡 **{dish_name}** - {nutrient_names} 함량이 조금 높으니 양을 조절하세요.\n")
        else:
            response_parts.append(f"✅ **{dish_name}** - 신장병 환자분이 드셔도 비교적 안전해요!\n")

        # 3. 1끼 영양소 분석표 생성
        response_parts.append("\n📊 **1끼 영양소 분석** (1인분 기준)\n")
        response_parts.append("| 영양소 | 섭취량 | 1끼 제한 | 상태 |\n")
        response_parts.append("|--------|--------|----------|------|\n")

        status_emoji = {"safe": "✅ 안전", "warning": "⚠️ 주의", "danger": "🚫 초과"}
        for nutrient in nutrition_data["nutrients"]:
            name = nutrient["name"]
            value = nutrient["value"]
            max_val = nutrient["max"]
            unit = nutrient["unit"]
            status = status_emoji.get(nutrient["status"], "❓")
            response_parts.append(f"| {name} | {value}{unit} | {max_val}{unit} | {status} |\n")

        # 4. 초과 영양소 상세 설명
        if danger_nutrients or warning_nutrients:
            response_parts.append("\n⚠️ **주의가 필요한 영양소:**\n")
            for n in danger_nutrients + warning_nutrients:
                percent = round((n["value"] / n["max"]) * 100)
                response_parts.append(f"- **{n['name']}**: {n['value']}{n['unit']} (제한의 {percent}%)\n")

        # 5. 대체 재료 추천
        if alternatives:
            response_parts.append("\n🔄 **대체 재료 추천:**\n")
            for alt in alternatives[:3]:
                original = alt.get("original", "")
                substitute = alt.get("substitute", "")
                reason = alt.get("reason", "")
                if original and substitute:
                    response_parts.append(f"- {original} → **{substitute}** ({reason})\n")

        # 6. 대체 레시피 추천 (CKD 친화적 요리)
        if alternative_recipes:
            response_parts.append("\n🍳 **CKD 친화적 대체 요리 추천:**\n")
            for recipe_item in alternative_recipes[:3]:
                recipe_name = recipe_item.get("name", "")
                recipe_reason = recipe_item.get("reason", recipe_item.get("description", ""))
                recipe_nutrients = recipe_item.get("nutrients", {})
                if recipe_name:
                    nutrient_info = ""
                    if recipe_nutrients:
                        nutrient_info = f" (Na {recipe_nutrients.get('sodium', 0)}mg, K {recipe_nutrients.get('potassium', 0)}mg)"
                    response_parts.append(f"- **{recipe_name}**: {recipe_reason}{nutrient_info}\n")

        # 7. 조리 팁
        if recipe:
            response_parts.append(f"\n💡 **조리 팁:** {recipe[:150]}...\n")

        response_parts.append("\n⚠️ *개인 건강 상태에 따라 다를 수 있으니 담당 의료진과 상담하세요.*")

        return {
            "response": "".join(response_parts),
            "nutritionData": nutrition_data
        }

    async def _analyze_dish_from_recommendation(
        self,
        dish_recommendation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        추천 요리 데이터로 영양 분석 생성

        Args:
            dish_recommendation: {dishName, description, estimatedNutrients}

        Returns:
            영양 분석 결과
        """
        dish_name = dish_recommendation.get("dishName", "요리")
        estimated_nutrients = dish_recommendation.get("estimatedNutrients", {})

        # Nutrition data 생성 (1끼 제한량 기준)
        nutrition_data = {
            "dishName": dish_name,
            "nutrients": [
                {
                    "name": "나트륨",
                    "value": estimated_nutrients.get("sodium", 300),
                    "max": PER_MEAL_LIMITS["sodium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(estimated_nutrients.get("sodium", 300), PER_MEAL_LIMITS["sodium"])
                },
                {
                    "name": "칼륨",
                    "value": estimated_nutrients.get("potassium", 300),
                    "max": PER_MEAL_LIMITS["potassium"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(estimated_nutrients.get("potassium", 300), PER_MEAL_LIMITS["potassium"])
                },
                {
                    "name": "인",
                    "value": estimated_nutrients.get("phosphorus", 100),
                    "max": PER_MEAL_LIMITS["phosphorus"],
                    "unit": "mg",
                    "status": self._get_nutrient_status(estimated_nutrients.get("phosphorus", 100), PER_MEAL_LIMITS["phosphorus"])
                },
                {
                    "name": "단백질",
                    "value": estimated_nutrients.get("protein", 8),
                    "max": PER_MEAL_LIMITS["protein"],
                    "unit": "g",
                    "status": self._get_nutrient_status(estimated_nutrients.get("protein", 8), PER_MEAL_LIMITS["protein"])
                }
            ],
            "alternatives": [],
            "guideline": f"{dish_name} - {dish_recommendation.get('description', '')}\n\n⚠️ 영양사 또는 의료진과 상담 권장"
        }

        # 동적 응답 생성
        response_parts = []

        # 위험 영양소 확인
        danger_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "danger"]
        warning_nutrients = [n for n in nutrition_data["nutrients"] if n["status"] == "warning"]

        if danger_nutrients:
            nutrient_names = ", ".join([n["name"] for n in danger_nutrients])
            response_parts.append(f"⚠️ {dish_name}는 {nutrient_names} 함량이 높아 주의가 필요해요.")
        elif warning_nutrients:
            nutrient_names = ", ".join([n["name"] for n in warning_nutrients])
            response_parts.append(f"💡 {dish_name}는 {nutrient_names} 함량이 조금 높으니 양을 줄이세요.")
        else:
            response_parts.append(f"✅ {dish_name}는 신장병 환자분이 드셔도 비교적 안전한 메뉴예요!")

        return {
            "response": " ".join(response_parts),
            "nutritionData": nutrition_data
        }

    def _find_high_risk_ingredients(self, nutrition: Dict[str, Any], ingredients: List[str]) -> List[str]:
        """CKD 제한 영양소를 초과하는 재료 찾기"""
        high_risk = []

        # 나트륨 > 667mg (1끼 기준)
        if nutrition.get("sodium", 0) > 667:
            high_risk.append("고염 조미료 (간장, 된장, 고추장)")

        # 칼륨 > 667mg
        if nutrition.get("potassium", 0) > 667:
            high_risk.append("고칼륨 야채 또는 과일")

        # 인 > 267mg
        if nutrition.get("phosphorus", 0) > 267:
            high_risk.append("고인 식품 (유제품, 견과류)")

        return high_risk

    async def _recommend_alternative_ingredients(
        self,
        dish_name: str,
        high_risk_ingredients: List[str]
    ) -> List[Dict[str, Any]]:
        """
        대체 재료 추천 (간장 반복 방지, 웹 검색 활용)

        Returns:
            [
                {
                    "name": "대체 버전명",
                    "description": "설명",
                    "nutrients": {sodium, potassium, phosphorus, protein}
                },
                ...
            ]
        """
        if not high_risk_ingredients:
            return []

        try:
            high_risk_str = ", ".join(high_risk_ingredients)
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": ALTERNATIVE_INGREDIENT_PROMPT.format(
                            dish_name=dish_name,
                            high_risk_ingredients=high_risk_str
                        )
                    }
                ],
                max_tokens=1500,
                temperature=0.7
            )

            content = response.choices[0].message.content
            data = self._extract_json(content)

            # alternatives 배열을 프론트엔드 형식으로 변환
            alternatives = []
            for alt in data.get("alternatives", []):
                for replacement in alt.get("replacements", [])[:2]:  # 최대 2개씩
                    alternatives.append({
                        "name": replacement.get("name", ""),
                        "description": replacement.get("reason", ""),
                        "nutrients": replacement.get("nutrients", {})
                    })

            # 간장 필터링 (절대 포함 금지)
            alternatives = [
                alt for alt in alternatives
                if not any(keyword in alt["name"].lower() for keyword in ["간장", "된장", "고추장", "soy sauce"])
            ]

            logger.info(f"✅ Recommended {len(alternatives)} alternatives (soy sauce filtered)")
            return alternatives[:3]  # 최대 3개

        except Exception as e:
            logger.error(f"Recommend alternative ingredients failed: {e}", exc_info=True)
            return []

    def _get_nutrient_status(self, value: float, max_value: float) -> str:
        """영양소 상태 판정 (safe/warning/danger)"""
        ratio = value / max_value
        if ratio < 0.7:
            return "safe"
        elif ratio < 1.0:
            return "warning"
        else:
            return "danger"

    async def _estimate_nutrition_with_openai(self, dish_name: str) -> Dict[str, float]:
        """
        OpenAI로 음식 영양소 추정 (1인분 기준, CKD 환자용)

        Args:
            dish_name: 음식명

        Returns:
            Dict: {sodium, potassium, phosphorus, protein, calcium, calories}
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """당신은 영양학 전문가입니다. 한국 음식의 1인분 기준 영양소 함량을 추정해주세요.
신장병(CKD) 환자에게 중요한 영양소를 정확히 추정해야 합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{"sodium": 숫자, "potassium": 숫자, "phosphorus": 숫자, "protein": 숫자, "calcium": 숫자, "calories": 숫자}

- sodium: 나트륨 (mg)
- potassium: 칼륨 (mg)
- phosphorus: 인 (mg)
- protein: 단백질 (g)
- calcium: 칼슘 (mg)
- calories: 칼로리 (kcal)"""
                    },
                    {
                        "role": "user",
                        "content": f"'{dish_name}' 1인분의 영양소 함량을 추정해주세요."
                    }
                ],
                max_tokens=200,
                temperature=0.3
            )

            content = response.choices[0].message.content
            nutrition = self._extract_json(content)

            # 기본값 설정 (추정 실패 시)
            default_nutrition = {
                "sodium": 800,
                "potassium": 600,
                "phosphorus": 250,
                "protein": 20,
                "calcium": 50,
                "calories": 400
            }

            # 유효한 값만 사용, 나머지는 기본값
            for key in default_nutrition:
                if key not in nutrition or not isinstance(nutrition.get(key), (int, float)):
                    nutrition[key] = default_nutrition[key]

            logger.info(f"✅ OpenAI estimated nutrition for {dish_name}: {nutrition}")
            return nutrition

        except Exception as e:
            logger.error(f"OpenAI nutrition estimation failed: {e}")
            # 기본 추정값 반환 (한국 음식 평균)
            return {
                "sodium": 1200,
                "potassium": 800,
                "phosphorus": 300,
                "protein": 25,
                "calcium": 60,
                "calories": 450
            }

    # 저칼륨 채소 데이터 (100g 기준 칼륨 함량, mg)
    # Unsplash CDN 이미지 사용 - 고품질 통일 배경
    LOW_POTASSIUM_VEGETABLES = [
        {"id": "cabbage", "name": "양배추", "thumbnail": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=200&h=160&fit=crop&crop=center", "potassium": 170, "description": "쌈, 샐러드, 볶음 등 다양하게 활용"},
        {"id": "cucumber", "name": "오이", "thumbnail": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=200&h=160&fit=crop&crop=center", "potassium": 147, "description": "냉국, 무침, 샐러드에 좋음"},
        {"id": "eggplant", "name": "가지", "thumbnail": "https://images.unsplash.com/photo-1628773822503-930a7eaecf80?w=200&h=160&fit=crop&crop=center", "potassium": 230, "description": "볶음, 찜, 구이로 활용"},
        {"id": "lettuce", "name": "상추", "thumbnail": "https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=200&h=160&fit=crop&crop=center", "potassium": 194, "description": "쌈 채소로 최적"},
        {"id": "bellpepper", "name": "피망", "thumbnail": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=200&h=160&fit=crop&crop=center", "potassium": 175, "description": "볶음, 샐러드에 활용"},
        {"id": "iceberg", "name": "양상추", "thumbnail": "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=200&h=160&fit=crop&crop=center", "potassium": 141, "description": "샐러드, 샌드위치에 좋음"},
        {"id": "zucchini", "name": "애호박", "thumbnail": "https://images.unsplash.com/photo-1563252722-6434563a985d?w=200&h=160&fit=crop&crop=center", "potassium": 261, "description": "전, 볶음, 찌개에 활용"},
        {"id": "radish", "name": "무", "thumbnail": "https://images.unsplash.com/photo-1522184216316-3c25379f9760?w=200&h=160&fit=crop&crop=center", "potassium": 227, "description": "국, 나물, 깍두기로 활용"},
        {"id": "beansprout", "name": "콩나물", "thumbnail": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&h=160&fit=crop&crop=center", "potassium": 169, "description": "무침, 국에 좋음"},
        {"id": "onion", "name": "양파", "thumbnail": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=200&h=160&fit=crop&crop=center", "potassium": 146, "description": "볶음, 조림에 기본 재료"},
    ]

    def _is_low_potassium_ingredient_query(self, user_input: str) -> bool:
        """저칼륨 식재료 요청인지 확인"""
        keywords = [
            "저칼륨 음식 재료", "저칼륨 식재료", "저칼륨 재료",
            "칼륨 낮은 재료", "칼륨 낮은 음식", "칼륨 낮은 식재료",
            "저칼륨 채소", "칼륨 적은 채소", "칼륨 적은 재료",
            "저칼륨 야채", "칼륨 낮은 야채", "저칼륨 대체 식재료"
        ]
        return any(keyword in user_input for keyword in keywords)

    def _get_low_potassium_ingredients(self) -> Dict[str, Any]:
        """저칼륨 식재료 캐러셀 데이터 반환"""
        logger.info("🥬 Building low-potassium ingredient carousel data")
        ingredients = []
        for veg in self.LOW_POTASSIUM_VEGETABLES:
            ingredients.append({
                "id": veg["id"],
                "name": veg["name"],
                "thumbnail": veg["thumbnail"],
                "potassium": veg["potassium"],
                "category": "vegetable",
                "description": veg["description"]
            })

        return {
            "response": "신장병 환자분들께 적합한 **저칼륨 채소**를 소개해 드릴게요!\n\n아래 식재료들은 100g 기준 칼륨 함량이 낮아 CKD 식단에 안전하게 활용할 수 있어요.\n\n**식재료를 선택하시면 해당 재료를 활용한 레시피를 추천해 드립니다.**",
            "ingredientCarouselData": ingredients,
            "analysisType": "ingredient_carousel"
        }

    def _is_kimjang_recipe_query(self, user_input: str) -> bool:
        """신장병 환자 김장 레시피 요청인지 확인"""
        keywords = ["김장", "김치 담그", "김치 레시피", "배추김치"]
        kidney_keywords = ["신장", "콩팥", "투석", "CKD", "저염", "저칼륨"]
        has_kimchi = any(k in user_input for k in keywords)
        has_kidney = any(k in user_input for k in kidney_keywords)
        return has_kimchi and has_kidney

    def _get_kidney_friendly_kimjang_recipe(self) -> Dict[str, Any]:
        """신장병 환자를 위한 저염/저칼륨 김장 레시피 반환"""
        logger.info("🥬 Returning kidney-friendly kimjang recipe")

        recipe_response = """## 신장병 환자를 위한 저염 물김치 레시피

신장병 환자분들도 김장 김치를 즐기실 수 있어요! 나트륨과 칼륨을 낮춘 **저염 물김치** 레시피를 소개합니다.

### 재료 (4인분 기준)

**주재료**
- 알배기 배추 1개 (소금물에 살짝만 절이기)
- 무 1/4개 (얇게 채썰기)
- 당근 1개 (채썰기)
- 쪽파 100g

**양념 재료**
- 물 2.5L
- 저염 소금 2티스푼 (일반 소금의 1/3)
- 고춧가루 2스푼
- 다진 마늘 2스푼
- 생강 반 개
- 설탕 3스푼
- 다시마 약간

### 만드는 방법

**1단계: 채소 준비**
- 배추는 깨끗이 씻어 한입 크기로 자릅니다
- 무와 당근은 얇게 채썰어 준비합니다
- **TIP**: 칼륨을 낮추려면 채소를 물에 2시간 담가두세요

**2단계: 양념물 만들기**
- 생강, 고춧가루, 다진 마늘을 물 500ml와 함께 믹서기에 갈아줍니다
- 체로 걸러 고춧물을 만들고 설탕을 섞습니다

**3단계: 다시물 준비**
- 물 2L에 다시마를 넣고 끓여 식힙니다
- 저염 소금 2티스푼으로 간을 맞춥니다

**4단계: 완성**
- 준비한 채소를 용기에 담습니다
- 다시물과 고춧물을 부어줍니다
- 냉장고에서 2-3일 숙성 후 드세요

### 영양 정보 (1인분 기준)
| 영양소 | 함량 | 일반 김치 대비 |
|--------|------|---------------|
| 나트륨 | 약 300mg | **70% 감소** |
| 칼륨 | 약 150mg | **50% 감소** |
| 칼로리 | 약 25kcal | - |

### 주의사항
- 저염 제품이므로 **반드시 냉장 보관**하세요
- 일주일 내로 드시는 것을 권장합니다
- 개인의 투석 상태에 따라 섭취량을 조절하세요

### 참고 자료
- [식품의약품안전처 저염 레시피](https://www.foodnuri.go.kr)
- [신장병 환자 김장 영상](https://youtube.com/shorts/s2_oWGoECEE)

---
*이 레시피는 일반적인 가이드라인입니다. 개인 상태에 따라 담당 의료진과 상담 후 드세요.*"""

        return {
            "response": recipe_response,
            "analysisType": "recipe",
            "recipeData": {
                "name": "저염 물김치",
                "category": "김치",
                "tags": ["저염", "저칼륨", "신장병", "CKD"],
                "sodium_per_serving": 300,
                "potassium_per_serving": 150,
                "calories_per_serving": 25
            }
        }

    async def _handle_text_input(
        self,
        user_input: str,
        session_id: str,
        conv_state: Dict[str, Any],
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        텍스트 입력 처리 - 레시피 요청 vs 저칼륨 식재료 vs 일반 질문 구분

        Args:
            user_input: 사용자 입력
            session_id: 세션 ID
            conv_state: 대화 상태
            user_profile: 사용자 프로필

        Returns:
            처리 결과
        """
        # 1. 신장병 환자 김장 레시피 요청 확인
        if self._is_kimjang_recipe_query(user_input):
            logger.info("🥬 Detected kidney-friendly kimjang recipe request")
            return self._get_kidney_friendly_kimjang_recipe()

        # 2. 저칼륨 식재료 요청 확인
        if self._is_low_potassium_ingredient_query(user_input):
            logger.info("🥬 Detected low-potassium ingredient request - returning carousel data")
            return self._get_low_potassium_ingredients()

        # 3. 레시피 요청 확인
        recipe_keywords = ["레시피", "만들기", "만드는법", "만드는 법", "요리법", "조리법"]
        is_recipe_request = any(keyword in user_input for keyword in recipe_keywords)

        if is_recipe_request and RECIPE_HANDLER_AVAILABLE:
            logger.info("🍽️  Detected recipe request - routing to recipe handler")

            # RecipeHandler 초기화 (lazy)
            if self.recipe_handler is None:
                self.recipe_handler = RecipeHandler(self.client, self.rag)

            # 레시피 요청 처리
            result = await self.recipe_handler.handle_recipe_request(
                user_input, session_id, conv_state, user_profile
            )

            if result:
                return result

            # RecipeHandler 실패 시 일반 텍스트 쿼리로 fallback
            logger.warning("Recipe handler failed - falling back to text query")

        # 3. 일반 텍스트 쿼리 처리
        return await self._analyze_text_query(user_input, user_profile)

    async def _handle_text_query(
        self,
        user_input: str,
        session_id: str,
        conv_state: Dict[str, Any],
        user_profile: str = "general"
    ) -> Dict[str, Any]:
        """
        텍스트 쿼리 처리 (레거시 메서드 - _handle_text_input으로 대체됨)
        호환성을 위해 _analyze_text_query 호출
        """
        return await self._analyze_text_query(user_input, user_profile)

    async def _analyze_text_query(self, user_query: str, user_profile: str = "general") -> Dict[str, Any]:
        """
        텍스트 기반 영양 질문 분석

        Args:
            user_query: 사용자 질문
            user_profile: 사용자 프로필 (general, patient, researcher)

        Returns:
            분석 결과
        """
        try:
            # Build profile-specific system prompt
            profile_instructions = get_profile_instructions(user_profile)
            system_prompt = NUTRITION_SYSTEM_PROMPT.format(profile_specific_instructions=profile_instructions)

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"""CKD 환자를 위한 영양 상담: {user_query}

한국어로 자세하고 친절하게 답변해주세요."""
                    }
                ],
                max_tokens=1500,
                temperature=0.7
            )

            answer = response.choices[0].message.content
            logger.info(f"✅ Text analysis response received: {len(answer)} chars")

            return {
                "response": answer,
                "nutritionData": None
            }

        except Exception as e:
            logger.error(f"Text analysis failed: {e}", exc_info=True)
            return {
                "response": f"죄송합니다. 분석 중 오류가 발생했습니다: {str(e)}"
            }

    def _extract_json(self, content: str) -> Dict[str, Any]:
        """JSON 추출 (```json ... ``` 제거)"""
        try:
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
            else:
                json_str = content.strip()

            return json.loads(json_str)
        except Exception as e:
            logger.error(f"JSON extraction failed: {e}", exc_info=True)
            return {}

    def _error_response(self, error_msg: str, session_id: str) -> Dict[str, Any]:
        """에러 응답 생성"""
        return {
            "response": f"영양 분석 중 오류가 발생했습니다: {error_msg}",
            "type": "error",
            "nutritionData": None,
            "tokens_used": 0,
            "status": "error",
            "agent_type": self.agent_type,
            "metadata": {
                "session_id": session_id,
                "error": error_msg
            }
        }

    def estimate_context_usage(self, user_input: str) -> int:
        """
        컨텍스트 사용량 추정

        Args:
            user_input: 사용자 입력

        Returns:
            int: 예상 토큰 수
        """
        estimated_tokens = int(len(user_input) * 1.5)
        estimated_tokens += 500  # 시스템 프롬프트
        estimated_tokens += 1200  # 영양 분석 응답 (상대적으로 긴 응답)
        estimated_tokens += 500  # 이미지 분석 추가 토큰 (Vision API)

        return estimated_tokens
