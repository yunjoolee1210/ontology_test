"""
네이버 카페 QNA 크롤링 → 노이즈 제거 → 클러스터링 → RAGAS FAQ 생성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사전 준비:
  pip install selenium webdriver-manager pandas scikit-learn

실행:
  python naver_cafe_crawler.py
  → 로그인 후 Enter
  → output/ 폴더에 저장
"""

import time, json, datetime, os, re
from collections import Counter

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
TARGET_PER_DISEASE = 120      # 질병당 목표 수집 게시글 수 (노이즈 제거 후 100개 확보)
MAX_PAGES          = 10       # 메뉴당 최대 페이지 수
POSTS_PER_PAGE     = 30       # 페이지당 게시글 수
CLUSTER_THRESHOLD  = 0.40     # 코사인 유사도 임계값 (이 이상이면 같은 클러스터)
MIN_ANSWER_LEN     = 30
MIN_TITLE_LEN      = 8

CAFE_MENUS = {
    # 콩팥병은 이전 실행 완료 — 재실행 시 주석 해제
    # "콩팥병": [
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/72",  "category": "일반_질문"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/102", "category": "식이_관리"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/14",  "category": "투석_방법"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/73",  "category": "복지_지원"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/12",  "category": "병원_치료"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/4",   "category": "약물_관리"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/75",  "category": "생활_관리"},
    #     {"url": "https://cafe.naver.com/f-e/cafes/10097006/menus/78",  "category": "복지_정보"},
    # ],
    "당뇨병": [
        # 11~20페이지만 추가 수집
        {"url": "https://cafe.naver.com/f-e/cafes/10096425/menus/682", "category": "혈당_관리",
         "start_page": 11, "end_page": 20},
    ],
}

# 운영자 공지 / 광고 / 이벤트 필터 키워드
NOISE_KW = [
    "[함께 결정하는 투석]", "안녕하세요. 일일호일", "모집", "체험단", "신청이 저조",
    "댓글창에 신청", "당뇨학교", "이벤트", "[공지]", "공지사항", "카페 규정",
    "카페 소개", "운영진", "관리자", "정기점검", "카페지기", "홍보", "광고",
    "후원", "협찬", "설문조사", "인터뷰 참여", "참여해주세요", "증정", "경품",
    "배너", "안내드립니다", "회원님들께", "[안내]", "[알림]",
]

# 복지_정보는 [공지]만 제거 (연금신청 등 실제 질문 보존)
NOISE_KW_WELFARE = ["[공지]", "공지사항", "카페 규정", "카페 소개", "운영진", "관리자",
                    "정기점검", "카페지기", "[안내]", "[알림]"]


# ─────────────────────────────────────────────
# 드라이버 / 로그인
# ─────────────────────────────────────────────
def create_driver():
    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
    driver.set_page_load_timeout(30)   # 페이지 로딩 30초 초과 시 포기
    driver.set_script_timeout(20)
    driver.execute_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    return driver


def naver_login(driver):
    print("\n" + "="*50)
    print("네이버 로그인 창이 열립니다. 로그인 후 Enter.")
    print("="*50)
    driver.get("https://nid.naver.com/nidlogin.login")
    time.sleep(2)
    input("▶ 로그인 완료 후 Enter: ")
    print("✅ 로그인 완료\n")


# ─────────────────────────────────────────────
# iframe 진입 유틸
# ─────────────────────────────────────────────
def _try_enter_frame(driver) -> bool:
    try:
        WebDriverWait(driver, 4).until(
            EC.frame_to_be_available_and_switch_to_it((By.ID, "cafe_main"))
        )
        return True
    except:
        return False


