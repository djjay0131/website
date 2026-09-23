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

**This repo (2026-09-19, sprint 2026-09-hub Wave 0 — the seeded lesson now
has local evidence, and it is a confirmation).** Five implementation streams
ran in parallel against one repository. Scope discipline itself held —
zero cross-stream file edits across fourteen bounded contracts, and one
stream refused a contract instruction of mine that would have crossed into
another's tree. What did *not* hold was **atomicity**.

The refinement this repo adds to the seeded lesson: the risk is not the
number of agents, it is **splitting one change across two of them**. Three
instances in one sprint, all the same shape:

1. **SEAM-10** is atomic by its own specification — it states that two
   existing guards "will fail until they are updated in the same commit" —
   and was split *specify* / *implement* across two concurrent streams. The
   wave's highest-risk IAM item shipped as `WAITING — nothing implemented`.
2. **`PRIVATE_BUCKET` / `GATE_PRIVATE_BUCKET`** (Phase 3): two streams each
   green while disagreeing about a variable name nothing checked.
3. **`/session/end`** (Wave 0): the gate stream built the handler, the site
   stream owned the Hosting rewrite, and nobody owned the *caller* — so a
   route and a rewrite shipped with no UI invoking them. Sign-out that does
   not exist.

**Planning rule this yields:** before splitting work across streams, ask
whether the change is *atomic* — whether any one part of it is false or
inert without the others. If it is, one agent owns it end to end, however
wide the surface. A contract that hands a stream half of an atomic change
is a defect in the contract, not in the stream.

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

- **Breaking a guard on an ambiguous anchor, and trusting the green.** To
  prove a guard fires you must break the thing it protects — but if the
  string you patch occurs more than once, you may break something else
  entirely and read the resulting pass as proof the guard is sound, or the
  resulting *absence* of a failure as proof it is un-failable. **Both
  failure modes look exactly like diligence.**

  **Evidence (this repo, 2026-09-19, three separate agents in one sprint):**
  an infra stream's `sed` hit a *comment* at `storage.tf:15` while the real
  assignment at `:87` stayed `true`, so breaking UBLA left the guard green —
  and it was caught only by expecting red and getting green. A verifier then
  anchored on a string occurring twice in `main.py`, patched the mint path
  instead of sign-out, got `43 passed`, and was one step from reporting the
  gate's most important assertion un-failable. A later tester verified its
  edit had landed on the real line before trusting the result, and found the
  guard sound.

  **The rule:** assert the anchor is unique before you break on it —
  literally, `assert text.count(anchor) == 1` — and after breaking, confirm
  the *specific* test you expected to fail is the one that failed, by name.
  A guard proven by a break you did not verify is not proven.

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
