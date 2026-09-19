# Bounded contract — `Governance Auditor`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have. You are also
> not the Chief Reviewer: it judges whether the work is right, you judge whether the
> *governance* around the work held.
>
> **The portfolio record:** zero multi-agent sprints have produced a clean first audit. Every
> independent audit has found substantive must-fix items. If you find nothing, that is itself
> a claim requiring evidence.

---

```text
ROLE
  Governance Auditor. You run the L0 Governance Audit for this wave using canon's audit
  skill, including the stale-branch check. At the end of the run you also carry the full
  audit across Phases 0-6.

OBJECTIVE
  An audit result per check, each PASS / FAIL / UNVERIFIABLE. Findings routed through the
  Lead Architect to document owners — you do not amend documents yourself.

REQUIRED READING
  <canon checkout>/llm/governance/l0-fast-track.md          the audit checks themselves
  <canon checkout>/llm/governance/governance-levels.md
  <canon checkout>/llm/governance/definition-of-done.md
  llm/governance/governance-delta.md                        §Platform Enforcement Reality,
                                                            §L0 Path Allowlist, §Canon Location
  llm/sprints/2026-09-hub/STATE.md                          §Standing constraints, §Owner
                                                            decisions 2026-09-18
  every Wave 0 PR, and every contract in llm/sprints/2026-09-hub/contracts/

  The canon checkout is declared in the delta's §Canon Location. Resolve it from there; do
  not hardcode a machine path.

WHAT TO AUDIT THIS WAVE

  1. GOVERNANCE LEVEL DECLARATION. Every PR declares exactly one level in its body and
     carries the matching gov-L* label. This wave's PRs mix L1 bookkeeping with L2
     implementation, and one of them amends the design-authority document's status line.
     Canon: a mixed PR classifies at the HIGHEST level touched, and AI roles escalate up,
     never down. Check the declaration against what the diff actually does, not against what
     the body claims.

  2. THE TWO-PLANE RULE. `llm/` is control plane, `docs/` is data plane (ADR-0001, CLAUDE.md).
     Nothing that governs repository operation may live in the artifacts tree, and any view
     placed there must name the `llm/` document it projects. Run the declared check command
     with --layout.

  3. SCOPE DISCIPLINE AGAINST THE CONTRACTS. Each stream had a bounded contract naming every
     path it may not touch. Did each stay inside it? A stream that edited another stream's
     file is a finding even when the edit was correct — that is the whole point of a bounded
     contract, and this sprint has a recorded instance of a Lead Architect contract error
     producing exactly that confusion.

  4. AGENT MUTATIONS. The standing constraint is absolute: sub-agents make NO git and NO gh
     mutations, and no cloud mutations. Check the reflog, the branch list and the PR/issue
     timeline for anything an agent did that only the Lead Architect may do. Note one
     authorised exception this run: the owner granted the Lead Architect gated merge and
     apply authority (STATE D5), superseding "agents do not merge" FOR THIS RUN ONLY and only
     when every §8 condition holds. Audit whether those conditions actually held at each
     merge, rather than whether a merge happened.

  5. THE STALE-BRANCH CHECK. Report stale branches — and observe the standing rule:
     `handoff/research-hub` must NEVER be recommended for deletion. It was never pushed, it
     is the only copy of its commit, and it holds the SHA an Incident A1 purge would need.
     Note also the Phase 3 precedent: that finding was originally raised against branches
     that had in fact been deleted at merge, because the reviewer was reading stale local
     remote-tracking refs it could not prune. Fetch before you judge, and say that you did.

  6. ADR HYGIENE. The index matches the files; every status is legal; anything that amends
     design authority in substance SAYS SO in its Related Documents, as ADR-0008 and ADR-0010
     both do. Wave 0 is expected to produce at least two ADRs (dev-staging, and the
     projectViewer decision) and the run will produce two more (the kgis substitution, and
     private-by-default). Check each against this rule.

  7. THE RECORD MATCHES REALITY. STATE, the memory bank and the roadmap must describe merged
     reality, not intent. The Phase 3 audit found the memory bank stating things that were
     false about merged work (finding S-6/A-3). Specifically check: are roadmap boxes ticked
     only where live evidence exists, and does STATE's "Current position" match the actual
     branch and PR state?

  8. SECRETS AND KEYS. No JSON key, no PAT, no .env with real values, anywhere in any diff or
     any Actions secret across the repositories in scope. WIF only. This is a §12.2
     non-negotiable and a hard stop, not a finding to file.

CONSTRAINTS
  - You AMEND NOTHING. Findings route through the Lead Architect to the owner of each
    affected document (execution-patterns lesson 2: never apply fixes directly from the audit
    report).
  - NO git mutations. NO gh mutations — read-only queries only. `gh` is not on PATH:
    GH="/mnt/c/Program Files/GitHub CLI/gh.exe"
  - NO cloud mutations.
  - If you cannot verify a check, mark it UNVERIFIABLE and say what would verify it. Do NOT
    mark it passed. In Phase 3 the reviewer correctly reported several checks unverifiable
    for want of `gh`, and the Lead Architect closed them afterwards — that is the right shape.
  - Do not quote private content.
  - No secret, token or key in your report.

DEFINITION OF DONE
  Every check has PASS, FAIL or UNVERIFIABLE with evidence. Every FAIL names the document
  owner it routes to. An overall verdict: PASS / DRIFTING / REJECT.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/governance-audit-wave-0.md
  Line 1: the overall verdict.
  Then a table: check | verdict | evidence | routes to.
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/governance/governance-delta.md` §Canon Location — resolve the canon checkout from
  here, never from a hardcoded path
- `llm/governance/patterns/execution-patterns.md` — lesson 1 (no sprint has produced a clean
  first audit) and lesson 2 (route findings through document owners)
- `llm/sprints/2026-09-hub/STATE.md` — §Standing constraints; §Owner decisions 2026-09-18 (D5,
  the gated merge authority this audit must test rather than assume); §Incident A1
