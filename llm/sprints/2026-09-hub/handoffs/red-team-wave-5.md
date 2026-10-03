# Handoff — `Red Team`, Wave 5 (Phase 6: search, feed, OG, redirects, Pages retirement)

Agent: Red Team (independent; authored nothing in this wave — report only, no fixes)
Contract: `llm/sprints/2026-09-hub/contracts/phase-6-review-contracts.md` (Red Team section)
Seams: `llm/sprints/2026-09-hub/contracts/phase-6-seams.md`
Branch: `feat/phase-6` HEAD `1cecb35` — hub `/home/djjay/code/website`
Working tree: I changed **no tracked file**. All scratch output is under `/tmp/opencode/rt5/`.
The build inputs (`site/dist-public`, `site/dist-private`, `site/dist-redirects`) were built by the
`site` stream and left untouched; every injected plant was made on a `/tmp` copy.

## Summary

**16 attacks / groups: 8 REFUSED, 6 BYPASS, 2 observations.** The text half of the leak check
works: a private slug/title planted in `index.html`, `rss.xml`, `sitemap-0.xml`,
`pagefind/pagefind-entry.json` or a redirect stub is caught, `demo:leak-check` names all seven
planted outputs, the stubs artifact is exactly stubs + `404.html`, the Pages artifact path is
`site/dist-redirects`, and all 40 `uses:` are SHA-pinned. The six bypasses are all in the new
Wave 5 surface:

1. Pagefind/OG **binary** content is matched by path only — a private title in a `.pf_fragment`,
   a `.pf_meta`, or the real PNG `og-card.png` bytes passes (`B1–B3`).
2. `checkSearchIndexScope` **silently no-ops** when `pagefind-entry.json` is absent, so a fragment
   indexing `/p/**` passes (`B4`).
3. `generate-redirect-stubs.mjs` **does not reject `..`** in a map `from`; `path.join` escapes the
   artifact dir, and a crafted entry can overwrite `dist-public/index.html` — the Firebase deploy
   artifact — between the Astro build and the upload (`B5`). This is the same class as the Wave 4
   `sync-content.sh` traversal, whose fix (`realpath` containment) was **not** applied to the new
   generator.
4. A private title shorter than `TITLE_MIN_LENGTH` (8) is not a needle and is only warned about;
   planting just that title passes (`B6`).

The `to` injection is refused: `canonicalTarget` always prefixes the canonical origin and
`renderStub` HTML-escapes, so neither markup nor a `javascript:` scheme survives. The live Pages
probe shows the retirement is **not yet live** (the host still serves the full site).

## Attack table

