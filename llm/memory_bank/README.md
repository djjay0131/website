# Memory Bank

Status: Draft
Last updated: 2026-09-14
Owner: Chief Architect

## Purpose

The project's durable memory for humans and AI agents starting cold: where the
project stands, what it is, and what has been done. It ranks first in the
design authority hierarchy (agentic-governance
`llm/governance/architecture-governance.md` §Design Authority Hierarchy).

## Structure

| File | Holds |
|---|---|
| `activeContext.md` | Current focus, current stop point, next steps |
| `projectbrief.md` | What the project is and is not (points at the design doc) |
| `progress.md` | What works, what is left, known issues — against merged reality |

## Reading order

1. `activeContext.md` — always first; it says whether you may start work.
2. `projectbrief.md`
3. `progress.md`

## Update triggers

Update the memory bank whenever a merged PR changes project state: a phase
closes, a checkpoint is reached, a decision is recorded, or a known issue opens
or closes. Syncing it to already-merged work is administrative (L0); recording
new decisions here instead of in an ADR is not allowed.

## Assumptions

- These files are stubs seeded at adoption; a fuller memory-establish workflow
  can populate them later.

## Open Questions

- None.

## Cross-References

- `llm/governance/governance-delta.md` — declares this path
- `llm/sprints/2026-09-hub/STATE.md` — live orchestration state for the current sprint
