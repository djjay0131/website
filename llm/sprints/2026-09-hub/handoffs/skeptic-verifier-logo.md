# Handoff — Skeptic Verifier, L1 wave "logo" (owner decision D16)

Agent: Skeptic Verifier (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/logo-wave.md`
Design authority: `llm/specs/2026-10-01-branding-design.md` (amended 2026-10-04); ADR-0015 (amended 2026-10-04)
Repo: `/home/djjay/code/website` · branch `feat/logo` · HEAD `a310db8` · `main` `9bd10ed`
Mode: temporary in-place edits, each reverted; no commit, no `gh`, no cloud mutation. This file is the only file left written.

## Summary

**8 guards attempted; 8 made red by name, then restored green. 0 un-failable guards.**
But the file `site/scripts/logo.test.ts` guards **source strings, not rendered output**, so
**6 new claims of this wave have no guard at all** — including two the contract lists as Exit
criteria: the emblem actually appearing on every page, and the OG default actually resolving to
the emblem in the built HTML. Four of the six I defeated with a change that leaves the whole
suite (31 files, 413 passed | 2 skipped) green; the other two I defeated at source level.

One guard is **fail-able but proves less than it claims**: the ring-contrast guard passes when
the emblem's actual outer ring is repainted to maroon (invisible on the band) — it only checks
that the literal `#e5751f` appears *somewhere* in the SVG plus a hard-coded pair against the
token, not that the *ring* is that colour.

Baseline and final restored state: `logo.test.ts` 10/10; `route-inventory.test.ts` 6 passed |
1 skipped; `npm test` 31 files, 413 passed | 2 skipped; `npm run build:private` green
("checked 102 emitted path(s) against the gate's allowlist (SD-7)"); `npm run build` green
(27 pages). Final tracked tree clean (`git status --porcelain` empty before this file).

Every break was anchored on a string asserted to occur exactly once
(`source.split(anchor).length - 1 === 1`), checked before editing. Two guard inputs are
deliberately non-unique (`badges/…today.png` twice in `index.astro`; `fill="#e5751f"` three
times in the SVG); the breaks that touch them are called out below.

## Method

Baseline first, then per break: assert the anchor's occurrence count is 1 → edit → run the
named test file (or `npm run build:private` for the SD-7 branch) → capture the exact failing
test name → `git checkout -- <file>` (or inverse `mv`) → rerun green → `git status --porcelain`
clean. `dist-public`/`dist-private` are gitignored, so the builds' output does not dirty the
tree. The `npm run build:private` SD-7 run leaves no receipt on failure (the check throws
before the receipt is written).

## Break/restore results — one row per guard request

| # | Guard (file) | Unique anchor | Break applied | Exact failing test / command | Verdict |
|---|---|---|---|---|---|
| 1 | emblem alt (`SiteBand.astro`) | `alt="Jason Cusati research emblem"` (1) | `alt="Research emblem"` | `logo.test.ts > D16 — the emblem is in the band, left of the wordmark > links the emblem svg with the exact alt text` | fail-able |
| 2 | 40px/44px hit target (`SiteBand.astro`) | `width: 44px` (1) | `width: 48px` | `logo.test.ts > … > renders the emblem at 40px inside a 44px hit target` | fail-able |
| 3 | source order (`SiteBand.astro`) | the emblem `<a>` block | wordmark anchor moved before the emblem anchor | `logo.test.ts > … > puts the emblem before the wordmark in source order` | fail-able |
| 4a | badge srcset (`index.astro`) | the `srcset={\`…\`}` line (1) | removed the `srcset` attribute line | `logo.test.ts > D16 — the badge is the home hero where the portrait used to be > shows the badge with a 1x/2x srcset` | fail-able |
| 4b | badge no-lazy/alt (`index.astro`) | `class="identity-badge"\n      src={…today.png\`}` | added `loading="lazy"` after `class` | `logo.test.ts > … > is not lazy-loaded (it is above the fold) and has descriptive alt text` | fail-able |
| 5a | badge file exists / gate name (`logo.test.ts` const) | `BADGE_2X` literal | renamed `…today-2x.png` → `…today@2x.png` | `logo.test.ts > … > commits both files, each under 150KB, with gate-servable names` (existence assert) | fail-able |
| 5b | badge size <150KB | `…today.png` (tracked file) | `truncate -s 160000` (13 775 → 160 000 B) | `logo.test.ts > … > commits both files, each under 150KB, with gate-servable names` (size assert) | fail-able |
| 5c | badge segment allowlist (`logo.test.ts`) | `BADGE_2X` literal | renamed asset to `@2x` **and** updated the const to match | `logo.test.ts > … > commits both files, each under 150KB, with gate-servable names` — `expected 'vt-…-today@2x.png' to match /^[A-Za-z0-9._-]+$/` | fail-able |
| 5d | private-build SD-7 segment check (`npm run build:private`) | — | renamed `…today-2x.png` → `…today@2x.png` | `npm run build:private` exits 1: `the private build emitted 1 path(s) the gate cannot serve. badges/vt-badge-hokiebird-laptop-tower-research-today@2x.png / offending segment: "…@2x.png"` | fail-able |
| 6a | redirect-map coverage (`logo.test.ts`) | the badge `-2x` map object | deleted the `-2x` `{from,to}` entry | `logo.test.ts > … > covers both files in the committed redirect map` | fail-able |
| 6b | redirect-map coverage (`route-inventory.test.ts`) | same deletion | same deletion | `route-inventory.test.ts > committed redirect map (redirects/github-pages.json) > covers every static page, public file, redirect source, smoke route and CI file` | fail-able |
| 7 | og:image default (`Base.astro`) | `emblem/research-emblem.png` (1) | reverted to `og-card.png` | `logo.test.ts > D16 — the default og:image is the emblem, not the generated card > falls back to research-emblem.png` | fail-able |
| 8a | emblem fills present (`research-emblem.svg`) | `fill="#e5751f"` (3, **non-unique**) | `replaceAll` → `fill="#00ff00"` | `logo.test.ts > D16 — the emblem's visible rings meet AA non-text contrast on the band > uses the burnt-orange ring and the white disc the band relies on` | fail-able |
| 8b | emblem/token contrast (`tokens.css`) | `--vt-band: #861f41;` (1) | → `--vt-band: #e5751f;` | `logo.test.ts > … > has those two at >= 3:1 against --color-band in the light theme` | fail-able |

All 14 breaks restored; each rerun returned the 10/10 green baseline (or the 16 passed | 1
skipped for the two-file run in 6). `npm test` after restoration: 31 files, 413 passed | 2 skipped.

### One guard is fail-able but does not test the thing it names (guard 8a/8b)

Repaint **only the ring** — `research-emblem.svg` line 12, `<circle cx="200" cy="200"
r="188" fill="#e5751f"/>` → `fill="#861f41"` — and leave the sunrise/other `#e5751f` fills.
The outer burnt-orange ring is now maroon-on-maroon and invisible at 40px, which falsifies the
contract's "visible rings … meet the AA non-text 3:1 threshold". **All 10 `logo.test.ts` tests
still pass.** The guard's sub-test 1 is `expect(emblem).toContain('fill="#e5751f"')` (presence
anywhere) and sub-test 2 compares hard-coded `#e5751f`/`#fbfbf8` against the `--color-band`
token, never the SVG's actual ring. So the contrast guard can be globally red (8a/8b) but cannot
catch the precise regression it exists to prevent.

