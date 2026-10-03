# Handoff — `site`, Wave 5 (Phase 6)

Status: Delivered
Date: 2026-10-03
Stream: `site` (`site/**`)
Branch: `feat/phase-6`
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-5.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1..P7); ADR-0020
Issue: `hub-006`

## Summary

Implemented the four Phase 6 site deliverables: Pagefind over `dist-public` with
a public search page, an `@astrojs/rss` feed over effectively-public manifest
items, redirect stubs + `404.html` per ADR-0020, and the leak-check/demo
extension covering every derived output. The two script seams other streams
call now exist: **`npm run search:index`** and **`npm run redirects:stubs`**.

`.github/workflows/**` and `firebase.json` were not touched. Nothing was
committed.

## Files

Modified:

- `site/package.json` — added `pagefind` (devDependency) and `@astrojs/rss`;
  added `search:index` and `redirects:stubs`; `check:no-private-in-public` now
  passes `--stubs dist-redirects`.
- `site/package-lock.json` — the new dependency trees.
- `site/redirects/github-pages.json` — +2 entries (`/website/rss.xml`,
  `/website/search/`) so the committed map covers the two new public routes.
- `site/scripts/check-no-private-in-public.mjs` — derived-output enumeration,
  the structural search-index scope assertion, redirect-stub title/summary
  scan, `--stubs`, and an `isTextFile` binary-extension list.
- `site/scripts/demo-leak-check.mjs` — plants a private needle into each derived
  output and asserts the check names all of them.
- `site/src/layouts/Base.astro` — `<slot name="head">`, the footer `RSS` link
  (`/rss.xml`), and an RSS autodiscovery `<link>`; public layout only.

Added:

- `site/scripts/generate-redirect-stubs.mjs` — the stub/404 generator.
- `site/src/pages/search.astro` — the public Pagefind UI page.
- `site/src/pages/rss.xml.ts` — the `@astrojs/rss` endpoint.
- `site/src/lib/canonical-url.mjs` — the canonical origin (re-exports
  `DEFAULT_SITE_URL`), so feed/stub URLs never point at the retired Pages host.
- `site/src/lib/public-feed.mjs` — the testable feed item set.
- `site/.gitignore` — ignores `dist-redirects/` (kept in `site/**` so this
  stream touches nothing outside it; root `.gitignore` already holds the other
  two output dirs).
- Tests: `site/src/lib/public-feed.test.ts`,
  `site/scripts/generate-redirect-stubs.test.ts`,
  `site/scripts/check-derived-outputs.test.ts`,
  `site/scripts/wave-5-structure.test.ts`.

## Dependencies and supply chain (SEAM-P2)

`pagefind` was installed with `npm install --save-dev pagefind@^1.5.2`. Its
install added exactly two npm packages and ran **no** postinstall and made **no**
separate binary download and used **no** credential. The binary arrives as the
platform optional dependency `@pagefind/linux-x64`, resolved from the npm
registry like any package. `@astrojs/rss` was installed with
`npm install --save @astrojs/rss@^4.0.19`.

```
$ npm ls pagefind @astrojs/rss
├── @astrojs/rss@4.0.19
└── pagefind@1.5.2

$ ./node_modules/.bin/pagefind --version
pagefind 1.5.2
```

Lockfile entries (all `registry.npmjs.org`):

```
node_modules/pagefind              1.5.2  https://registry.npmjs.org/pagefind/-/pagefind-1.5.2.tgz
node_modules/@pagefind/linux-x64   1.5.2  https://registry.npmjs.org/@pagefind/linux-x64/-/linux-x64-1.5.2.tgz
node_modules/@astrojs/rss          4.0.19 https://registry.npmjs.org/@astrojs/rss/-/rss-4.0.19.tgz
```

## Exact check results

Run from `site/`:

```
### npm install
added/audited cleanly (only the report-only audit output).

### npm test
Test Files  30 passed (30)
     Tests  392 passed | 1 skipped (393)
```

Baseline before this wave: `26 passed (26)`, `360 passed | 1 skipped (361)`
(+4 files, +32 tests).

```
### npm run build:public
[build] 27 page(s) built in 1.54s
[hub-public-build] staged 3 payload file(s) for 1 public framed item(s)
# routes emitted include /rss.xml and /search/index.html

### npm run redirects:stubs
redirects:stubs: wrote 57 stub(s) + 404.html to dist-redirects/
redirects:stubs: also wrote 404.html into dist-public/ (Firebase serves it)
# 57 map entries -> 57 stubs; dist-public/404.html written

### npm run search:index
Indexed 29 pages
Finished in 0.134 seconds
# dist-public/pagefind/ EXISTS (pagefind-entry.json + fragment/ + index/ + wasm/ + UI)

### npm run build:private
[build] 6 page(s) built in 1.20s
# absence: search absent, pagefind absent, rss.xml absent, 404.html absent

### npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, route, payload path, title or
summary appears in any path or any file's contents under dist-public and no private
title or summary appears in any stub under dist-redirects
(210 file(s) scanned in dist-public, 58 in dist-redirects).
# derived outputs reported: og-card (2), search-text (10), rss (1), sitemap (2)

### npm run check:private-links
check:private-links: PASS — every link in 12 page(s) resolves under /p/ ...
(130 outbound anchor(s) allowed)

### npm run check:publish-allowlist
check:publish-allowlist: PASS (mode pr) — 14 entries, 0 conflicts, 0 stale.

### npm run demo:leak-check
check:no-private-in-public: 15 LEAK(S) of private content into the public outputs:
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak in all 7 output(s) ...
# exit 0: the guard fired, and named index.html, the private route path, rss.xml,
# sitemap-0.xml, pagefind/pagefind-entry.json, og-cards/<slug>.png and the stub.

### governance: node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout
PASS governance-links
PASS adr-index
PASS adr-status
PASS layout
4 of 4 checks passed, 0 failed.
```

