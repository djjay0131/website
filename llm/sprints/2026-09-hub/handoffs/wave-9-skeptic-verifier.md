# Handoff — Skeptic Verifier, Wave 9 (D22)

- **Wave:** 9 · **Design:** owner D22, ADR-0024 · **Repos:** `cv` `feat/d22-cv-consolidation`, `website` `feat/d22-cv-consolidation`
- **Mode:** read-only; all mutation on copies under `/tmp/opencode/…`; break→red→restore→green.

**Headline:** every new guard was made to fail — none is un-failable. Two did
not prove what they appeared to, and both are fixed:

## Guard 1 — `cv/tools/page_budget.py` (+ CI `page-budget` job)

**Failable.** 3-page `research-2p` → exit 1; 2-page `one-page` → exit 1; the
injected counter is used by the tests; the CI job runs the exact command and
`publish` depends on it.

**Gap (was):** the budget was read from the variant's own `length`, with no
binding to the slug — a `research-2p.yaml` declaring `length: full` (or omitting
it, default `full`) let an arbitrarily long PDF pass. **Fixed**:
`expected_length_for_slug()` makes `*-2p` require `two-page` and `one-page`
require `one-page`; a relabel is now a violation. New tests pin it.

## Guard 2 — `site/src/lib/pdf-pages.mjs`

**Failable / correct on real output.** Matched `pdfinfo` on 15 real XeTeX PDFs
(1–4 pages, incl. FlateDecode ObjStm). Overcount is possible for a stream that
carries the literal `/Type /Page` and is unreferenced; undercount is the stated
design limit (non-Flate page objects). Display-only — the budget gate is `cv`'s.

## Guard 3 — `site/scripts/firebase-redirects.test.ts`

**Not vacuous.** Deleting a rule, flipping the Fellow 302→301, or adding a
redirect *to* the Fellow slug each turns it red.

## Guard 4 — `generate-redirect-map.mjs --check` (CI-wired)

**Failable; two defects (both fixed).**
- Over-fired in CI because it ran after `search:index` and the committed map was
  fixture-derived. **Fixed:** excluded `pagefind/`, `_payload/`, `404.html`
  (`route-inventory.mjs`); map regenerated from real content; `--check` now green
  on a real-content build.
- Fixture-derived baseline dropped the 12 real project routes. **Fixed** by the
  same regeneration.

## Guard 5 — `check-no-private-in-public.mjs` (Fellow CV)

**Non-vacuous.** `collectPrivateItems` returns `cv/anthropic-fellow` (allowlist
omits it); each needle shape — `qualified-id`, bounded `slug`, `route`,
`payload-path`, `title` — fires in CONTENTS with no matching path; a clean page
yields 0.

## Guards that could not be made to fail

None. The real findings were the inverse of the brief: Guard 4 **over-fired**,
Guard 1 **under-fired** for a mislabelled selector. Both are remediated.
