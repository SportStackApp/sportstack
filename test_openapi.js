import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function test() {
  const url = "https://svierarfcolhcfjpmwck.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aWVyYXJmY29saGNmanBtd2NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjY1NTgsImV4cCI6MjA5MzkwMjU1OH0.UMkZt5lgFK87elwdnc8ctv6y12uiSnTdilMoZfIZfpw";
  const res = await fetch(url);
  const data = await res.json();
  console.log("Keys:", Object.keys(data));
  if (data.definitions) console.log("Definitions for teams:", Object.keys(data.definitions.teams?.properties || {}));
  if (data.components) console.log("Components.schemas.teams:", Object.keys(data.components?.schemas?.teams?.properties || {}));
}

test();
