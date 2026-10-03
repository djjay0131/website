# Contract — Skeptic Verifier, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Skeptic Verifier (read + write to `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-3.md`; temporary edits to a scratch copy only)
Issue: `hub-004`
Branch: `feat/sharing`

## Purpose

A guard that cannot fail proves nothing. For every **new** guard in Wave 3, break
it, show the specific test go red by name, restore, and show green. Report every
guard that reports success while proving nothing.

## Guards to break (at minimum)

- The section segment validation in `_share_item_prefix` (make it accept a
  multi-segment or illegal section; the test must fail).
- The prefix containment for `/s/**` (remove the prefix from the object name
  built by `safe_object_path`; the traversal/cross-prefix tests must fail).
- The `private, no-store` header on `/s/**` and `/share/**`.
- The owner check (`is_owner`) — make a non-owner pass; the 403 tests must fail.
- The site island's owner branch — make a 403 render controls; the unit test must
  fail.
- The `firebase.json` rewrite presence — remove `/share/**`; the assertion must
  fail.
- `check:no-private-in-public` still catching the Shares island/route if it were
  emitted publicly.

## Not in scope

Guards that existed before this branch and are unchanged: report only if you find
one un-failable, but the wave's conclusion concerns the new guards.

## Report

One row per guard: file:line, the break, the exact failing test name, restore
proof, and verdict (fail-able / un-failable / coverage gap). Use unique anchors —
assert the anchor occurs once before patching, because an ambiguous anchor
produces both a false pass and a false "un-failable". Record any coverage gap
(a thing no test would catch) separately from an un-failable guard.
