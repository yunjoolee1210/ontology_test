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

async function checkWelfare() {
  try {
    const { data, count, error } = await supabase
      .from('welfare_documents')
      .select('*', { count: 'exact' });

    if (error) {
      console.log('Error querying welfare_documents:', error.message);
    } else {
      console.log('Successfully read welfare_documents. Row Count:', count);
      console.log('Sample Row:', data.slice(0, 1));
    }

    // Also check search_welfare RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_welfare', {
      query: '산정특례',
      match_count: 5
    });

    if (rpcError) {
      console.log('Error calling search_welfare RPC:', rpcError.message);
    } else {
      console.log('Successfully called search_welfare RPC. Found:', rpcData.length, 'docs');
      console.log('Sample RPC Result:', rpcData.slice(0, 1));
    }

  } catch (err) {
    console.error('Exception:', err);
  }
}

checkWelfare();
