# Handoff — Skeptic Verifier, Wave 5 (Phase 6)

Agent: Skeptic Verifier (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` (Skeptic section)
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1..P7); ADR-0020; ADR-0005
Repo: `/home/djjay/code/website` · branch `feat/phase-6` · HEAD `1cecb35`
Issue: `hub-006`

## Headline

**6 fail-able. 1 un-failable. 4 coverage gaps.**

Every requested break was applied in place with a unique anchor, the covering
check run, then reverted (`git checkout -- <file>` for the edited file). The
whole tracked tree is clean at the end (`git diff --exit-code` prints nothing,
`git status --porcelain` empty). Baseline and restored suite: **30 files, 392
passed | 1 skipped (393)**.

| Count | Meaning |
|---|---|
| 6 | guard items whose violation produced a red named check (table below) |
| 1 | guard that is correct in code but **no committed test observes**: the stub generator's HTML escaping |
| 4 | coverage gaps — no guard or no test at all (path traversal, CI wiring, `redirects:check`, synthetic Pagefind coverage) |

The load-bearing surprises: (1) **the stub generator's `escapeHtml` is un-tested**
— replacing it with `String(value)` emits a live `<script>` into the meta-refresh
and the full suite still reads `392 passed | 1 skipped`; (2) **`from` is only
prefix-checked, never `..`-checked** — `from: "/website/../escaped/"` makes
`generateRedirectStubs` write `index.html` *outside* its `outDir` (demonstrated);
and (3) **no committed test or wiring guard names any Wave 5 CI step or the Pages
artifact path**, so the ADR-0020 "stubs only" upload is enforced only at runtime
by a post-deploy smoke check that does not run on pull requests.

## Method

Baseline first (`npx vitest run` → 30 files, 392 passed | 1 skipped). Each break:
unique-anchor edit → run the named file(s) → capture the red test name → revert
via `Edit` back to the exact original text → rerun green → `git diff --exit-code
-- <file>` clean. The `demo:leak-check` run uses the real public build already in
`site/dist-public` and the synced fixture content (4 effectively-private items);
the demo copies to a temp dir and never touches the real outputs. The dist-private
break added a temporary untracked `src-private/pages/rss.xml.ts`, rebuilt, then
deleted it and rebuilt; `dist-*` is gitignored. No CI job was run; the CI section
is read from `.github/workflows/build.yml` (parsed with PyYAML) plus reasoning.
`actionlint` is **NOT TESTED** (not installed on this host).

## Guard results — one row per guard item

| # | Guard (file:line) | Break applied | Exact failing check (name) | Verdict |
|---|---|---|---|---|
| 1 | `stubRelativePath` base validation `generate-redirect-stubs.mjs:65` | `if (!raw.startsWith(base))` → `if (false)` | `generate-redirect-stubs.test.ts > stubRelativePath maps a /website/<path> URL into the Pages artifact > refuses an entry that is not under the retired base, rather than writing it wrong` | **fail-able** |
| 2 | `normalizeMap` `to` validation `generate-redirect-stubs.mjs:150` | `if (!from \|\| !to)` → `if (!from)` | `generate-redirect-stubs.test.ts > generateRedirectStubs writes the stubs-only artifact > rejects a malformed map rather than writing a partial artifact` | **fail-able** |
| 3 | `escapeHtml` escaping `generate-redirect-stubs.mjs:76-83` | body → `return String(value);` | **none** — full suite `392 passed \| 1 skipped`, unchanged. `renderStub({to:"/\"><script>alert(1)</script>"})` emits the script unescaped | **un-failable** (coverage gap G0) |
| 4 | `needlesFor` title needle `check-no-private-in-public.mjs:246` | `[["title",…],["summary",…]]` → `[["summary",…]]` | `check-derived-outputs.test.ts > findRedirectStubLeaks scans stubs for titles/summaries (SEAM-P6) > flags a private title planted into a stub`; **+4** in `check-no-private-in-public.test.ts` (title/escaped-title/content/needle-kinds) | **fail-able** |
| 5 | `checkSearchIndexScope` `/p/` gate `check-no-private-in-public.mjs:498` | `if (url === "/p/" \|\| url.startsWith("/p/"))` → `if (false)` | `check-derived-outputs.test.ts > checkSearchIndexScope: the index must be built from dist-public only (SEAM-P6) > rejects an index URL under the private gate base /p/` | **fail-able** |
| 6 | `listDerivedOutputs` og-card naming `check-no-private-in-public.mjs:421` | line → `if (false) out.push({kind:"og-card",…})` | `check-derived-outputs.test.ts > listDerivedOutputs names the derived outputs (SEAM-P6) > finds the sitemap, rss, og-card and the Pagefind text files` | **fail-able** |
| 7 | private-build absence `wave-5-structure.test.ts:42-50` (+ `:22-32`) | added temp `src-private/pages/rss.xml.ts`, ran `npm run build:private` | `has no search page, no pagefind index, no rss.xml and no 404.html`; also `has no /search/ and no /rss.xml route` and `has no search.astro or rss.xml.ts source file` | **fail-able** |

### The contract's specific asks

**Stub generator escaping and `from`/`to` validation.** `from`/`to` validation is
fail-able (#1, #2). Escaping is **not** (#3): the code escapes correctly, but
`generate-redirect-stubs.test.ts` only asserts the *clean* target string; no test
feeds a markup-bearing `to`, so removing `escapeHtml` in full turns nothing red.
The `to` **scheme** vector (`javascript:…`) is neutralized in code because
`canonicalTarget` prefixes `https://jason.cusati.us/`, making it a path — but no
test pins that either.

**Leak check's derived-output coverage.** Removing a needle call (#4) makes
`npm run demo:leak-check` exit **1** with:

```
demo:leak-check: the check failed, but did NOT name these planted derived
output(s): pagefind/pagefind-entry.json, cv/index.html. A derived output the
guard cannot see is an uncovered leak.
```

That is the demo's own cross-check firing exactly as designed. The named vitest
test for the stub scan also goes red, plus the title/escaped-title content tests.
`checkSearchIndexScope` (#5) and `listDerivedOutputs` (#6) are separately
fail-able. So the newly *named* derived outputs (sitemap, RSS, Pagefind text, OG
card, stubs) each have a committed test that turns red when their coverage is
removed.

**Search/RSS absence from `dist-private`.** Fail-able at both layers (#7): the
routing test goes red the moment a `src-private/pages/{search.astro,rss.xml.ts}`
exists, and the built-output test goes red once `build:private` emits `rss.xml`
(and, by the same route, would catch `/search/`, `pagefind/`, `404.html`).

**CI steps (reasoned, not run).** See the table below. The steps are fail-able
*when they execute* (a failing command fails its job), but **none of their
presence, order, or target paths is asserted anywhere static**.

| Wave 5 CI step (`.github/workflows/build.yml`) | Executes on | Fails red when | Static guard? |
|---|---|---|---|
| `Build the search index` (build, `:1095`; build-firebase, `:1230`) → `npm run search:index` | build / PR / deploy | `pagefind` missing or errors | none — see G2 |
| `Generate the redirect stubs…` (build `:1108`, build-firebase `:1238`) → `npm run redirects:stubs` | build / PR / deploy | generator throws / map malformed | none |
| `Upload the redirect stubs to Pages` `:1136-1139`, `path: site/dist-redirects` | build | `dist-redirects` absent/empty | none; only post-deploy smoke-test |
| `Deploy the redirect stubs` `:1318` | deploy (non-PR) | deploy-pages fails | none |
| `Verify the retired Pages root…` `:1339`, `Verify a redirect stub forwards…` `:1354` | smoke-test (**non-PR only**) | Pages serves the full site / a stub is wrong | none |
| `check:no-private-in-public` (`--stubs dist-redirects`, npm script) | both builds | a private trace in dist-public **or** a title/summary in a stub | **yes** — unit tests (#4–#6) |
| `redirects:check` | **never** | — | **not wired** (G3) |

All 28 `uses:` in the workflow are full-40-hex SHA-pinned (checked by regex over
the parsed file); no unpinned action remains.

## Coverage gaps

**G0 — the stub generator's HTML escaping is un-verified (un-failable).**
`escapeHtml` (`generate-redirect-stubs.mjs:76-83`) is the only thing preventing a
`to` value from injecting markup into `http-equiv="refresh"` / `<link rel=canonical>`
/ the `<a>` text. Replacing its body with `String(value)` and running the full
suite yields the unchanged `392 passed | 1 skipped`; `renderStub` then emits
`content="0; url=https://jason.cusati.us/"><script>alert(1)</script>"`. A one-line
regression here is invisible. (The `to` scheme vector is contained by
`canonicalTarget`, also un-tested.)

**G1 — `from` has no `..` (path-traversal) check, and no test.** `stubRelativePath`
only asserts the `/website/` prefix. Verified live:

```
stubRelativePath("/website/../etc/")  =>  "../etc/index.html"
generateRedirectStubs({map:[{from:"/website/../escaped/",to:"/x/"}], outDir})
  escaped file exists outside outDir: true
  inside outDir:                     false
```

`path.join(outDir, "../escaped/index.html")` writes outside the artifact root.
The committed map is trusted input today, so this is not a live exposure — but the
Red Team's "`from` with `..`" attack has no mechanical answer in the code or the
tests.

**G2 — no static guard names any Wave 5 CI step or the Pages artifact path.** A
`grep` over `site/`, `infra/`, `.github/` for `dist-redirects`, `search:index`,
`redirects:stubs`, `upload-pages-artifact`, `deploy-pages` finds no test or guard.
The only step that parses the workflow (`Check the live bucket IAM check is wired
to a job that runs`, `:650`) is scoped to `infra/scripts/check-private-bucket-iam.sh`.
Consequences:
- Reverting `path: site/dist-redirects` → `site/dist-public` (the exact ADR-0020
  regression) merges **green**: `smoke-test` is `if: github.event_name !=
  'pull_request'`, so it never runs on the PR that introduces it; it surfaces only
  after the next non-PR deploy.
- Deleting `Generate the canonical 404 page` in `build-firebase` is silent: no
  Pages upload exists there, `check:no-private-in-public` treats a missing
  `--stubs` dir as a **warning + null**, and nothing asserts `dist-public/404.html`
  exists (`check:smoke-routes` does not cover it).
- Removing `Build the search index` silently skips the public-output
  `describe.runIf(index exists)` test rather than failing it.

**G3 — `redirects:check` is not wired (acknowledged deferred).** The committed map
is never validated against the built routes in CI, so a route added without a map
entry (or vice versa) cannot fail a build. The Wave 5 site handoff records the
pre-existing `redirects:check` failure (`/_payload/**`, fixture projects) and the
contract records it as a deferred follow-up, not ticked — consistent, but the
roadmap acceptance still depends on the map, and nothing protects it.

**G4 — the demo's Pagefind coverage is synthetic.** `leak-check-self-test` runs
`npm run build` but **not** `search:index` (documented at
`demo-leak-check.mjs:123-126`), so `demo:leak-check` plants a hand-made
`pagefind-entry.json` + `en_demo.pf_fragment`. The real Pagefind index is therefore
never content-checked against private items in CI; and in `build`/`build-firebase`
the leak check prints its own "no private items are published… proves nothing"
notice until Checkpoint 4. `checkSearchIndexScope`'s structural assertion (#5) is
the only index guard that can run on a real index today.

## Removal-vs-fail-ability note

G0 is "correct but unobserved". G2's steps and G3 are "absent guards", so removal
is not meaningful — there is nothing to remove that a test would notice. By
contrast, removing the logic behind #1, #2, #4, #5, #6, #7 turns a committed test
red; those six are the Wave 5 guards whose removal is caught.

## Restore proof

Each edited tracked file reverted via `Edit` and confirmed:

```
site/scripts/generate-redirect-stubs.mjs     git diff --exit-code  -> clean
site/scripts/check-no-private-in-public.mjs  git diff --exit-code  -> clean
```

`site/src-private/pages/rss.xml.ts` (temporary, untracked) deleted; `dist-public`,
`dist-private` and `dist-redirects` are gitignored. Final whole-repo state:

```
git -C /home/djjay/code/website diff --exit-code   -> clean
git -C /home/djjay/code/website status --porcelain -> (empty)
```

Post-restore green baselines re-confirmed: `npx vitest run` → **30 files, 392
passed | 1 skipped (393)**; `npm run demo:leak-check` → exit 0, all 7 planted
outputs named; `wave-5-structure.test.ts` → 5 passed; `dist-private/rss.xml`
absent again.

## Related docs

- `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md`
- `llm/sprints/2026-09-hub/contracts/phase-6-seams.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-5.md`
- `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-4.md` (method)
