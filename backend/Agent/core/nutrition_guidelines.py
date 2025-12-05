"""
Nutrition Guidelines (영양 가이드라인)

정책 5. 영양 가이드라인 테이블 (Nutrition 에이전트 필수 사용 - 하드코딩)
- CKD 단계별 영양소 권장 섭취량
- 투석 유형별 특화 가이드라인
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum


class DiseaseStage(str, Enum):
    """질환 단계"""
    CKD1 = "CKD1"
    CKD2 = "CKD2"
    CKD3 = "CKD3"
    CKD4 = "CKD4"
    CKD5 = "CKD5"
    DKD_C = "DKD-C"  # 당뇨성 신장병
    CKD_T = "CKD_T"  # 이식환자
    AKI = "AKI"      # 급성신손상
    PD = "PD"        # 복막투석
    HD = "HD"        # 혈액투석
    NONE = "None"    # 비질환자


@dataclass
class NutritionGuideline:
    """영양 가이드라인 데이터 구조"""
    name: str
    energy: str           # kcal/kg (이상체중)
    protein: str          # g/kg/일
    sodium: str           # mg/일
    potassium: str        # mg/일
    phosphorus: str       # mg/일
    carbs_sugar: str      # 탄수화물/당류
    management: str       # 관리 포인트


# 정책 5: 영양 가이드라인 테이블 (하드코딩)
NUTRITION_GUIDELINES: Dict[str, NutritionGuideline] = {
    "CKD1": NutritionGuideline(
        name="만성신장병 1단계",
        energy="25-30",
        protein="0.8-1.0",
        sodium="≤2,000",
        potassium="~2,000-3,000",
        phosphorus="일반식 수준",
        carbs_sugar="총열량의 45-60%",
        management="질환 진행 억제, 저염·저단백 식단"
    ),
    "CKD2": NutritionGuideline(
        name="만성신장병 2단계",
        energy="25-30",
        protein="0.8-1.0",
        sodium="≤2,000",
        potassium="~2,000-3,000",
        phosphorus="-",
        carbs_sugar="-",
        management="질환 진행 억제, 저염·저단백 식단"
    ),
    "CKD3": NutritionGuideline(
        name="만성신장병 3단계",
        energy="25-35",
        protein="0.6-0.8",
        sodium="≤2,000",
        potassium="2,000-3,000(혈청에 따라)",
        phosphorus="800-1,000(혈청상승 시)",
        carbs_sugar="-",
        management="질환 진행 억제, 저염·저단백 식단"
    ),
    "CKD4": NutritionGuideline(
        name="만성신장병 4단계",
        energy="25-35",
        protein="≈0.6",
        sodium="≤2,000",
        potassium="≤2,000-2,500(검사 기준)",
        phosphorus="800-1,000",
        carbs_sugar="-",
        management="저염·저단백, 저칼륨, 저인 식단"
    ),
    "CKD5": NutritionGuideline(
        name="만성신장병 5단계",
        energy="25-35",
        protein="~0.6(투석 전)",
        sodium="≤2,000",
        potassium="≤2,000(혈청기준)",
        phosphorus="800-1,000",
        carbs_sugar="-",
        management="저염·저단백, 저칼륨, 저인 식단"
    ),
    "DKD-C": NutritionGuideline(
        name="당뇨성 신장병",
        energy="25-35",
        protein="0.8(비투석)/≥1.2(투석시)",
        sodium="≤2,000",
        potassium="개인화(혈청K 기준)",
        phosphorus="800-1,000",
        carbs_sugar="개별화 권장(ADA/KDIGO), 정제당·당음료 제한",
        management="당뇨+CKD 동시 관리"
    ),
    "CKD_T": NutritionGuideline(
        name="이식환자",
        energy="초기30-35/장기25-30",
        protein="초기1.2-2.0/장기0.8-1.0",
        sodium="1,500-2,000(개별)",
        potassium="개별(약물·혈청)",
        phosphorus="개별(골대사)",
        carbs_sugar="균형식(면역억제제 주의)",
        management="면역억제제·감염·식단관리"
    ),
    "AKI": NutritionGuideline(
        name="급성신손상",
        energy="25-35",
        protein="~0.6(투석 전)",
        sodium="≤2,000",
        potassium="≤2,000(혈청기준)",
        phosphorus="800-1,000",
        carbs_sugar="-",
        management="회복 모니터링 및 재발 방지"
    ),
    "PD": NutritionGuideline(
        name="복막투석",
        energy="30-40",
        protein="≥1.2-1.3",
        sodium="≤2,000",
        potassium="투석·혈청에 따라",
        phosphorus="투석·혈청에 따라",
        carbs_sugar="-",
        management="감염·체액 관리, 제한은 혈액투석보다 덜 엄격"
    ),
    "HD": NutritionGuideline(
        name="혈액투석",
        energy="30-40",
        protein="≥1.2",
        sodium="≤2,000",
        potassium="투석 간격·검사 기준",
        phosphorus="투석·검사 기준",
        carbs_sugar="-",
        management="칼륨·인·나트륨 제한 엄격"
    ),
    "None": NutritionGuideline(
        name="비질환자",
        energy="25-30",
        protein="0.8-1.0",
        sodium="≤2,300",
        potassium="2,600-3,400",
        phosphorus="700-1,250",
        carbs_sugar="총열량의 45-65%",
        management="일반 건강 관리"
    )
}


class NutritionGuidelinesManager:
    """영양 가이드라인 관리자"""

    # 고칼륨 식품 목록
    HIGH_POTASSIUM_FOODS = [
        "바나나", "오렌지", "멜론", "키위", "아보카도",
        "감자", "고구마", "토마토", "시금치", "브로콜리",
        "콩류", "견과류", "초콜릿", "건포도", "말린과일"
    ]

    # 저칼륨 식품 목록
    LOW_POTASSIUM_FOODS = [
        "사과", "배", "포도", "복숭아", "딸기", "블루베리",
        "양배추", "오이", "당근(삶은)", "가지", "양상추",
        "쌀", "빵", "국수"
    ]

    # 고인 식품 목록
    HIGH_PHOSPHORUS_FOODS = [
        "유제품", "치즈", "요거트", "아이스크림",
        "가공육", "소시지", "햄", "베이컨",
        "콜라", "탄산음료", "초콜릿",
        "견과류", "땅콩버터", "두부"
    ]

    # 저인 식품 목록
    LOW_PHOSPHORUS_FOODS = [
        "쌀밥", "빵(일반)", "국수", "떡",
        "달걀 흰자", "닭가슴살", "생선(흰살)",
        "신선한 채소", "과일"
    ]

    # 고나트륨 식품 목록 (피해야 할 식품)
    HIGH_SODIUM_FOODS = [
        "김치", "젓갈", "장아찌", "된장찌개", "라면",
        "가공식품", "통조림", "햄", "소시지", "베이컨",
        "치즈", "피자", "햄버거", "감자칩"
    ]

    @classmethod
    def get_guideline(cls, disease_stage: str) -> Optional[NutritionGuideline]:
        """
        질환 단계별 가이드라인 조회

        Args:
            disease_stage: 질환 단계

        Returns:
            Optional[NutritionGuideline]: 가이드라인 또는 None
        """
        return NUTRITION_GUIDELINES.get(disease_stage)

    @classmethod
    def get_all_guidelines(cls) -> Dict[str, NutritionGuideline]:
        """모든 가이드라인 반환"""
        return NUTRITION_GUIDELINES

    @classmethod
    def format_guideline_text(
        cls,
        disease_stage: str,
        dialysis_type: Optional[str] = None
    ) -> str:
        """
        가이드라인을 텍스트로 포맷팅

        Args:
            disease_stage: 질환 단계
            dialysis_type: 투석 유형 (PD/HD)

        Returns:
            str: 포맷팅된 가이드라인 텍스트
        """
        # 투석 환자는 투석 유형 가이드라인 사용
        if dialysis_type and dialysis_type != "None":
            stage_key = dialysis_type
        else:
            stage_key = disease_stage

        guideline = cls.get_guideline(stage_key)
        if not guideline:
            guideline = cls.get_guideline("None")

        text = f"""