## Un-failable guards

None. All 8 requested guards went red by name and were restored. The concern is the inverse:
the source-level guard file is too coarse (see guard 8 note) and, below, guards nothing that is
rendered.

## Uncovered claims (new in this wave, no guard catches them)

For each: the minimal failing change, and what the current tests do.

| Claim (source) | Minimal failing change | Current tests |
|---|---|---|
| **A. "the emblem is in the band on every page"** / the emblem actually renders (`logo-wave.md:44-45,85-86`) | Comment the emblem `<a class="band-emblem">…</a>` block out with a JS comment (`{/* … */}`) in `SiteBand.astro`. The literal strings (`class="band-emblem"`, `research-emblem.svg`, the `alt`, `width="40"`) remain in source, so every assertion still matches, but nothing renders. | **Not caught.** `npm test`: **31 files, 413 passed \| 2 skipped**. Built `dist-public`: **27 → 0** of 32 HTML files contain `band-emblem`. (`private-structure.test.ts` only proves both layouts *import* `SiteBand`; it never inspects output.) |
| **B. "the default og:image is … research-emblem.png"** actually emitted / resolves (`logo-wave.md:55`) | Comment out `<meta property="og:image" content={ogImageUrl} />` in `Base.astro`; the `emblem/research-emblem.png` string still lives in the `const ogImageUrl` line above. | **Not caught.** `logo.test.ts` 10/10 pass; built `dist-public/index.html` has **0** `og:image` tags (`twitter:image` still carries the emblem URL). The guard reads the layout's source text, not the rendered head. |
| **C. "the badge is the home hero where the portrait used to be"** — placed in the identity block and visible (`logo-wave.md:50-51`) | Add `display: none;` to `.identity-badge` in `index.astro` (or move the `<img>` out of `<section class="identity">`; the class/alt/srcset strings survive either way). | **Not caught.** `npm test`: 413 passed \| 2 skipped. No test asserts the badge is inside the identity section, is visible, or is larger than its mobile box. |
| **D. the emblem is a *linked* mark ("a linked 40px emblem")** (`logo-wave.md:44`, `SiteBand.astro:54`) | Change `<a class="band-emblem" href={homeHref}>` (and its `</a>`) to `<span class="band-emblem">…</span>`. The `class="band-emblem"` assertion still matches. | **Not caught.** `logo.test.ts` 10/10 pass. Nothing asserts `band-emblem` is an anchor or that it has an `href`. |
| **E. the OG target file exists / the URL resolves** (`Base.astro:48`) | Move `site/public/emblem/research-emblem.png` out of the tree (190 461 B). `logo.test.ts` never stats it; `route-inventory` only maps routes that exist. | **Not caught.** `logo.test.ts` 10/10 and `route-inventory.test.ts` 6 passed \| 1 skipped stay green; the OG URL 404s. |
| **F. focus ring is `--color-on-band` on the band, and the band is maroon in *both* themes** (`logo-wave.md:48-49`) | (i) Change `.site-band :focus-visible { outline-color: var(--color-on-band); }` to `var(--color-focus)` (maroon-on-maroon, invisible). (ii) Add `--color-band: #000;` inside the dark-theme block. | **Not caught.** No test references `focus-visible` or `--color-on-band` for the band. The contrast sub-test calls `parseThemes(...)` but uses only `.light`, so a dark override of `--color-band` is invisible to it. |

