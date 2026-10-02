# Contract — Red Team, Wave 0b (private by default)

Status: Issued
Date: 2026-10-02
Stream: Red Team (adversary; authors no source, fixes nothing)
Branch: `feat/private-by-default` (PR #86)
Handoff: `llm/sprints/2026-09-hub/handoffs/red-team-wave-0b.md`

## Purpose

Attack the Wave 0b allowlist. Owner decision D8 makes
`site/publish-allowlist.json` the sole authority on what is public; a bypass is a
private item on the public internet. Find one, or show the specific attack was
refused.

## Rules of engagement

- **Read-only against source.** Do not edit `site/**`, `contract/**`, `llm/**` or
  any workflow. Your only write is your handoff file.
- No git, `gh`, `gcloud`, `terraform` or `firebase` mutation. No network deploy.
- Run builds, tests and scripts locally; attach transcripts (command + output).
- ≥5 attacks, each with a verdict: **REFUSED** (with the refusing code/line) or
  **BYPASS** (with a reproduction).

## Target list (the brief's allowlist targets)

1. **Slug casing** — a manifest item with a slug differing only in case from an
   allowlisted one, or a path differing only in case.
2. **Unicode normalisation** — a confusable/NFC-vs-NFD slug, or a lookalike
   character in `source`/`slug`.
3. **Path-dot / traversal** — `../`, `./`, encoded dots, or extra path segments
   in `slug`/`path` aimed at reaching an allowlisted route or escaping a prefix.
4. **`(source, slug)` collision** — two sources (or two items) whose effective
   keys collide, or an allowlist entry satisfied by the wrong item.
5. **Manifest renaming an item onto a public slug** — a private item renamed to
   an allowlisted `(source, slug)`, or a satellite editing an existing slug so the
   allowlist silently publishes something else.
6. **The `cv-data` residue** — the fellowship variant's content reaching
   `dist-public` through the shared payload, any public page, sitemap or
   `build-info.json`.
7. **Historical URLs** — `/pdfs/anthropic-fellow.pdf`, `/cv/anthropic-fellow` and
   the GitHub Pages spellings must never be 200.

## Evidence required

- The build(s) you attacked (`HUB_OUTPUT`, command) and the exact tree.
- For each refusal: the code path that refused it.
- For each bypass: the artifact under `dist-public` and a byte-level snippet, or
  the HTTP response.
- Name anything you could not test and why.

## Exit

≥5 attacks with transcripts; every target above covered or explicitly named as
not-attempted with a reason. A BYPASS is a *Fix now* finding for the Lead
Architect; a REFUSED attack is recorded with its evidence.
