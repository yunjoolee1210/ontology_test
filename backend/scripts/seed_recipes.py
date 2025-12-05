"""
레시피 데이터 시딩 스크립트
- 이미지 다운로드: rsc/static/food/recipe/{한국어}_{영어}.jpg
- MongoDB에 레시피 데이터 저장
"""
import asyncio
import httpx
from pathlib import Path
from datetime import datetime
import sys

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

# 경로 설정 (모든 음식 이미지는 rsc/static/food/ 아래에 저장)
RSC_DIR = Path(__file__).parent.parent.parent / "rsc" / "static" / "food"
RSC_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB 연결
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")


# 레시피 데이터 (파일명: {한국어}_{영어}.jpg)
RECIPES = [
    {
        "name": "두부 달걀찜",
        "name_en": "tofu_egg_steam",
        "category": "low-potassium",
        "cooking_time": "20분",
        "servings": "2인분",
        "nutrients": {
            "calories": 180,
            "potassium": 150,
            "phosphorus": 120,
            "protein": 12,
            "sodium": 280
        },
        "ingredients": [
            "연두부 1모(300g)",
            "달걀 2개",
            "당근 30g",
            "파 약간",
            "참기름 1작은술",
            "소금 약간"
        ],
        "steps": [
            "연두부는 키친타올로 물기를 제거합니다.",
            "달걀을 풀어 소금으로 간합니다.",
            "당근은 잘게 다지고, 파는 송송 썹니다.",
            "내열 용기에 두부를 으깨어 담고 달걀물을 붓습니다.",
            "당근과 파를 올리고 찜기에서 15분간 찝니다.",
            "참기름을 뿌려 완성합니다."
        ],
        "tips": "두부는 칼륨 함량이 낮아 CKD 환자에게 좋은 단백질 공급원입니다. 물에 담가두면 칼륨이 더 빠집니다.",
        "image_source": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600"
    },
    {
        "name": "양배추 쌈밥",
        "name_en": "cabbage_wrap_rice",
        "category": "low-potassium",
        "cooking_time": "25분",
        "servings": "2인분",
        "nutrients": {
            "calories": 320,
            "potassium": 180,
            "phosphorus": 95,
            "protein": 8,
            "sodium": 320
        },
        "ingredients": [
            "양배추 8장",
            "밥 2공기",
            "당근 50g",
            "계란 2개",
            "참기름",
            "저염 쌈장"
        ],
        "steps": [
            "양배추는 끓는 물에 2분간 데쳐 부드럽게 만듭니다.",
            "당근은 채 썰어 볶습니다.",
            "계란은 지단을 부쳐 채 썹니다.",
            "밥에 참기름을 넣고 섞습니다.",
            "양배추 위에 밥과 재료를 올려 쌈을 쌉니다.",
            "저염 쌈장과 함께 즐깁니다."
        ],
        "tips": "양배추는 데치면 칼륨이 30% 이상 감소합니다. 쌈장은 저염 제품을 사용하세요.",
        "image_source": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600"
    },
    {
        "name": "애호박 전",
        "name_en": "zucchini_pancake",
        "category": "low-potassium",
        "cooking_time": "15분",
        "servings": "2인분",
        "nutrients": {
            "calories": 150,
            "potassium": 120,
            "phosphorus": 80,
            "protein": 6,
            "sodium": 250
        },
        "ingredients": [
            "애호박 1개",
            "달걀 1개",
            "부침가루 3큰술",
            "식용유",
            "소금 약간"
        ],
        "steps": [
            "애호박은 0.5cm 두께로 동그랗게 썹니다.",
            "소금을 살짝 뿌려 10분간 절입니다.",
            "물기를 제거하고 부침가루를 묻힙니다.",
            "달걀물을 입힙니다.",
            "달군 팬에 기름을 두르고 노릇하게 굽습니다.",
            "앞뒤로 골고루 익혀 완성합니다."
        ],
        "tips": "애호박은 칼륨이 적고 소화가 잘 됩니다. 절인 후 물기를 꼭 짜주세요.",
        "image_source": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600"
    },
    {
        "name": "달걀 야채죽",
        "name_en": "egg_vegetable_porridge",
        "category": "low-phosphorus",
        "cooking_time": "30분",
        "servings": "2인분",
        "nutrients": {
            "calories": 220,
            "potassium": 160,
            "phosphorus": 90,
            "protein": 9,
            "sodium": 300
        },
        "ingredients": [
            "쌀 1컵",
            "달걀 1개",
            "당근 30g",
            "애호박 30g",
            "참기름",
            "소금 약간"
        ],
        "steps": [
            "쌀은 30분 이상 불려 준비합니다.",
            "당근, 애호박은 잘게 다집니다.",
            "냄비에 참기름을 두르고 쌀을 볶습니다.",
            "물 5컵을 넣고 약불에서 저어가며 끓입니다.",
            "야채를 넣고 쌀이 퍼질 때까지 끓입니다.",
            "달걀을 풀어 넣고 소금으로 간합니다."
        ],
        "tips": "인이 높은 멸치, 다시마 육수 대신 맹물을 사용하세요. 달걀은 노른자보다 흰자 위주로 사용하면 인 섭취를 줄일 수 있습니다.",
        "image_source": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600"
    },
    {
        "name": "두부 스테이크",
        "name_en": "tofu_steak",
        "category": "low-phosphorus",
        "cooking_time": "20분",
        "servings": "2인분",
        "nutrients": {
            "calories": 200,
            "potassium": 140,
            "phosphorus": 100,
            "protein": 14,
            "sodium": 280
        },
        "ingredients": [
            "두부 1모",
            "양파 1/4개",
            "마늘 2쪽",
            "간장 1큰술",
            "올리브유",
            "후추"
        ],
        "steps": [
            "두부는 1.5cm 두께로 썰어 물기를 제거합니다.",
            "팬에 올리브유를 두르고 두부를 노릇하게 굽습니다.",
            "양파와 마늘은 다져서 볶습니다.",
            "간장, 물 2큰술을 넣어 소스를 만듭니다.",
            "구운 두부 위에 소스를 뿌립니다.",
            "후추를 뿌려 완성합니다."
        ],
        "tips": "두부는 육류보다 인 함량이 낮은 좋은 단백질원입니다. 물에 데쳐 사용하면 인 함량을 더 낮출 수 있습니다.",
        "image_source": "https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?w=600"
    },
    {
        "name": "오이냉국",
        "name_en": "cucumber_cold_soup",
        "category": "low-phosphorus",
        "cooking_time": "10분",
        "servings": "2인분",
        "nutrients": {
            "calories": 45,
            "potassium": 100,
            "phosphorus": 35,
            "protein": 2,
            "sodium": 350
        },
        "ingredients": [
            "오이 1개",
            "물 3컵",
            "식초 2큰술",
            "설탕 1큰술",
            "소금 1/2작은술",
            "깨 약간"
        ],
        "steps": [
            "오이는 얇게 채 썹니다.",
            "차가운 물에 식초, 설탕, 소금을 넣어 섞습니다.",
            "오이를 국물에 담급니다.",
            "냉장고에서 30분간 차갑게 식힙니다.",
            "깨를 뿌려 완성합니다.",
            "시원하게 즐깁니다."
        ],
        "tips": "오이는 인 함량이 매우 낮습니다. 여름철 시원한 국물 요리로 좋습니다.",
        "image_source": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600"
    }
]


