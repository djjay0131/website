// Build interface (SEAM-1): SITE_URL and SITE_BASE, both optional, defaulting to
// https://jason.cusati.us (ADR-0006) at "/". The GitHub Pages variant sets
// SITE_URL=https://djjay0131.github.io SITE_BASE=/website/.
//
// TWO OUTPUTS FROM ONE SOURCE TREE (ADR-0005 decision 1; SEAM-4), selected by
// HUB_OUTPUT. Unset means public, so every Phase 2 invocation behaves exactly as
// it did; see scripts/site-output.mjs for why an unrecognised value is an error
// rather than a fallback.
//
// ---------------------------------------------------------------------------
// WHY srcDir SWITCHES, AND WHY THAT IS THE WHOLE ANSWER TO "HOW CAN PRIVATE
// NAVIGATION NOT REACH THE PUBLIC BUILD"
// ---------------------------------------------------------------------------
// Astro routes exactly one directory: <srcDir>/pages. The public build's srcDir
// is ./src and the private build's is ./src-private, so:
//
//   - the public build never resolves src-private/pages/**, and therefore CANNOT
//     emit a private route or a private navigation entry. Not "does not" -- the
//     router is never shown those files;
//   - the private build never resolves src/pages/**, so dist-private contains
//     the private items and nothing else, rather than a second copy of the
//     public site sitting in the private bucket.
//
// The alternative -- one pages tree with `if (HUB_OUTPUT === 'private')` guards,
// or getStaticPaths returning [] -- keeps the private page modules inside the
// public build and makes the guarantee depend on every one of those guards being
// right, forever. This is a structural guarantee instead of a convention, which
// is what the Phase 3 contract asked for. scripts/private-structure.test.ts pins
// the import direction as the second half of it.
//
// There is still ONE content collection and ONE Zod mirror of the manifest
// schema: src-private/content.config.ts re-exports src/content.config.ts.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { resolveSiteEnv, withBase } from './scripts/site-env.mjs';
import { LEGACY_REDIRECTS, isExcludedFromSitemap } from './scripts/site-routes.mjs';
import { resolveHubOutput } from './scripts/site-output.mjs';
import { privateBuild } from './scripts/private-build.mjs';

const { site, base } = resolveSiteEnv(process.env);
const { outDir, isPrivate } = resolveHubOutput(process.env);

export default defineConfig({
  site,
  base,
  output: 'static',
  outDir,
  srcDir: isPrivate ? './src-private' : './src',
  // The sitemap is a PUBLIC-ONLY derived output (ADR-0005 Consequences: every
  // build-time output generated from collections must come from the public build
  // only). A sitemap of the private area would be a list of private URLs.
  integrations: isPrivate
    ? [privateBuild()]
    : [sitemap({ filter: (page) => !isExcludedFromSitemap(page, base) })],
  // The legacy GitHub Pages redirects are public routes and have no meaning in
  // the private output.
  redirects: isPrivate
    ? {}
    : Object.fromEntries(LEGACY_REDIRECTS.map(({ from, to }) => [`/${from}`, withBase(base, to)])),
});
