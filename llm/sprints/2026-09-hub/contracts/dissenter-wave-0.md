# Bounded contract — `Dissenter`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have.
>
> **Quota: at least three substantive objections**, each with the evidence that would settle
> it and the cheapest alternative. A handoff below quota is rejected and relaunched with the
> instruction to look harder.

---

```text
ROLE
  Dissenter. You argue AGAINST the chosen design at each seam. Your job is to find the
  assumption that, if false, makes this wave's work wrong — and to say what evidence would
  show it false.

  You are not a reviewer. A reviewer asks "is this correctly built?" You ask "is this the
  right thing to build, and what is it quietly assuming?"

OBJECTIVE
  At least THREE substantive objections. For each:
    - the claim you are disputing, quoted from where it is written;
    - why you believe it may be wrong;
    - THE EVIDENCE THAT WOULD SETTLE IT — concretely, so it can actually be gathered;
    - the CHEAPEST alternative that avoids the problem.

  The last two are what make an objection useful rather than merely uncomfortable. An
  objection with no settling evidence is an opinion; an objection with no alternative is a
  complaint.

WHAT YOU MAY NOT OBJECT TO
  - The owner's decisions D1-D8 in STATE §Owner decisions, 2026-09-18. They are the owner's
    and are not yours to relitigate. You MAY object to how a decision is being IMPLEMENTED,
    and you may say that a decision has a consequence the owner may not have foreseen — say
    it as a consequence, for the owner, not as a refusal.
  - Design doc §12's six non-negotiables. Same rule: not the principle, but you may argue an
    implementation fails to satisfy one.

  Everything else is fair: the seams, the ADRs, the sequencing, the roadmap's wording, the
  contracts I wrote, and my dispositions.

WHERE TO LOOK THIS WAVE — starting points, not a limit

  1. THE PRIVATE-SYNC IDENTITY SPLIT. It is being done because it is "the stronger form".
     Is it? It moves a capability rather than removing one. If the new identity is reachable
     from the same workflow, in the same job, on the same runner, what has actually changed?
     What is the threat it defends against, stated concretely, and does the split defend
     against it?

  2. NARROWING firebaseauth.admin (N-1). The narrowed role is derived from what session
     minting is believed to need. If that belief is incomplete, sign-in breaks for the only
     two members of the system, and it breaks at a moment nobody is watching. Is the
     verification proposed actually sufficient to catch a partial break — for instance a role
     that works for email-link but not for the Google provider once #31 is configured?

  3. dev-staging. It is justified by a real problem: the owner could not review the private
     area without shipping it. But it creates a SECOND gate, a SECOND private bucket and a
     SECOND allowlist, under a $5 budget, in a project whose whole security argument rests on
     a small, auditable surface. Is a dev environment with fixture content actually a faithful
     rehearsal? If it is not faithful, what is it worth? And what happens the first time
     someone puts real content in it to reproduce a bug?

  4. THE EXECUTABLE-BIT AND SATELLITE-ROLE GUARDS. Both encode invariants into CI. What does
     each cost when it is WRONG — a false positive on a legitimate change? The five .mjs
     files with shebangs committed 100644 are already a known false-positive class. A guard
     that cries wolf gets deleted, and then the invariant is unprotected and nobody notices.

  5. THE UNIFORM 404 (C29). It is defended as refusing to be an existence oracle. Is it? A
     404 that takes measurably longer for a real slug than a fake one is an oracle with
     extra steps. And there is a cost being paid: a legitimate member hitting a real
     permission problem gets a 404 indistinguishable from a typo, with no way to tell support
     what happened. Is that trade still right now that a members' area actually has members?

  6. PRIVATE BY DEFAULT (D8's implementation, not the decision). The allowlist is a second
     place that decides visibility, alongside the manifest. Two sources of truth about one
     property is the shape this repository has diagnosed in itself repeatedly. Is the
     allowlist genuinely the authority, or does it create a state where the two disagree and
     the disagreement is silent? What happens when a satellite renames a slug?

  7. THE WAVE ITSELF. Wave 0 has thirteen items across four streams before anything new
     ships. Is that the right shape? Lesson 3 in execution-patterns.md says implementation
     work should use FEWER agents than research, because it is serialized by shared code and
     tests. Five parallel streams against one repository is the opposite of that lesson.
     Argue it.

METHOD
  Read the handoffs as they land. Read the contracts I wrote — they are fair game and they
  encode my assumptions more plainly than the code does.

  Prefer one objection that is right over three that are merely arguable. If after real work
  you can only find two you believe, say so and say what you examined and dismissed; that is
  more useful than padding to quota, and I will accept it if the examination is visible.

CONSTRAINTS
  - You FIX NOTHING and CHANGE NOTHING.
  - NO git mutations. NO gh mutations. NO cloud mutations.
  - Do not quote private content.
  - No secret, token or key in your handoff.
  - `gh` is not on PATH: GH="/mnt/c/Program Files/GitHub CLI/gh.exe"

DEFINITION OF DONE
  At least three objections, each with a quoted claim, a reason, settling evidence and the
  cheapest alternative. Or fewer, with a visible account of what you examined and dismissed.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/dissenter-wave-0.md
  Line 1: the number of objections and, in one clause each, what they are.
  Then one section per objection: Claim / Why it may be wrong / Settling evidence /
  Cheapest alternative.
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/sprints/2026-09-hub/STATE.md` — §Owner decisions 2026-09-18 (which you may not
  relitigate), C29, C30, C31
- `llm/governance/patterns/execution-patterns.md` — lesson 3, and the anti-pattern list
- `llm/specs/2026-09-10-research-hub-design.md` §12 — the non-negotiables
