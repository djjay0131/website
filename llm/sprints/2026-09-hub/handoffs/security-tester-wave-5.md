# Handoff — Security Tester, Wave 5 (Phase 6: search, feed, stubs, Pages retirement)

Status: Delivered
Date: 2026-10-03
Stream: Security Tester (read only; wrote this file only)
Issue: `hub-006`
Branch: `feat/phase-6` @ `1cecb35`
Contract: `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` §Security Tester
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1…P7); ADR-0020; ADR-0005
Authority: run-brief §6 (`llm/plans/2026-10-01-completion-brief.md`), scoped by the Phase 6 review contract
Evidence: `/tmp/opencode/w5-plant.mjs`, `/tmp/opencode/w5-search.mjs`, `/tmp/opencode/stub-attack.mjs`

## Verdict

**Not blocked: 0 FAIL.** All six scoped Phase 6 security checks are **PASS**.
No tracked file was modified by this run (`git status` shows only other agents'
untracked handoffs; the three `dist-*` dirs are gitignored build outputs). One
non-blocking observation is recorded on the stub generator's `from` handling
(Check 3), and the one deliberate Phase 6 acceptance gap (`redirects:check`
unwired) is **out of this check's scope** and is treated as a decision record,
not a security FAIL.

## Check table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | No private content in any public output; marker in `dist-private` + each derived output; leak check red→green | **PASS** | fresh pipeline, demo + independent plant, below |
| 2 | Private build emits no search/rss/404/pagefind; Pages artifact is stubs + `404.html` only | **PASS** | fresh `build:private`; 58-file `dist-redirects`; `upload-pages-artifact` path |
| 3 | Stubs/`404.html` carry no private title/summary; targets encoded, no script injection | **PASS** (with observation) | 0 title/summary hits; injection probes neutralized; `from`-traversal observation |
| 4 | Supply chain: `pagefind`/`@astrojs/rss` locked + registry-resolved; every action SHA-pinned | **PASS** | lockfile integrity; 28/28 `uses:` pinned in `build.yml` (0 unpinned in all workflows) |
| 5 | Static public site: `firebase.json` unchanged; no functions/SSR | **PASS** | blob-identical to `main`; no `functions/`; `output: 'static'` |
| 6 | Firestore / budget unaffected | **PASS** | no `infra/`, rules or budget file changed vs `main`; `budget-guard` untouched |

Blocking count: **0** (a single FAIL would block; there is none).

---

## Check 1 — No private content in any public output. PASS

Fresh pipeline from the committed tree (`cd site`, 2026-10-03 09:22):

```text
$ npm run build:public
[build] 27 page(s) built in 1.97s            EXIT=0
$ npm run search:index
Finished in 0.211 seconds                    # dist-public/pagefind/ written
$ npm run redirects:stubs
redirects:stubs: wrote 57 stub(s) + 404.html to dist-redirects/
redirects:stubs: also wrote 404.html into dist-public/ (Firebase serves it)
$ npm run check:no-private-in-public
check:no-private-in-public: derived outputs scanned in dist-public:
  og-card (2), search-text (10), rss (1), sitemap (2)
check:no-private-in-public: redirect stubs scanned in dist-redirects
  (title/summary needles only; paths are ADR-0020 legacy URLs)
check:no-private-in-public: 4 private item(s) to look for in dist-public:
  cv/anthropic-fellow, phd-milestones/milestones,
  phd-milestones/committee-dossier, phd-milestones/internal-notes
check:no-private-in-public: PASS — no private slug, route, payload path, title or
  summary appears in any path or any file's contents under dist-public and no
  private title or summary appears in any stub under dist-redirects
  (209 file(s) scanned in dist-public, 58 in dist-redirects).       EXIT=0
```

**Pagefind structural scope (SEAM-P1/P6).** `checkSearchIndexScope` returned `[]`:
29 of 29 indexed URLs are public-rooted, **0** off-origin, **0** under `/p/`, and
each resolves to a file in this `dist-public`. Decompressing all 29 `.pf_fragment`
files and scanning for `anthropic-fellow`, `phd-milestones`, `milestones`,
`committee-dossier`, `internal-notes`, `Fellowship CV (fixture)`,
`Programme Milestone Tracker (fixture)`: **0 hits**. The readable derived text
outputs (`rss.xml`, `sitemap-0.xml`, `sitemap-index.xml`,
`pagefind/pagefind-entry.json`, `search/index.html`) also contain **0** hits.

**Red→green (red first).**