# ─────────────────────────────────────────────
# 게시글 링크 수집 (페이지네이션 지원)
# ─────────────────────────────────────────────
def get_post_links(driver, menu_url: str, max_pages: int = MAX_PAGES,
                   start_page: int = 1, end_page: int = None) -> list[dict]:
    all_links = {}   # article_id → {url, title}
    if end_page is None:
        end_page = start_page + max_pages - 1

    for page in range(start_page, end_page + 1):
        paged_url = f"{menu_url}?page={page}" if page > 1 else menu_url
        try:
            driver.get(paged_url)
        except Exception:
            # 타임아웃이어도 부분 로딩된 내용 사용
            driver.execute_script("window.stop()")

        in_frame = False
        try:
            # React SPA 로딩 대기 (article 링크 나타날 때까지)
            try:
                WebDriverWait(driver, 8).until(
                    lambda d: len(d.find_elements(By.CSS_SELECTOR, "a[href*='articles']")) > 0
                )
            except:
                in_frame = _try_enter_frame(driver)
                try:
                    WebDriverWait(driver, 6).until(
                        lambda d: len(d.find_elements(By.CSS_SELECTOR, "a[href*='articles']")) > 0
                    )
                except:
                    pass

            prev_count = len(all_links)
            elems = driver.find_elements(By.CSS_SELECTOR, "a[href*='articles']")
            for e in elems:
                href  = e.get_attribute("href") or ""
                title = e.text.strip()
                if not href or not title or len(title) < MIN_TITLE_LEN:
                    continue
                m = re.search(r'/articles/(\d+)', href)
                if not m:
                    continue
                aid = m.group(1)
                if aid not in all_links:
                    all_links[aid] = {"url": href.split("?")[0], "title": title, "article_id": aid}

            new_found = len(all_links) - prev_count
            print(f"    페이지 {page}: {new_found}개 새 링크  (누적 {len(all_links)}개)")

            # 새 링크가 없으면 마지막 페이지
            if new_found == 0:
                break

            # "다음 페이지" 버튼 존재 여부 확인
            try:
                next_btn = driver.find_element(
                    By.CSS_SELECTOR,
                    ".pagination .next, [aria-label='다음'], .btn-next, a.next"
                )
                if not next_btn.is_enabled():
                    break
            except:
                pass  # 버튼 없어도 URL page= 방식으로 계속 시도

        except Exception as e:
            print(f"    ⚠ 페이지 {page} 오류: {e}")
        finally:
            if in_frame:
                driver.switch_to.default_content()

        time.sleep(1.5)

    links = list(all_links.values())
    print(f"  → 총 {len(links)}개 고유 게시글 링크")
    return links


# ─────────────────────────────────────────────
# 게시글 본문 + 댓글 수집
# ─────────────────────────────────────────────
def get_post_content(driver, post: dict) -> dict:
    try:
        driver.get(post["url"])
    except Exception:
        driver.execute_script("window.stop()")
    result = {
        "article_id":  post["article_id"],
        "url":         post["url"],
        "title":       post["title"],   # 목록 제목을 기본값으로
        "content":     "",
        "comments":    [],
        "crawled_at":  datetime.datetime.now().isoformat(),
    }

    in_frame = False
    try:
        try:
            WebDriverWait(driver, 8).until(
                EC.presence_of_element_located((By.CSS_SELECTOR,
                    ".se-main-container,.article-content,#postContent,[class*='ArticleContent']"))
            )
        except:
            in_frame = _try_enter_frame(driver)
            try:
                WebDriverWait(driver, 6).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR,
                        ".se-main-container,.article-content,#postContent"))
                )
            except:
                pass

        # 제목 (페이지 내 셀렉터가 목록보다 정확)
        for sel in [".se-title-text", ".article-head .title", "h3.title",
                    ".title_text", "[class*='ArticleHead'] h3"]:
            try:
                t = driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                if t:
                    result["title"] = t
                    break
            except:
                continue

        # 본문
        for sel in [".se-main-container", ".article-content", "#postContent",
                    "[class*='ArticleContent']", ".ArticleContentsArea"]:
            try:
                c = driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                if c:
                    result["content"] = c
                    break
            except:
                continue

        # 댓글
        for sel in [".comment-text-box", ".CommentItem .text",
                    ".comment-content", ".comment_text_box", ".text_comment"]:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            if elems:
                result["comments"] = [e.text.strip() for e in elems if len(e.text.strip()) > 10]
                break

    except Exception as e:
        print(f"    ⚠ 본문 오류: {e}")
    finally:
        if in_frame:
            driver.switch_to.default_content()

    return result


# ─────────────────────────────────────────────
# 노이즈 필터
# ─────────────────────────────────────────────
def is_noise(title: str, category: str = "") -> bool:
    kw_list = NOISE_KW_WELFARE if category == "복지_정보" else NOISE_KW
    return any(kw in title for kw in kw_list)


