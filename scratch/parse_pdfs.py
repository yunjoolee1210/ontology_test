import os
import json
import re
from pypdf import PdfReader

# 디렉토리 경로 정의
RAW_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/raw"))
OUTPUT_JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "parsed_pdfs.json"))

print(f"Searching for PDFs in: {RAW_DATA_DIR}")

# 폴더명에 따른 정보 매핑 사전
FOLDER_META = {
    "welfare": {
        "org": "보건복지부",
        "disease": "BOTH",
        "category": "welfare"
    },
    "diet": {
        "org": "식품의약품안전처/대한신장학회/질병관리청",
        "disease": "BOTH",
        "category": "diet"
    },
    "dm": {
        "org": "대한당뇨병학회/질병관리청",
        "disease": "DM",
        "category": "dm"
    },
    "ckd": {
        "org": "대한신장학회",
        "disease": "CKD",
        "category": "ckd"
    },
    "hospital": {
        "org": "건강보험심사평가원",
        "disease": "CKD",
        "category": "hospital"
    },
    "healthcareproviders": {
        "org": "건강보험심사평가원",
        "disease": "CKD",
        "category": "hospital"
    }
}

def clean_text(text):
    # 불필요한 줄바꿈 및 이상 기호 정제
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def chunk_text(text, chunk_size=800, overlap=100):
    chunks = []
    if not text:
        return chunks
        
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        # 단어 경계 근처로 청크 끊기 조정 (선택 사항)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == text_len:
            break
        start += (chunk_size - overlap)
        
    return chunks

parsed_documents = []
doc_counter = 0

# raw 디렉토리 순회
for root, dirs, files in os.walk(RAW_DATA_DIR):
    # 현재 폴더 이름
    folder_name = os.path.basename(root)
    meta = FOLDER_META.get(folder_name, {
        "org": "공식 정보처",
        "disease": "BOTH",
        "category": "general"
    })
    
    for file in files:
        if file.lower().endswith(".pdf"):
            pdf_path = os.path.join(root, file)
            rel_path = os.path.relpath(pdf_path, RAW_DATA_DIR)
            print(f"Parsing: {rel_path}...")
            
            try:
                reader = PdfReader(pdf_path)
                full_text = ""
                
                # 각 페이지 텍스트 추출
                for page_num, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        full_text += f"\n[페이지 {page_num + 1}]\n" + page_text
                
                cleaned = clean_text(full_text)
                chunks = chunk_text(cleaned)
                
                title = os.path.splitext(file)[0]
                
                for idx, chunk in enumerate(chunks):
                    doc_counter += 1
                    parsed_documents.append({
                        "id": f"pdf_{doc_counter:04d}",
                        "title": f"{title} (파트 {idx + 1})",
                        "content": chunk,
                        "org": meta["org"],
                        "disease": meta["disease"],
                        "category": meta["category"],
                        "url": "",
                        "doi": "",
                        "path": rel_path
                    })
                    
            except Exception as e:
                print(f"Error parsing {pdf_path}: {e}")

# JSON 파일로 쓰기
with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(parsed_documents, f, ensure_ascii=False, indent=2)

print(f"Parsing complete! Total chunks extracted: {len(parsed_documents)}")
print(f"Saved output to: {OUTPUT_JSON_PATH}")
