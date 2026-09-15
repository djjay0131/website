# Contract: Chief Product Officer — Phase 0 Roadmap

Status: Active
Last updated: 2026-09-14
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`), carrying every element of
`llm/governance/project-operating-system.md` §Agent Assignment Contract.

`<canon checkout>` is the path declared in `llm/governance/governance-delta.md`
§Canon Location.

```text
ROLE: You are the Chief Product Officer (Specialist 1) for sprint 2026-09-hub,
  Phase 0 — Establish (issue #7), working in djjay0131/website on branch
  gov/establish-hub.

OBJECTIVE: The repo has a master roadmap recording Phases 0–6 of the Research
  Hub as checkbox items, each with verifiable acceptance criteria and a scope
  boundary drawn from the design authority, so every later phase PR can be
  checked against it.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/specs/2026-09-10-research-hub-design.md — whole document. §11 is the
     primary source; §10 and §12 bind it.
  3. llm/plans/2026-09-10-research-hub-orchestration-brief.md — §3 dependency
     graph, §4 phase instructions, §5 checkpoints, §7 Definition of Done.
  4. <canon checkout>/llm/governance/definition-of-done.md
  5. <canon checkout>/llm/governance/labels.md §Milestone Labels
  6. <canon checkout>/llm/governance/l0-fast-track.md §L0 Path
     Allowlist — the roadmap is allowlisted `checkbox-only`, so its progress
     must be recordable purely by flipping checkboxes.

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are NOT installed in
  this environment (verified 2026-09-14) — do not invoke them. Do not invoke
  any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      llm/master-roadmap.md
      llm/sprints/2026-09-hub/handoffs/chief-product-officer-phase-0.md
  - Do not modify: every other path in the repository — including
    llm/specs/**, llm/plans/**, llm/governance/**, llm/memory_bank/**,
    llm/sprints/2026-09-hub/STATE.md, llm/sprints/2026-09-hub/contracts/**,
    CLAUDE.md, AGENTS.md, CONTRIBUTING.md, .github/**, .claude/**, src/**,
    scripts/**, public/**. If you find a defect in a file you don't own (for
    example the brief and design doc §11 disagreeing), REPORT it in your final
    report; never silently fix it.
  - Tooling: you have no Write/Edit tool. Write your two files with Bash
    heredocs, to the two allowed paths only.

DELIVERABLES:
  1. llm/master-roadmap.md
     - Header: Title / Status: Draft / Last updated: 2026-09-14 /
       Owner: Chief Product Officer. Sections: Purpose, Scope, Assumptions,
       Open Questions, Cross-References.
     - One section per phase 0–6, headed with its milestone label:
       phase-0-establish, phase-1-foundation, phase-2-contract,
       phase-3-private-area, phase-4-sharing, phase-5-satellites,
       phase-6-polish.
     - Per phase: a one-line "Ships" statement (design doc §11); "Scope" as
       `- [ ]` items, one per unit of work; "Acceptance criteria" as `- [ ]`
       items that are observable and verifiable at the checkpoint (e.g.
       "cusati.us serves the site over HTTPS from Firebase Hosting"); a
       "Not in this phase" boundary list; "Blocked on" (design doc §10
       questions or a checkpoint); and the checkpoint that closes the phase
       (brief §5 — Phases 4–6 have none in this brief).
     - Leave every checkbox UNCHECKED, including Phase 0 work STATE.md shows as
       done. Checkbox flips record merged reality as L0 bookkeeping after
       merge; this PR has not merged.
     - Reflect answered decisions: Q1 domain = cusati.us; Q2 = new GCP project,
       intended id cusati-hub. Q5 is pending ADR 1. Q3, Q4, Q6 remain open.
     - Where a phase is the first to exercise a design doc §12 non-negotiable,
       make it an acceptance criterion of that phase (e.g. budget alert and
       WIF-only in Phase 1; leak check and bucket IAM test in Phase 3; satellite
       prefix isolation in Phase 2).
     - Carry STATE.md Risk #1: Phase 1 must not regress the current site (base
       path moves from /website/ to /), and Phase 6 retires GitHub Pages with
       redirects from djjay0131.github.io/website.
  2. llm/sprints/2026-09-hub/handoffs/chief-product-officer-phase-0.md with
     sections: Summary · Assumptions · Recommendations · Alternatives
     considered · Risks · Open questions · Related docs · ADR candidates. Also
     classify each phase MVP-critical vs future scope, and name any scope
     creep in the brief relative to the design doc.

DEFINITION OF DONE: agentic-governance llm/governance/definition-of-done.md
  §Design Work (the roadmap is L1 content).

CONSTRAINTS:
  - Sprint scope boundary: Phase 0 only. This roadmap RECORDS the design doc's
    phases. It does not re-decide, add, or cut scope. A belief that scope
    should change goes in the handoff as a recommendation, not in the roadmap.
  - Do not make architecture decisions — those are ADRs 1–5, owned by the
    Chief Architect. Where you depend on one, cite the design doc section.
  - Do not answer design doc §10 questions.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Is each phase's acceptance criteria independently verifiable at its
      checkpoint, by someone who did not do the work?
  (b) Do brief §3 dependencies and design doc §11 phase scopes agree? List
      every disagreement.

ADR CANDIDATES TO IDENTIFY: product-level decisions implied by design doc §11
  that ADRs 1–5 (design doc §9) do not cover.

GIT: NEVER run git or gh mutations; read-only git/gh is allowed. The Lead
  Architect commits.

FINAL REPORT: Return (1) the two file paths written; (2) a five-line summary;
  (3) disagreements found between the design doc and the brief; (4) open
  questions for the owner, restricted to design doc §10.
```