```text
$ npm run demo:leak-check
demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak in all 7
  output(s) ...   EXIT=0
```

The demo named every planted derived output: `index.html`, the private route
path, `rss.xml`, `sitemap-0.xml`, `pagefind/pagefind-entry.json`,
`og-cards/anthropic-fellow.png`, and the `cv/index.html` stub.

**Independent plant (my own, not the demo's).** A private marker
`ZZPRIVATE-MARKER-W5` written into a real `dist-private/ZZ-PRIVATE-MARKER.txt`
appeared in **0** files under `dist-public` (the private build output is not a
public input). In an isolated scratch copy, the title `"Committee Dossier
(fixture)"` / route `/phd/phd-milestones/committee-dossier/` planted into each
derived output made the real check exit **1** and name every one of them:

```text
B. check exit: 1 (1 = caught)
B. named in output? YES  sitemap-0.xml
B. named in output? YES  rss.xml
B. named in output? YES  pagefind/pagefind-entry.json
B. named in output? YES  og-cards/committee-dossier.png
B. named in output? YES  cv/index.html
```

`check:publish-allowlist` (mode pr): `PASS — 14 entries, 0 conflicts, 0 stale`.

## Check 2 — Private build absence; Pages artifact stubs-only. PASS

Fresh private build:

```text
$ npm run build:private
[hub-private-build] wrote .hub-private-build.json: 4 private item(s), 100 file(s)
[build] 6 page(s) built in 1.37s             EXIT=0
absent: pagefind
absent: rss.xml
absent: 404.html
absent: search/index.html
```

The six emitted private pages are the expected private routes
(`/index.html`, `/shares/`, and the four item frames) — no `/search/`, no
`/rss.xml`, no `404.html`, no Pagefind directory.

Pages artifact:

```text
$ find dist-redirects -type f | wc -l     → 58        # 57 stubs + 404.html
non-stub files (no http-equiv="refresh"):
  dist-redirects/404.html                  # the one intended non-stub
```

Every one of the 57 stubs contains `<meta http-equiv="refresh">`; the only file
without it is the `404.html` mapping page. `.github/workflows/build.yml:1137-1139`
sets `uses: actions/upload-pages-artifact@fc324d35… # v5.0.0` with
`path: site/dist-redirects`; the `dist-public` upload to Pages is gone.

## Check 3 — Stubs/`404.html` private-free and safe. PASS (one observation)

No private title or summary in the artifact (grep over all 58 files):

```text
[CLEAN] Programme Milestone Tracker   [CLEAN] Committee Dossier
[CLEAN] Internal Project Notes        [CLEAN] Fellowship CV
```

`anthropic-fellow` appears only as the ADR-0020 legacy **path** (accepted by
decision 5), not as a title/summary.

Target encoding and injection probes (`renderStub`, `canonicalTarget`):

```text
to = javascript:alert(1)          → url=https://jason.cusati.us/javascript:alert(1)   # origin-prefixed, no JS scheme
to = /"><script>alert(1)</script> → …/&quot;&gt;&lt;script&gt;…                        # HTML-escaped, no markup breakout
to = //evil.example/x             → https://jason.cusati.us//evil.example/x            # still canonical host
to = https://evil.example/x       → https://jason.cusati.us/https://evil.example/x     # still canonical host
```

`escapeHtml` neutralizes `" < > & '`; `canonicalTarget` prefixes
`https://jason.cusati.us`, so no probe can change the destination origin or
break out of the attribute. The `404.html` inline script interpolates only the
constant `CANONICAL_ORIGIN` plus `window.location.pathname/search/hash`, always
prefixed by the canonical origin — no user-controlled scheme, no script
injection, no host change.

**Observation (non-blocking, hand to Red Team).** `stubRelativePath` refuses a
`from` outside `/website/` but does **not** reject `..` segments:
`from: "/website/../ESCAPED/"` yields `../ESCAPED/index.html`, and
`generateRedirectStubs` writes it outside `outDir` (confirmed:
`/tmp/opencode/stubout/ESCAPED/index.html` was created). The redirect map is a
committed, trusted file (`site/redirects/github-pages.json`) and the output is
still private-free and script-free, so this is not a Check 3 FAIL; it is a
defense-in-depth gap the Red Team contract explicitly attacks. Recommend
rejecting/normalizing `..` before URL-path use.

## Check 4 — Supply chain. PASS

Lockfile entries resolved from the npm registry with `sha512` integrity
(`site/package-lock.json`):

```text
node_modules/pagefind            1.5.2   https://registry.npmjs.org/pagefind/-/pagefind-1.5.2.tgz               dev
node_modules/@astrojs/rss        4.0.19  https://registry.npmjs.org/@astrojs/rss/-/rss-4.0.19.tgz               prod
node_modules/@pagefind/linux-x64 1.5.2   https://registry.npmjs.org/@pagefind/linux-x64/-/linux-x64-1.5.2.tgz   optional,dev
# + darwin-arm64/x64, freebsd-x64, linux-arm64, windows-arm64/x64 — all registry.npmjs.org, all with integrity
```

`site/package.json` carries `"@astrojs/rss": "^4.0.19"` and
`"pagefind": "^1.5.2"`; the exact pins live in the lockfile (`npm ci`), matching
the seam's "version and lockfile entry" requirement. Every action is SHA-pinned:

```text
$ grep -cE '^\s*(- )?uses:' .github/workflows/build.yml     → 28
$ grep … | grep -vE '@[0-9a-f]{40}( |$|#)'                   → NONE (0 unpinned)
ci.yml: 5 uses, 0 unpinned · gate.yml: 5 uses, 0 unpinned
```

No new high/critical advisory is introduced (the additive RSS/pagefind trees are
registry-sourced; the `firebase`/`@grpc/grpc-js` set remains the accepted
baseline).

## Check 5 — Static public site. PASS

`firebase.json` is **not** in the branch diff and is byte-identical to `main`:

```text
main:firebase.json  b194674517c3a290c82b2982542ac19cdb627ac2
HEAD:firebase.json  b194674517c3a290c82b2982542ac19cdb627ac2
no functions/ directory; astro.config.mjs output: 'static'
rewrites (unchanged): /p/**, /session, /session/end, /client-events, /share, /share/**, /s/**
```

No functions, no SSR, no new rewrite or redirect.

## Check 6 — Firestore / budget. PASS

The branch diff touches no infrastructure: `git diff --name-only main...HEAD`
lists only `.github/workflows/build.yml`, `llm/**` docs and `site/**` files —
**no** `infra/`, `firestore`, rules, or budget file. `infra/firestore.tf` is
present and untouched; the `budget-guard` job (`build.yml:272`) is outside the
`build.yml` diff (0 budget mentions in the diff). Firestore rules release and
`google_billing_budget.hub` are not in this wave's change set.

---

## Assumptions

1. The fixture content tree is the same one the `site`/`infra` handoffs used
   (`src/content/sources`: `cv`, `kgis`, `phd-milestones`); private items are the
   four the leak check enumerates.
2. "Pinned" for `pagefind`/`@astrojs/rss` means exact version + registry +
   integrity in `package-lock.json` (the seam's wording), not a caret-free
   `package.json`.
3. The redirect map is trusted, committed input; a reviewer who can edit it
   already has repo write.
4. `redirects:check` being unwired is the deliberate §4 decision recorded in
   `handoffs/infra-wave-5.md`, not a security control this check owns.

## Recommendations

1. **Stub generator:** reject `..` (and normalize) in `stubRelativePath` before
   joining, or assert the resolved path stays under `outDir`. Cheap, closes the
   Red Team's explicit `from`-traversal attack.
2. Keep the demo's per-derived-output plant coupled to `listDerivedOutputs`, so a
   future derived output cannot be silently added without a plant.
3. The `.pf_*` binary limit stays covered only by the structural URL scope check;
   if a future Pagefind version changes the fragment container, re-verify
   `fragmentUrls` before trusting that half.

## Alternatives

- A URL-encode (percent-encode) of the stub target instead of HTML-escape was
  considered; the current origin-prefix + HTML-escape already prevents scheme and
  markup injection, and percent-encoding would alter already-valid targets, so no
  change is recommended.
- Full-page leak scanning of `.pf_*` by decompressing in `findLeaks` was avoided
  (the schema allows `--stubs`-style separation); the structural scope check is
  the accepted second half.

## Risks / open questions

1. **Concurrent agents.** Other Wave 5 reviewers were active in this same
   workspace during the run (an untracked `src-private/pages/rss.xml.ts` appeared
   transiently and a concurrent Red Team `node -e` plant process was observed). I
   confirmed the **committed branch** is clean (`git status` shows no tracked
   modification), full `npm test` is green twice (`30 files, 392 passed | 1
   skipped`), and the transient file is not in the branch; all leak evidence above
   was reconfirmed against a fresh isolated rebuild.
2. `redirects:check` remains red/unwired by design; the roadmap acceptance must
   record it as a deferred follow-up, not ticked (Chief Reviewer's call).
3. `build` still runs `search:index` for a Pages variant that no longer ships it —
   intentional (it exercises the leak check's derived-output coverage), no
   security effect.

## ADR candidates

None. The stub-traversal observation is an implementation hardening, not an
architecture decision. ADR-0020 already covers the stubs model.

## Related docs

- `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` §Security Tester
- `llm/sprints/2026-09-hub/contracts/phase-6-seams.md` (SEAM-P1…P7)
- `llm/sprints/2026-09-hub/contracts/site-wave-5.md`, `contracts/infra-wave-5.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-5.md`, `handoffs/infra-wave-5.md`
- `llm/governance/adr/0020-pages-retirement-with-redirect-stubs.md`
- `llm/plans/2026-10-01-completion-brief.md` §6

---

# Round 2 — re-run on the hardened tree

Status: Delivered · Date: 2026-10-03
Branch: `feat/phase-6` @ `dac8a76` (`fix(phase-6): close Wave 5 round findings`)
Base of round 1: `1cecb35`. Scope unchanged: the six checks in
`contracts/phase-6-review-contracts.md` §Security Tester, run-brief §6.
Round 2 fixes reviewed: `site-wave-5-hardening.md` (Red Team B1–B5, Skeptic
G0/G1, Dissenter D2/D3). `.github/workflows/**`, `firebase.json` and `infra/**`
are untouched by `dac8a76`.

## Round 2 verdict

**Not blocked: 0 FAIL.** All six checks re-confirm **PASS** on `dac8a76`. The
`..`-traversal observation from round 1 is now **closed** (fail-closed), and the
`.pf_*` binary limit is now contents-scanned, so the two caveats I recorded are
resolved.

| # | Check | Round 1 | Round 2 |
|---|---|---|---|
| 1 | Public-output cleanliness; marker in `dist-private` + each derived output; leak red→green | PASS | **PASS** (now incl. `.pf_*`) |
| 2 | Private build no search/rss/404/pagefind; Pages artifact stubs + `404.html` only | PASS | **PASS** (42 HTML files) |
| 3 | Stubs/`404.html` no private title/summary; encoding/injection refused | PASS (observation) | **PASS** (traversal closed) |
| 4 | `pagefind`/`@astrojs/rss` locked + registry; all actions SHA-pinned | PASS | **PASS** |
| 5 | `firebase.json` unchanged; no functions/SSR | PASS | **PASS** |
| 6 | Firestore / budget unaffected | PASS | **PASS** |

Blocking count: **0**.

## Required pipeline (exact, from the task)

```text
$ cd site
$ npm run build:public           EXIT=0   [build] 27 page(s) built in 1.85s
$ npm run redirects:stubs        EXIT=0   wrote 41 meta-refresh stub(s) + 404.html
                                          for 16 file-shaped route(s) (57 map entries)
$ npm run search:index           EXIT=0   Finished in 0.147 seconds
$ npm run check:no-private-in-public EXIT=0
    check:no-private-in-public: PASS — no private slug, route, payload path,
    title or summary ... (210 file(s) scanned in dist-public, 42 in dist-redirects).
$ npm run demo:leak-check        EXIT=0
    demo:leak-check: the check exited 1 (1 means it caught the leak).
    demo:leak-check: PASS — the guard failed on the injected leak in all 10 output(s)
$ npm run build:private          EXIT=0   [build] 6 page(s) built in 1.42s
```

All six commands exit 0; the inner leak check exits 1 only inside the demo's
scratch copy, as intended.

## Check 1 — public-output cleanliness. PASS (hardened)

Fresh `check:no-private-in-public`: 4 private items, 210 `dist-public` files,
42 `dist-redirects` files, **0 leaks, 0 scope problems**. Independent plant (my
own, scratch copy, `/tmp/opencode/r2-plant.mjs`):

- marker `ZZPRIVATE-MARKER-W5-R2` + `"Committee Dossier (fixture)"` written into a
  real `dist-private/ZZ-PRIVATE-MARKER-R2.txt` → **0** occurrences anywhere under
  `dist-public` (then removed).
- victim planted into every derived output including the now-scanned gzip
  payloads — the real check exited **1** and named each:

```text
named? YES  sitemap-0.xml
named? YES  rss.xml
named? YES  pagefind/pagefind-entry.json
named? YES  pagefind/fragment/en_plant.pf_fragment
named? YES  pagefind/pagefind.en_plant.pf_meta
named? YES  pagefind/index/en_plant.pf_index
named? YES  og-cards/committee-dossier.png
named? YES  cv/index.html
```

This closes Red Team B1–B3 / Dissenter D3 for me: a private title inside a
`.pf_fragment` is now caught by decompression, not just documented as a limit.
`checkSearchIndexScope("dist-public")` → `[]`; and the B4 no-op is fixed —
`pagefind/` present with no `pagefind-entry.json` now returns a problem
(`"the index is incomplete; a missing entry file is not a scope pass"`), while no
`pagefind/` at all still returns `[]`.

## Check 2 — private build absence + Pages artifact. PASS

```text
private build: 6 pages; absent: pagefind, rss.xml, 404.html, search, search/index.html
dist-redirects: 42 files — extension histogram: 42 html
files without http-equiv="refresh": dist-redirects/404.html   (the one intended non-stub)
41 stubs carry meta-refresh; no per-path .pdf/.json/.xml/.png/.ico stub remains
```

`build.yml:1137-1139` still uploads `path: site/dist-redirects` to Pages. The
artifact is now **41 HTML stubs + `404.html`** (was 57 stubs + `404.html`): the 16
file-shaped legacy URLs are handled by the Pages `404.html` map instead of HTML
files served with a JSON/PDF MIME type (Dissenter D2). Every file in the artifact
is HTML; nothing is a file-shaped per-path stub.

## Check 3 — stubs/`404.html` private-free, encoding/injection refused. PASS

No private title or summary in the artifact (`Programme Milestone Tracker`,
`Committee Dossier`, `Internal Project Notes`, `Fellowship CV`: all CLEAN). The
Pages `404.html` lists 16 file-shaped legacy routes (including the ADR-0020
accepted fellowship **path**); the Firebase mirror `dist-public/404.html` lists
**0** file routes, so no legacy private path enters the scanned public build.

Injection/encoding re-probe (`/tmp/opencode/r2-attack.mjs`):

```text
to = javascript:alert(1)          → https://jason.cusati.us/javascript:alert(1)   # canonicalTarget origin prefix
to = /"><script>alert(1)</script> → HTML-escaped by renderStub
render404 hostile fileRoutes      → escapeScriptString emits \u003c … no </script>, no <script>alert
escapeHtml('<>"&\'')              → "&lt;&gt;&quot;&amp;&#39;"
```

**Traversal observation closed (Red Team B5).** `stubRelativePath` now refuses
`/website/../evil/`, `/website/../../etc/`, `/website/a/../../b/`, `/website/.`,
`/website/./x/` and a backslash entry; `generateRedirectStubs` validates every
entry **before touching the filesystem**, so a hostile `from` writes nothing and
creates no `outDir`:

```text
refused whole write: redirect map entry "/website/../PWNED/" contains the forbidd…
PWNED escaped? false      dist dir created? false
```

## Check 4 — supply chain. PASS

`dac8a76` touches only `site/scripts/**`, tests and a handoff — no manifest or
lockfile change. `pagefind@1.5.2` (`^1.5.2`) and `@astrojs/rss@4.0.19`
(`^4.0.19`) remain registry-resolved (`registry.npmjs.org`) with `sha512`
integrity in `package-lock.json`; `@pagefind/*` optional platform deps likewise.
`build.yml`: **28 `uses:`, 0 unpinned** (all 40-hex + `# vN`). No new advisory.

## Check 5 — static public site. PASS

`firebase.json` byte-identical to `main`:
`main:firebase.json = HEAD:firebase.json = b194674517c3a290c82b2982542ac19cdb627ac2`.
No `functions/`, Astro `output: 'static'`, rewrites unchanged.

## Check 6 — Firestore / budget. PASS

`dac8a76`'s changed-file list contains no `infra/`, firestore, rules or budget
file (only `site/scripts/**` + `llm/.../site-wave-5-hardening.md`); `budget-guard`
is outside the diff. `infra/firestore.tf` and `google_billing_budget.hub` are
untouched.

## Additional evidence

- `npm test`: `30 files passed`, `403 passed | 1 skipped (404)` — the +11 tests
  are the hardening's guard tests (traversal, escaping, `.pf_*` scan, B4).
- No tracked file modified by this run; the transient `dist-private` marker was
  removed; `dist-*` are gitignored build outputs.
- Concurrent Wave 5 reviewer handoffs are the only untracked files present.

## Round 2 conclusion

The hardened tree at `dac8a76` satisfies all six scoped Phase 6 security checks
with the round-1 caveats removed. **Blocking count: 0 FAIL.**
