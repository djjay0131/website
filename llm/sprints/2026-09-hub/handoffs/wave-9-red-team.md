# Handoff — Red Team, Wave 9 (D22)

- **Wave:** 9 · **Design:** owner D22, ADR-0024 · **Repos:** `cv` `feat/d22-cv-consolidation`, `website` `feat/d22-cv-consolidation`
- **Mode:** read-only adversarial review; no tracked file modified (only gitignored build output and `/tmp` fixtures).

## Required targets

| # | Attack | Result | Evidence |
|---|---|---|---|
| 1 | Fellow slug/title/summary/path in the **redirect map** and generated **stubs** | REFUSED | map regenerated from the public build; `grep -F anthropic redirects/github-pages.json` → nothing; `grep -rF anthropic dist-redirects` → nothing; `--check` "every inventoried route covered". The private page is never built, so it has no route. |
| 2 | Fellow needles in **OG** | REFUSED | `check-no-private-in-public` scans og-card; `grep -rlF "Anthropic Fellow" dist-public` → 0 |
| 3 | Fellow needles in **sitemap** | REFUSED | `sitemap-0.xml` CV `<loc>`s = 6 (`/cv/` + 5), no fellow |
| 4 | Fellow needles in **Pagefind** (incl. gzip `.pf_*`) | REFUSED | indexed CV URLs = 6; `checkSearchIndexScope` → 0 problems |
| 5 | Fellow needles in **RSS** | REFUSED | `rss.xml` CV items = 5 |
| 6 | Fellow via **bucket-listing-derived staging** (raw payload/assets) | REFUSED | no `cv-data`/`*.yaml`/`*.bib` staged into `dist-public`; `public/pdfs` = 5, no fellow |
| 7 | 3-page `research-2p` with an **honest** selector | REFUSED | `FAILED: research-2p: length 'two-page' allows at most 2 pages, built 3`, exit 1 |
| 8 | Defeat budget by **relabelling `length`** (`research-2p` → `length: full`) | **SUCCEEDED (Low) — FIXED** | before the fix: 3-page PDF with `length: full` → exit 0. **Fixed** by binding the slug to its budget: `expected_length_for_slug` in `tools/page_budget.py`; now `research-2p: the slug implies length 'two-page', but the selector declares 'full'`. |
| 9 | Bypass budget via **out-of-band publish** (hub does not re-check page counts) | SUCCEEDED (Low, by trust model) | the budget is a `cv`-CI guard; the hub allowlist binds names, not page counts. Recorded as a residual in ADR-0024. |
| 10 | A 301 redirecting to a **private** target | REFUSED | only Fellow rules are 302 → `/signin/`; no destination names `anthropic-fellow`; `firebase-redirects.test.ts` pins it |
| 11 | A 301 redirecting to a **nonexistent** URL | REFUSED | every 301 destination resolves in `dist-public` |
| 12 | `/resumes/research-professional/` handled | REFUSED (caveat: lands on the `/cv/` index via `/resumes/**`, not variant-specific) |
| 13 | CV index lists exactly the five public documents | REFUSED | featured one-page + Research(2) + Professional(2) = 5; `/cv/` = index + 5 |
| 14 | Latent grouping: a public `track: both` non-one-page variant would be omitted from `/cv/` | noted (Low, not exploitable today) |

## Dispositions

- #1–#6, #10–#13 **accept** — the private surfaces are clean; redirects are correct.
- #7 accept / **#8 fixed** — the budget is now bound to the slug, not self-declared.
- #9 note — recorded as an ADR-0024 residual (name-not-bytes, extended to page counts).
- #14 note — harden `cv/index.astro` grouping if a `track: both` public document is ever added.

## Environment note

Mid-session the gitignored `site/src/content/sources` tree was temporarily swapped by a local `data:link`; the reviewer restored it with `content:fixture` and reproduced identical results on both trees. Not a product defect.
