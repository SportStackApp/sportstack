import https from 'https';
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
    if (match) result[match[1]] = match[2];
  });
  return result;
}

const env = { ...parseEnv(resolve(__dirname, '.env')), ...parseEnv(resolve(__dirname, '.env.local')) };
const apikey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const hostname = env.VITE_SUPABASE_URL.replace('https://', '');

function request(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: { 'apikey': apikey, 'Authorization': `Bearer ${apikey}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('Testing team_divisions...');
  const r1 = await request('/rest/v1/teams?select=id,team_divisions(divisions(name))&limit=1');
  console.log('r1 status:', r1.status);
  console.log('r1 data:', r1.data);

  console.log('\nTesting division_id...');
  const r2 = await request('/rest/v1/teams?select=id,divisions:division_id(name)&limit=1');
  console.log('r2 status:', r2.status);
  console.log('r2 data:', r2.data);
}

test();
