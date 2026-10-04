# Handoff — a11y-tester, L1 wave "logo" (D16)

Status: Complete — **0 checks FAIL** (1 non-blocking risk, 1 inherited gap)
Date: 2026-10-04
Stream: a11y-tester (read-only; authors no source, fixes nothing)
Branch: `feat/logo` (HEAD `95f3ab5`)
Contract: `llm/sprints/2026-09-hub/contracts/logo-wave.md`
Design authority: `llm/specs/2026-10-01-branding-design.md`; ADR-0015

Read-only. The only file written is this handoff. No git/gh/cloud mutation.
Built from `site/` with `npm run build` → `dist-public` (27 pages, one of them a
framed payload) then `npm run build:private` → `dist-private` (6 pages plus
raw payload/doc copies). Inspected `dist-public/**`, `dist-private/**`,
`site/src/**`, `site/src-private/**`. `npm test` green (421 passed / 2 skipped),
`scripts/logo.test.ts` green (18/18), `npm run contrast` exit 0.

---

## Summary

The two new surfaces are sound. The band emblem is on **every chrome page in
both builds** — exactly one `class="band-emblem"` anchor, one `<img>` inside it,
`alt="Jason Cusati research emblem"` exactly once, no empty or duplicate `alt`.
The \(44\times44\) anchor / \(40\times40\) image hit target is in the emitted CSS
of both builds. The band-scoped `:focus-visible { outline-color:
var(--color-on-band) }` is emitted in both builds and beats the global
`:focus-visible` on specificity, so the light-theme ring is no longer invisible
on maroon. The badge hero carries a descriptive `alt`, explicit `width`/`height`,
a `1x`/`2x` `srcset`, no `loading="lazy"`, and stacks at `≤700px` with no
`display:none`. `npm run contrast` is **56 pairs, 0 below AA**; the emblem's
burnt-orange ring is **3.02:1** and its white disc **8.86:1** against
`--color-band #861f41`, both ≥ 3:1. Semantics are unchanged: one `h1`, one
implicit `banner`, one `contentinfo`, `aria-current` as in Wave 0c, and the new
image carries no `role`.

**FAIL count: 0.**

Two things worth recording, neither blocking:

1. **Rendered ring is sub-pixel at 40px.** The orange ring is
   \(6/400\) of the viewBox = **0.6px** at the 40px render; the outer maroon ring
   is invisible against the band by design. The ratios pass, but the visible
   "ring" is a hairline (the white disc is the load-bearing element). See Risks.
2. **Private build has no global `:focus-visible`.** The shared, band-scoped
   rule is present, so the band ring's *colour* is correct in `/p/`, but private
   band links still depend on the UA default outline for style/width. This is the
   un-fixed second half of Wave 0c's Check 2 finding; `src-private/` is outside
   this wave's scope. See Risks.

---

## Checks

| # | Check | Verdict |
|---|---|---|
| 1 | Emblem in the band, every page (name, role, alt) | **PASS** (26 public + 6 private chrome pages) |
| 2 | Hit target: 44×44 anchor, 40×40 image | **PASS** |
| 3 | Band `:focus-visible` is `--color-on-band` in both themes | **PASS** — duplicate home link noted, acceptable |
| 4 | Badge hero: alt / width-height / no lazy / srcset / ≤700 stack / no `display:none` | **PASS** |
| 5 | Contrast: `npm run contrast` 0 below AA; ring/disc ≥ 3:1 | **PASS** |
| 6 | Semantics regressions: one `h1`, banner/contentinfo, `aria-current`, no role conflict | **PASS** |

Scan method: `/tmp/opencode/a11y-logo-scan.mjs` (regex over all emitted `.html`),
plus targeted `node -e` extraction of the built CSS. Redirect stubs and framed
raw documents (which carry no chrome by construction) are listed in Check 1.

---

### Check 1 — Emblem in the band, every page — PASS

Measured per page: `class="band-emblem"` count, `<img>` count inside that
anchor, and exact-`alt` count (`/tmp/opencode/a11y-logo-scan.mjs`).

