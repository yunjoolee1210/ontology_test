import os
import sys
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# Load env file from the project root
BASE_DIR = "/Users/yunjoolee/Desktop/ai-service/carekidney-clean"
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
# Use service_role key to bypass any RLS restriction for writing
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

PROCESSED_CSV = os.path.join(BASE_DIR, "data/hospitals_2066_processed.csv")

def main():
    print("\n" + "=" * 80)
    print("🚀 SUPABASE DATA INTEGRATION PIPELINE START")
    print("=" * 80)

    # 1. Verify credentials
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from .env!")
        print("   Please add the following variables to your .env file:")
        print("   SUPABASE_URL=\"https://your-project.supabase.co\"")
        print("   SUPABASE_SERVICE_KEY=\"your-service-role-key\"")
        print("=" * 80 + "\n")
        sys.exit(1)

    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Supabase Key: {SUPABASE_KEY[:6]}...{SUPABASE_KEY[-6:]}")

    # 2. Check processed CSV existence
    if not os.path.exists(PROCESSED_CSV):
        print(f"❌ Error: Processed CSV not found at: {PROCESSED_CSV}")
        print("   Please run the preprocessing script first:")
        print("   python3 preprocess/hospital_dialysis_preprocess_v2.py")
        sys.exit(1)

    df = pd.read_csv(PROCESSED_CSV)
    print(f"Loaded processed dataset. Total records: {len(df)}")

    # 3. Connect to Supabase
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Successfully connected to Supabase Client.")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)

    # 4. Truncate table (delete all existing rows)
    # RLS bypass using service_role key is required here
    print("\n🔄 Clearing existing dialysis_hospitals records (Truncating)...")
    try:
        # Delete all records
        delete_resp = supabase.table("dialysis_hospitals").delete().neq("name", "").execute()
        print("✅ Successfully cleared existing records in table 'dialysis_hospitals'.")
    except Exception as e:
        print(f"❌ Failed to clear table: {e}")
        print("   Make sure the table 'dialysis_hospitals' exists and RLS allows deletes (use service_role key).")
        sys.exit(1)

    # 5. Filter and map database columns
    # Expected columns: name, address, phone, region, dialysis_machines, has_dialysis_unit, night_dialysis, dialysis_days, naver_map_url, lat, lng
    db_cols = [
        "name", "address", "phone", "region", "dialysis_machines", 
        "has_dialysis_unit", "night_dialysis", "dialysis_days", 
        "naver_map_url", "lat", "lng"
    ]
    
    # Fill missing strings and parse datatypes
    upload_df = df[db_cols].copy()
    upload_df["address"] = upload_df["address"].fillna("")
    upload_df["phone"] = upload_df["phone"].fillna("")
    upload_df["region"] = upload_df["region"].fillna("")
    upload_df["dialysis_days"] = upload_df["dialysis_days"].fillna("")
    upload_df["naver_map_url"] = upload_df["naver_map_url"].fillna("")
    
    upload_df["dialysis_machines"] = upload_df["dialysis_machines"].astype(int)
    upload_df["has_dialysis_unit"] = upload_df["has_dialysis_unit"].astype(bool)
    upload_df["night_dialysis"] = upload_df["night_dialysis"].astype(bool)
    upload_df["lat"] = upload_df["lat"].astype(float)
    upload_df["lng"] = upload_df["lng"].astype(float)

    # Convert to list of dicts
    records = upload_df.to_dict(orient="records")

    # 6. Bulk Insert in Optimized Batches (150 rows per batch)
    BATCH_SIZE = 150
    total_records = len(records)
    inserted_count = 0
    
    print(f"\n📤 Uploading {total_records} records in batches of {BATCH_SIZE}...")
    
    for i in range(0, total_records, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            resp = supabase.table("dialysis_hospitals").insert(batch).execute()
            inserted_count += len(batch)
            print(f"   Batch {i // BATCH_SIZE + 1}: Uploaded rows {i} to {i + len(batch)} ({inserted_count}/{total_records})... ✅")
        except Exception as e:
            print(f"❌ Error inserting batch starting at row {i}: {e}")
            print("   Aborting upload to prevent partial loading.")
            sys.exit(1)

    print("\n" + "=" * 80)
    print(f"🎉 SUCCESS! Successfully uploaded {inserted_count}/{total_records} records to Supabase 'dialysis_hospitals' table!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
