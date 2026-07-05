// @ts-check
import { defineConfig } from 'astro/config';

// Apex custom domain → base path is '/'.
// `site` drives canonical URLs, the sitemap, and absolute links in the RSS feed.
export default defineConfig({
  site: 'https://jahuntsmith.com',
  trailingSlash: 'ignore',
});