async def download_image(url: str, filepath: Path) -> bool:
    """이미지 다운로드"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                filepath.write_bytes(response.content)
                print(f"  ✅ Downloaded: {filepath.name}")
                return True
            else:
                print(f"  ❌ Failed to download: {url} (status: {response.status_code})")
                return False
    except Exception as e:
        print(f"  ❌ Error downloading {url}: {e}")
        return False


async def seed_recipes():
    """레시피 데이터 시딩"""
    print("🍳 Starting recipe seeding...")

    # MongoDB 연결
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.careguide

    # 기존 데이터 삭제 (선택적)
    await db.recipes.delete_many({})
    print("  🗑️ Cleared existing recipes")

    for recipe in RECIPES:
        # 파일명 생성: {한국어}_{영어}.jpg
        filename = f"{recipe['name'].replace(' ', '')}_{recipe['name_en']}.jpg"
        filepath = RSC_DIR / filename

        # 이미지 다운로드
        print(f"\n📥 Processing: {recipe['name']} ({recipe['name_en']})")
        await download_image(recipe["image_source"], filepath)

        # slug 생성 (SEO-friendly URL)
        slug = recipe["name_en"].replace("_", "-")

        # MongoDB에 저장할 문서 생성
        doc = {
            "name": recipe["name"],
            "name_en": recipe["name_en"],
            "slug": slug,
            "category": recipe["category"],
            "cooking_time": recipe["cooking_time"],
            "servings": recipe["servings"],
            "nutrients": recipe["nutrients"],
            "ingredients": recipe["ingredients"],
            "steps": recipe["steps"],
            "tips": recipe["tips"],
            "image_url": f"/rsc/static/food/{filename}",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # MongoDB에 저장
        result = await db.recipes.insert_one(doc)
        print(f"  📝 Saved to MongoDB: {result.inserted_id}")

    # 인덱스 생성
    await db.recipes.create_index("category")
    await db.recipes.create_index("name")
    await db.recipes.create_index("slug", unique=True)
    print("\n✅ Recipe seeding completed!")

    # 결과 확인
    count = await db.recipes.count_documents({})
    print(f"📊 Total recipes in database: {count}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_recipes())
