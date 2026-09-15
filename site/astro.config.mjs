// Build interface (SEAM-1): SITE_URL and SITE_BASE, both optional, defaulting to
// https://cusati.us at "/". The GitHub Pages variant sets
// SITE_URL=https://djjay0131.github.io SITE_BASE=/website/. Static output to
// dist-public/, no adapter.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { resolveSiteEnv, withBase } from './scripts/site-env.mjs';
import { LEGACY_REDIRECTS, isExcludedFromSitemap } from './scripts/site-routes.mjs';

const { site, base } = resolveSiteEnv(process.env);

export default defineConfig({
  site,
  base,
  output: 'static',
  outDir: './dist-public',
  integrations: [sitemap({ filter: (page) => !isExcludedFromSitemap(page, base) })],
  redirects: Object.fromEntries(LEGACY_REDIRECTS.map(({ from, to }) => [`/${from}`, withBase(base, to)])),
});
