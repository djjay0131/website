# Contract: Gate Implementation Engineer — Phase 3

Status: Active
Last updated: 2026-09-17
Owner: Chief Architect (Lead Architect)

Instance of the Universal Bounded-Contract Skeleton (agentic-governance
`llm/governance/patterns/prompt-patterns.md`, Pattern 2 Implementation), carrying every
element of `llm/governance/project-operating-system.md` §Agent Assignment Contract.
`<canon checkout>` is the path declared in `llm/governance/governance-delta.md` §Canon
Location.

```text
ROLE: You are the Gate Implementation Engineer (Specialist 1) for sprint 2026-09-hub,
  Phase 3 — Private area (issue #24), working in djjay0131/website on branch
  feat/private-area.

OBJECTIVE: A signed-in, allowlisted member can read the milestone tracker and the
  committee dossier through /p/**; everyone else — signed out, signed in but not
  allowlisted, or requesting the Cloud Run URL directly — gets no private content and no
  hint that it exists.

REQUIRED READING (before writing anything):
  1. llm/sprints/2026-09-hub/STATE.md
  2. llm/sprints/2026-09-hub/contracts/phase-3-seams.md — BINDING. SEAM-1, SEAM-2,
     SEAM-3, SEAM-6, SEAM-8, SEAM-9 are yours.
  3. llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md — the whole
     ADR. Its two constraints (the `__session` name, the `allUsers` invoker) are the two
     things most likely to make a correct-looking gate wrong.
  4. llm/governance/adr/0010-withdrawal-semantics.md — what "withdrawn" must mean for a
     private item.
  5. llm/specs/2026-09-10-research-hub-design.md §6 (responsibilities 1-3 only), §7, §12.
  6. llm/master-roadmap.md §phase-3-private-area — every acceptance criterion naming the
     gate is yours to satisfy.
  7. Issue #24 (`gh issue view 24`).
  8. <canon checkout>/llm/governance/definition-of-done.md §Implementation Work

REQUIRED SKILLS/WORKFLOWS: Superpowers and Constellize are not installed; do not invoke
  them. Do not invoke any /governance:* skill.

FILE CONTRACT:
  - You may create/edit ONLY:
      gate/**
      .github/workflows/gate.yml
      llm/sprints/2026-09-hub/handoffs/gate-phase-3.md
  - Do not modify: site/**, infra/**, contract/**, firebase.json,
    .github/workflows/build.yml or ci.yml, docs/**, CLAUDE.md, AGENTS.md, .claude/**, or
    anything in llm/ apart from your handoff. Do not touch the cv or phd-milestones
    repositories. If you find a defect in a file you don't own, REPORT it; never fix it.

DELIVERABLES:
  D1 gate/app/ — a FastAPI service small enough to read in one sitting (§6). Three
     responsibilities, and ONLY three:
       (1) POST /session — accept {"idToken": "<jwt>"}, verify it with the Firebase Admin
           SDK, mint a Firebase session cookie of 14 days, and set it.
           **The cookie MUST be named `__session`.** Firebase Hosting strips every other
           cookie on a Cloud Run rewrite (ADR-0004), so any other name produces a gate
           that passes every direct test and fails only through Hosting. HttpOnly, Secure,
           SameSite=Lax.
       (2) The allowlist — Firestore Native, collection `members/{email}`, document id the
           email **lowercased**. The gate lowercases the token's email before lookup;
           case-sensitive matching is a silent "not shared with you". A verified sign-in
           that is not a member gets the "not shared with you" page and no private content.
       (3) GET /p/{path:path} — verify the session, then stream the object from the private
           bucket. Correct Content-Type. **Every response carries
           `Cache-Control: private, no-store`**, and no response under /p/** may ever carry
           `public` or `s-maxage` (ADR-0004: Hosting's CDN caches a rewrite response only
           if the gate itself says it may).
     NOT in this phase: share mint, list, revoke, /s/** and /share/** — §6 responsibility 4
     is Phase 4 (roadmap "Not in this phase"). Do not build them, do not stub them.
  D2 Path-traversal rejection on /p/. The bucket's namespace is flat, so a crafted path is
     a literal object name; normalise and reject anything that escapes the private
     prefix, and test it with real inputs (`..`, encoded `..`, absolute, backslash, NUL).
  D3 gate/Dockerfile and gate/pyproject.toml. Python **3.12** (system Python here is 3.8;
     a uv-managed CPython 3.12.11 is available). Pin dependencies. The image must run as a
     non-root user.
  D4 gate/tests/ — pytest, covering at minimum: session mint and verify; an expired or
     malformed token; a verified non-member; path traversal on /p/; and an explicit
     assertion that no /p/** response carries `public` or `s-maxage` in Cache-Control.
     Every authorisation test must ALSO be expressed against the direct service URL case,
     because the invoker is `allUsers` (ADR-0004) — a check that only holds behind Hosting
     is not a check.
  D5 .github/workflows/gate.yml — build the image, push to Artifact Registry, deploy to
     Cloud Run. Authenticate through Workload Identity Federation only; no JSON key, no
     long-lived secret. Every action pinned by full commit SHA with a version comment.
     Run the pytest suite in CI. Gate the deploy on the same `vars.GCP_PROJECT_ID` pattern
     Phase 1 established, so an unconfigured repository still builds.
  D6 Handoff at llm/sprints/2026-09-hub/handoffs/gate-phase-3.md: Summary · Assumptions ·
     Recommendations · Alternatives considered · Risks · Open questions · Related docs ·
     ADR candidates — plus the exact IAM the gate's service account needs, stated as the
     minimum, for the infra stream to implement.

VALIDATION — run and report results verbatim:
  - pytest, with the count and any skips stated plainly.
  - A lint pass appropriate to the project (ruff if you add it; say what you chose).
  - actionlint on .github/workflows/gate.yml, and a YAML parse.
  - Build the Docker image locally if Docker is available (it is: 28.5.1) and report the
    result; do not push it anywhere.
  - NEVER run a command that creates, changes or reads a cloud resource. There are no
    credentials and none may be created. Firestore and the private bucket do not exist
    yet; test against fakes or emulators, and say which.

DEFINITION OF DONE: <canon checkout>/llm/governance/definition-of-done.md §Implementation
  Work, plus each roadmap Phase 3 acceptance criterion naming the gate, named in your
  handoff as met locally with evidence, or verifiable only at Checkpoint 4.

CONSTRAINTS:
  - Sprint scope boundary: Phase 3 only. No shares, no member-management interface, no
    search. The gate serves; it does not administer.
  - The cookie is named `__session`. If you believe another name is correct, STOP and
    report — do not rename it.
  - The invoker is `allUsers` and that is deliberate (ADR-0004). Do not attempt to solve
    authorisation with Cloud Run IAM; it must hold in the application.
  - WIF only. A JSON key, a key file or a secret credential of any kind => STOP and report
    (design doc §12.2).
  - The gate's service account reads the private bucket and Firestore and NOTHING else.
    State the minimum grant; do not assume a broad role.
  - No private slug, path or title may appear in any log line, error body or stack trace
    the gate returns to an unauthenticated caller.
  - Every tracked *.sh you add that begins with a shebang must be committed 100755. This
    machine's filesystem reports every file as 0777, so verify with `git ls-files -s`,
    never `ls -l`. CI enforces it and it broke Phase 2 once.
  - If a change would contradict an Accepted ADR, STOP and report.
  - Uncertain classification => semantic => human review.

OPEN QUESTIONS TO ANSWER:
  (a) Firebase session cookies require the Admin SDK and a service-account identity. State
      exactly what the gate needs at runtime on Cloud Run, and confirm it needs no key file.
  (b) What should an unauthenticated /p/** request return — 302 to the sign-in page, or 404?
      Recommend, and say what each leaks about the existence of the item.

ADR CANDIDATES TO IDENTIFY: the unauthenticated-response shape from (b); session lifetime
  and revocation; whether the gate should log member access at all, given the material.

GIT: NEVER run git or gh mutations; read-only git and gh are allowed. The Lead Architect
  commits.

FINAL REPORT: files delivered; validation output verbatim; each acceptance criterion met or
  deferred to Checkpoint 4; the minimum IAM the gate needs; decisions taken in your scope;
  seam defects found; open questions.
```