# ─────────────────────────────────────────────
# TF-IDF 클러스터링 → FAQ 선별
# ─────────────────────────────────────────────
def cluster_faq(posts: list[dict], category: str, disease: str) -> list[dict]:
    valid = [p for p in posts if len(p.get("title", "")) >= MIN_TITLE_LEN]
    if not valid:
        return []

    titles = [p["title"] for p in valid]

    try:
        vec   = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 3), max_features=5000)
        tfidf = vec.fit_transform(titles)
        sim   = cosine_similarity(tfidf)
    except Exception:
        return _flat_faq(valid, category, disease)

    visited  = [False] * len(valid)
    clusters = []
    for i in range(len(valid)):
        if visited[i]:
            continue
        group = [i]
        visited[i] = True
        for j in range(i + 1, len(valid)):
            if not visited[j] and sim[i][j] >= CLUSTER_THRESHOLD:
                group.append(j)
                visited[j] = True
        clusters.append(group)

    faq = []
    for group in clusters:
        members = [valid[i] for i in group]

        # 대표 질문: 물음표 있으면 우선, 그 다음 짧은 것
        members.sort(key=lambda p: (
            0 if "?" in p["title"] or "요?" in p["title"] else 1,
            len(p["title"])
        ))
        rep = members[0]

        # 베스트 답변: 클러스터 전체 댓글 중 가장 긴 것
        all_comments = []
        for m in members:
            all_comments += [c for c in m.get("comments", []) if len(c) >= MIN_ANSWER_LEN]
        best = max(all_comments, key=len)[:1000] if all_comments else ""

        faq.append({
            "question":         rep["title"],
            "question_body":    rep.get("content", "")[:400],
            "ground_truth":     best,
            "has_answer":       bool(best),
            "cluster_size":     len(group),
            "similar_questions": [m["title"] for m in members[1:4]],
            "disease":          disease,
            "category":         category,
            "source_url":       rep["url"],
            "verified":         False,
        })

    # 답변 있는 것 먼저, 클러스터 크기 내림차순 (자주 묻는 것 우선)
    faq.sort(key=lambda x: (-int(x["has_answer"]), -x["cluster_size"]))
    return faq


def _flat_faq(posts, category, disease):
    faq = []
    for p in posts:
        comments = [c for c in p.get("comments", []) if len(c) >= MIN_ANSWER_LEN]
        faq.append({
            "question":         p["title"],
            "question_body":    p.get("content", "")[:400],
            "ground_truth":     max(comments, key=len)[:1000] if comments else "",
            "has_answer":       bool(comments),
            "cluster_size":     1,
            "similar_questions": [],
            "disease":          disease,
            "category":         category,
            "source_url":       p["url"],
            "verified":         False,
        })
    return faq


# ─────────────────────────────────────────────
# 체크포인트 (크래시 대비 중간 저장)
# ─────────────────────────────────────────────
def _save_checkpoint(raw_posts, faq_all):
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    cp_path = os.path.join(OUTPUT_DIR, f"checkpoint_{ts}.json")
    with open(cp_path, "w", encoding="utf-8") as f:
        json.dump({"raw_posts": raw_posts, "faq": faq_all}, f, ensure_ascii=False, indent=2)
    print(f"\n💾 체크포인트 저장: {cp_path}  ({len(raw_posts)}건)")


