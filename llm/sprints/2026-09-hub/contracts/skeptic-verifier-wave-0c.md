# Contract — Skeptic Verifier, Wave 0c (branding)

Status: Issued
Date: 2026-10-02
Stream: Skeptic Verifier (adversary; authors no source, fixes nothing)
Branch: `feat/branding` (PR #91)
Handoff: `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0c.md`

## Purpose

A guard that cannot fail proves nothing. Break the Wave 0c guards, show red,
restore.

## Mandatory demonstrations

1. **A wrong band colour turns `tokens.test.ts` red** (the brief named this
   specifically). Change `--color-band` to a non-brand colour in a way the
   carve-out catches (or a band token that no longer resolves to the `--vt-*`
   ramp), run `npm test`, show the failing assertion, restore.
2. **A sub-AA pair turns `contrast.mjs` red**: lower `--vt-orange-text` (or the
   on-band colour) until a checked pair drops below 4.5:1, show
   `npm run contrast` fail, restore.
3. **`--tracker-petrol` removal is pinned**: show that re-introducing petrol into
   the verbatim palette (or removing a band token from the carve-out) fails the
   tests, restore.
4. **The portrait guard is live**: stage `photo_jason_1.jpeg` back into
   `dist-public` (or a stale copy into `public/`) and show the build/check that
   refuses it, restore.
5. **OG card no-portrait**: show the OG generation refuses/fails if handed the
   portrait, or that the emitted `og:image` is the card, restore.

## Rules

- You may edit files to plant a failure, but MUST restore exactly (`git status`
  clean except your handoff; tests green). Record the restore.
- Read-only otherwise; no git/cloud mutation.

## Exit

Every demonstration red→green with transcripts; name any guard that could not be
made to fail (*Fix now*).
