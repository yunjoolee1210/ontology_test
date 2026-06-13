"""
기존 raw_posts JSON → 노이즈 제거 + 중복 제거 + 클러스터링 → FAQ CSV/JSON
사용:  python postprocess_existing.py
"""

import json, re, datetime, os
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "output")
RAW_FILE    = os.path.join(OUTPUT_DIR, "naver_cafe_raw_20260611_002131.json")

CLUSTER_THRESHOLD = 0.40
MIN_ANSWER_LEN    = 30
MIN_TITLE_LEN     = 8

URL_CAT_MAP = {
    "menuid=72":  ("콩팥병","일반_질문"),  "menuid=102": ("콩팥병","식이_관리"),
    "menuid=14":  ("콩팥병","투석_방법"),  "menuid=73":  ("콩팥병","복지_지원"),
    "menuid=12":  ("콩팥병","병원_치료"),  "menuid=4":   ("콩팥병","약물_관리"),
    "menuid=75":  ("콩팥병","생활_관리"),  "menuid=682": ("당뇨병","혈당_관리"),
    "menuid=956": ("당뇨병","식이_관리"),
}

NOISE_KW = [
    "[함께 결정하는 투석]","안녕하세요. 일일호일","모집","체험단","신청이 저조",
    "댓글창에 신청","당뇨학교","이벤트","[공지]","공지사항","카페 규정",
    "카페 소개","운영진","관리자","정기점검","카페지기","홍보","광고",
    "후원","협찬","설문조사","인터뷰 참여","참여해주세요","증정","경품",
    "배너","안내드립니다","회원님들께","[안내]","[알림]",
]

def get_cat(url):
    for k, v in URL_CAT_MAP.items():
        if k in url: return v
    return None

def get_aid(url):
    m = re.search(r'/articles/(\d+)', url)
    return m.group(1) if m else url

def is_noise(title):
    return any(kw in title for kw in NOISE_KW)

def cluster_faq(posts, category, disease):
    if not posts:
        return []
    titles = [p["title"] for p in posts]
    try:
        vec   = TfidfVectorizer(analyzer="char_wb", ngram_range=(2,3), max_features=5000)
        tfidf = vec.fit_transform(titles)
        sim   = cosine_similarity(tfidf)
    except:
        return _flat(posts, category, disease)

    visited, clusters = [False]*len(posts), []
    for i in range(len(posts)):
        if visited[i]: continue
        group = [i]; visited[i] = True
        for j in range(i+1, len(posts)):
            if not visited[j] and sim[i][j] >= CLUSTER_THRESHOLD:
                group.append(j); visited[j] = True
        clusters.append(group)

    faq = []
    for group in clusters:
        members = [posts[i] for i in group]
        members.sort(key=lambda p: (0 if "?" in p["title"] else 1, len(p["title"])))
        rep = members[0]
        all_comments = []
        for m in members:
            all_comments += [c for c in m.get("comments",[]) if len(c) >= MIN_ANSWER_LEN]
        best = max(all_comments, key=len)[:1000] if all_comments else ""
        faq.append({
            "question":          rep["title"],
            "question_body":     rep.get("content","")[:400],
            "ground_truth":      best,
            "has_answer":        bool(best),
            "cluster_size":      len(group),
            "similar_questions": [m["title"] for m in members[1:4]],
            "disease":           disease,
            "category":          category,
            "source_url":        rep["url"],
            "verified":          False,
        })
    faq.sort(key=lambda x: (-int(x["has_answer"]), -x["cluster_size"]))
    return faq

def _flat(posts, category, disease):
    faq = []
    for p in posts:
        comments = [c for c in p.get("comments",[]) if len(c) >= MIN_ANSWER_LEN]
        faq.append({
            "question":          p["title"],
            "question_body":     p.get("content","")[:400],
            "ground_truth":      max(comments,key=len)[:1000] if comments else "",
            "has_answer":        bool(comments),
            "cluster_size":      1,
            "similar_questions": [],
            "disease":           disease,
            "category":          category,
            "source_url":        p["url"],
            "verified":          False,
        })
    return faq


