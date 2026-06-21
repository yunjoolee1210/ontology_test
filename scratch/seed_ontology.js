const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// .env.local 수동 파싱
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ 에러: DATABASE_URL 이 .env.local에 설정되어야 합니다.');
  console.error('예: DATABASE_URL=postgresql://postgres:[비밀번호]@db.jbwogaokapcxlespfokt.supabase.co:5432/postgres');
  process.exit(1);
}

const sqlFiles = [
  // 1. pgvector, papers 테이블 및 match_documents RPC 생성
  path.join(__dirname, '..', 'db', 'match_documents.sql'),
  
  // 2. 온톨로지 의도, 슬롯, 개념 구조 생성 및 데이터 삽입
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '01_ontology_intent_disease_concept.sql'),
  
  // 3. 병원 테이블 생성 및 1500여 건 데이터 삽입 (약 1MB)
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '02_hospitals_data.sql'),
  
  // 4. 위치 기반 병원 검색 및 의미 검색 RPC 함수 생성
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '03_hospital_search_rpc.sql'),
  
  // 5. 확장 온톨로지 데이터 삽입
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '04_extended_ontology_ckdo_htn_dmto.sql'),
  
  // 6. CDPEO 온톨로지 데이터 삽입
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '05_cdpeo_ontology.sql'),
  
  // 7. HTO 온톨로지 데이터 삽입
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '06_hto_ontology.sql'),
  
  // 8. 통합 한글 온톨로지 역색인 데이터 생성
  path.join(__dirname, '..', 'app', 'ontology', 'supabase', '07_unified_korean_index.sql'),
];

async function seedDatabase() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false } // Supabase 연결 시 SSL 지원 필요
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully! Starting seed migrations...\n');

    for (const sqlFile of sqlFiles) {
      const fileName = path.basename(sqlFile);
      console.log(`Running: ${fileName}...`);
      
      if (!fs.existsSync(sqlFile)) {
        throw new Error(`Migration file not found: ${sqlFile}`);
      }
      
      const sqlContent = fs.readFileSync(sqlFile, 'utf8');
      
      // SQL 실행
      await client.query(sqlContent);
      console.log(`✅ Finished ${fileName} successfully.`);
    }

    console.log('\n🎉 All database migrations and seeding finished successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed during execution:', err.message);
  } finally {
    await client.end();
  }
}

seedDatabase();
