# Handoff — a11y-tester, Wave 0c (branding)

Status: Complete — **2 checks FAIL** (band focus ring in light theme; private print)
Date: 2026-10-03
Stream: a11y-tester (read-only; authors no source, fixes nothing)
Branch: `feat/branding` (PR #91)
Contract: `llm/sprints/2026-09-hub/contracts/a11y-tester-wave-0c.md`
Spec: `llm/specs/2026-10-01-branding-design.md`

Read-only. The only file written is this handoff. No git/cloud mutation.
Built with `npm run build:public` then `npm run build:private` from `site/`
sequentially (26 public pages, 5 private pages). Inspected `dist-public/**`,
`dist-private/**`, `site/src/**` and `site/src-private/**`.

---

## Summary

The new chrome is in good shape: every rendered page carries the band and
footer, exactly one `h1`, one `banner` and one `contentinfo`; `aria-current`
is correct on the section indexes and item pages; the Elsewhere links have
text names with `aria-hidden` icons; the contrast suite is at **0 below AA**;
no transition/animation was introduced; and the 320px CSS is sound.

Two defects:

1. **The maroon band's focus ring is invisible in the light theme.** The
   global `:focus-visible` outline uses `--color-focus`, which in light is
   Chicago Maroon `#861f41` — the same colour as `--color-band`. Ratio 1.00:1.
   Dark theme uses orange (`#f0913f`, 3.86:1 on maroon) and is fine.
2. **The private build does not hide the band or the skip link in print.**
   The public layout's global print rule lives in `Base.astro`, which
   `PrivateBase.astro` deliberately does not import; the shared `SiteFooter`
   hides itself, but nothing hides `SiteBand` or `.skip-link` under `/p/`.

Both are Fix-now (below). Nothing else regressed.

---

## Checks

| # | Check | Verdict |
|---|---|---|
| 1 | Keyboard order and skip link | **PASS** |
| 2 | Focus rings on the band | **FAIL** — light-theme ring 1.00:1, invisible |
| 3 | `aria-current` | **PASS** |
| 4 | Contrast both themes | **PASS** — 56 pairs, 0 below AA |
| 5 | Reduced motion | **PASS** — no motion introduced (none at all) |
| 6 | 320px layout | **PASS** (static CSS; no browser) |
| 7 | Print hides chrome | **FAIL** — private band + skip link print |
| 8 | Semantics | **PASS** |

---

### Check 1 — Keyboard order and skip link — PASS

- The skip link is the first element in `<body>`, before the band:
  `site/src/layouts/Base.astro:122` and `site/src-private/layouts/PrivateBase.astro:79`
  → `<a href="#main-content" class="skip-link">Skip to main content</a>`.
  Confirmed first in the emitted HTML of `/`, `/research/`, `/cv/`,
  `/signin/` and `/p/` (e.g. `dist-public/index.html`, `dist-private/index.html`).
- Its target exists once and is the `<main>`: `Base.astro:129`
  (`<main id="main-content" role="main">`), `PrivateBase.astro:102`.
  `id="main-content"` count = 1 on all 27 chrome pages (scan script,
  `/tmp/opencode/a11y-scan2.mjs`).
- Band links are native `<a>`/`<button>` (keyboard-reachable): `SiteBand.astro:45,61,72`;
  the private sign-out is a `<button>` (`PrivateBase.astro:95`). `<details>/<summary>`
  ("More") is natively focusable.
- Tab order per page is: skip link → band brand → band nav (Research,
  Projects, Writing, CV, then More disclosure on narrow screens) → main →
  footer. `/signin/` renders the band brand and footer with **no** `<nav>`
  (`hideNav`; `dist-public/signin/index.html`, `nav` absent). `/p/**` renders
  brand → "Members" tag → private nav → Sign out (`dist-private/index.html`).

### Check 2 — Focus rings on the band — FAIL

- The band links inherit the global rule `Base.astro:182-185`:
  `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }`.
- Light theme: `--color-focus: var(--vt-maroon)` = `#861f41`
  (`site/src/styles/tokens.css:132`, `:90`), and `--color-band: var(--vt-band)`
  = `#861f41` (`tokens.css:118`, `:101`).
- Measured `#861f41` on `#861f41` = **1.00:1** (`node -e` using
  `scripts/contrast.mjs:contrastRatio`). The outline is drawn over the maroon
  band with a 2px offset, so it is invisible. `SiteBand.astro` defines no
  band-scoped focus override (only `:hover` at lines 110, 163).
- Built evidence: `dist-public/_astro/Base.CcU5ywDX.css` contains exactly one
  focus rule, `:focus-visible{outline:2px solid var(--color-focus)...}`, and no
  band-specific `outline-color`.
- Dark theme is acceptable: `--color-focus: var(--vt-orange)` = `#f0913f`
  (`tokens.css:184`, `:168`) → 3.86:1 on the band, ≥ the 3:1 non-text minimum.
- The private band links do not even get the token: `PrivateBase.astro` has no
  global `:focus-visible`, so they fall back to the UA default
  (inconsistent, but visible). The sign-out button overrides with
  `--rule-orange` (`PrivateBase.astro:226`), 3.02:1 — passes.

### Check 3 — `aria-current` — PASS

`SiteBand.astro:61,72` emits `aria-current="page"` when `item.current`.
Measured on emitted HTML (`/tmp/opencode/a11y-scan2.mjs`):

- Section index: `/research/`→Research, `/projects/`→Projects,
  `/writing/`→Writing, `/cv/`→CV, `/papers/`→Papers, `/resumes/`→Resumes.
- Item pages: `/projects/kgis/kgis-docs/`, `/cv/academic/`, each
  `/research/soa-agentic-se/**` item → their section; `/p/**` item pages →
  the matching private nav item.
- Home, `/email/`, `/privacy/`, `/phd/`, `/signin/`, `/p/` carry none — correct,
  since none is a linked primary/secondary section (`phd` is deliberately
  never linked, `Base.astro:57`). Exactly one `aria-current` per relevant page.

### Check 4 — Contrast both themes — PASS

- `npm run contrast` exit 0: **`56 pairs, 0 below AA`** (`scripts/contrast.mjs`).
- Band white-on-maroon: `--color-on-band #ffffff` on `--color-band #861f41`
  = **9.19:1** in both themes (tokens do not flip; `contrast.mjs:35`). The
  spec's 8.4:1 was a conservative estimate; actual is higher, still AA.
- Orange rule `--rule-orange #e5751f` (`tokens.css:103,120`) is used only as a
  4px border and a current-link underline (`SiteBand.astro:89,174`) — decorative,
  no text obligation. (`#e5751f` on maroon is 3.02:1, fine for non-text.)
- `--vt-orange-text` = `#c34600` light, `var(--vt-orange)` `#f0913f` dark
  (`tokens.css:108,175`); on `--color-bg` = **4.57:1** light / **7.79:1** dark
  (`contrast.mjs:36`). Both AA.
- Note (non-blocking): `--vt-orange-text` is defined and passes, but **no
  emitted rule references it** (no `var(--vt-orange-text)` in
  `dist-public/_astro/*.css` or `dist-private/_astro/*.css`). The spec §5
  intended it for a "light-theme orange underline"; no such underline exists —
  the only orange underline is the band's decorative `--rule-orange`. This is a
  spec-vs-build gap, not an AA failure; see "Could not test".

### Check 5 — Reduced motion — PASS

Grep over `site/src` and `site/src-private` (`*.astro,*.css,*.ts,*.mjs`) for
`transition|animation|@keyframes|prefers-reduced-motion|scroll-behavior`
returned **no matches** (exit 1). Same grep over
`dist-public/_astro/Base.CcU5ywDX.css` and
`dist-private/_astro/private-content.BA0uPzLR.css` returned none. There is no
motion (not even a hover transition), so nothing needs a reduced-motion guard.

### Check 6 — 320px layout — PASS (static inspection; no browser)

Relevant emitted CSS (`dist-public/_astro/Base.CcU5ywDX.css`):

- `*,:before,:after{box-sizing:border-box;margin:0}` — border-box everywhere.
- Band, ≤600px: `.band-inner{flex-wrap:nowrap;align-items:center}`,
  `.band-nav{min-width:0}`, `.band-primary{flex-wrap:nowrap;overflow-x:auto}`,
  `.band-primary li{white-space:nowrap}` (`SiteBand.astro:212-237`). Single
  scrollable row; no hamburger JS anywhere (no client script in `Base.astro`).
  The nav's `min-width:0` + primary's `overflow-x:auto` let the row shrink to
  the viewport; `white-space:nowrap` is safely inside the scroll container.
- Home tenet grid → `1fr` at ≤700 (`index.astro:251-255`); ways grid → `1fr`
  and recent rows wrap at ≤600 (`index.astro:257-266`).
- Footer columns → `1fr` at ≤600 (`SiteFooter.astro:178-182`); the only
  `min-width` is `.footer-provenance{min-width:14rem}` = 224px
  (`SiteFooter.astro:169-172`), which fits inside the 272px content box at 320
  (320 − 2×24px padding).
- No fixed `width` larger than the content box (only `--max-width:800px`, a
  cap) and no horizontal-scroll-busting `white-space` outside the band's scroll
  container. Static analysis finds no horizontal-overflow source. Not exercised
  in a browser (see below).

### Check 7 — Print hides the chrome — FAIL (private build)

- **Public — PASS.** `Base.astro:238-243` emits
  `@media print { .site-band, .site-footer, .skip-link { display:none } ... }`;
  present in `dist-public/_astro/Base.CcU5ywDX.css`:
  `@media print{.site-band,.site-footer,.skip-link{display:none}main{...}}`.
- **Private — FAIL.** `PrivateBase.astro` has **no** `@media print` block. The
  only print rule in `dist-private/_astro/private-content.BA0uPzLR.css` is
  `@media print{.site-footer[data-astro-cid-nns7i3if]{display:none}}` (from the
  shared `SiteFooter.astro:184-188`). So under `/p/`, the **band prints** and the
  skip link is not print-hidden. Pre-existing pattern (the old
  `.private-header` also had no print rule), but the Wave 0c shared band now
  makes this a contract gap across both builds.

### Check 8 — Semantics — PASS

Measured on all 27 chrome pages plus the raw `_payload` documents
(`/tmp/opencode/a11y-scan2.mjs`):

- One `h1` per rendered document: home `index.astro:54`; section indexes
  `SectionIndex.astro:56`; item pages `ItemPage.astro:41`; `/signin/`
  `src/pages/signin/index.astro:52`. Count = 1 everywhere (redirect stubs and
  `_payload` raw content excluded; `_payload` still has one `h1`).
- Footer is `contentinfo`: `SiteFooter.astro:50`
  (`<footer class="site-footer" role="contentinfo" ...>`) — count = 1 per page.
- Band is `banner`: `<header class="site-band">` is a direct child of `<body>`
  (`Base.astro:123`, `PrivateBase.astro:80`), so it maps to the `banner`
  landmark. `banner=true` on every chrome page. The second `<header>`
  (`.section-head` / `.item-head`) is inside `<main>` and is not a banner.
- Elsewhere links have discernible names: each `<a rel="me noopener">` holds a
  `<SiteIcon>` with `aria-hidden="true"` (`SiteIcon.astro:13-22`) plus a text
  `<span>{label}</span>` (`SiteFooter.astro:64-68`). All six icons
  (GitHub, LinkedIn, Google Scholar, ORCID, X, Bluesky) have `iconHidden=true`
  and a non-empty name.
- Also present: `<html lang="en">`, the framed payload `<iframe … title="…">`
  (`dist-public/projects/kgis/kgis-docs/index.html`).

---

## Could not test

- **Live keyboard traversal / focus rendering / 320px layout** — no browser is
  available in this environment (the contract permits CSS inspection). Checks 1,
  2, 6 and the print checks are asserted from the emitted DOM/CSS, not from a
  rendered tab sequence, screenshot or `prefers-color-scheme`/print emulation.
  The Check 2 failure is arithmetic (two identical hex values), so it does not
  depend on rendering.
- **`prefers-reduced-motion`** — cannot be triggered, but there is no motion to
  reduce, so the assertion is the static absence of transitions/animations.
- **The light-theme orange underline using `--vt-orange-text`** — no such UI
  exists in the build; the token is never referenced (see Check 4). There is no
  rendered underline to spot-check. The related contrast pair does pass.
- **`aria-current` via assistive tech** — verified as an attribute in the
  emitted HTML only.

---

## Fix-now list

1. **Band focus ring, light theme (Check 2).** Give the band a focus indicator
   that contrasts against maroon — e.g. in `SiteBand.astro` add
   `:focus-visible { outline-color: var(--color-on-band); }` (white, 9.19:1) or
   `var(--rule-orange)` (3.02:1, meets 3:1). `--color-focus` cannot be changed
   globally: it is correct (maroon on paper) everywhere except the band, so the
   fix belongs scoped to the band. Also give `PrivateBase.astro` a real
   `:focus-visible` so private band links do not depend on the UA default.
2. **Private print chrome (Check 7).** Hide the band and skip link under
   `/p/`. Cleanest: move the `.site-band`/`.skip-link` print rule into the
   shared `SiteBand` (and/or add `@media print { .site-band, .skip-link {
   display:none } }` to `PrivateBase.astro`), so both layouts hide all chrome.

Non-blocking observation (not a check failure):

3. `--vt-orange-text` is defined, checked and passing, but unreferenced. If the
   spec still wants an orange text/underline in the light theme, wire it up;
   otherwise the token (and its `contrast.mjs` pair) is dead. Owner may also
   revisit the `#c34600` vs `#c64600` question recorded in the spec §5
   amendment.

---

## Related docs

- Contract: `llm/sprints/2026-09-hub/contracts/a11y-tester-wave-0c.md`
- Spec: `llm/specs/2026-10-01-branding-design.md` (§3, §4, §5, §6, §7)
- ADR: `llm/governance/adr/0015-branding-no-portrait-band-and-mark-rule.md`
- Build scripts: `site/package.json` (`build:public`, `build:private`,
  `contrast`), `site/scripts/contrast.mjs`
- Sources cited: `site/src/layouts/Base.astro`,
  `site/src-private/layouts/PrivateBase.astro`,
  `site/src/components/SiteBand.astro`, `site/src/components/SiteFooter.astro`,
  `site/src/components/SiteIcon.astro`, `site/src/styles/tokens.css`,
  `site/src/pages/index.astro`
- Built artifacts: `dist-public/_astro/Base.CcU5ywDX.css`,
  `dist-private/_astro/private-content.BA0uPzLR.css`,
  `dist-public/index.html`, `dist-public/signin/index.html`,
  `dist-private/index.html`
