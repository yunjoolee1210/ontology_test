import os
import re
import time
import urllib.parse
import pandas as pd
import requests
from dotenv import load_dotenv

# Load env file from the project root
BASE_DIR = "/Users/yunjoolee/Desktop/ai-service/carekidney-clean"
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

KAKAO_KEY = os.getenv("KAKAO_REST_API_KEY")
if not KAKAO_KEY:
    print("❌ KAKAO_REST_API_KEY is not set in .env! Please configure it first.")
    exit(1)

print(f"Loaded Kakao REST API Key: {KAKAO_KEY[:4]}...{KAKAO_KEY[-4:]}")

INPUT_CSV = os.path.join(BASE_DIR, "data/gsheet_raw.csv")
OUTPUT_CSV = os.path.join(BASE_DIR, "data/hospitals_2066_processed.csv")

# Ensure raw data exists
if not os.path.exists(INPUT_CSV):
    print(f"❌ Input file not found: {INPUT_CSV}")
    exit(1)

df = pd.read_csv(INPUT_CSV)
print(f"Loaded raw dataset from: {INPUT_CSV} (Shape: {df.shape})")

# Standardize hospital name spacing
def standardize_hospital_name(name: str) -> str:
    if not isinstance(name, str):
        return name
    replacements = {
        "가톨릭대학교부천성모병원": "가톨릭대학교 부천성모병원",
        "가톨릭대학교인천성모병원": "가톨릭대학교 인천성모병원",
        "가톨릭대학교의정부성모병원": "가톨릭대학교 의정부성모병원",
        "가톨릭대학교여의도성모병원": "가톨릭대학교 여의도성모병원",
        "가톨릭대학교서울성모병원": "가톨릭대학교 서울성모병원",
        "가톨릭대학교대전성모병원": "가톨릭대학교 대전성모병원",
        "한림대학교동탄성심병원": "한림대학교 동탄성심병원",
        "한림대학교성심병원": "한림대학교 성심병원",
        "한림대학교춘천성심병원": "한림대학교 춘천성심병원",
        "한림대학교강남성심병원": "한림대학교 강남성심병원",
        "한림대학교한강성심병원": "한림대학교 한강성심병원",
        "인제대학교부산백병원": "인제대학교 부산백병원",
        "인제대학교일산백병원": "인제대학교 일산백병원",
        "인제대학교상계백병원": "인제대학교 상계백병원",
        "인제대학교해운대백병원": "인제대학교 해운대백병원",
        "동국대학교일산불교병원": "동국대학교 일산불교병원",
        "동국대학교의과대학경주병원": "동국대학교 의과대학 경주병원",
        "중앙대학교광명병원": "중앙대학교 광명병원",
        "차의과학대학교분당차병원": "차의과학대학교 분당차병원",
        "차의과학대학교부속구미차병원": "차의과학대학교 부속 구미차병원",
        "차의과학대학교구미차병원": "차의과학대학교 구미차병원",
        "한양대학교구리병원": "한양대학교 구리병원",
        "고려대학교의과대학부속구로병원": "고려대학교 의과대학 부속 구로병원",
        "고려대학교의과대학부속안산병원": "고려대학교 의과대학 부속 안산병원",
        "고려대학교의과대학부속병원": "고려대학교 의과대학 부속 병원",
        "연세대학교의과대학세브란스병원": "연세대학교 의과대학 세브란스병원",
        "연세대학교의과대학 강남세브란스병원": "연세대학교 의과대학 강남세브란스병원",
        "연세대학교의과대학 용인세브란스병원": "연세대학교 의과대학 용인세브란스병원",
        "이화여자대학교의과대학부속서울병원": "이화여자대학교 의과대학 부속 서울병원",
        "이화여자대학교의과대학부속목동병원": "이화여자대학교 의과대학 부속 목동병원",
        "순천향대학교부속 천안병원": "순천향대학교 부속 천안병원",
        "순천향대학교부속부천병원": "순천향대학교 부속 부천병원",
        "순천향대학교부속 서울병원": "순천향대학교 부속 서울병원",
        "순천향대학교부속 구미병원": "순천향대학교 부속 구미병원",
        "학교법인가톨릭학원가톨릭대학교서울성모병원": "학교법인 가톨릭학원 가톨릭대학교 서울성모병원",
        "학교법인가톨릭학원 가톨릭대학교서울성모병원": "학교법인 가톨릭학원 가톨릭대학교 서울성모병원",
        "학교법인가톨릭학원 가톨릭대학교 서울성모병원": "학교법인 가톨릭학원 가톨릭대학교 서울성모병원",
        "학교법인가톨릭학원": "학교법인 가톨릭학원",
        "가톨릭학원가톨릭대학교": "가톨릭학원 가톨릭대학교",
    }
    res = name
    for k, v in replacements.items():
        res = res.replace(k, v)
    for u in ["가톨릭대학교", "한림대학교", "인제대학교", "연세대학교", "고려대학교", "동국대학교", "중앙대학교", "차의과학대학교", "한양대학교", "이화여자대학교", "순천향대학교부속"]:
        res = re.sub(f"{u}([^\\s])", f"{u} \\1", res)
    res = re.sub(r"\s+", " ", res).strip()
    return res

