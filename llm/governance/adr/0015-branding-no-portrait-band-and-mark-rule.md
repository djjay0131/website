# ADR-0015: Branding — no portrait, maroon band as a token, and no VT mark without permission

Status: Accepted
Date: 2026-10-01

## Context

`llm/plans/2026-09-19-branding-plan.md` was approved by the owner as design authority for
Wave 0c (D14, 2026-10-01), and turned into
`llm/specs/2026-10-01-branding-design.md`. Four choices in it are decisions rather than
styling, each with a reason that outlives the wave:

1. The live home page is a CV hero whose only visual is the portrait, and the default
   `og:image` is that portrait. Licensing declined the Virginia Tech marks (D13,
   2026-10-01), so the emblem (#71) is the site mark; leaving a face as the link preview is
   both a branding and a privacy choice.
2. The header band's colours (Chicago Maroon `#861f41`, Burnt Orange `#e5751f`) do not swap
   with the light/dark theme, unlike every other accent. A token test (`tokens.test.ts`)
   pins every `--color-*` token to the tracker palette and would reject them.
3. The VT wordmark and HokieBird are registered marks and a personal site is not an
   authorized use; the plan ships without them and swaps one in only after permission.
4. `--tracker-petrol` paints nothing and exists only because a test pins it.

## Decision

1. **No portrait on the public site.** The home hero drops the photo; the default `og:image`
   becomes a generated card (name, title, maroon band, orange rule). The photo stays in the
   CV PDFs the owner already publishes. The build stops staging `photo_jason_1.jpeg` into
   `dist-public`.
2. **The band is a token pair, and the theme invariant is explicit.** Add `--color-band`,
   `--color-on-band`, `--rule-orange` and `--vt-orange-text`. The first three do **not**
   flip between themes: the band is the brand. `tokens.test.ts`'s carve-out is widened **by
   name** with a positive test that each resolves to the `--vt-*` ramp; the verbatim-palette
   assertion is amended to drop `--tracker-petrol`, not deleted.

   > Amended 2026-10-02 (Wave 0c build). `--vt-orange-text` holds **`#c34600`**, not the
   > `#c64600` first named: `#c64600` measures 4.48:1 on `--color-bg`, 0.02 below AA, and
   > this ADR's contrast suite requires 0 below AA. `#c34600` is the nearest same-family
   > shade that passes (4.57:1). Spec §5 is amended to match.
3. **No VT mark without permission.** Wave 0c serves the affiliation as plain text
   ("Virginia Tech") and no mark. Adding the mark later is an ADR amendment, on evidence of
   permission (licensing@vt.edu).
4. **`--tracker-petrol` is removed**, with its assertion amended in the same change.
5. **The chrome is shared.** The band and footer become components under
   `site/src/components/` imported by **both** `Base.astro` and `PrivateBase.astro`, whose
   navigations stay separate. `private-structure.test.ts` is extended to cover the shared
   components, not weakened.

## Consequences

- The home page is text-led and institutional; the site is legible as a VT researcher's hub
  without any mark.
- The band is the one theme-invariant surface; the contrast suite (`contrast.mjs`) gains the
  `on-band`/`band` and `vt-orange-text`/`bg` pairs and must stay at zero below AA.
- Two layout files import one pair of components; the private nav cannot leak into the
  public build because the components carry no navigation.
- Wave 0c runs **after** Wave 0b: the home page's Recent block reads the allowlisted item
  set, which 0b introduces.

## Alternatives considered

- Keep the portrait somewhere (an About page) — the Dissenter's case; the owner's default is
  no page, and the CV carries the biography.
- Serve the VT logo now — rejected: the marks are registered and permission is not on the
  record.
- Make the band flip light/dark like other accents — rejected: it is the brand, and
  white-on-maroon is 8.4:1 in both themes.

## Amendment — 2026-10-04 (owner decision D16)

D16 is a small owner-directed L1 follow-up on `feat/logo`. It changes two of this ADR's
outcomes and knowingly overrides one, each on the owner's own authority:

1. **The research emblem returns to the band and to `og:image`.** Decision 1's generated
   OG card is superseded: the default `og:image` is again `/emblem/research-emblem.png`,
   as #71 had it. The emblem is also placed as a linked mark, 40px in a 44px hit target,
   to the **left of the wordmark** in the shared `SiteBand` (every page, both themes). The
   emblem is original work and carries no university mark and no HokieBird.
2. **Decision 3 is overridden for exactly one asset.** The owner knowingly serves his own
   AI-generated badge `vt-badge-hokiebird-laptop-tower-research-today.png` as the home-page
   hero image, where the portrait used to sit. It depicts the HokieBird, a VT trademark the
   Office of Licensing and Trademarks **declined** (D13). This is not a licensing reversal and
   not a precedent: PR #70 stays unmerged, the other seven badge concepts are **not** added,
   and no VT mark is added anywhere else. **The emblem remains the mark-free fallback.**

The owner's caveat, recorded verbatim in `STATE.md` D16:

> the badge depicts the HokieBird, a VT trademark Licensing declined; the owner chose to use
> his own AI-generated rendering knowingly; the emblem remains the mark-free fallback.

## References

- `llm/specs/2026-10-01-branding-design.md`
- `llm/plans/2026-09-19-branding-plan.md`
- D13, D14 in `llm/sprints/2026-09-hub/STATE.md`
- ADR-0005, ADR-0011
