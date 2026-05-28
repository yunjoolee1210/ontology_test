import csv
import json
import os

def generate_fallback():
    csv_path = "data/hospitals_2066_processed.csv"
    ts_path = "frontend/src/data/fallbackHospitals.ts"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
        
    hospitals = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse standard boolean columns
            has_dialysis = row.get("has_dialysis_unit", "False").lower() in ("true", "1", "yes")
            night_dialysis = row.get("night_dialysis", "False").lower() in ("true", "1", "yes")
            
            # Parse integers and floats
            try:
                dialysis_machines = int(row.get("dialysis_machines", 0))
            except ValueError:
                dialysis_machines = 0
                
            try:
                lat = float(row.get("lat", 0.0))
            except ValueError:
                lat = 0.0
                
            try:
                lng = float(row.get("lng", 0.0))
            except ValueError:
                lng = 0.0
                
            try:
                specialist_count = int(row.get("specialist_count", 0)) if row.get("specialist_count") else 0
            except ValueError:
                specialist_count = 0
                
            try:
                is_dialysis_specialist = int(row.get("is_dialysis_specialist", 0)) if row.get("is_dialysis_specialist") else 0
            except ValueError:
                is_dialysis_specialist = 0

            hospital_id = f"hospital_{row.get('no', '0')}"
            
            hospitals.append({
                "id": hospital_id,
                "name": row.get("name", "").strip(),
                "address": row.get("address", "").strip(),
                "phone": row.get("phone", "").strip(),
                "region": row.get("region", "").strip(),
                "dialysis_machines": dialysis_machines,
                "has_dialysis_unit": has_dialysis,
                "night_dialysis": night_dialysis,
                "dialysis_days": row.get("dialysis_days", "").strip(),
                "naver_map_url": row.get("naver_map_url", "").strip(),
                "lat": lat,
                "lng": lng,
                "hira_grade": row.get("hira_grade", "").strip(),
                "ksn_certified": row.get("ksn_certified", "").strip(),
                "ksn_cert_date": row.get("ksn_cert_date", "").strip(),
                "specialist_count": specialist_count,
                "specialists": row.get("specialists", "").strip(),
                "nephrology_doctor": row.get("nephrology_doctor", "").strip(),
                "is_dialysis_specialist": is_dialysis_specialist
            })

    print(f"Loaded {len(hospitals)} hospitals from CSV.")
    
    # Write TS file
    with open(ts_path, mode='w', encoding='utf-8') as f:
        f.write("// 이 파일은 전처리된 1,523개 투석 병원 데이터를 기반으로 자동 생성되었습니다.\n")
        f.write("// 신장내과 전문의 명단 및 심평원 평가 등 추가 정보가 포함되어 있습니다.\n")
        f.write("import { Hospital } from '../services/hospitalApi';\n\n")
        f.write("export const FALLBACK_HOSPITALS: Hospital[] = ")
        
        # Format beautiful JS representation
        json_str = json.dumps(hospitals, ensure_ascii=False, indent=2)
        f.write(json_str)
        f.write(";\n")
        
    print(f"Successfully generated {ts_path}")

if __name__ == "__main__":
    generate_fallback()