df['name'] = df['name'].apply(standardize_hospital_name)
print("Standardized hospital name spacing.")

# Cache to avoid calling Kakao API for identical addresses
coord_cache = {}

# Pre-populate cache from previously processed output if it exists to avoid re-calling APIs
if os.path.exists(OUTPUT_CSV):
    try:
        prev_df = pd.read_csv(OUTPUT_CSV)
        print(f"Pre-populating cache from existing output: {OUTPUT_CSV}")
        for _, r in prev_df.iterrows():
            addr = str(r.get("address", ""))
            lat = r.get("lat")
            lng = r.get("lng")
            src = str(r.get("coord_source", ""))
            if pd.notna(lat) and pd.notna(lng) and "#N/A" not in str(lat) and "#N/A" not in str(lng):
                # Standardize source strings to avoid double correction loops
                clean_src = src.replace("_corrected", "").replace("_parse_error", "").replace("_cached", "")
                coord_cache[addr] = (float(lat), float(lng), clean_src)
        print(f"Cached {len(coord_cache)} addresses from previous run.")
    except Exception as e:
        print(f"⚠️ Could not load previous cache: {e}")

# Clean address to remove detailed interior numbers (e.g. room, suite, floor, basement details) for better matching
def clean_address_for_search(addr: str) -> str:
    if not addr:
        return ""
    # Split by comma and take first part (usually has the main building number)
    parts = addr.split(",")
    main_addr = parts[0].strip()
    
    # Remove floor/basement detail patterns in parentheses or brackets
    main_addr = re.sub(r"\([^)]*?층[^)]*?\)", "", main_addr)
    main_addr = re.sub(r"\(지하[^)]*?\)", "", main_addr)
    # Remove trailing floor details
    main_addr = re.sub(r"\s+지하\s*\d+층.*$", "", main_addr)
    main_addr = re.sub(r"\s+\d+층.*$", "", main_addr)
    main_addr = re.sub(r"\s+지하층.*$", "", main_addr)
    return main_addr.strip()

# Call Kakao Address API
def get_kakao_address_coord(address: str):
    if not address or "주소없음" in address:
        return None, None
        
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    
    try:
        resp = requests.get(url, headers=headers, params={"query": address}, timeout=5)
        if resp.status_code == 200 and resp.json().get("documents"):
            doc = resp.json()["documents"][0]
            return float(doc["y"]), float(doc["x"])  # lat, lng
    except Exception as e:
        print(f"      [Kakao Address Error] {e}")
    return None, None

# Call Kakao Keyword API as backup
def get_kakao_keyword_coord(region: str, name: str):
    if not name:
        return None, None
        
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    
    # Standardize name (remove parentheses like (의), (사), etc.)
    clean_name = re.sub(r"\(.*?\)", "", name).strip()
    query = f"{region} {clean_name}"
    
    try:
        resp = requests.get(url, headers=headers, params={"query": query}, timeout=5)
        if resp.status_code == 200 and resp.json().get("documents"):
            doc = resp.json()["documents"][0]
            return float(doc["y"]), float(doc["x"])  # lat, lng
    except Exception as e:
        print(f"      [Kakao Keyword Error] {e}")
    return None, None

