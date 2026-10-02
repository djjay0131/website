# Contract — Skeptic Verifier, Wave 0b (private by default)

Status: Issued
Date: 2026-10-02
Stream: Skeptic Verifier (adversary; authors no source, fixes nothing)
Branch: `feat/private-by-default` (PR #86)
Handoff: `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0b.md`

## Purpose

A guard that cannot be made to fail proves nothing. Break the two new guards,
show red, restore, and record the transcript:

1. `site/scripts/check-no-private-in-public.mjs` — the widened, effective-
   visibility leak check.
2. `site/scripts/check-publish-allowlist.mjs` — conditions A and B.

## Mandatory demonstrations

1. **The `cv-data` residue (SEAM-B3, explicitly required).** Plant a distinctive
   marker string inside the fellowship variant (its YAML, its label, or content
   only it includes), run the public build, and show `check:no-private-in-public`
   **fails** naming the leak. Then restore and show green. A pass without this
   demonstration proves nothing.
2. **A wrong allowlist entry turns the guards red.** Remove an allowlisted CV
   item (e.g. `cv/academic`) and show (a) the leak check fails because the item
   now renders on public pages, or (b) the allowlist guard / build fails — the
   exact mechanism is yours to find and report.
3. **Condition A.** Add an allowlist entry for a manifest-private item and show
   `check-publish-allowlist` fails in **both** modes.
4. **Condition B.** Add a stale entry (source present, slug absent) and show it
   fails in `pr` mode and warns in `deploy` mode. Then show an entry for a wholly
   absent source does **not** fail in `pr` mode.
5. **A wrong band/needle cannot silently pass**: show a short source name (`cv`)
   is deliberately not a bare needle and that its qualified-id/route needles
   still catch a planted `cv/anthropic-fellow` trace.

## Rules of engagement

- **Leave the committed tree untouched.** You may edit files to plant a failure,
  but you MUST restore the tree exactly (`git diff` clean, tests green) before you
  finish. The handoff must record the restore command and its output.
- Your only committed write is your handoff file.
- No git, `gh`, `gcloud`, `terraform` or `firebase` mutation beyond reading.

## Exit

Every mandatory demonstration above with the exact command and its output
(red then green). Name any guard that could **not** be made to fail — that is a
*Fix now* finding. Restore verified.
