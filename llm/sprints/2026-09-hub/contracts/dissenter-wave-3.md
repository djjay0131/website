# Contract — Dissenter, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Dissenter (read + write to `llm/sprints/2026-09-hub/handoffs/dissenter-wave-3.md` only)
Issue: `hub-004`
Branch: `feat/sharing`

## Purpose

Argue that Wave 3 is wrong, incomplete or risky — not that it is buggy. ≥3
objections, each with the evidence that would settle it. Do not fix anything.

## Angles worth testing (not a checklist; find your own if better)

- Does the share model actually satisfy design doc §6 responsibility 4? A token
  names one item; is that the right unit, or should it name a section, a source,
  or a time-boxed set?
- The item prefix is `<section>/<source>/<slug>`; the gate cannot enumerate
  items, so `POST /share` mints for any well-formed triple. Is "mint blind, 404
  on serve" the right failure mode, or does it leak (timing, logs) that a share
  exists for a nonexistent item?
- `GET /share` returns no full token; the owner UI therefore cannot revoke a
  share unless it kept the token. Is a list that cannot revoke what it lists a
  half-feature? Name the evidence that settles it.
- The display id is a token prefix. Does that meaningfully narrow an attack?
- Every served sub-asset triggers the same checks; is the cost model (SEAM) sound
  at a shared page with many assets?
- Does the deny-all rule plus project-wide `datastore.user` adequately bound the
  gate's Firestore reach? What would a compromised gate image do?
- Is `private, no-store` on a share link actually right for a link meant to be
  handed out and re-opened?
- Anything the wave's records claim that the code does not support.

## Report

One row per objection: claim, evidence offered, and the experiment that would
settle it (with the expected result if the objection holds). Note what you
examined and dismissed.
