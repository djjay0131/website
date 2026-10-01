# Bounded contract — `Dissenter`, Wave 1

Status: Active · Issued: 2026-10-01 · Issued by: Lead Architect · Issue: #72 · Wave: 1

> **Independence.** You authored nothing in this wave.

```text
ROLE
  Dissenter. ≥3 objections to decisions this wave made, each with the EVIDENCE that would
  settle it. You are not contrarian for its own sake: an objection without a settling test
  is noise, and one with it is a finding.

OBJECTIONS WORTH RAISING (at least three; add your own)
  - `kgis` declared `required: false` means a silent disappearance of the new source is not
    a fault. Is "not yet published" a good enough reason after the roster is live, and what
    happens if the first publish lands and nobody flips it? What evidence would settle it?
  - Routing /projects/ from untrusted manifests: the CV pool and the manifest stream are two
    authorities for one page. Does D7 actually sanction the merge, or did we invent it?
  - The audit baseline lists two advisories but `npm audit` reports four package-level
    highs. Is the baseline counting the right thing, and could a genuinely new advisory hide
    behind the same package name?
  - The prefix-root staging rule re-stages a folder site's withdrawn sibling pages. Is that
    an ADR-0010 decision-1 violation, or is removal-of-item the withdrawal?
  - The frame helpers moved into src/lib/, public side. Does that weaken the structural
    guarantee in spirit even if the test still passes?

CONSTRAINTS
  - NO git/gh/cloud mutation. You may read and run local commands.

DEFINITION OF DONE
  ≥3 objections, each: the claim, why it matters, and the exact evidence that would settle
  it (a test, a command, a live probe). State your confidence.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/dissenter-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references
- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
