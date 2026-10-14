# Handoff — Security Tester, Wave 9 (D22)

- **Wave:** 9 · **Design:** owner D22, ADR-0024 · **Repos:** `cv` `feat/d22-cv-consolidation` (`fe13b0f`), `website` `feat/d22-cv-consolidation` (`550255d`)
- **Mode:** read-only; no tracked file modified.

## Checks

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Private content off the public path | **PASS** | `build:public` 36 pages; `check-no-private-in-public --stubs dist-redirects` PASS (240 files + 43 stubs, 0 leaks); `demo-leak-check.mjs` **proves the guard non-vacuous** (exits 1 on the injected leak). Fellow needles absent from `dist-public`, sitemap, RSS, OG. |
| 2 | Allowlist is the authority | **PASS** | `check-publish-allowlist --mode pr` — 22 entries, 0 conflicts, 0 stale; `cv/anthropic-fellow` absent; no entry names a `private` manifest item. |
| 3 | Private build parity | **PASS** | Fellow reachable only under `/p/`; private index links the five public ones **out**, no duplicate bytes in the private bucket. |
| 4 | Redirect safety | **PASS** | Fellow paths are 302 → `/signin/`, never 301; 0 destinations name `anthropic-fellow`; all 12 301s target public paths. |
| 5 | Contract integrity | **PASS** | `git diff -- contract/` empty in both repos; claim table accepts `"1"` and `"2"`, rejects unknown. |
| 6 | Supply chain | **PASS** (advisory) | No JS dependency added (lockfile byte-identical to `main`). `check:npm-audit` exits 1 from advisory-DB drift, not this change (CI runs it `--report`). Advisory: `pypdf` was unpinned — **now `pypdf>=4,<7`**. |
| 7 | Schema/version ordering | **PASS** | `cv-data` `schema_version "2"` builds on this commit; `content.config.test.ts` asserts `["1","2"]`. |

## Additional finding — the commit's own newly-wired check (was FAIL, now FIXED)

`redirects:check` was red against real content: the committed map had been
regenerated from **fixture** content, dropping the 12 real `/projects/*` routes
(and adding fixture slugs), and the CI step ran *after* `search:index`, so
`dist-public/pagefind/**` and `404.html` were uninventoried. Both are now fixed:
the route inventory excludes `_payload/`, `pagefind/` and `404.html`
(`site/scripts/route-inventory.mjs`), and the map was regenerated from a
real-content build (72 entries, 26 project routes). `redirects:check --dist
dist-public` now exits 0 ("every inventoried route is covered").

## VERDICT: PASS

0 FAIL after remediation. The Fellow CV is off every public surface; the leak
guard is proven non-vacuous; `/p/` parity is correct; the contract is
byte-unchanged; no dependency is added; both `cv-data` versions build.
