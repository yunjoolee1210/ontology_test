"""
레시피 이미지 Supabase Storage 업로드 스크립트
-----------------------------------------------
실행 전 아래 두 값을 채우세요 (Supabase 대시보드 > Settings > API):
  SUPABASE_URL      = "https://xxxxxxxx.supabase.co"
  SUPABASE_SERVICE_KEY = "service_role_xxxxxxx..."   ← anon key 아닌 service_role key

이미지 소스: frontend/public/recipes/recipe-{1~30}.jpg (로컬 파일)
업로드 후: recipes 테이블 image_url 컬럼이 Supabase Storage public URL로 업데이트됩니다.

나중에 특정 레시피 이미지만 바꾸려면:
  python upload_recipe_images.py --only 3      # 3번 레시피만 재업로드
  python upload_recipe_images.py --only 3,5,7  # 여러 개 지정
"""

import os
import sys
import argparse
from pathlib import Path
from supabase import create_client

# ── 여기에 실제 값 입력 ──────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")          # 또는 직접 문자열로
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key
# ────────────────────────────────────────────────────────────────────────────

BUCKET_NAME = "recipe-images"
IMAGES_DIR = Path(__file__).parent / "frontend" / "public" / "recipes"
TOTAL = 30


def upload_image(client, recipe_no: int) -> str | None:
    img_path = IMAGES_DIR / f"recipe-{recipe_no}.jpg"
    if not img_path.exists():
        print(f"  [건너뜀] recipe-{recipe_no}.jpg 파일 없음")
        return None

    storage_path = f"recipe-{recipe_no}.jpg"
    with open(img_path, "rb") as f:
        data = f.read()

    # 이미 있으면 덮어쓰기(upsert)
    client.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=data,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )

    public_url = client.storage.from_(BUCKET_NAME).get_public_url(storage_path)
    return public_url


def update_db(client, recipe_no: int, url: str):
    client.table("recipes").update({"image_url": url}).eq("recipe_no", recipe_no).execute()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", type=str, default="",
                        help="업로드할 레시피 번호 (쉼표 구분, 예: 3 또는 3,5,7). 생략시 전체")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_URL 또는 SUPABASE_SERVICE_KEY가 설정되지 않았습니다.")
        print("   스크립트 상단 변수에 직접 입력하거나 환경변수로 전달하세요.")
        print("   예) SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=service_role_xxx python upload_recipe_images.py")
        sys.exit(1)

    targets = (
        [int(n.strip()) for n in args.only.split(",") if n.strip()]
        if args.only else list(range(1, TOTAL + 1))
    )

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 버킷 생성 (이미 있으면 무시)
    try:
        client.storage.create_bucket(BUCKET_NAME, options={"public": True})
        print(f"✅ 버킷 '{BUCKET_NAME}' 생성 완료")
    except Exception:
        print(f"ℹ️  버킷 '{BUCKET_NAME}' 이미 존재 (사용)")

    print(f"\n📤 이미지 업로드 시작 (대상: {targets})\n")
    success, fail = 0, 0
    for no in targets:
        print(f"  [{no:02d}] 업로드 중...", end=" ")
        try:
            url = upload_image(client, no)
            if url:
                update_db(client, no, url)
                print(f"✅ {url}")
                success += 1
            else:
                fail += 1
        except Exception as e:
            print(f"❌ 실패: {e}")
            fail += 1

    print(f"\n완료 — 성공: {success}, 실패: {fail}")


if __name__ == "__main__":
    main()
