import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"(.*?)"\s*$/) || line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      result[match[1]] = match[2];
    }
  });
  return result;
}

const env = { ...parseEnv(resolve(__dirname, '.env')), ...parseEnv(resolve(__dirname, '.env.local')) };

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing team_divisions...');
  const { data: tdData, error: tdError } = await supabase.from('teams').select('id, team_divisions(divisions(name))').limit(1);
  if (tdError) {
    console.error('team_divisions error:', tdError.message);
  } else {
    console.log('team_divisions success:', JSON.stringify(tdData, null, 2));
  }

  console.log('\nTesting division_id...');
  const { data: dData, error: dError } = await supabase.from('teams').select('id, divisions:division_id(name)').limit(1);
  if (dError) {
    console.error('division_id error:', dError.message);
  } else {
    console.log('division_id success:', JSON.stringify(dData, null, 2));
  }
}

test();