- **dist-public:** 26 chrome pages, each `bandAnchor=1`, `imgsInEmblem=[1]`,
  `alt="Jason Cusati research emblem"` count 1, `alt=""` count 0.
- **dist-private:** 6 chrome pages, same result.
- DOM shape (both builds), e.g. `dist-public/index.html`:
  `<div class="band-brand-group"><a class="band-emblem" href="/"><img src="/emblem/research-emblem.svg" alt="Jason Cusati research emblem" width="40" height="40"></a><a class="band-brand" href="/">…`
  Private mirror uses `href="/p/"` and `src="/p/emblem/research-emblem.svg"`.
- **Accessible name** = the image `alt` (`SiteBand.astro:57`); the anchor has no
  `aria-label`/`title`/other text, so the name is exactly "Jason Cusati research
  emblem". **Role** = native `link` (`<a href>`). `alt` is non-empty and appears
  once per page.
- **Source:** `site/src/components/SiteBand.astro:54-61`.
- **Chrome-less documents excluded by design** (11 files; none has the band):
  - `dist-public/_payload/kgis/index.html` — framed payload (`_payload`).
  - `dist-public/research/agentic-harnesses/{index,consensus,sources,synthesis}/index.html`
    — 4 legacy redirect stubs (500–560 B, `<meta http-equiv="refresh">`).
  - `dist-private/_payload/phd-milestones/site/{index,committee,internal}.html` — framed payloads.
  - `dist-private/**/_doc/{committee,index,internal}.html` — 3 raw item copies.
  There is **no `404.html`** in either output.

### Check 2 — Hit target — PASS

Emitted CSS (identical rule in both builds):

- `dist-public/_astro/Base.0y6ydA4-.css`:
  `.band-emblem[…cid…]{width:44px;height:44px;color:var(--color-on-band);border-radius:50%;flex-shrink:0;justify-content:center;align-items:center;display:inline-flex}`
  `.band-emblem[…cid…] img[…cid…]{width:40px;height:40px;display:block}`
- `dist-private/_astro/private-content.CGDnylrz.css`: same two rules.
- **Source:** `SiteBand.astro:129-138` (44px box), `:140-144` (40px image);
  image attrs `width="40" height="40"` at `:58-59` (attribute + CSS agree, 1:1 so
  no layout shift).

### Check 3 — Focus visibility — PASS (duplicate link: acceptable)

- Emitted rule in **both** builds:
  `.site-band[…cid…] […cid…]:focus-visible{outline-color:var(--color-on-band)}`.
- `--color-on-band` = `var(--vt-on-band)` = `#ffffff` and is **not overridden in
  the dark block** (`tokens.css:102,119,146-189`), so the ring colour is white
  against maroon in **both themes** (9.19:1 over the band), never
  `--color-focus` (light `#861f41` = 1.00:1, dark `#f0913f` = 3.86:1;
  `tokens.css:132,184`).
- Specificity: band selector is class+2×attr+pseudo-class (0,4,0) vs the global
  `:focus-visible` in `Base.astro:189-192` (0,1,0); the band rule wins. In public
  the global rule still supplies `outline: 2px solid` and the band rule overrides
  only the colour, so the ring is 2px white.
- **Source:** `SiteBand.astro:222-228`; verified in both built CSS bundles.
- **Duplicate home link — acceptable.** The emblem anchor and the wordmark anchor
  are adjacent siblings with the same `href` (`/` public, `/p/` private;
  `SiteBand.astro:54,62`). Screen readers announce two links to the same
  destination ("Jason Cusati research emblem", link; then the wordmark+affiliation
  link). This passes **WCAG 2.4.4** (each link's purpose is discernible from its
  own name) and is a very common pattern (logo + site name both home). The only
  cost is one redundant tab stop for keyboard/AT users; it is not a failure. If
  the owner wants to remove it, wrap both mark and wordmark in a single anchor,
  or give one of the two `tabindex="-1"`/`aria-hidden` while the other keeps the
  name — do **not** `aria-hidden` the only named element.

