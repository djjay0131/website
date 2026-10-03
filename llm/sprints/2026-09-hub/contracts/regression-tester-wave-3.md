# Contract — Regression Tester, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Regression Tester (read + write to `llm/sprints/2026-09-hub/handoffs/regression-tester-wave-3.md` only)
Issue: `hub-004`
Branch: `feat/sharing`

## Purpose

Prove Wave 3 breaks nothing that already worked. Read branch items via
`git diff main...HEAD`; do not check out other branches.

## Checks

- **Suites:** `site` vitest, `gate` pytest, `contract` tests — record counts
  against the branch baseline and against `main`.
- **Public routes:** every route in the public inventory still builds and, after
  deploy, returns 200. `/p/` signed-out still 404.
- **The rewrites:** `/p/**`, `/session`, `/session/end`, `/client-events` still
  reach the gate; no ordering regression from adding `/share/**` and `/s/**`.
- **The private build:** renders, `check:private-links` green, delete list
  unchanged; no new public trace.
- **Wave 0b/0c boundaries:** allowlist, effective visibility, leak check, OG card,
  band/footer chrome unchanged in behaviour.
- **Terraform:** no unrelated resource changed.

## Report

Table: area, before, after, verdict. Record every failure you found and whether
it is a Wave 3 regression or pre-existing. Correct your own false starts rather
than reporting them as passes.
