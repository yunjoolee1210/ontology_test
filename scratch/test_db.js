const { createClient } = require('@supabase/supabase-js');
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

let supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl && supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/$/, '');
}
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log('Testing update on user_profiles...');
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: '8063dee0-6391-4af5-910a-b4960fa485e6', // dummy UUID
      role: 'patient',
      ckd_stage: '3a',
      dialysis_type: '해당없음',
      diabetes_type: '2형',
      medication: '경구약',
      other_conditions: ['고혈압'],
    });

  if (error) {
    console.error('Upsert failed:', error.message, error.code);
  } else {
    console.log('Upsert succeeded!');
  }
}

testInsert();