### Check 4 — Badge hero — PASS

Emitted `dist-public/index.html` (only the public home page carries it; the
private build has none — `/p/` output contains no `identity-badge`):

```
<img class="identity-badge"
  src="/badges/vt-badge-hokiebird-laptop-tower-research-today.png"
  srcset="/badges/vt-badge-hokiebird-laptop-tower-research-today.png 1x,
          /badges/vt-badge-hokiebird-laptop-tower-research-today-2x.png 2x"
  width="200" height="200"
  alt="Illustrated research badge: the HokieBird at a laptop in front of the
       Virginia Tech tower, captioned “Research today · A brighter tomorrow”.">
```

- **Descriptive `alt`** — yes (names subject, setting and caption text).
  **Source:** `site/src/pages/index.astro:59-66`.
- **Explicit `width`/`height`** — `200`/`200`, plus CSS
  `.identity-badge{width:200px;height:200px}` (inlined in the page `<style>`),
  so no layout shift. (`x`-descriptor `srcset`, so no `sizes` needed.)
- **No `loading="lazy"`** — `grep -c 'loading='` = 0 on the page; above-the-fold
  eager load correct.
- **`1x`/`2x` `srcset`** — present, both files committed
  (`site/public/badges/…today.png` 13,775 B; `…today-2x.png` 38,611 B; both
  < 150 KB).
- **Stacks at ≤700px, no `display:none`** — emitted page CSS:
  `@media (width<=700px){.identity{flex-direction:column;gap:1.25rem}.identity-badge{width:160px;height:160px}…}`
  (`index.astro:280-294`). No `display:none` on `.identity`, `.identity-badge` or
  any ancestor in the built output.

### Check 5 — Contrast — PASS

- `npm run contrast` → **`56 pairs, 0 below AA`**, exit 0.
- Independently computed with `scripts/contrast.mjs:contrastRatio` against
  `--color-band #861f41`:

  | Element | Hex | Ratio | ≥ 3:1 (WCAG 1.4.11)? |
  |---|---|---|---|
  | Burnt-orange ring (`research-emblem.svg:12`) | `#e5751f` | **3.02:1** | Yes |
  | White disc (`research-emblem.svg:14`) | `#fbfbf8` | **8.86:1** | Yes |
  | (reference) `--color-on-band` | `#ffffff` | 9.19:1 | — |

- The emblem is a **logotype**, which WCAG 1.4.11 exempts from non-text contrast;
  the owner asked for AA anyway, and both checked colours clear 3:1. Source-level
  guard: `scripts/logo.test.ts:107-124` (ties the ratios to the actual `r="188"`
  orange and `r="176"` white rings, so repainting the ring goes red).

### Check 6 — Semantics regressions — PASS

Per chrome page (`/tmp/opencode/a11y-logo-scan.mjs`, all 26 public + 6 private):

- **One `h1`** — count 1 everywhere (home `index.astro:68`; section/item pages).
- **One `banner`** — the only `<header>` before `<main>` is
  `<header class="site-band">` (implicit banner); pages with two `<header>`
  elements (e.g. `dist-public/cv/index.html`) have the second,
  `<header class="section-head">`, **inside** `<main>`, so it is not a banner.
- **One `contentinfo`** — `role="contentinfo"` count 1 on every page.
- **`aria-current` unchanged** — section/item pages carry exactly one, home /
  `/email/` / `/privacy/` / `/phd/` / `/signin/` / `/search/` and private home
  carry none. Same as Wave 0c Check 3.
- **No role conflict on the new image** — `<img>` in the band has no `role`
  attribute (`imgRole=0`); the SVG's internal `role="img"`/`aria-labelledby` is
  not exposed when the SVG is referenced via external `<img src>`, so the alt is
  the sole accessible name.
- `npm test` fully green (421 passed / 2 skipped), so the semantics/route guards
  did not regress.

