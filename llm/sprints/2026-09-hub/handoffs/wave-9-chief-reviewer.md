# Handoff — Chief Reviewer, Wave 9 (D22)

- **Satellite:** `djjay0131/cv#16` (`feat/d22-cv-consolidation`)
- **Hub:** `djjay0131/website#126` (`feat/d22-cv-consolidation`)
- **Authority read:** ADR-0024, ADR-0016, ADR-0009, ADR-0020, STATE D22.

## Verdict

**Request changes** at review time; all must-fixes are now applied.

## Verified by me (ran, not accepted)

- Contract frozen: `git diff main...HEAD -- contract/` (hub) and
  `master...HEAD -- contract/` (cv) are both empty.
- Decision 2 self-consistent: claim table `["1","2"]`; `CV_DATA_SCHEMA_VERSION = "2"`.
- Six variants; `visibility: private` only on `anthropic-fellow`; allowlist has
  exactly the five public slugs + `cv-data`, no Fellow.
- Page-budget code: `publish: needs [build, page-budget]`; 16 tests pass.
- Hub tests: 106 across the touched files; governance `--layout` 4/4 PASS; ADR
  index "Accepted" matches the file Status.
- Redirects: 301s for `/resumes{,/,**}` and the retired slugs/PDFs; Fellow stays
  302 → `/signin/` and is never a destination.

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | must-fix | `github-pages.json` regenerated from fixtures; 12 real project routes missing — but I noted my reproduction was affected by the reviewer's other sub-agent running concurrently | **FIXED.** Regenerated from a real-content build: 72 entries, 26 project routes; `redirects:check` green. |
| 2 | must-fix | `site/src-private/layouts/PrivateBase.astro:68` still linked "Resumes" | **FIXED.** Removed. |
| 3 | should-fix | Fixture slugs and `_payload/**` entered the map | **FIXED.** `_payload/`, `pagefind/`, `404.html` excluded; real map restored. |
| 4 | should-fix | stale `/resumes/` comments (`public-feed.mjs`, `projects/index.astro`, `[section]/[source]/[slug].astro`) | **FIXED.** |
| 5 | should-fix | "either merge order is safe" overstated | **FIXED.** ADR-0024 and STATE now state satellite-first and why. |
| 6 | note | removing the private fellowship path from the map is a change vs ADR-0020's risk note | Recorded: the Pages `404.html` prefix-strip still forwards it; the public `dist-public/404.html` carries no private path. |
| 7 | note | `build.yml:52` comment cited `/cv/academic` | **FIXED.** |
| 8 | note | test-count / page-count drift in prose | **FIXED.** |
| 9 | note | `contract/README.md` still says `@main` (out of scope; contract untouched) | Tracked separately. |

## UNVERIFIABLE

- The live GitHub CI result for `redirects:check` on the bucket/release-fed job;
  reproduced locally against a real-content build instead.
- Live built-PDF page counts (from the satellite PR body / CI job).
- The roster reports existed only as sub-agent sessions at review time; they are
  now persisted alongside this one.