Claim A and B are the two the contract itself puts in its Exit line ("the emblem is in the band on
every page"; "`og:image` is the emblem") and in its Evidence list (`npm test`, `npm run build`).
There is **no build-output assertion anywhere** for either surface: `grep` over all of
`scripts/*.test.ts` finds `research-emblem`, `band-emblem`, `identity-badge` and `og:image` only
inside `logo.test.ts` (source strings) and in comments in `og-card.test.ts` / `site-routes.mjs`.
The dissenter's D-S1 was answered with source-level guards; that closes "revert the file", but not
"the file no longer produces the surface". The dissenter noted the same residual gap.

## Risks

- **A silent, fully-green revert of either Exit surface is still possible** (A, B, C). The wave's
  whole value is the three rendered surfaces; nothing in `npm test` observes a rendering.
- **The contrast guard's precision** (guard 8): the exact failure it names — the ring losing
  contrast — passes green. If a future edit tweaks the ring (or the token) without also removing
  every literal, the AA claim can die unnoticed.
- **The OG target is unpinned** (E): an accidental asset move/deletion at `public/emblem/` would
  leave every page pointing at a 404 preview image with a green suite.
- **`npm run contrast` is still not wired into CI** (`grep` over `.github/workflows/` finds no
  contrast step), so the emblem pair is checked only because `logo.test.ts` re-implements it
  inside `npm test`. Any later move of that assertion back to `contrast.mjs` would silently
  leave CI.
- No un-failable guard was found, but six claims are unguarded; the contract's replicable-guard
  bar (`logo-wave.md:66-68`) is met only for the four surfaces it enumerated, not for the Exit
  criteria it wrote.

## Open questions

1. Should the three Exit surfaces be pinned at the **build** level (parse `dist-public/**/*.html`
   for the emblem img + alt, the badge `src`/`srcset`/no-lazy, and the `og:image` meta) rather
   than in `SiteBand.astro`/`Base.astro` source? The Dissenter proposed a build-output test; it is
   still absent.
2. Should `logo.test.ts` assert the emblem is an `<a href=…>` and that
   `public/emblem/research-emblem.png` exists (claims D and E)?
3. Should the contrast guard read the *ring* element (e.g. parse the `r="188"` circle's fill)
   instead of `toContain`-ing a colour that also paints the sunrise and the caption, and should
   the dark theme be asserted invariant?
4. Is the `-2x` → `@2x` concern a real CI risk or only the private build (guard 5)? The badge is a
   public asset; SD-7 catches it only because `public/` is copied into `dist-private`. That is
   real, but it is the Dissenter's S6 category point.

## ADR candidates

- **"Source-level logo guards do not satisfy rendered-surface Exit criteria."** A one-line rule:
  any wave whose Exit names a served/rendered artefact must add a build-output assertion for it,
  not only a template-source string check. Would have forced A and B into this PR.
- **"The emblem ring is pinned by element, not by colour occurrence."** Records that the contrast
  guard must read the ring's own fill (and that the logo exemption/thin-rim caveat from the
  Dissenter's S4 applies), so the guard cannot be satisfied by a colour that survives elsewhere in
  the SVG.
- **"OG defaults must pin target existence."** `og:image` string guards must also assert the
  referenced public file exists and is emitted to the build.

## Related docs

- `llm/sprints/2026-09-hub/contracts/logo-wave.md`
- `site/scripts/logo.test.ts`, `site/src/components/SiteBand.astro`, `site/src/pages/index.astro`,
  `site/src/layouts/Base.astro`, `site/redirects/github-pages.json`
- `site/scripts/route-inventory.test.ts`, `site/scripts/private-structure.test.ts`
- `site/scripts/private-build.mjs` (SD-7), `site/src/lib/frame-content.mjs`
  (`findUnservablePaths`, `GATE_SEGMENT_PATTERN`)
- `llm/sprints/2026-09-hub/handoffs/dissenter-logo.md` (S1, S4, S6)
- `git diff main...feat/logo`

## Addendum — 2026-10-04, HEAD `2236c54`

Since the first pass, `95f3ab5` ("close the skeptic's tightened gaps") and `2236c54`
("round dispositions") added guards. Re-verified with **both builds present** so the
`describe.runIf` built-output blocks actually run.

Baseline before breaking: `npm run build` green (27 pages); `npm run build:private` green
("checked 102 emitted path(s) against the gate's allowlist (SD-7)"); `npx vitest run
scripts/logo.test.ts` **18 passed (18)**; `npm test` **31 files, 421 passed | 2 skipped (423)**.
All breaks used unique anchors (verified `split(anchor).length - 1 === 1`), then
`git checkout -- <file>`; final `git status --porcelain` shows only the pre-existing
`M site/scripts/og-card.mjs` (the Lead Architect's in-flight edit) and the untracked
`chief-reviewer-logo.md` — neither touched by me.

### New guards defeated by name (8) — plus the ring fix

| Claim | New guard (source) | Break | Exact failing test |
|---|---|---|---|
| prior "ring proves less" | `logo.test.ts:113` `r="188"\s+fill="#e5751f"` | repaint **only** the `r="188"` ring to `#861f41` | `… > uses the burnt-orange ring and the white disc the band relies on` |
| D linked mark | `logo.test.ts:33` `<a class="band-emblem"\s+href=\{homeHref\}>` | `<a …>` → `<span class="band-emblem">` | `… > links the emblem svg with the exact alt text` |
| F focus ring | `logo.test.ts:38-40` `.site-band :focus-visible … var(--color-on-band)` | `--color-on-band` → `--color-focus` | `… > keeps the band focus ring visible in both themes` |
| C badge hero | `logo.test.ts:64-67` identity order + not `display:none` | `display: none;` on `.identity-badge` | `… > is the identity block's hero, not hidden` |
| E OG target exists | `logo.test.ts:102-104` | move `public/emblem/research-emblem.png` out of tree | `… > ships the file the default points at` |
| A built / | `logo.test.ts:132-137` reads `dist-public/index.html` | comment out the emblem `<a>` block, `npm run build` | `… > has the linked emblem with its alt text` |
| A built /p/ | `logo.test.ts:148-153` reads `dist-private/index.html` | same, `npm run build:private` | `… > has the emblem with its alt text` |
| B built og:image | `logo.test.ts:139-141` reads `dist-public/index.html` | comment out the `<meta property="og:image">` line, `npm run build` | `… > has og:image resolving to the emblem` |
| F dark half (pre-existing) | `src/styles/tokens.test.ts:63,129` (not in `scripts/`) | add `--vt-band: #111413;` inside the dark `:root` | `design tokens > resolves every brand token to the VT ramp, in both themes` |

The ring-specific fix lands: repainting **only** the ring (my prior finding) is now caught, as is
the linked-mark, focus-ring, hidden-hero, missing-OG-target and built-output regressions. The
dark-theme half of F was **already** guarded by the pre-existing `tokens.test.ts`
(`color-band: {light:#861f41, dark:#861f41}`) — my first report missed it by grepping only
`scripts/*.test.ts`.

### A–F after the addendum

| Claim | Status now | Residual gap |
|---|---|---|
| **A** emblem on every page | **Partial** | Built guards read only `dist-public/index.html` **and** `dist-private/index.html`; they do not enumerate all 27/6 built pages. A page that stopped rendering `SiteBand` would evade them. Substantively shielded: every chrome page uses `Base`/`PrivateBase`, both of which import `SiteBand`, so a component regression hits `index` too. |
| **B** OG resolves in built HTML | **Partial** | Same index-only scope (`dist-public/index.html`). `og:image` lives in shared `Base`, so a regression hits index, but per-page og overrides are unchecked. |
| **C** badge is the hero | **Partial** | Source guard catches `display: none` and source order. It does **not** catch other hiding: `visibility: hidden` on `.identity-badge` leaves `logo.test.ts` **18/18 green** (demonstrated). `opacity: 0` / off-screen positioning would likewise pass. |
| **D** emblem is a linked mark | **Closed** | — |
| **E** OG target file exists | **Closed** | Existence only (not emitted-path/base correctness), but the claim as stated is pinned. |
| **F** focus ring / dark-theme invariance | **Closed** | Focus ring via the new `logo.test.ts` guard; dark-band invariance via pre-existing `tokens.test.ts`. |

### Claims STILL uncovered after the addendum

- **A — "the emblem is in the band on every page":** covered for the two index pages, **not**
  enumerated across the full build.
- **B — "og:image resolves to the emblem in the built HTML":** covered for the home page only,
  **not** per public page.
- **C — "the badge is the identity hero (not hidden)":** only `display:none` is caught;
  **`visibility:hidden` (and other CSS hiding) still passes the whole suite.**

D, E and F are closed. No wholly-unguarded claim remains; the three survivors are
residual/partial gaps, not blanks.