Private-needle audit of the public derived outputs (fixture content): the
decompressed Pagefind fragments plus `rss.xml`/`sitemap-*.xml` contain **0**
occurrences of `anthropic-fellow`, `phd-milestones`, `milestones`,
`committee-dossier`, `internal-notes` or `Fellowship CV (fixture)`.

## Design decisions recorded (contract asks)

- **Missing RSS date — SKIPPED, with a warning.** The schema makes `date`
  required; a missing date only reaches `collectFeedItems` from a malformed
  manifest (which fails the build later). An undated item is skipped rather than
  given an invented `pubDate` (a feed that lies about chronology is worse than an
  absent item). `site/src/lib/public-feed.mjs`.
- **RSS item links** use the canonical origin (`https://jason.cusati.us/`) with
  trailing slashes (SEAM-P7), not `SITE_URL`, so the Pages variant cannot put the
  retired host in the feed. Only items with a real page are included: framed
  `html`/`bundle` items and `cv` PDFs; `data` payloads (e.g. `cv-data`) are
  skipped.
- **Redirect stubs** are written at the artifact-relative path the old URL maps
  to (`/website/cv/` → `cv/index.html`, `/website/build-info.json` →
  `build-info.json`) and forward to `https://jason.cusati.us/<to>`. `404.html`
  forwards only a legacy `/website/**` path; on Firebase an unknown canonical
  path shows a plain 404 rather than redirecting to itself (no loop).
- **`.pf_*` binary limit.** `pagefind`'s `.pf_index`/`.pf_fragment`/`.pf_meta`
  are gzip; they are declared binary (`BINARY_EXTENSIONS`) and are not content
  scanned. The compensating control is `checkSearchIndexScope`, which
  decompresses every fragment and asserts each URL is public-rooted, not under
  `/p/`, and resolves to a file that exists in this `dist-public`.
- **Redirect stubs and the leak check.** A stub must repeat the legacy path, and
  the committed map already names the private fellowship paths (ADR-0020
  decision 5 / Risks). `findRedirectStubLeaks` therefore flags a private
  **title** or **summary** in a stub, not the legacy path slug. The generated
  artifact is verified to contain no private title/summary.

## Hard problem (report, not fixed here)

**`npm run redirects:check` exits 1 — pre-existing, not caused by this wave.**
It builds the Pages variant and compares its routes with the committed map:

```
inventory: 48 routes; committed map: 57 entries
entries with no route in this build (not an error):
  (15 legacy entries)
routes missing from redirects/github-pages.json:
  /_payload/kgis/
  /_payload/kgis/assets/style.css
  /_payload/kgis/manifest.json
  /projects/fixture-one/
  /projects/fixture-two/
  /projects/kgis/kgis-docs/
```

The committed map was generated in Phase 1 against a real CV build; the local
tree here is the fixture, and the map predates the Wave 1 `kgis` source. This
failure was already recorded in `handoffs/site-astro-upgrade.md` §8
("`redirects:check` exits 1 — and did so before the upgrade too"), and
`redirects:check` appears in no workflow today. The two new routes this wave
adds (`/rss.xml`, `/search/`) **are** covered by the map, so this wave
introduces no new missing route.

The infra wave-5 contract (item 4) makes `redirects:check` a required CI step.
Before it can be required, someone with the real content must regenerate
`redirects/github-pages.json`, and `route-inventory.mjs` should exclude
`_payload/` (a hub-internal namespace the old Pages site never served) from
`EXCLUDED_BUILD_PREFIXES`, as it already excludes `_astro/`. Both are outside
this contract's `site-wave-5` requirements; flagging rather than expanding scope.

## Residual / notes

- A stub for a file-shaped legacy URL (`build-info.json`, `*.pdf`, `*.png`,
  `favicon.ico`, `sitemap-*.xml`, `robots.txt`) contains HTML at that exact
  path, so GitHub Pages will serve it with the extension's content type. This
  is the contract's literal "one meta-refresh stub per entry"; directory-shaped
  routes (the ones inbound links normally target) behave correctly. Worth a
  smoke check on the infra side.
- The public search page and `404.html` are indexed by Pagefind (they contain no
  private content); excluding them is a cosmetic follow-up, not a leak.
- `@astrojs/rss` pulls `fast-xml-parser`, `piccolore` and `zod`; the report-only
  `check:npm-audit` baseline is unchanged (the 6 high findings remain the
  `firebase`/`@grpc/grpc-js` set already accepted in `site/audit-baseline.json`).
