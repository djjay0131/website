# Contract — Security Tester, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Stream: Security Tester (owns the wave gate; one FAIL blocks)
Branch: `feat/branding` (PR #91)
Handoff: `llm/sprints/2026-09-hub/handoffs/security-tester-wave-0c.md`

## Purpose

Run the subset of the brief §6 gate Wave 0c can affect, and confirm the Wave 0b
guarantees are untouched.

## Checks

1. **No private content on the public path.** Rebuild `dist-public`; prove the
   new home page, the footer, the research index and the OG card carry no
   non-allowlisted title, slug or route. Red→green by planting a trace. Restore.
2. **Wave 0b not weakened.** `check:no-private-in-public` and
   `check:publish-allowlist` PASS; the allowlist and effective-visibility model
   are unchanged; `/cv/anthropic-fellow` and its PDF are still absent from
   `dist-public`.
3. **Portrait absent.** `photo_jason_1.jpeg` is not staged to `dist-public` and
   not referenced by any `og:*` tag; the CV PDFs still embed it.
4. **No off-origin request.** Grep the built output for third-party sub-resources
   (fonts.googleapis, gstatic, CDNs); all fonts/icons/images are in-repo.
5. **OG card.** Generated at build time, no private title, no portrait.
6. **firebase.json unchanged in kind** (no function/SSR/new rewrite/secret);
   `/signin/` noindex; private output `noindex, nofollow`.

## Rules

- Read-only except a restored planted trace. No git/cloud mutation.
- Every check PASS/FAIL with command + transcript; state §6 lines that are out of
  scope explicitly.

## Exit

Zero FAIL to pass.
