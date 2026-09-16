# Contract: Site Implementation Engineer — Phase 2

Status: Active
Last updated: 2026-09-16
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying
every element of `llm/governance/project-operating-system.md` §Agent Assignment
Contract. `<canon checkout>` is the path declared in
`llm/governance/governance-delta.md` §Canon Location.

```text
ROLE: You are the Site Implementation Engineer (Specialist 3) for sprint
  2026-09-hub, Phase 2 — Publishing contract (issue #16), working in
  djjay0131/website on branch feat/publishing-contract.

OBJECTIVE: The hub builds from content it synced out of the content bucket instead of
  from a cv GitHub release, notices a publish by polling rather than by being told,
  and serves every CV URL exactly as it does today — with no visible change to the
  live site.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/sprints/2026-09-hub/contracts/phase-2-seams.md — BINDING. SEAM-1, SEAM-4,
     SEAM-5, SEAM-6, SEAM-7 are yours.
  3. contract/manifest.schema.json — authored by the contract stream. You MIRROR it;
     you do not change it. If it is not present yet, STOP and report.
  4. llm/governance/adr/0008-manifest-data-format-hub-renders-cv.md — the whole ADR.
     Decisions 2, 3, 4 and 5 are yours to implement.
  5. llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md
     §Decision 1 and 7 — the poll, and why the scheduled run can authenticate.
  6. llm/specs/2026-09-10-research-hub-design.md §3, §4 (as amended), §5, §9, §11.
  7. llm/master-roadmap.md §phase-2-contract
  8. .github/workflows/build.yml — yours to change; note its SEAM comments from
     Phase 1 and keep the seam discipline.
  9. site/scripts/fetch-data.sh, site/scripts/sync-local-data.sh, site/src/lib/cv-data.ts
     and every page importing it — the code path you are repointing.
  10. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not
  invoke them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      site/**
      .github/workflows/build.yml
      .gitignore
      llm/sprints/2026-09-hub/handoffs/site-phase-2.md
  - Do not modify: contract/**, infra/**, docs/**, .github/workflows/ci.yml,
    firebase.json, CLAUDE.md, AGENTS.md, .claude/**, or anything in llm/ apart from
    your handoff. Do not touch the cv repository. If you find a defect in a file you
    don't own, REPORT it; never fix it.

DELIVERABLES:
  D1 site/src/content.config.ts — the Astro content collection mirroring
     contract/manifest.schema.json FIELD FOR FIELD (design doc §4; SEAM-1). Astro 6
     content layer: defineCollection with a loader; zod is available as `astro/zod`
     (Astro 6 uses zod v4). The same fixed sets, the same required/optional split,
     the same schema_version rule for `data` items. A manifest the JSON Schema
     rejects must also fail the build — demonstrate that with a test, not an
     assertion in prose.
  D2 A sync step that pulls gs://<bucket>/sources/** into site/src/content/sources/
     before the build. The hub's deploy identity holds unconditioned
     roles/storage.objectViewer on the bucket (the infra stream's D4), so the hub MAY
     list — unlike a satellite. Keep it a script under site/scripts/ so it is
     testable and has one home, following the fetch-data.sh precedent it replaces.
     The synced tree is gitignored (already added).
  D3 Data-item claiming (ADR-0008 decision 3). The hub renders exactly the
     (source, slug) data items it claims — in Phase 2, only ("cv", "cv-data").
     Any other `data` item FAILS THE BUILD, as does an unrecognised schema_version.
     Make the claimed set one obvious, reviewable declaration.
  D4 Repoint site/src/lib/cv-data.ts and the six pages importing it at the synced
     payload instead of site/data/. The RENDERED OUTPUT MUST NOT CHANGE. Do not
     restructure cv-data.ts, do not alter the resolver logic, and do not touch its
     tests beyond the path change. /cv/, /cv/<variant>, /resumes/, /projects/,
     /projects/<slug> and / must render as they do today, and /pdfs/<variant>.pdf
     must still resolve — decide where the synced PDFs land so that holds, and say
     why in the handoff.
  D5 .github/workflows/build.yml:
     - The `check` job fingerprints the BUCKET rather than the cv GitHub release. The
       fingerprint MUST change when an object is deleted, not only when one is added
       or modified — a withdrawn item that leaves the site looking unchanged is a
       defect. Say in a comment how deletions are covered.
     - It authenticates through WIF (google-github-actions/auth, pinned by SHA, v3 =
       7c6bc770dae815cd3e89ee6cdf493a5fab2cc093) and needs id-token: write. Scheduled
       runs carry ref refs/heads/main, so the existing binding admits them.
     - build-info.json gains content_fingerprint; keep the Phase 1 comparison shape.
     - REMOVE the repository_dispatch: [cv-updated] trigger.
     - DELETE site/scripts/fetch-data.sh and its call sites.
     - Keep everything else Phase 1 established: both host builds, the Pages deploy,
       budget-guard, deploy-tools, both smoke tests, the notification jobs,
       least-privilege per-job permissions, every action pinned by SHA.
     - The bucket name comes from vars.GCP_CONTENT_BUCKET. Gate the new work so that
       an unconfigured repository still builds, exactly as Phase 1 gated Firebase on
       vars.GCP_PROJECT_ID.
  D6 site/scripts/sync-local-data.sh updated, or replaced, so a developer can still
     run the site locally against a cv checkout with no cloud access at all. Local
     development must not require credentials. Say what you chose.
  D7 Tests: the collection schema accepts contract/examples/manifest.example.json and
     rejects every contract/examples/invalid/*.json (SEAM-1 — use the contract
     stream's fixtures, do not invent parallel ones); an unclaimed data item fails;
     an unknown schema_version fails; SMOKE_ROUTES still resolve.
  D8 Handoff at llm/sprints/2026-09-hub/handoffs/site-phase-2.md: Summary ·
     Assumptions · Recommendations · Alternatives considered · Risks · Open questions
     · Related docs · ADR candidates — and an explicit statement, route by route, of
     which URLs Phase 1 served and whether each still resolves.

VALIDATION — run and report results verbatim:
  - From site/: npm test; npm run build; npm run check:smoke-routes.
  - actionlint on .github/workflows/build.yml, and a YAML parse of it.
  - A diff or screenshot-equivalent argument that CV pages are unchanged: at minimum,
    build before and after your change and compare the generated HTML for
    /cv/academic and /resumes/, reporting any difference.
  - NEVER run a command that creates, changes or reads a cloud resource. There are no
    credentials and none may be created. The sync cannot be exercised against a real
    bucket; test it against a local fixture tree and say so.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md
  §Implementation Work, plus the roadmap Phase 2 acceptance criteria in your scope:
  the collection mirrors the schema; a manifest the schema rejects fails the build;
  every cv URL Phase 1 served still resolves.

CONSTRAINTS:
  - Sprint scope boundary: Phase 2 only. NO two-output build, NO HUB_OUTPUT env var,
    NO leak check, NO private bucket, NO gate rewrites, NO private items — all Phase 3
    (roadmap "Not in this phase"; issue #10 K2 for why rewrites cannot land early).
  - Do not change the rendered CV. A visual or structural change to /cv/<variant> is
    out of scope even if it looks like an improvement; report it instead.
  - No new runtime dependency on the public path: the site stays static (§12.4).
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and
    report (§12.2).
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) What is the right poll interval now that the poll authenticates and lists a
      bucket? Phase 1 polls hourly. Recommend, with the cost arithmetic.
  (b) Should a sync that finds NO manifest for a previously published source fail the
      build, or publish an empty section? Say which is safer and why.

ADR CANDIDATES TO IDENTIFY: the poll interval; how withdrawal of a published item is
  meant to behave end to end.

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead
  Architect commits.

FINAL REPORT: files delivered; validation results verbatim; the route-by-route URL
  parity statement; each acceptance criterion met or not; decisions taken within your
  scope; seam issues found; open questions.
```
