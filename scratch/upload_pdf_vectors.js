const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
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

const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/$/, '');
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 에러: NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 .env.local에 설정되어야 합니다.');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('❌ 에러: OPENAI_API_KEY 가 .env.local에 설정되어야 합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

const PARSED_JSON_PATH = path.join(__dirname, 'parsed_pdfs.json');

async function uploadVectors() {
  if (!fs.existsSync(PARSED_JSON_PATH)) {
    console.error(`❌ 에러: 파싱된 JSON 파일이 존재하지 않습니다: ${PARSED_JSON_PATH}. 먼저 python3 scratch/parse_pdfs.py 를 실행해 주세요.`);
    process.exit(1);
  }

  console.log('Loading parsed PDF chunks...');
  const chunks = JSON.parse(fs.readFileSync(PARSED_JSON_PATH, 'utf8'));
  console.log(`Loaded ${chunks.length} chunks.`);

  // 배치 처리 크기 설정
  const batchSize = 10;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)} (chunks ${i + 1} - ${Math.min(i + batchSize, chunks.length)})...`);

    // 1. 임베딩 동시 생성
    const embeddingPromises = batch.map(async (chunk) => {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.content,
        });
        return {
          ...chunk,
          embedding: response.data[0].embedding
        };
      } catch (err) {
        console.error(`Error embedding chunk ${chunk.id}:`, err.message);
        return null;
      }
    });

    const embeddedChunks = (await Promise.all(embeddingPromises)).filter(c => c !== null);

    // 2. 카테고리별 분기 업로드
    const welfareDocs = [];
    const paperDocs = [];

    embeddedChunks.forEach(chunk => {
      if (chunk.category === 'welfare') {
        welfareDocs.push({
          id: chunk.id,
          content: chunk.content,
          title: chunk.title,
          org: chunk.org,
          category: chunk.category,
          disease: chunk.disease,
          url: chunk.url || '',
          embedding: chunk.embedding
        });
      } else {
        paperDocs.push({
          id: chunk.id,
          title: chunk.title,
          content: chunk.content,
          org: chunk.org,
          url: chunk.url || '',
          doi: chunk.doi || '',
          disease: chunk.disease,
          embedding: chunk.embedding
        });
      }
    });

    // 3. Supabase 데이터베이스 삽입
    if (welfareDocs.length > 0) {
      console.log(`Upserting ${welfareDocs.length} welfare documents to welfare_documents...`);
      const { error } = await supabase
        .from('welfare_documents')
        .upsert(welfareDocs, { onConflict: 'id' });
      if (error) {
        console.error('❌ Welfare docs upsert failed:', error.message);
      } else {
        console.log('✅ Welfare docs upsert succeeded.');
      }
    }

    if (paperDocs.length > 0) {
      console.log(`Upserting ${paperDocs.length} papers to papers...`);
      const { error } = await supabase
        .from('papers')
        .upsert(paperDocs, { onConflict: 'id' });
      if (error) {
        console.error('❌ Papers upsert failed:', error.message);
      } else {
        console.log('✅ Papers upsert succeeded.');
      }
    }
  }

  console.log('\n🎉 All vector uploads completed successfully!');
}

uploadVectors();
