import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://jahuntsmith.com/admin/ on GitHub Pages.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
});
