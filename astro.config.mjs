import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({ site: 'https://djjay0131.github.io', base: '/website/', integrations: [sitemap()],
  redirects: {
    '/research/agentic-harnesses': '/website/research/soa-agentic-se/agentic-harnesses',
    '/research/agentic-harnesses/synthesis': '/website/research/soa-agentic-se/agentic-harnesses/synthesis',
    '/research/agentic-harnesses/sources': '/website/research/soa-agentic-se/agentic-harnesses/sources',
    '/research/agentic-harnesses/consensus': '/website/research/soa-agentic-se/agentic-harnesses/consensus',
  } });
