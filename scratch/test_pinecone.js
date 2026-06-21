const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

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

const pc = new Pinecone({
  apiKey: env.PINECONE_API_KEY || 'dummy_key',
});

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'dummy_key',
});

async function testPinecone() {
  console.log('Testing Pinecone connection...');
  console.log('API Key:', env.PINECONE_API_KEY);
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: '만성 신장병',
    });
    const [{ embedding }] = embeddingResponse.data;
    console.log('OpenAI Embedding Succeeded, dimension:', embedding.length);

    const index = pc.index('kongdang-papers');
    const queryResponse = await index.query({
      vector: embedding,
      topK: 2,
      includeMetadata: true,
    });
    console.log('Pinecone search result matches count:', queryResponse.matches?.length);
    console.log('Matches:', JSON.stringify(queryResponse.matches));
  } catch (err) {
    console.error('Error during Pinecone query:', err.message);
  }
}

testPinecone();
