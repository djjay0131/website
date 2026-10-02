# Contract — Security Tester, Wave 0b (private by default)

Status: Issued
Date: 2026-10-02
Stream: Security Tester (owns the wave's gate; a single FAIL blocks)
Branch: `feat/private-by-default` (PR #86)
Handoff: `llm/sprints/2026-09-hub/handoffs/security-tester-wave-0b.md`

## Purpose

Run the subset of the run brief's §6 gate that Wave 0b can turn red, and say
plainly which checks are unchanged. A single FAIL blocks the merge and the next
wave.

## Checks to run (from §6, scoped to this wave)

1. **No private content on the public path.** Rebuild `dist-public` from the
   fixture tree and prove `cv/anthropic-fellow` leaves **no** trace: no path, no
   byte, no sitemap, no build-info, no page. Then prove the guard is live by
   planting a trace and showing the leak check fails (red → green).
2. **The allowlist guard.** Conflict (condition A) and stale (condition B) behave
   as specified; the committed allowlist parses; a malformed allowlist fails the
   build rather than defaulting.
3. **Effective visibility is the only authority.** No public page reads raw
   `item.visibility`; the `/projects/` and CV indexes consume effective
   visibility.
4. **Historical URLs.** `/cv/anthropic-fellow` and `/pdfs/anthropic-fellow.pdf`
   are not emitted by the public build; `firebase.json` 302s them to `/signin/`
   (assert the config; live check is the Lead Architect's post-merge step).
5. **Supply chain / config unchanged.** `firebase.json` gains no function, no SSR
   and no rewrite; no new secret; no new outbound origin. State "unchanged" where
   true.
6. **The private build still serves members.** Build `HUB_OUTPUT=private` and run
   `check:private-links`.

## Rules of engagement

- Read-only; your only write is your handoff. No git/cloud mutation.
- Every check: PASS or FAIL, with the command and a transcript. Where a §6 line
  is out of scope for this wave, say so explicitly rather than omitting it.

## Exit

Zero FAIL to pass. Paste the plan/results table and the red→green transcript.
