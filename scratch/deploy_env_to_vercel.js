const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
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

const variablesToSync = [
  'OPENAI_API_KEY',
  'PINECONE_API_KEY',
  'PINECONE_INDEX_PAPERS',
  'PINECONE_INDEX_WELFARE',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

console.log('Syncing environment variables to Vercel project (kongdang-next)...');

for (const key of variablesToSync) {
  if (env[key]) {
    console.log(`Setting ${key}...`);
    try {
      for (const envName of ['production', 'preview', 'development']) {
        try {
          execSync(`vercel env rm ${key} ${envName} -y`, { stdio: 'ignore' });
        } catch (e) {
          // ignore
        }
        execSync(`echo "${env[key]}" | vercel env add ${key} ${envName}`, { stdio: 'inherit' });
      }
      console.log(`✅ ${key} synced.`);
    } catch (err) {
      console.error(`❌ Failed to sync ${key}:`, err.message);
    }
  } else {
    console.warn(`⚠️ Warning: ${key} not found in .env.local. Skipping.`);
  }
}

console.log('🎉 Environment variables sync complete!');
