# Contract — Chief Reviewer, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`

## Mandate

Review the Wave 6 PR against the seams, the contracts and the design authority.
Author nothing. Verdict **Approve / Comment / Request changes**, with findings
severity-ranked (`must-fix` / should-fix / note). Verify claims independently
rather than accepting the handoffs.

## Review questions

- Do the implemented gate routes match AN-STORE/AN-ROUTES/AN-GUARD exactly, and
  is there any path by which a member reads or deletes another's notes?
- Is every annotation response `private, no-store`, and is the
  `X-Frame-Options` change confined to `_payload/**`?
- Is the capture island, My notes page, routing file and export renderer
  private-build-only, and does the leak check actually catch a planted
  annotation needle?
- Does ADR-0021 match what shipped? Is ADR-0022 correctly Proposed and is the
  credential genuinely absent?
- Scope: are all changed files within a contract's scope, with a verbatim clause
  for any contested file?
- Does the PR body carry the data/security/privacy section and the governance
  level?
- Are STATE, the roadmap and the memory bank updated in the same PR?

Report as `handoffs/chief-reviewer-wave-6.md` and, via the Lead Architect, on
the PR.
