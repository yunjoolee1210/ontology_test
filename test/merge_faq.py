"""
기존 faq_clusters JSON + 신규 faq_clusters JSON 병합
→ 중복 제거 후 ragas_eval CSV/JSON 재생성

사용:  python3 merge_faq.py
       (output/ 폴더의 faq_clusters_*.json 파일을 전부 자동 감지)
"""

import json, glob, datetime, os
import pandas as pd

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

def load_all_faq():
    files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "faq_clusters_*.json")))
    if not files:
        print("❌ output/faq_clusters_*.json 파일이 없어요.")
        return []

    all_faq = []
    for f in files:
        with open(f, encoding="utf-8") as fp:
            data = json.load(fp)
        items = data.get("faq", [])
        print(f"  {os.path.basename(f)}: {len(items)}건")
        all_faq.extend(items)
    return all_faq

def deduplicate(faq_list):
    """source_url 기준 중복 제거, 동일 URL이면 더 긴 ground_truth 보존"""
    seen = {}
    for q in faq_list:
        key = q["source_url"]
        if key not in seen:
            seen[key] = q
        else:
            # 같은 URL이면 답변이 더 긴 것 유지
            if len(q.get("ground_truth", "")) > len(seen[key].get("ground_truth", "")):
                seen[key] = q
    return list(seen.values())

def main():
    print(f"📂 {OUTPUT_DIR} 에서 faq_clusters_*.json 로드")
    all_faq = load_all_faq()
    if not all_faq:
        return

    print(f"\n병합 전 총: {len(all_faq)}건")
    merged = deduplicate(all_faq)
    print(f"중복 제거 후: {len(merged)}건")

    # 카테고리별 현황
    from collections import Counter
    by_cat = Counter((q["disease"], q["category"]) for q in merged)
    print("\n카테고리별:")
    for (d, c), n in sorted(by_cat.items()):
        print(f"  {d}/{c}: {n}건")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    # FAQ JSON
    faq_path = os.path.join(OUTPUT_DIR, f"faq_merged_{ts}.json")
    with open(faq_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "created_at": ts,
                "total_faq": len(merged),
                "with_answer": sum(1 for q in merged if q["has_answer"]),
            },
            "faq": merged,
        }, f, ensure_ascii=False, indent=2)

    # RAGAS JSON
    ragas = [
        {
            "question":     q["question"],
            "ground_truth": q["ground_truth"],
            "contexts":     [q["question_body"]] if q.get("question_body") else [],
            "metadata": {
                "disease":           q["disease"],
                "category":          q["category"],
                "cluster_size":      q.get("cluster_size", 1),
                "similar_questions": q.get("similar_questions", []),
                "source_url":        q["source_url"],
                "verified":          q.get("verified", False),
            },
        }
        for q in merged if q["has_answer"]
    ]
    ragas_path = os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.json")
    with open(ragas_path, "w", encoding="utf-8") as f:
        json.dump({"data": ragas}, f, ensure_ascii=False, indent=2)

    # CSV
    csv_path = os.path.join(OUTPUT_DIR, f"ragas_eval_{ts}.csv")
    df = pd.DataFrame([{
        "disease":          q["disease"],
        "category":         q["category"],
        "question":         q["question"],
        "ground_truth":     q["ground_truth"],
        "has_answer":       q["has_answer"],
        "cluster_size":     q.get("cluster_size", 1),
        "similar_questions": " | ".join(q.get("similar_questions", [])),
        "source_url":       q["source_url"],
    } for q in merged])
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    print(f"\n✅ 저장 완료")
    print(f"  🗂  {os.path.basename(faq_path)}   ({len(merged)}개 FAQ)")
    print(f"  🎯 {os.path.basename(ragas_path)}  ({len(ragas)}건, 답변 있는 것만)")
    print(f"  📊 {os.path.basename(csv_path)}")

if __name__ == "__main__":
    main()