| # | Target | Exact setup | Observed | Verdict | Code path |
|---|--------|-------------|----------|---------|-----------|
| 1 | Leak check, `dist-private` vs `dist-public` | `grep -rl "Programme Milestone Tracker (fixture)" dist-private` / `dist-public` | title present in 3 files under `dist-private`; **0** under `dist-public`; check on `dist-public` PASS (210 files) | **REFUSED** (no cross-contamination; `dist-private` is deliberately not scanned) | `check-no-private-in-public.mjs:342-397,598` |
| 2 | Leak check, text derived outputs | `npm run demo:leak-check` — plants title/route into `index.html`, page at private route, `rss.xml`, `sitemap-0.xml`, `pagefind/pagefind-entry.json`, `og-cards/<slug>.png`, a stub | exit 1, 15 leaks, and the run names **all 7** planted outputs; `demo:leak-check: PASS` | **REFUSED** | `demo-leak-check.mjs:99-202` |
| 3 | Leak check, binary OG **path** | private slug in `og-cards/anthropic-fellow.png` (copied PNG) | `path: slug of cv/anthropic-fellow` | **REFUSED** | `check-no-private-in-public.mjs:356-372` |
| 4 | Leak check, redirect-stub private title | title appended to a generated stub | `cv/index.html (redirect stub): title …` | **REFUSED** | `check-no-private-in-public.mjs:539-570` |
| 5 | Stub generator, `to` markup / `javascript:` | `to: "/\"><script>alert(1)</script>"`, `to: "javascript:alert(1)"`, `to: "/x</title><script>…"` | `&quot;`, `&lt;`, `&gt;` entities; `javascript:` becomes `https://jason.cusati.us/javascript:alert(1)`; no raw `<script`, no executable scheme | **REFUSED** | `generate-redirect-stubs.mjs:49-53,76-102` |
| 6 | Stub generator, `from` traversal | `from: "/website/../pwned.html"`, `from: "/website/cv/../../../tmp/…/ESCAPED.html"` | `stubRelativePath` returns `../pwned.html`; files written **outside** `outDir` | **BYPASS** | `generate-redirect-stubs.mjs:62-74,166-175` |
| 7 | Stub generator, overwrite the deploy artifact | `from: "/website/../dist-public/index.html"` with `publicDir=dist-public` | `dist-public/index.html` replaced by a meta-refresh stub to `/attacker` | **BYPASS** | same as #6 |
| 8 | Leak check, gzip `.pf_fragment` content | gzip fragment `{url:"/index.html",content:"…Programme Milestone Tracker (fixture)"}` | check PASS (212 files); title not seen | **BYPASS** | `check-no-private-in-public.mjs:144,308-325` |
| 9 | Leak check, gzip `.pf_meta` content | title inside a `.pf_meta` | check PASS | **BYPASS** | same |
| 10 | Leak check, real PNG bytes | private title appended to a NUL-bearing `og-card.png` | check PASS (binary → path-only) | **BYPASS** | `check-no-private-in-public.mjs:99-115` |
| 11 | Search-index structural scope | remove `pagefind-entry.json`; plant a fragment `{url:"/p/phd-milestones/milestones/"}` | check PASS; `/p/` URL not reported | **BYPASS** | `check-no-private-in-public.mjs:467-470` |
| 12 | Leak check, short title | private item `title:"Short"` (5 < 8), plant only `<p>Short</p>` | WARNING "shorter than 8 characters … not covered"; PASS | **BYPASS** | `check-no-private-in-public.mjs:126-127,246-251,257-271` |
| 13 | `dist-redirects` contents | classify all 58 files against `renderStub`/`render404` | 57 stubs + 1 `404.html` + **0 other**; no real asset shipped | **REFUSED** | `generate-redirect-stubs.mjs:86-138` |
| 14 | Pages artifact path | `grep -n 'upload-pages-artifact\|path: site/dist' build.yml` | `upload-pages-artifact@fc324d… path: site/dist-redirects` (1137-1139); `dist-public`/`dist-private` go to `upload-artifact` for Firebase/private-sync only; `deploy-pages@368f82…` consumes it | **REFUSED** | `build.yml:1136-1139,1320` |
| 15 | Supply chain, `uses:` pins | 40 `uses:` entries across 4 workflow/action files parsed | 40/40 are `@<40-hex>`; `contract/publish/action.yml:9` `@main` is a comment, not a call site | **REFUSED** | all `.github/workflows/*`, `contract/publish/action.yml` |
| 16 | Live Pages probe | `curl -sL https://djjay0131.github.io/website/` and `/website/cv/academic/` | HTTP 200; root `<title>Jason Cusati</title>`, 18 705 B, **0** refresh metas; cv page `<title>Jason Cusati — CV (academic)</title>` | **OBSERVATION** — retirement not live | — |

Counts: **16 groups, 8 REFUSED, 6 BYPASS, 2 observations.**

---

## Bypass reproductions

### B1–B3 — the leak check reads bytes, but not binary bytes (Pagefind fragments, `.pf_meta`, PNG OG)

`TEXT_EXTENSIONS`/`BINARY_EXTENSIONS` (`check-no-private-in-public.mjs:130-144`) mean `.pf_*` is
always binary and a NUL-bearing unknown extension (the real `og-card.png`) is sniffed as binary
(`:308-325`). Binary files are matched by path only, and the check's own header states this as an
accepted limit (`:99-115`). Planting the private **title** (not its path) is the gap:

