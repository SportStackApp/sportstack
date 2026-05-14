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
  const rDivs = await request('/rest/v1/divisions?select=*&limit=1');
  console.log('divisions status:', rDivs.status);
  console.log('divisions data:', rDivs.data);
  
  const rTeamDivs = await request('/rest/v1/team_divisions?select=*&limit=1');
  console.log('team_divisions status:', rTeamDivs.status);
  console.log('team_divisions data:', rTeamDivs.data);
}

test();
