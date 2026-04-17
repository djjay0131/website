// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://djjay0131.github.io',
  base: '/website/',
  integrations: [sitemap()],
});