# Fully resolve coordinate using multi-stage approach
def resolve_coords(row):
    name = row["name"]
    addr = str(row["address"]) if pd.notna(row["address"]) else ""
    region = str(row["region"]) if pd.notna(row["region"]) else ""
    
    if not addr:
        return None, None, "no_address"
        
    # Check cache
    if addr in coord_cache:
        lat, lng, src = coord_cache[addr]
        return lat, lng, f"{src}_cached"
        
    # Stage 1: Full Address Search
    lat, lng = get_kakao_address_coord(addr)
    if lat and lng:
        coord_cache[addr] = (lat, lng, "kakao_address_full")
        return lat, lng, "kakao_address_full"
        
    # Stage 2: Cleaned Address Search
    cleaned_addr = clean_address_for_search(addr)
    if cleaned_addr and cleaned_addr != addr:
        lat, lng = get_kakao_address_coord(cleaned_addr)
        if lat and lng:
            coord_cache[addr] = (lat, lng, "kakao_address_cleaned")
            return lat, lng, "kakao_address_cleaned"
            
    # Stage 3: Keyword Search (Region + Name)
    lat, lng = get_kakao_keyword_coord(region, name)
    if lat and lng:
        coord_cache[addr] = (lat, lng, "kakao_keyword_name")
        return lat, lng, "kakao_keyword_name"
        
    return None, None, "failed"

# 1. First Pass: Clean non-coordinate columns and detect missing/incorrect values
print("\n--- Cleaning hospital details columns ---")
cleaned_count = 0
for idx, row in df.iterrows():
    # Clean dialysis_machines
    machines_val = str(row.get("dialysis_machines", "0")).strip()
    if pd.isna(row.get("dialysis_machines")) or "#N/A" in machines_val or not machines_val:
        df.at[idx, "dialysis_machines"] = 0
        df.at[idx, "has_dialysis_unit"] = False
    else:
        try:
            # Extract number
            num = int(float(re.sub(r"[^0-9.]", "", machines_val)))
            df.at[idx, "dialysis_machines"] = num
            df.at[idx, "has_dialysis_unit"] = True if num > 0 else False
        except:
            df.at[idx, "dialysis_machines"] = 0
            df.at[idx, "has_dialysis_unit"] = False

    # Clean night_dialysis & dialysis_days
    days_val = str(row.get("dialysis_days", "")).strip()
    if pd.isna(row.get("dialysis_days")) or "#N/A" in days_val or days_val == "nan":
        df.at[idx, "dialysis_days"] = ""
    else:
        df.at[idx, "dialysis_days"] = days_val

    # Night dialysis is TRUE if night_dialysis was True, or dialysis_days is not empty
    night_val = str(row.get("night_dialysis", "FALSE")).upper()
    if night_val in ["TRUE", "1", "Y"] or df.at[idx, "dialysis_days"]:
        df.at[idx, "night_dialysis"] = True
    else:
        df.at[idx, "night_dialysis"] = False

    # Clean phone
    phone_val = str(row.get("phone", "")).strip()
    if pd.isna(row.get("phone")) or "#N/A" in phone_val or phone_val == "nan":
        df.at[idx, "phone"] = ""
    else:
        df.at[idx, "phone"] = phone_val

    # Clean other #N/A columns
    for na_col in ["심평원 평가", "학회 인증"]:
        col_val = str(row.get(na_col, "")).strip()
        if pd.isna(row.get(na_col)) or "#N/A" in col_val or col_val == "nan":
            df.at[idx, na_col] = ""

    # Always standardize maps search URLs
    df.at[idx, "naver_map_url"] = f"https://map.naver.com/v5/search/{urllib.parse.quote(row['name'])}"
    df.at[idx, "kakao_map_url"] = f"https://map.kakao.com/?q={urllib.parse.quote(row['name'])}"

print("Standardized dialysis machines, night dialysis flags, map search URLs, and cleaned other columns.")

# 2. Coordinate Resolution & Correction Pass
print("\n--- Starting Coordinate Resolution & Correction Pass ---")
resolved_missing = 0
corrected_incorrect = 0
unchanged = 0
failed_resolutions = []

# Deviation correction threshold (0.001 degrees is ~110 meters)
CORRECTION_THRESHOLD = 0.001