```
$ node scripts/check-no-private-in-public.mjs --dist /tmp/opencode/rt5/dp2 --sources src/content/sources
check:no-private-in-public: derived outputs scanned in …/dp2: og-card (2), search-text (10), rss (1), sitemap (2)
check:no-private-in-public: 4 private item(s) to look for in …/dp2: …
check:no-private-in-public: PASS — no private slug, route, payload path, title or summary appears
in any path or any file's contents under …/dp2 (212 file(s) scanned).
```

`dp2` was a copy of `dist-public` with the title `Programme Milestone Tracker (fixture)` written
into (a) a real, NUL-bearing `og-card.png`, (b) a gzip `pagefind/fragment/en_evil01.pf_fragment`
whose `url` is the public `/index.html`, and (c) a gzip `pagefind.en_evil.pf_meta`. All three pass.
The Pagefind index is the artifact a *search request* reads; an accidental private title there is a
real, reachable disclosure that this check cannot see. The structural URL check (`:467-524`) is the
intended second half — see B4.

### B4 — the structural search-index check disappears if the entry file does

`checkSearchIndexScope` returns `[]` immediately when `pagefind/pagefind-entry.json` is absent
(`:467-470`) — "no index in this build; not applicable". But the `.pf_fragment`/`.pf_index`/`.pf_meta`
files are still binary-skipped, so a build that emits fragments without an entry named exactly
`pagefind-entry.json` gets **no** index coverage at all:

```
$ node -e 'fs.rmSync("…/dp3/pagefind/pagefind-entry.json"); write gzip fragment {url:"/p/phd-milestones/milestones/"}'
$ node scripts/check-no-private-in-public.mjs --dist /tmp/opencode/rt5/dp3 --sources src/content/sources
check:no-private-in-public: derived outputs scanned in …/dp3: og-card (2), search-text (9), rss (1), sitemap (2)
check:no-private-in-public: PASS — … (210 file(s) scanned).
```

The private gate base `/p/` URL was not reported. The guard is triggered by a Pagefind
implementation filename, not by "a Pagefind index exists"; a Pagefind version bump or a differently
assembled index turns the structural check into a no-op while the bytes stay unreadable.

### B5 — `generate-redirect-stubs.mjs` trusts `..` in a map `from` (artifact escape + deploy-artifact overwrite)

`stubRelativePath` (`:62-74`) only asserts the `from` starts with `/website/`, then slices and
`path.join`s the remainder without a `..`/realpath containment check (`:166-175`):

```
$ node -e 'generateRedirectStubs({ map:[
    {from:"/website/",to:"/"},
    {from:"/website/../pwned.html",to:"/"},
    {from:"/website/cv/../../../tmp/…/ESCAPED.html",to:"/"}] , outDir:"…/out/dist-redirects" })'
returned stubs: ["index.html","../pwned.html","cv/../../../tmp/…/ESCAPED.html"]
$ find …/traversal2 -type f
…/out/dist-redirects/404.html
…/out/dist-redirects/index.html
…/out/pwned.html            <-- one level ABOVE outDir
…/traversal2/tmp/opencode/rt5/traversal2/ESCAPED.html   <-- escaped the artifact tree
```

The damage is not limited to a scratch dir. The generator also writes `404.html` into `publicDir`
(`:182-185`), and in `build-firebase` `redirects:stubs` runs **after** `npm run build` and
**before** `upload-artifact` (`build.yml:1238-1239` vs `1281-1288`). A map entry
`from: "/website/../dist-public/index.html"` resolves to `site/dist-public/index.html`:

```
$ node -e '… generateRedirectStubs({map:[{from:"/website/../dist-public/index.html",to:"/attacker"}],
    outDir:"…/site/dist-redirects", publicDir:"…/site/dist-public"})'
stubs written: ["index.html","../dist-public/index.html"]
--- dist-public/index.html after redirects:stubs ---
<meta http-equiv="refresh" content="0; url=https://jason.cusati.us/attacker">
```

So the deploy artifact uploaded to Firebase can be replaced by a redirect stub after the Astro
build, and the leak check will pass it (the stub carries no private content). The committed map has
**0** `..`/backslash entries today, so this is latent — it needs a poisoned/hand-edited
`redirects/github-pages.json` — but there is no guard anywhere on that input: `redirects:stubs`
accepts it, and `redirects:check` — which would at most *print* an unmatched `from` and only fails
on a *missing* route — is **not a step in any workflow** (see O2). This is exactly the Wave 4
`sync-content.sh` shape; that fix (`realpath -m` containment against `$DEST`, refuse `..`) was not
carried into the new generator, and `generate-redirect-stubs.test.ts:47-49` only pins refusal of a
non-`/website/` prefix, never a `..`.

