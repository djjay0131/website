# Contract — `site`, Wave 5 (Phase 6)

Status: Issued · Date: 2026-10-03 · Branch: `feat/phase-6`
Stream: `site` (`site/**`) · Issue: `hub-006`
Seams: `contracts/phase-6-seams.md` (SEAM-P1..P7)

## Requirements

1. **Pagefind (SEAM-P2).** Add `pagefind` to `site/package.json` (record the
   version and lockfile entry). Add an `npm run search:index` script that runs
   Pagefind over `dist-public` into `dist-public/pagefind/`. Add a public search
   page (`site/src/pages/search.astro` or equivalent) with a minimal accessible
   search UI that loads the Pagefind UI/assets and searches the public index.
   The private build must NOT emit a search page or index.
2. **RSS (SEAM-P3).** Add `@astrojs/rss`; add `site/src/pages/rss.xml.ts` over
   effectively-public manifest items (absolute canonical URLs, dates; state how
   a missing `date` is handled). Point the public footer's `RSS` slot at
   `/rss.xml` (public layout only). No RSS in the private build.
3. **Redirect stubs + 404 (SEAM-P5, ADR-0020).** Add a generator (e.g.
   `site/scripts/generate-redirect-stubs.mjs`) that reads
   `site/redirects/github-pages.json` and writes, into `site/dist-redirects/`,
   one meta-refresh stub per entry forwarding to `https://jason.cusati.us/<to>`,
   plus a `404.html`. Also emit `404.html` into `dist-public` (Firebase serves
   it). Every stub contains only the path/target — no private slug/title.
4. **Leak check covers the derived outputs (SEAM-P6).** Extend
   `check-no-private-in-public.mjs` so the sitemap, `rss.xml`, the Pagefind text
   files, the OG card and the redirect stubs are explicitly enumerated and
   covered; document the binary limit (`.pf_*` fragments, PNG OG bytes) and add
   a structural assertion that the search index was built from `dist-public`
   only. Extend `demo:leak-check` to plant a private needle into each derived
   output (search index JSON, rss.xml, sitemap, a stub, the og card path) and
   show the check red.
5. **Tests.** Vitest for the stub generator, the RSS item set (public-only), the
   search page presence/absence per build, and the leak-check extension. Keep
   `npm test` green.

Do not touch `.github/workflows/**` or `firebase.json` (the `infra` stream owns
the workflow wiring in this wave). Report any change that must happen there.
