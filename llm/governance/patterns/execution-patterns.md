# Execution Patterns: Evidence-Backed Lessons — website (Research Hub)

Status: Draft
Last updated: 2026-09-14
Owner: Chief Architect

## Purpose

The durable execution lessons from this repo's agent sprints, each tied to
the evidence that earned it. Lessons here are rules of thumb for planning
the NEXT sprint; one-time anecdotes are deliberately excluded (see
"Excluded as Anecdote"). Prompt-level machinery for applying these lessons
lives in agentic-governance `llm/governance/patterns/prompt-patterns.md`.

## Scope

How to structure and run agent work in this repository: team shape, work
ordering, audit/reconciliation mechanics, interruption handling. Not
governance policy (cited, not restated) and not product/architecture
content.

---

## Durable Lessons

### 1. An independent Governance Audit is mandatory for architecture-class work

An auditor who authored none of the deliverables, run before
reconciliation, is not overhead. Across the portfolio's multi-agent
sprints to date, **zero sprints have produced a clean first audit** —
every independent audit has caught substantive must-fix findings.

**Evidence (seed):** portfolio experience through 2026-07 (every
multi-agent sprint audit in the seed repo found must-fix findings).
**This repo:** no evidence yet — onboarded 2026-09-14 (issue #7).

### 2. Reconciliation routes findings to document OWNERS before applying

The Lead Architect dispositions findings by sending each to the owner of
the affected document for a proposed amendment (or a recorded rejection),
then applies — preserving single ownership of every doc set. Never apply
fixes directly from the audit report.

**Evidence (seed):** every disposition round in the seed repo applied
amendments through owners with zero silent fixes.
**This repo:** no evidence yet — onboarded 2026-09-14 (issue #7).

### 3. Implementation work should use fewer agents than broad research/architecture work

Architecture and research sprints fan out (4–6 specialists) because the
surface is wide and scopes are disjoint documents; implementation against
an approved blueprint is serialized by shared code, tests, and migrations —
default to a single agent or small team, escalating to ultracode only when
complexity (multi-domain, cross-repo, dependency-heavy) genuinely
justifies it.

**Evidence (seed):** seed-repo blueprint phases were scoped as single
coherent scaffolds — the shared-state shape parallel agents make riskier,
in contrast to the disjoint doc scopes that made design parallelism safe.
**This repo:** no evidence yet — onboarded 2026-09-14 (issue #7).

### 4. Infrastructure interruptions must not lose specialist output

Commit completed deliverables immediately (Lead Architect commits, per
scope, as soon as a specialist's work is done — not batched at sprint
end); resume interrupted work from transcripts rather than restarting
specialists.

**Evidence (seed):** a seed-repo sprint survived three infrastructure
stalls with no lost deliverables because completed work was committed
promptly and stalled threads resumed from transcripts.
**This repo:** no evidence yet — onboarded 2026-09-14 (issue #7).

---

## Anti-Patterns

- **Directory-level `git add` sweeping parallel agents' files.** With
  multiple specialists writing into shared trees, a broad `git add docs/`
  by the committing agent captures other specialists' in-progress or
  unreviewed files. Commits are per-scope and name files explicitly (Lead
  Architect only — see prompt-patterns [UBC] GIT rule).
- **Two docs each assuming the other specifies a seam.** Both documents
  pass review; the seam is specified nowhere. End-to-end scenario
  walkthroughs, not per-doc review, catch this class.
- **Copying policy across documents instead of linking to one source of
  truth.** Duplicated policy drifts; consolidate and cite.
- **Using ultracode as a governance bypass.** It is an execution
  mechanism; classification and review requirements are unchanged by team
  size (`llm/governance/project-operating-system.md` §Non-Negotiables, in
  agentic-governance).
- **Treating an uncertain change as administrative.** The default is the
  reverse: uncertain => semantic => human review
  (`llm/governance/governance-levels.md`).
- **Restarting stalled specialists from scratch.** Restarts lose decisions
  made mid-thread and re-spend budget; resume from transcripts (lesson 4).

---

## Excluded as Anecdote

Record one-time facts here so they are not re-litigated, but deliberately
do NOT promote them to lessons — they are facts, not planning rules.
Examples of what belongs here: platform trivia (issue/PR numbering),
specific vendor findings (owned by the relevant domain docs), codified
one-time exceptions.

- None yet.

## Assumptions

- PR-numbered evidence is as recorded in this repo's memory bank — the
  memory bank remains the authoritative history.
- Seeded lessons hold until this repo's own evidence confirms or contradicts
  them.

## Open Questions

- Whether the Phase 1–3 implementation streams (site, contract, gate, infra) stay disjoint enough to run in parallel, given lesson 3 (implementation favors fewer agents).

## Cross-References

- agentic-governance `llm/governance/patterns/prompt-patterns.md` — the prompt
  machinery for these lessons
- This repo's memory bank — evidence trail
- agentic-governance `llm/governance/project-operating-system.md`,
  `llm/governance/governance-levels.md`
