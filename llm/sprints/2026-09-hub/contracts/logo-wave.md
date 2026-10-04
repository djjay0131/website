# Contract — L1 follow-up wave "logo" (D16)

Status: Issued
Date: 2026-10-04
Owner: Lead Architect
Stream: site (build) + adversaries/testers/reviewer (see §Agents)
Branch: `feat/logo`
Decision: D16 (STATE 2026-10-04)
Design authority: `llm/specs/2026-10-01-branding-design.md` (amended 2026-10-04); ADR-0015 (amended 2026-10-04)
Related: PR #70 (`assets/research-badges`, stays a draft); #71 (original emblem)

## Purpose

Restore the research emblem as the site mark and give the home page a hero image again,
without merging #70 and without weakening any existing guard. This is a small, bounded L1
change: two component/page edits, one default in the layout, two committed image files, and a
redirect-map entry. No infra, gate, or Terraform change; none is permitted by this contract.

## Scope — paths this wave may touch

- `site/src/components/SiteBand.astro` — the linked emblem left of the wordmark
- `site/src/pages/index.astro` — the badge hero in the identity block
- `site/src/layouts/Base.astro` — the default `og:image` returns to the emblem
- `site/public/badges/vt-badge-hokiebird-laptop-tower-research-today{,-2x}.png`
- `site/redirects/github-pages.json` — the two new public files, sorted
- `site/scripts/logo.test.ts` — source-level guards for the three new surfaces and the
  emblem's non-text contrast (added in response to Dissenter D-S1)
- `site/scripts/og-card.mjs`, `og-card.test.ts`, `site-routes.mjs`, `site/astro.config.mjs`
  — **comments only**, to record that the generated card is retained but no longer the
  default (Dissenter D-S2). No behaviour change.
- `llm/governance/adr/0015-*.md`, `llm/specs/2026-10-01-branding-design.md`, `STATE.md`
- Wave records under `llm/sprints/2026-09-hub/`

## Must NOT touch

- `gate/**`, `infra/**`, `contract/**`, `.github/workflows/**`, `firebase.json`
- `contract/manifest.schema.json`
- The allowlist / effective-visibility model; the leak check's rules; `og-card.mjs` behaviour
  (the generated card stays in the tree but is no longer the default)
- Any other badge from `assets/research-badges`; **PR #70 is not merged**

## Requirements

1. **Emblem in the band (D16.1).** In `SiteBand`, a linked 40px emblem (44px minimum hit
   target) to the **left** of the wordmark, from `emblem/research-emblem.svg`, on every page
   and in both themes. `alt` is exactly `Jason Cusati research emblem`. The band stays the
   theme-invariant maroon; the emblem's visible rings (burnt-orange 3.02:1, white disc 8.86:1
   against `--color-band`) meet the AA non-text 3:1 threshold; the focus ring stays
   `--color-on-band`.
2. **Badge hero (D16.2).** On `/`, the owner's
   `vt-badge-hokiebird-laptop-tower-research-today.png` sits in the identity block where the
   portrait used to be. Copy **only** that PNG from `assets/research-badges`; optimise under
   150KB and add a 2x. No `loading="lazy"` (above the fold). Descriptive `alt`. The filename
   must satisfy the gate's segment allowlist `[A-Za-z0-9._-]` (so `-2x`, never `@2x`).
3. **OG stays the emblem (D16.2).** The default `og:image` is `/emblem/research-emblem.png`.
4. **Record (D16.3).** D16 is a row in STATE's decisions table, with the owner caveat
   recorded **verbatim**. ADR-0015 and the branding spec carry dated amendments, and the
   files that still call the generated card "the default `og:image`" are corrected in
   comments, so no existing source of truth is left contradicted by the served emblem,
   badge or OG default. The generated card itself is retained, not retired (a follow-up).

## Agents (all read-only; they write no source and make no git/gh/cloud mutation)

- **Dissenter** — ≥3 objections with the evidence that would settle each; the bar is
  "blocking?", not "could be better".
- **Skeptic Verifier** — break every new guard or claim and show red, then restore. In
  particular: the gate-segment guard on the badge filename, the redirect-map coverage, the
  emblem alt text, and the OG default.
- **Security Tester** — confirm **no new served paths beyond `/badges/`** and **no change to
  the gate or `firebase.json` rewrites**; re-run the public/private boundary (leak check
  red→green if it can, private build SD-7 path check).
- **a11y pass** — the two new surfaces: the band emblem (name, role, hit target, focus ring,
  contrast against the band both themes) and the badge hero (alt text, no layout shift, 320px).
- **Chief Reviewer** — §8 verdict (Approve / Comment), authors nothing.

## Evidence required

`npm test`; `npm run contrast` (0 below AA); `npm run build` and `build:private`; leak check
`check:no-private-in-public` PASS; `check:private-links`; `check:publish-allowlist`;
`check:smoke-routes`; `redirects:stubs`; `governance-checks --layout` 4/4. Build-size probe:
each badge file under 150KB.

## Exit

Both new surfaces render in the public and private builds; the emblem is in the band on every
page; `/` carries the badge and `og:image` is the emblem; leak check and builds green; Security
Tester zero FAIL; Skeptic no un-failable guard; Chief Reviewer Approve/Comment; merged under
§8 with a merge commit and the branch deleted; live probes on `jason.cusati.us` show the badge
on `/` and the emblem on every page.