### B6 — private titles/summaries shorter than 8 chars are not needles

`needlesFor` skips any title/summary `< TITLE_MIN_LENGTH` (`:246-251`) and `weakNeedleWarnings`
merely warns (`:257-271`). A short private title planted in prose is therefore invisible:

```
$ node scripts/check-no-private-in-public.mjs --dist …/short/dist-public --sources …/short/sources
check:no-private-in-public: WARNING secret-src/realsecret: title "Short" is shorter than 8
characters, so it is NOT used as a needle -- it would match ordinary prose. That field is not
covered by this check.
check:no-private-in-public: PASS — … (210 file(s) scanned …).
```

The warning is honest, but the check still exits 0, so a build that publishes a short private title
is green.

---

## Observations (not guard bypasses)

- **O1 — Pages is not actually retired at the probed URL.** `https://djjay0131.github.io/website/`
  returns HTTP 200 with `<title>Jason Cusati</title>` (18 705 B, no refresh meta); `/website/cv/academic/`
  returns the real CV page. The full site is still the live Pages payload; ADR-0020's "Pages retired"
  is a property of the merge that has not deployed. The `smoke-test` job (`build.yml:1327-1365`)
  asserts the *opposite* and would be red against today's live host, but it runs only after this
  branch's `deploy` uploads stubs, so this is expected pre-merge rather than a defect. Recorded
  because the claim under review ("Pages retirement with redirect stubs") is not yet observable
  externally.
- **O2 — `redirects:check` is not wired into CI, contradicting SEAM-P6/ADR-0020 decision 4.**
  `phase-6-seams.md:63` says "`redirects:check` is wired into CI" and ADR-0020 decision 4 says it
  becomes a required step, but `grep -rn redirects:check .github` finds nothing; `infra-wave-5.md:160`
  and `site-wave-5.md:182` record the *deliberate* deferral. Both build jobs run only
  `redirects:stubs`. The map is therefore an unvalidated input to B5.
- **Minor — `--json` is not JSON-only.** `check-no-private-in-public.mjs:625-654` prints the JSON
  document and *then* the human-readable derived-output/stub/PASS lines, so `--json` output cannot be
  parsed as-is (I had to strip the trailing lines). No security impact.

## What would make the bypasses red

- B1–B3: a per-item value scan of the decompressed `.pf_*` payloads and the OG bytes — or, at
  minimum, decompress `.pf_fragment`/`.pf_meta` and grep their text (they are gzip, not opaque).
- B4: gate the structural check on "any `pagefind/fragment/*.pf_fragment` exists", not on the
  presence of `pagefind-entry.json`; fail if a fragment is present without the entry.
- B5: reject a map `from` whose post-slice remainder contains `..` or whose `realpath -m` is not
  strictly under `outDir` (mirror `sync-content.sh`), before any `mkdir`/write; and wire
  `redirects:check` (extended to fail on an unmatched `..` `from`).
- B6: treat a short title/summary as a failure (or require a manifest to carry a usable needle)
  rather than a warning, at least when the item is private.

Nothing has been changed. Report only.

---

# Round 2 — re-verify the fixes on `feat/phase-6` @ `dac8a76`

