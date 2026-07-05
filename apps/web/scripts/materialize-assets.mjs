// Runs before `astro build` (and `astro dev`). Pulls uploaded files out of the
// `assets` table and writes them into public/assets/<id>.<ext> so the static
// site can serve them. Regenerated from scratch every build.
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) {
  const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(rootEnv)) config({ path: rootEnv });
}

const url = process.env.DATABASE_URL;
const outDir = fileURLToPath(new URL('../public/assets/', import.meta.url));

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

if (!url) {
  console.warn('[materialize-assets] DATABASE_URL not set — writing no assets.');
  process.exit(0);
}

const sql = neon(url);
const assets = await sql`select id, filename, content_type, data from assets`;

for (const a of assets) {
  const ext = (a.filename?.split('.').pop() || 'bin').toLowerCase();
  const buf = Buffer.from(a.data, 'base64');
  await writeFile(path.join(outDir, `${a.id}.${ext}`), buf);
}

console.log(`[materialize-assets] wrote ${assets.length} asset(s) to public/assets/`);
