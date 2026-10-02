# Contract — Chief Reviewer, Wave 0b (private by default)

Status: Issued
Date: 2026-10-02
Stream: Chief Reviewer (authors nothing in the wave it reviews)
Branch: `feat/private-by-default` (PR #86)
Handoff: `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0b.md`

## Purpose

Review PR #86 against the wave's contract, seams and ADR. Author nothing; your
only write is your handoff. Recommend Approve / Comment / Request changes.

## Read

- `llm/sprints/2026-09-hub/contracts/private-by-default-seams.md`
- `llm/sprints/2026-09-hub/contracts/site-wave-0b.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-0b.md`
- `llm/governance/adr/0016-private-by-default-publish-allowlist.md`
- `git diff main...feat/private-by-default`
- The adversarial handoffs for this wave (once present).

## Questions to answer

1. Does the implementation satisfy D8 and SEAM-B1…B9? Name any unmet seam.
2. Is effective visibility computed in exactly one place, and does any public
   consumer still read raw `item.visibility` for a public decision?
3. Is the leak check's widened private set correct, and is the short-source-name
   carve-out justified and bounded?
4. Is condition B's context-dependence implemented as SEAM-B5's amendment
   specifies, and is the evaluating job named?
5. Does the ADR accurately record the decision, and do design doc §4/§5 point at
   it? Does `docs/satellites.md` / `contract/README.md` tell a satellite the
   truth?
6. Are the `hub/*` entries a gap between the seam's wording and the code? Is that
   dispositioned, not hidden?
7. Any must-fix, should-fix or note. Grade governance level (expect L2).

## Exit

A recommend verdict with findings classified **Fix now / Fix later / Note**, each
citing a file:line or a test. No source edits.
