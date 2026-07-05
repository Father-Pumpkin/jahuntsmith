import { createClient } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  throw new Error(
    'Missing VITE_NEON_AUTH_URL / VITE_NEON_DATA_API_URL. Copy .env.example to .env.',
  );
}

// One client for both auth and Data API queries. The JWT is injected into
// Data API requests automatically once the user is signed in.
export const client = createClient({
  auth: { url: authUrl },
  dataApi: { url: dataApiUrl },
});
