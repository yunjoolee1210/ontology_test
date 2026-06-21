const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local to avoid dependency issues
const envPath = path.join(__dirname, '../.env.local');
let supabaseUrl = 'https://jbwogaokapcxlespfokt.supabase.co';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const matchUrl = line.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (matchUrl) supabaseUrl = matchUrl[1].trim();
    const matchKey = line.match(/^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*["']?(.*?)["']?\s*$/);
    if (matchKey) supabaseAnonKey = matchKey[1].trim();
  }
}

if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/$/, '');
}

console.log('Connecting to Supabase Url:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'cdpeo_concepts',
  'cdpeo_swrl_rules',
  'hto_concepts',
  'hto_relations',
  'concept_registry',
  'concept_same_as',
  'korean_colloquial_index'
];

async function verifyOntologyTables() {
  console.log('--- Checking Ontology Tables in Supabase (Select Row Limit 3) ---');
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(3);

      if (error) {
        console.log(`❌ Table [${table}]: ERROR - ${error.message}`);
      } else {
        console.log(`✅ Table [${table}]: EXISTS, Found ${data.length} rows (sampled:`, JSON.stringify(data), `)`);
      }
    } catch (err) {
      console.log(`❌ Table [${table}]: EXCEPTION - ${err.message}`);
    }
  }

  // Check RPC search_korean_concept
  try {
    const { data, error } = await supabase.rpc('search_korean_concept', { query_text: '콩팥병' });
    if (error) {
      console.log(`❌ RPC [search_korean_concept]: ERROR - ${error.message}`);
    } else {
      console.log(`✅ RPC [search_korean_concept]: EXISTS, returns ${data.length} concepts for query "콩팥병"`);
      console.log('Sample result:', data.slice(0, 2));
    }
  } catch (err) {
    console.log(`❌ RPC [search_korean_concept]: EXCEPTION - ${err.message}`);
  }
}

verifyOntologyTables();