---

## Findings (file:line)

- **PASS** — Emblem anchor + exact alt: `site/src/components/SiteBand.astro:54-61`;
  emitted on all chrome pages (`dist-public/*/index.html`, `dist-private/*/index.html`).
- **PASS** — Hit target: `SiteBand.astro:129-138,140-144`; emitted in
  `dist-public/_astro/Base.0y6ydA4-.css` and
  `dist-private/_astro/private-content.CGDnylrz.css`.
- **PASS** — Band focus colour: `SiteBand.astro:222-228`; `tokens.css:102,119`
  (on-band fixed) vs `:132,184` (focus flips).
- **PASS** — Badge hero: `site/src/pages/index.astro:59-66` (attrs), `:144-148`
  (CSS), `:280-294` (≤700 stack).
- **PASS** — og default restored (context, not an a11y check):
  `site/src/layouts/Base.astro:48` → `emblem/research-emblem.png`, confirmed in
  `dist-public/index.html`.
- **PASS** — Wave guard: `site/scripts/logo.test.ts:28-52` (band), `:54-92`
  (badge), `:107-124` (emblem contrast), `:126-158` (built output).
- **RISK (non-blocking)** — Ring thickness at render:
  `site/public/emblem/research-emblem.svg:11-14` (radii 196/188/182/176). The
  only ring that reads against the maroon band is the orange annulus
  \(r=182..188\) = **0.6px at 40px**; the outer maroon ring (`r=188..196`) is the
  band colour. The contrast *ratio* is compliant, but the ring is effectively a
  hairline and the white disc does the visual work.
- **INHERITED GAP (non-blocking, out of scope)** — `src-private/layouts/PrivateBase.astro`
  emits no global `:focus-visible` outline (only `.sign-out:focus-visible` at
  `:233`); private band links get the shared band `outline-color` but rely on the
  UA default for style/width. This is the residual half of Wave 0c Check 2.

---

## Risks

1. **Sub-pixel orange ring at 40px (Findings).** Non-text contrast is compliant
   arithmetically and the emblem is a WCAG-exempt logotype, but at 40px the
   orange ring is ~0.6px. If the owner wants the *ring* itself perceptible (not
   just the white disc), increase the emblem's render size, thicken the orange
   annulus, or raise the band-vs-ring delta. No source change is proposed here
   (read-only).
2. **Private-build focus ring depends on the UA default (Findings).** The colour
   is correct and visible, but rendering of the private band ring is
   browser-dependent for style/width. A one-line `:focus-visible` in
   `PrivateBase.astro`, or moving the global outline into the shared band, would
   close it. Out of this wave's scope.
3. **3.02:1 is a rounding-sensitive margin.** Any future drift in `#e5751f` or
   `#861f41` drops the ring below 3:1. `logo.test.ts` guards it (red on repaint),
   so this is monitored, not open.
4. **Duplicate home link (Check 3).** Accepted; listed only so a future reviewer
   does not re-raise it as new.

## Open questions

1. **Fixture wordmark vs. hard-coded alt.** In this test environment the wordmark
   renders "Fixture Person" (`dist-public/index.html`) while the emblem alt is
   the fixed "Jason Cusati research emblem". Not an a11y defect (the alt is the
   site owner's mark name, and production `meta.name` is "Jason Cusati"), but
   worth confirming the fixture content is never the served artifact.
2. **Badge alt verbosity.** ~113 characters naming subject, setting and caption.
   Describes the image well; a shorter alt ("Research badge: HokieBird at a
   laptop before the Virginia Tech tower") would be less repetitive for screen
   readers. Owner's call; not a failure.
3. **Emblem as lone tab stop?** See duplicate-link note — leave as-is or collapse
   to one link. No a11y requirement either way.

## ADR candidates

- None. All six checks pass; the risks are cosmetic rendering (ring thickness),
  an inherited private-layout focus rule, and a stylistic duplicate link. No new
  architectural decision is implied by this wave.
