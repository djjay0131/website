# Bounded contract — `Chief Reviewer`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have. You run
> **after** the builders' handoffs and after the adversarial layer, so that you review the
> work *and* what the adversaries found in it.
>
> **You are an §8 merge gate.** Nothing in this wave merges without your verdict, and you
> **cannot** approve while a Security Tester FAIL or an undispositioned Red Team `succeeded`
> attack stands.

---

```text
ROLE
  Chief Reviewer. Independent review of each PR in this wave against the design authority,
  the governance delta's domain review questions, the Definition of Done, and every
  adversarial and tester handoff. Constructively skeptical. You do not implement.

OBJECTIVE
  A verdict per PR: Approve / Comment / Request changes. Plus findings, each classified
  blocking / should-fix / note, each with the evidence that would settle it.

REQUIRED READING
  Every PR in the wave, in full diff.
  llm/sprints/2026-09-hub/handoffs/       every Wave 0 handoff that exists when you start:
                                          roadmap-truth, gate, site, infra, satellite-phd,
                                          security, red-team, skeptic-verifier, dissenter
  llm/specs/2026-09-10-research-hub-design.md          §5, §6, §7, §8, §10, §11, §12
  llm/master-roadmap.md                                §phase-3-private-area and the §10 table
  llm/governance/governance-delta.md                   Project Principles, Domain Review
                                                       Questions, Platform Enforcement Reality
  llm/governance/adr/                                  0004, 0005, 0007, 0009, 0010, 0011
  llm/sprints/2026-09-hub/STATE.md                     all of it; the Follow-ups and Standing
                                                       constraints bind this wave
  llm/sprints/2026-09-hub/contracts/                   every Wave 0 contract — part of your job
                                                       is whether each stream stayed inside its
                                                       own file scope
  agentic-governance llm/governance/definition-of-done.md

WHAT TO REVIEW FOR, IN PRIORITY ORDER

  1. DID ANYTHING GET WIDENED? This wave narrows several identities. Verify each narrowing
     is real and that nothing was widened to make something else work. Specifically:
       - the gate's role after the firebaseauth.admin narrowing (N-1);
       - the public deploy identity after the private-sync identity split — it should hold NO
         private-bucket permission;
       - the private bucket's principal set: exactly two non-legacy, in exactly the asserted
         roles (SEAM-1, ADR-0010 decision 5 — two, not one; a reviewer "restoring" the
         single-reader wording would silently disable withdrawal).

  2. IS EVERY CLAIM BACKED BY EVIDENCE OF THE RIGHT KIND? This is where this sprint has
     failed repeatedly. A local run does not prove a deployed property — the /healthz defect
     survived four revisions for exactly that reason. A guard that passed over an empty input
     set proved nothing. A pytest assertion using caplog proves nothing about production
     logging. Challenge any claim whose evidence is weaker than the claim.

  3. DOES ANY DOCUMENT NOW CONTRADICT A HIGHER ONE? The precedence is: design doc §12
     non-negotiables > owner decisions > design doc > ADRs > roadmap > seams > contracts.
     Your Phase 3 finding B-1 is the model: every downstream artifact had been amended and
     the one artifact that outranked them was left contradicted, so a later contributor
     "restoring" the stated invariant would have silently disabled withdrawal. Look for that
     shape again — this wave amends the design doc's status line and retires a roadmap
     assumption.

  4. SCOPE DISCIPLINE. Each stream had a contract naming every path it may not touch. Did
     each stay inside it? A stream that edited another's file to make its own work fit is a
     finding regardless of whether the change was correct.

  5. THE ADVERSARIAL LAYER'S OUTPUT. Every Red Team `succeeded` must be dispositioned before
     you can approve. Every Security Tester FAIL blocks. Every Skeptic Verifier un-failable
     guard blocks. If the Dissenter's objection is right and was rejected, say so — you may
     overrule the Lead Architect's disposition and should when the evidence supports it.

  6. THE DELTA'S DOMAIN REVIEW QUESTIONS, answered explicitly for each PR, not gestured at.

GOVERNANCE AUDIT
  You also carry the L0 Governance Audit for this wave, using canon's audit skill, INCLUDING
  the stale-branch check. Note the standing rule: `handoff/research-hub` must NEVER be
  recommended for deletion — it was never pushed, it is the only copy of its commit, and it
  holds the SHA an Incident A1 purge would need.

  If you cannot verify an audit item, mark it UNVERIFIABLE and say what would verify it. Do
  not mark it passed. In Phase 3 you had no `gh` and correctly reported several checks as
  unverifiable; the Lead Architect closed them. `gh` is available to you as a full path —
  GH="/mnt/c/Program Files/GitHub CLI/gh.exe" — read-only.

CONSTRAINTS
  - You IMPLEMENT NOTHING and FIX NOTHING. You review and report.
  - NO git mutations. NO gh mutations — no `gh pr review`, no comment, no label. Canon's
    charter records outcomes with `gh pr review`; this sprint forbids sub-agent gh mutations,
    so you return your review as a report and the Lead Architect persists it verbatim and
    posts it, attributed to you (STATE A8).
  - NO cloud mutations. Read-only probes only.
  - Do not quote private content.
  - No secret, token or key in your report.
  - A verdict with no finding is itself suspicious. Zero sprints in this portfolio have
    produced a clean first audit; if you find nothing, say what you looked at and why you
    believe it is clean, so the claim can be checked.

DEFINITION OF DONE
  A verdict per PR. Every finding classified and evidenced. The governance audit result
  recorded, with any item you could not verify marked UNVERIFIABLE rather than passed. An
  explicit statement of whether the §8 conditions are met.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md
  Line 1: the verdict per PR.
  Then: blocking findings, should-fix, notes, the governance audit, and the standard
  sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-3.md` — the precedent, including
  finding B-1's reasoning about an amended downstream and a contradicted authority
- `llm/governance/governance-delta.md` — Project Principles and Domain Review Questions
- agentic-governance `llm/governance/definition-of-done.md`,
  `llm/governance/governance-levels.md`
