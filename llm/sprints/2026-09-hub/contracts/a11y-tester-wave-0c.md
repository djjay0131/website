# Contract — a11y-tester, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Stream: a11y-tester (testers; authors no source, fixes nothing)
Branch: `feat/branding` (PR #91)
Handoff: `llm/sprints/2026-09-hub/handoffs/a11y-tester-wave-0c.md`

## Purpose

Verify the new chrome for accessibility on every page, in both themes and at
320px. The `site` stream is done; you break nothing.

## Checks

1. **Keyboard order and skip link.** Tab order is sensible on `/`, a section
   index, a CV page, `/signin/` and a `/p/**` page; the skip link is reachable
   first and targets `#main-content`; the band's links are keyboard-reachable.
2. **Focus rings on the band.** The maroon band's focused links have a visible
   focus indicator (the band is dark; check `--color-focus` contrast against
   `--color-band`).
3. **`aria-current`.** The current section link carries `aria-current` on each
   section index and item page.
4. **Contrast both themes.** `npm run contrast` at 0 below AA; spot-check the
   band's white-on-maroon, the orange rule (decorative), and the light-theme
   orange underline using `--vt-orange-text`.
5. **Reduced motion.** There is no motion to reduce; assert none was introduced
   (no CSS transitions/animations beyond hover).
6. **320px layout.** No horizontal overflow on `/`, the home tenet grid, the
   footer columns, or the band; the nav is a single scrollable row (no hamburger
   JS).
7. **Print.** The print stylesheet still hides the chrome (band, footer, skip
   link).
8. **Semantics.** One `h1` per page; the footer is `contentinfo`; the band is
   `banner`; the Elsewhere links have discernible names (icon is aria-hidden).

## Rules

- Read-only; your only write is your handoff. No git/cloud mutation.
- Use `npm run build:public` / `build:private` and inspect the emitted HTML/CSS;
  you may add no tests. Cite file:line or the built artifact.

## Exit

Every check PASS/FAIL with evidence; a FAIL is *Fix now*. Name anything you could
not test and why.