for idx, row in df.iterrows():
    name = row["name"]
    addr = row["address"]
    
    # Check if current coordinate is missing
    lat_val = str(row.get("lat", "")).strip()
    lng_val = str(row.get("lng", "")).strip()
    
    is_missing = "#N/A" in lat_val or "#N/A" in lng_val or not lat_val or not lng_val
    
    # Resolve high-precision coordinate from Kakao API
    k_lat, k_lng, k_src = resolve_coords(row)
    
    if is_missing:
        # Resolve missing
        if k_lat and k_lng:
            df.at[idx, "lat"] = k_lat
            df.at[idx, "lng"] = k_lng
            df.at[idx, "coord_source"] = f"kakao_{k_src}"
            resolved_missing += 1
            print(f"  [MISSING RESOLVED] {idx+1}/{len(df)}: {name} ({addr}) -> Lat: {k_lat}, Lng: {k_lng} (via {k_src})")
        else:
            df.at[idx, "lat"] = 37.5665  # Fallback to Seoul coordinates if all resolve stages fail
            df.at[idx, "lng"] = 126.9780
            df.at[idx, "coord_source"] = "failed_seoul_fallback"
            failed_resolutions.append((name, addr))
            resolved_missing += 1
            print(f"  ⚠️ [MISSING RESOLVE FAILED] {idx+1}/{len(df)}: {name} ({addr}) -> Fallback to Seoul")
            
    else:
        # Compare and correct existing
        try:
            curr_lat = float(lat_val)
            curr_lng = float(lng_val)
            
            if k_lat and k_lng:
                lat_diff = abs(curr_lat - k_lat)
                lng_diff = abs(curr_lng - k_lng)
                
                if lat_diff > CORRECTION_THRESHOLD or lng_diff > CORRECTION_THRESHOLD:
                    # Coords deviate too much, update to high-precision Kakao coords
                    df.at[idx, "lat"] = k_lat
                    df.at[idx, "lng"] = k_lng
                    df.at[idx, "coord_source"] = f"kakao_{k_src}_corrected"
                    corrected_incorrect += 1
                    print(f"  [INCORRECT CORRECTED] {idx+1}/{len(df)}: {name} ({addr})")
                    print(f"      Old: {curr_lat}, {curr_lng} | New: {k_lat}, {k_lng} (Dev: {lat_diff:.4f}, {lng_diff:.4f})")
                else:
                    df.at[idx, "lat"] = curr_lat
                    df.at[idx, "lng"] = curr_lng
                    df.at[idx, "coord_source"] = "public_data_verified"
                    unchanged += 1
            else:
                df.at[idx, "lat"] = curr_lat
                df.at[idx, "lng"] = curr_lng
                df.at[idx, "coord_source"] = "public_data_unverified"
                unchanged += 1
        except Exception as e:
            # If float parsing fails, treat it as missing
            if k_lat and k_lng:
                df.at[idx, "lat"] = k_lat
                df.at[idx, "lng"] = k_lng
                df.at[idx, "coord_source"] = f"kakao_{k_src}_parse_error_corrected"
                corrected_incorrect += 1
            else:
                df.at[idx, "lat"] = 37.5665
                df.at[idx, "lng"] = 126.9780
                df.at[idx, "coord_source"] = "failed_parse_fallback"
                corrected_incorrect += 1
    
    # Generate high-precision coordinate-centered Map URLs
    final_lat = df.at[idx, "lat"]
    final_lng = df.at[idx, "lng"]
    df.at[idx, "naver_map_url"] = f"https://map.naver.com/v5/search/{urllib.parse.quote(name)}?c={final_lng},{final_lat},15,0,0,0,dh"
    df.at[idx, "kakao_map_url"] = f"https://map.kakao.com/?q={urllib.parse.quote(name)}"
    
    # Tiny delay to avoid rate limit (300,000 requests/day, so 0.01s is perfectly safe)
    time.sleep(0.01)

# Ensure type conversions
df["dialysis_machines"] = df["dialysis_machines"].astype(int)
df["has_dialysis_unit"] = df["has_dialysis_unit"].astype(bool)
df["night_dialysis"] = df["night_dialysis"].astype(bool)
df["lat"] = df["lat"].astype(float)
df["lng"] = df["lng"].astype(float)

# Save processed CSV
df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")

print("\n" + "=" * 80)
print("PREPROCESSING PIPELINE COMPLETED SUCCESSFULLY!")
print("=" * 80)
print(f"Total processed rows: {len(df)}")
print(f"Resolved missing coordinates: {resolved_missing}")
print(f"Corrected incorrect coordinates: {corrected_incorrect}")
print(f"Verified coordinates (unchanged): {unchanged}")
print(f"Failed resolutions count (using fallback): {len(failed_resolutions)}")
print(f"Processed CSV saved to: {OUTPUT_CSV}")
print("=" * 80 + "\n")
