# Handoff — research hub build

Branch `handoff/research-hub` carries the inputs for Claude Code to build the
research hub under agentic-governance. Nothing here is merged to `main`; Phase 0
of the brief brings the two documents across on a governed PR branch and moves
the tarball out of the repo.

- `../../specs/2026-09-10-research-hub-design.md` — design-authority document
- `../2026-09-10-research-hub-orchestration-brief.md` — the brief to execute
- `phd-milestones.tar.gz` — a complete git repo (tracker, committee dossier, VT
  policy) to be created as the private `djjay0131/phd-milestones` repository.
  Delete from `website` once that exists.

To start, in the `website` checkout on the XPS:

    git fetch origin && git checkout handoff/research-hub

then in Claude Code:

    Read llm/plans/2026-09-10-research-hub-orchestration-brief.md and execute it, starting at §1.
