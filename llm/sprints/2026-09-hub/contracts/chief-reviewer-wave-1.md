# Bounded contract — `Chief Reviewer`, Wave 1

Status: Active · Issued: 2026-10-01 · Issued by: Lead Architect · Issue: #72 · Wave: 1

> **Independence.** You authored nothing in this wave. You do not fix findings.

```text
ROLE
  Chief Reviewer. Review the Wave 1 PR against the design authority and the run brief §7
  merge conditions. Findings classified Fix now / Fix later / Note, each with the evidence
  that settles it. Governance Level first, then the data/security/privacy answer.

INPUTS
  - The PR diff (feat/satellite-kgis vs main).
  - llm/plans/2026-10-01-completion-brief.md §6, §7.
  - llm/sprints/2026-09-hub/handoffs/site-wave-1.md
  - llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-1.md
  - llm/sprints/2026-09-hub/handoffs/security-tester-wave-1.md (if present)
  - llm/sprints/2026-09-hub/handoffs/red-team-wave-1.md (if present)
  - llm/governance/governance-delta.md; design doc llm/specs/2026-09-10-research-hub-design.md

THE QUESTIONS THAT MATTER
  1. Does the shared frame-content.mjs refactor preserve the one-way structural guarantee
     (private-structure.test.ts), and is `kgis` declared-not-required correct rather than
     convenient?
  2. Does /projects/ render UNTRUSTED manifest strings safely, and does the leak check
     actually cover a private item in the `projects` section?
  3. Is the prefix-root staging rule correct for a built site, and is its residual stated?
  4. Is the audit genuinely non-blocking, and is the baseline a written acceptance rather
     than a suppression file? Does #54 have a test that would catch its regression?
  5. §7 merge conditions: required checks green; Security Tester zero FAIL; Skeptic Verifier
     no un-failable guard; governance checks green; brief committed; the stateful-resource
     apply rule (the four live `kgis` resources are NOT destroyed — no Terraform plan this
     wave).
  6. Anything overstated in STATE or the handoffs, especially "verified" without evidence.

VERDICT
  Approve, Comment, or Request changes, with the §7 conditions itemised.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`, `0010`, `0011`
