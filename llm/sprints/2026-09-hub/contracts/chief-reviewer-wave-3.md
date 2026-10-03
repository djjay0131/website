# Contract — Chief Reviewer, Wave 3 (Phase 4 sharing)

Status: Issued
Date: 2026-10-03
Owner: Lead Architect
Stream: Chief Reviewer (read + write to `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-3.md` only)
Issue: `hub-004`
Branch: `feat/sharing`
PR: opened by the Lead Architect after the round

## Purpose

Review the Wave 3 PR against governance and the design authority. Author nothing
in the wave you review. Verdict: Approve / Comment / Request changes, plus a
governance-level judgement.

## Must check

- **Scope:** every changed file inside a stream's declared scope; no undeclared
  path; no secret, key, state or machine path.
- **Design authority:** the share model matches design doc §6 responsibility 4
  and §11 Phase 4, as amended by SEAM-S1 (the token stores
  `(section, source, slug)`) and the gate contract's rulings.
- **The seam defect:** confirm the gate follow-up actually stores and uses
  `section`, not merely that the seam text changed.
- **Security gate:** the Security Tester has zero FAIL; the Red Team's BYPASSes
  are all dispositioned; the Skeptic Verifier reports no un-failable new guard.
- **Records:** STATE, handoffs, contracts, memory bank are consistent and the
  §8 conditions are stated.
- **The stale record** `contracts/security-tester-wave-0.md` naming the gate's
  old roles is corrected or explicitly superseded.
- **L3/L2:** state the level; escalate up only.

## Report

Verdict, governance level, then must-fix / should-fix / notes (with file:line and
evidence), and what you verified rather than accepted. Mark anything you cannot
verify UNVERIFIABLE, naming the evidence that would settle it.