[{guideline.name} 영양 가이드라인]

▶ 열량: {guideline.energy} kcal/kg (이상체중 기준)
▶ 단백질: {guideline.protein} g/kg/일
▶ 나트륨: {guideline.sodium} mg/일
▶ 칼륨: {guideline.potassium} mg/일
▶ 인: {guideline.phosphorus} mg/일
▶ 탄수화물/당류: {guideline.carbs_sugar}

📌 관리 포인트: {guideline.management}
"""
        return text.strip()

    @classmethod
    def get_food_recommendations(
        cls,
        disease_stage: str,
        dialysis_type: Optional[str] = None,
        restriction_type: Optional[str] = None
    ) -> Dict[str, List[str]]:
        """
        식품 추천/제한 목록 조회

        Args:
            disease_stage: 질환 단계
            dialysis_type: 투석 유형
            restriction_type: 제한 유형 (potassium, phosphorus, sodium)

        Returns:
            Dict: 권장 식품과 제한 식품 목록
        """
        recommendations = {
            "recommended": [],
            "restricted": [],
            "tips": []
        }

        # CKD 3단계 이상 또는 투석 환자
        needs_restriction = (
            disease_stage in ["CKD3", "CKD4", "CKD5", "AKI"] or
            dialysis_type in ["PD", "HD"]
        )

        if needs_restriction:
            # 칼륨 제한
            if restriction_type in [None, "potassium"]:
                recommendations["restricted"].extend(cls.HIGH_POTASSIUM_FOODS[:5])
                recommendations["recommended"].extend(cls.LOW_POTASSIUM_FOODS[:5])
                recommendations["tips"].append(
                    "채소는 물에 담가두거나 데쳐서 칼륨을 줄일 수 있습니다."
                )

            # 인 제한
            if restriction_type in [None, "phosphorus"]:
                recommendations["restricted"].extend(cls.HIGH_PHOSPHORUS_FOODS[:5])
                recommendations["recommended"].extend(cls.LOW_PHOSPHORUS_FOODS[:5])
                recommendations["tips"].append(
                    "가공식품과 탄산음료는 첨가된 인이 많으니 피해주세요."
                )

            # 나트륨 제한 (모든 CKD 환자)
            if restriction_type in [None, "sodium"]:
                recommendations["restricted"].extend(cls.HIGH_SODIUM_FOODS[:5])
                recommendations["tips"].append(
                    "국물 요리는 건더기 위주로 드시고, 외식 시 싱겁게 요청하세요."
                )

        return recommendations

    @classmethod
    def calculate_daily_allowance(
        cls,
        disease_stage: str,
        weight_kg: float,
        dialysis_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        일일 영양소 허용량 계산

        Args:
            disease_stage: 질환 단계
            weight_kg: 체중 (kg)
            dialysis_type: 투석 유형

        Returns:
            Dict: 계산된 일일 허용량
        """
        stage_key = dialysis_type if dialysis_type and dialysis_type != "None" else disease_stage
        guideline = cls.get_guideline(stage_key)

        if not guideline:
            guideline = cls.get_guideline("None")

        # 열량 계산
        energy_range = guideline.energy.replace("≈", "").replace("~", "")
        if "-" in energy_range:
            energy_parts = energy_range.split("-")
            energy_min = float(energy_parts[0].split("/")[0]) * weight_kg
            energy_max = float(energy_parts[1].split("/")[0]) * weight_kg
        else:
            energy_min = energy_max = float(energy_range.split("/")[0]) * weight_kg

        # 단백질 계산
        protein_range = guideline.protein.replace("≈", "").replace("~", "").replace("≥", "")
        if "-" in protein_range:
            protein_parts = protein_range.split("-")
            protein_min = float(protein_parts[0].split("(")[0]) * weight_kg
            protein_max = float(protein_parts[1].split("(")[0]) * weight_kg
        else:
            protein_min = protein_max = float(protein_range.split("(")[0]) * weight_kg

        return {
            "stage": guideline.name,
            "weight_kg": weight_kg,
            "daily_allowance": {
                "energy_kcal": f"{energy_min:.0f} - {energy_max:.0f}",
                "protein_g": f"{protein_min:.1f} - {protein_max:.1f}",
                "sodium_mg": guideline.sodium,
                "potassium_mg": guideline.potassium,
                "phosphorus_mg": guideline.phosphorus
            },
            "management": guideline.management
        }


# 싱글톤 인스턴스
nutrition_guidelines_manager = NutritionGuidelinesManager()