# ─────────────────────────────────────────────
# 저장
# ─────────────────────────────────────────────
def save_all(raw_posts: list, faq_all: list, ts: str):
    # 원본 JSON
    with open(os.path.join(OUTPUT_DIR, f"raw_posts_{ts}.json"), "w", encoding="utf-8") as f:
        json.dump(raw_posts, f, ensure_ascii=False, indent=2)

    # FAQ JSON
    faq_path = os.path.join(OUTPUT_DIR, f"faq_clusters_{ts}.json")
    with open(faq_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "created_at": ts,
                "total_faq": len(faq_all),
                "with_answer": sum(1 for q in faq_all if q["has_answer"]),
            },
            "faq": faq_all,
        }, f, ensure_ascii=False, indent=2)

    # RAGAS JSON (답변 있는 것만)
    ragas = [
        {
            "question":    q["question"],
            "ground_truth": q["ground_truth"],
            "contexts":    [q["question_body"]] if q["question_body"] else [],
            "metadata": {
                "disease":           q["disease"],
                "category":          q["category"],
                "cluster_size":      q["cluster_size"],
                "similar_questions": q["similar_questions"],
                "source_url":        q["source_url"],
                "verified":          q["verified"],
            },
        }
        for q in faq_all if q["has_answer"]
    ]
    with open(os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.json"), "w", encoding="utf-8") as f:
        json.dump({"data": ragas}, f, ensure_ascii=False, indent=2)

    # CSV
    csv_path = os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.csv")
    df = pd.DataFrame([{
        "disease":          q["disease"],
        "category":         q["category"],
        "question":         q["question"],
        "ground_truth":     q["ground_truth"],
        "has_answer":       q["has_answer"],
        "cluster_size":     q["cluster_size"],
        "similar_questions": " | ".join(q["similar_questions"]),
        "source_url":       q["source_url"],
    } for q in faq_all])
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    # 요약
    print(f"\n{'='*55}")
    print("📊 카테고리별 FAQ 현황:")
    if not df.empty:
        stats = df.groupby(["disease","category"]).agg(
            FAQ수=("question","count"),
            답변있음=("has_answer","sum"),
            평균클러스터크기=("cluster_size","mean"),
        ).round(1)
        print(stats.to_string())
    print(f"\n✅ 저장: {OUTPUT_DIR}/")
    print(f"  📦 raw_posts_{ts}.json")
    print(f"  🗂  faq_clusters_{ts}.json  ({len(faq_all)}개 FAQ)")
    print(f"  🎯 ragas_eval_{ts}.json    ({len(ragas)}건 답변 포함)")
    print(f"  📊 ragas_eval_{ts}.csv")
    print("\n⚠️  verified=False — Claude 검토 후 사용 권장")


# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────
def main():
    print("🚀 네이버 카페 FAQ 크롤러 시작")
    driver  = create_driver()
    naver_login(driver)

    raw_posts  = []
    faq_all    = []
    seen_ids   = set()   # 전체 article_id 중복 방지

    for disease, menus in CAFE_MENUS.items():
        print(f"\n{'='*50}")
        print(f"📂 [{disease}] 수집 시작")

        disease_posts = []

        for menu_info in menus:
            category = menu_info["category"]
            print(f"\n  📋 {category}  |  {menu_info['url']}")

            links = get_post_links(
                driver, menu_info["url"],
                start_page=menu_info.get("start_page", 1),
                end_page=menu_info.get("end_page", None),
            )
            if not links:
                print("  ⚠ 링크 0건 — 스킵")
                continue

            posts_this_menu = []
            for i, link in enumerate(links, 1):
                # article_id 기준 전역 중복 제거
                if link["article_id"] in seen_ids:
                    continue

                # 노이즈 제거
                if is_noise(link["title"], category):
                    continue

                print(f"    [{i:02d}/{len(links)}] {link['title'][:50]}")
                try:
                    post = get_post_content(driver, link)
                    # 제목이 여전히 비어있으면 본문 첫 줄 사용
                    if not post["title"] and post["content"]:
                        post["title"] = post["content"].split("\n")[0].strip()
                    # 재확인 노이즈
                    if is_noise(post["title"], category) or len(post["title"]) < MIN_TITLE_LEN:
                        continue

                    seen_ids.add(link["article_id"])
                    post["_category"] = category
                    raw_posts.append(post)
                    posts_this_menu.append(post)
                    time.sleep(1.2)
                except Exception as e:
                    print(f"    ❌ {e}")
                    # Chrome 연결 끊김이면 체크포인트 저장 후 종료
                    if "timeout" in str(e).lower() or "connection" in str(e).lower():
                        _save_checkpoint(raw_posts, faq_all)
                        raise

            disease_posts.extend(posts_this_menu)

            # 이 메뉴 클러스터링
            faq_this = cluster_faq(posts_this_menu, category, disease)
            faq_all.extend(faq_this)
            print(f"  ✅ {len(posts_this_menu)}건 수집 → {len(faq_this)}개 FAQ 클러스터")

        print(f"\n  [{disease}] 총 {len(disease_posts)}건 (목표: {TARGET_PER_DISEASE}건)")
        if len(disease_posts) < TARGET_PER_DISEASE:
            print(f"  ⚠ {TARGET_PER_DISEASE - len(disease_posts)}건 부족 — 메뉴 추가 또는 페이지 수 늘리세요")

    driver.quit()
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    save_all(raw_posts, faq_all, ts)


if __name__ == "__main__":
    main()