def main():
    with open(RAW_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    print(f"원본 게시글: {len(raw)}건")

    # 제목 복원 (본문 첫 줄)
    for p in raw:
        if not p["title"] and p["content"]:
            first = p["content"].split("\n")[0].strip()
            if len(first) >= MIN_TITLE_LEN:
                p["title"] = first

    # 노이즈 제거 + article_id 기준 중복 제거
    seen_ids = set()
    clean    = []
    for p in raw:
        cat = get_cat(p["url"])
        if not cat: continue
        t = p["title"]
        if not t or len(t) < MIN_TITLE_LEN or is_noise(t): continue
        aid = get_aid(p["url"])
        if aid in seen_ids: continue
        seen_ids.add(aid)
        p["_disease"], p["_category"] = cat
        clean.append(p)

    print(f"정제 후: {len(clean)}건")
    from collections import Counter
    by_cat = Counter((p["_disease"], p["_category"]) for p in clean)
    for (d,c), n in sorted(by_cat.items()):
        print(f"  {d}/{c}: {n}건")

    # 카테고리별 클러스터링
    by_group = {}
    for p in clean:
        key = (p["_disease"], p["_category"])
        by_group.setdefault(key, []).append(p)

    faq_all = []
    for (disease, category), posts in sorted(by_group.items()):
        faq = cluster_faq(posts, category, disease)
        faq_all.extend(faq)
        print(f"  [{disease}/{category}] {len(posts)}건 → {len(faq)}개 FAQ")

    # 저장
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    with open(os.path.join(OUTPUT_DIR, f"faq_clusters_{ts}.json"), "w", encoding="utf-8") as f:
        json.dump({"metadata":{"total_faq":len(faq_all),
                               "with_answer":sum(1 for q in faq_all if q["has_answer"]),
                               "created_at":ts},
                   "faq":faq_all}, f, ensure_ascii=False, indent=2)

    ragas = [{"question":q["question"],"ground_truth":q["ground_truth"],
              "contexts":[q["question_body"]] if q["question_body"] else [],
              "metadata":{"disease":q["disease"],"category":q["category"],
                          "cluster_size":q["cluster_size"],
                          "similar_questions":q["similar_questions"],
                          "source_url":q["source_url"],"verified":q["verified"]}}
             for q in faq_all if q["has_answer"]]
    with open(os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.json"), "w", encoding="utf-8") as f:
        json.dump({"data":ragas}, f, ensure_ascii=False, indent=2)

    df = pd.DataFrame([{
        "disease":q["disease"],"category":q["category"],
        "question":q["question"],"ground_truth":q["ground_truth"],
        "has_answer":q["has_answer"],"cluster_size":q["cluster_size"],
        "similar_questions":" | ".join(q["similar_questions"]),
        "source_url":q["source_url"],
    } for q in faq_all])
    csv_path = os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    print(f"\n✅ 저장 완료")
    print(f"  🗂  faq_clusters_{ts}.json  ({len(faq_all)}개 FAQ)")
    print(f"  🎯 ragas_eval_{ts}.json    ({len(ragas)}건 답변 포함)")
    print(f"  📊 ragas_eval_{ts}.csv")

    print("\n📊 카테고리별 결과:")
    if not df.empty:
        print(df.groupby(["disease","category"]).agg(
            FAQ수=("question","count"), 답변있음=("has_answer","sum")
        ).to_string())

    print(f"\n⚠️  현재 데이터로는 콩팥병 {len([p for p in clean if p['_disease']=='콩팥병'])}건 / "
          f"당뇨병 {len([p for p in clean if p['_disease']=='당뇨병'])}건")
    print("   질병당 100건을 위해 naver_cafe_crawler.py 재실행 필요")


if __name__ == "__main__":
    main()
