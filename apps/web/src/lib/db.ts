import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

// In CI, DATABASE_URL comes from the environment (GitHub Actions secret).
// For local dev, search upward from the working directory for a .env file.
// (Working-dir based, not import.meta.url based, so it survives bundling.)
if (!process.env.DATABASE_URL) {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) {
      config({ path: candidate });
      break;
    }
    dir = path.dirname(dir);
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. The public site reads content from Neon at build time. ' +
      'Set it in the monorepo-root .env (local) or as a GitHub Actions secret (CI).',
  );
}

// HTTP driver — no pooling needed, one-shot queries during the build.
export const sql = neon(url);