Scope: `site/scripts/**` only. I modified no tracked file; all scratch output is under
`/tmp/opencode/rt5/`. Peer streams rebuilt `site/dist-*` during the session, so the
pipeline was re-run once cleanly after the first `demo:leak-check` hit a transient
"no public build" window. Fix under test: `dac8a76` ("close Wave 5 round findings —
stub traversal, index scope, binary scan, file-shaped URLs").

Requested pipeline (exit 0 end to end):

```
$ cd site && npm run build:public && npm run redirects:stubs && npm run search:index && npm run demo:leak-check
redirects:stubs: wrote 41 meta-refresh stub(s) + 404.html for 16 file-shaped route(s) to
  dist-redirects/ (57 map entries)
demo:leak-check: PASS — the guard failed on the injected leak in all 10 output(s) …
CHAIN_EXIT=0
$ npx vitest run scripts/generate-redirect-stubs.test.ts scripts/check-derived-outputs.test.ts
Test Files  2 passed (2)   Tests  33 passed (33)
```

## Closure table

| Finding | Reproduction | Round 2 observed | Verdict |
|---|---|---|---|
| **B5** `from` traversal | `stubRelativePath("/website/../pwned.html")`; `generateRedirectStubs({map:[{from:"/website/../dist-public/index.html",…}], outDir, publicDir})` | every `..`/`.`/`//`/backslash/non-`/website/` entry **throws**; `..` never reaches `path.join`; hostile map throws **before** `outDir` is touched (`outDir exists: false`), the `dist-public/index.html` sentinel is intact | **CLOSED** |
| **B4** structural scope | delete `pagefind/pagefind-entry.json`, keep a `/p/phd-milestones/milestones/` fragment | `SEARCH-INDEX PROBLEM`: "pagefind/ exists but pagefind/pagefind-entry.json is missing or unreadable … not a scope pass"; exit 1 | **CLOSED** |
| **B1–B3/D3** gzip payload contents | private title in `.pf_fragment` + `.pf_meta` + `.pf_index`, valid public fragment URL | 3 `contents` leaks named (`pagefind/fragment/en_x.pf_fragment`, `…/en_x.pf_index`, `…/pagefind.en_x.pf_meta`); the demo now plants all three and names all 10 outputs | **CLOSED** |
| **B6** short title (<8) | (not in the fix scope) | unchanged: WARNING + PASS | **RESIDUAL** (unchanged) |
| **D2** file-shaped legacy URLs | real `redirects:stubs`; `render404` with `</script>`/`javascript:` map entries | artifact is **42 files** = 41 HTML stubs + `404.html`; **no** `pdfs/academic.pdf` or `build-info.json` file; `404.html` lists the 16 file routes and contains `/website/pdfs/academic.pdf`; `</script>` → `\u003c/script\u003e`, markup → `\u0026`/entities, `javascript:` is inert (origin-prefixed in stubs, quoted-and-concatenated in the 404) | **CLOSED** |

Counts: **5 original findings re-tested — 4 CLOSED (B5, B4, B1–B3/D3, D2), B6 unchanged; 2 new residuals below.**

## Transcripts

**B5 — hostile map refused, nothing written outside `outDir`.**

```
$ node -e 'stubRelativePath("/website/../pwned.html")'
THROW … contains the forbidden path segment ".."
$ node -e 'stubRelativePath("/website/cv\\\\..\\\\x")'
THROW … contains a backslash
$ node -e 'generateRedirectStubs({map:[{from:"/website/",to:"/"},{from:"/website/../dist-public/index.html",to:"/attacker"}], outDir, publicDir})'
THREW: redirect map entry "/website/../dist-public/index.html" contains the forbidden path segment ".."
outDir exists: false
public index intact: <title>REAL PUBLIC HOMEPAGE</title>
files under base: [ '/site/dist-public/index.html' ]
```

`%2e%2e` is still accepted and lands as a literal `%2e%2e` segment **inside** `outDir` (the filesystem
does not URL-decode) — harmless, and the same residual the Wave 4 `realpath` fix recorded.

**B4 — missing entry is a failure, not a no-op.**

```
check:no-private-in-public: 2 LEAK(S) …
check:no-private-in-public: 1 SEARCH-INDEX PROBLEM(S):
  pagefind/ exists but pagefind/pagefind-entry.json is missing or unreadable, so the index is
  incomplete; a missing entry file is not a scope pass (SEAM-P6).
EXIT=1
```

(The `/p/` fragment is also caught by the byte scan, because its URL carries the `phd-milestones/milestones`
qualified-id — belt and braces.)

**B1–B3 — gzip payloads gunzipped and scanned.**

```
pagefind/fragment/en_demo_plant.pf_fragment
  contents: title of cv/anthropic-fellow — "Fellowship CV (fixture)"
  …:"/index.html","content":"demo fragment Fellowship CV (fixture)"}…
pagefind/index/en_demo.pf_index
  contents: title of cv/anthropic-fellow — "Fellowship CV (fixture)"
pagefind/pagefind.en_demo.pf_meta
  contents: title of cv/anthropic-fellow — "Fellowship CV (fixture)"
```

**D2 — markup / `javascript:` neutralised.**

```
$ node -e 'render404([{from:"/website/x\"</script><script>alert(1)</script>",to:"/safe"},{from:"/website/ok",to:"javascript:alert(1)\"><img src=x onerror=alert(1)>"}])'
var fileRoutes = [["/website/x\"\u003c/script\u003e\u003cscript\u003ealert(1)\u003c/script\u003e", "/safe"],
                  ["/website/ok", "javascript:alert(1)\"\u003e\u003cimg src=x onerror=alert(1)\u003e"]];
raw </script> in data? false
$ node -e 'renderStub({to:"javascript:alert(1)\"><img src=x onerror=alert(1)>"})'
<meta http-equiv="refresh" content="0; url=https://jason.cusati.us/javascript:alert(1)&quot;&gt;&lt;img …&gt;">
raw <img? false   raw <script? false
$ ls dist-redirects | …   # 42 files; pdfs/academic.pdf and build-info.json absent (served by 404.html)
```

## OG card — public-only by construction (residual stated)

`scripts/og-card.mjs:36-48,68-77` renders one static 1200×630 SVG from three constants
(`ownerName()` from the public `cv-data` meta, `"Research hub"`, `"Virginia Tech"`) and rasterises it;
there is no per-item title/summary input, so no private title can enter the PNG by construction.
The built card contains only `Fixture Person / Research hub / Virginia Tech`; the four private
titles/`Fellowship CV` are **absent** from `og-card.png` and `dist-public/og-card.png`.
**Residual:** the leak check still matches a PNG by PATH only, so a *separately tampered* `og-card.png`
whose pixels carry a private title would pass. This cannot arise from the generator; it is a deliberate,
documented binary limit (`check-no-private-in-public.mjs` LIMITS).

## New residuals (not regressions)

- **R2-a — a corrupt/non-gzip `.pf_*` payload falls back to path-only.** `decompressPagefind`
  catches a gunzip failure and returns `null`, then `.pf_*` is in `BINARY_EXTENSIONS`, so it is
  skipped. A plaintext (or truncated-gzip) `pagefind/pagefind.en_plain.pf_meta` carrying the private
  title passes:
  ```
  check:no-private-in-public: PASS — … (211 file(s) scanned …).   EXIT=0
  ```
  This is the acknowledged fallback in the fix's own comment. `.pf_fragment` is additionally covered
  by the structural gunzip (a corrupt fragment is reported as a scope problem), but `.pf_meta`/
  `.pf_index` have no structural check, so a corrupt `.pf_meta` hides its contents. Pagefind emits
  gzip, so this needs tampering; low severity.
- **R2-b — open redirect in the `404.html` file-route branch for a `to` beginning `@`.**
  `render404` does `window.location.replace(origin + target + …)` with `target = entry.to` used
  verbatim (unlike `canonicalTarget`, which prepends `/`). A map `to: "@evil.example"` makes
  `https://jason.cusati.us@evil.example`, whose parsed host is **`evil.example`**:
  ```
  "https://jason.cusati.us" + "@evil.example"  ->  new URL(...).host === "evil.example"
  ```
  Requires a poisoned committed map (`redirects:check` is still not in CI — round 1 O2), and the
  redirect only fires on a legacy `/website/<file>` path; `canonicalTarget`/`renderStub` are safe
  because they force a leading slash, and the generic `/website/**` branch uses a `/`-rooted
  `location.pathname`. Recommendation for the owners: pass every `to` through `canonicalTarget`
  (or reject a `to` not starting with `/`) before emitting `fileRoutes`.

Nothing was changed. Original findings B1–B5: **CLOSED** (B6 unchanged); the page-mapper and OG
residuals above are recorded rather than fixed.
