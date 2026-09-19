# Bounded contract — `gate`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

---

```text
ROLE
  Gate implementation specialist. You own the FastAPI service and its workflow. Two Wave 0
  items are yours, and both are security work rather than features.

OBJECTIVE
  1. Move the gate's health route off /healthz, which Google's frontend intercepts before it
     reaches the service, and repoint the gate.yml smoke test to the new path.
  2. Add sign-out: POST /session/end clears the __session cookie.

REQUIRED READING
  gate/app/main.py                                       all of it, especially the route table
                                                         and _configure_logging()
  gate/tests/                                            the whole suite, to match its idiom
  .github/workflows/gate.yml                             the smoke test you must repoint
  llm/sprints/2026-09-hub/STATE.md                       §Checkpoint 4 execution record (the
                                                         /healthz finding, with its evidence),
                                                         §The gate's structured logging never
                                                         worked in production, §Follow-ups
                                                         (SD-4), §Standing constraints
  llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md
  llm/sprints/2026-09-hub/contracts/phase-3-seams.md     SEAM-2 (the __session name), SEAM-9
  llm/specs/2026-09-10-research-hub-design.md            §6, §12

FILE CONTRACT
  You may create and modify, and nothing else:
      gate/**
      .github/workflows/gate.yml

  Do not modify, under any circumstance:
      site/**, infra/**, contract/**, firebase.json
      .github/workflows/build.yml     — infra owns it this wave
      .github/workflows/ci.yml        — infra owns it this wave
      llm/**, docs/**                 — Lead Architect only
      any other repository

  If your work requires a change outside that set — a Hosting rewrite for the new health
  path, for instance — STOP and report it. Do not edit another stream's file to make your
  own work fit. Phase 2 proved this discipline works: two streams reported seam defects that
  turned out to be errors in the Lead Architect's own seams, and both were amended rather
  than worked around.

ITEM 1 — THE HEALTH PATH

  What is known, with evidence, from Checkpoint 4:
    - gate.yml's smoke test fails with `hub-gate /healthz returned 404`.
    - The gate is healthy. Revision 00002 was Ready with 100% traffic on the real digest,
      and running that exact digest LOCALLY returns {"status":"ok"} on /healthz.
    - The 404 body is 1568 bytes of Google's error page (`<html lang=en>`, unquoted) while
      the gate's own 404 is ~426 bytes (`<html lang="en">`, quoted).
      CORRECTED 2026-09-18: that byte count is PATH-DEPENDENT and I propagated it as
      universal. The gate's 404 is ~426 bytes on `/p/` and **329 bytes** on `/healthz/`.
      Quoted-vs-unquoted `<html lang=...>` still separates the gate from Google's page, but
      the only reliable attribution is a matching container log line: a 404 with no log line
      never reached the service.
    - No /healthz request appears in the container log at all, while /session returns 405
      and /healthz/ returns 307 — both from the application.
    => Google's frontend takes the path for this service. The service is fine.

  Deliverable: move the route to a path the frontend does not claim — `/_gate/health` is the
  suggested name; if you find a reason to prefer another, say so. Update gate.yml's smoke
  test to match. Keep the response body and status identical.

  PROVE IT, do not assert it. A passing local test proves nothing here, because the defect is
  a property of Google's edge and not of the application — that is exactly why this survived
  four revisions. The acceptance evidence is a live request to the deployed revision through
  https://jason.cusati.us and, separately, to the *.run.app URL, plus the matching line in the
  container log. You cannot deploy; write the exact probe commands into your handoff and the
  Lead Architect runs them after merge.

ITEM 2 — SIGN-OUT (SD-4)

  There is currently no way to sign out. A 14-day HttpOnly session cookie with no in-band
  clear means a member on a shared machine cannot end their own session. This is a security
  defect today, and Phase 4 makes it worse by adding more session state.

  Deliverable: POST /session/end clears __session.

  Requirements, each of which is a test:
    - It clears the cookie by setting it empty with Max-Age=0 AND matching every attribute
      the mint path sets (Path, Secure, HttpOnly, SameSite). A Set-Cookie that differs in any
      attribute may not replace the original in some browsers, which is a silent failure.
    - It MUST be CSRF-safe. The mint path is a POST with SameSite=Lax; so is this. Add an
      explicit Origin check on the mutation and refuse a cross-origin POST. A sign-out CSRF
      is only a nuisance, but the same check is load-bearing for Phase 4's mint and revoke,
      and it should be written once, here, where the stakes are low.
    - It answers the same way whether or not a session existed — no existence oracle, exactly
      as C29 requires for /p/.
    - Cache-Control: private, no-store, like every other gate response.
    - It emits an `event=` line so it is visible in Cloud Logging. Follow the existing
      grammar in main.py; do not invent a second one.
    - It must hold on a direct *.run.app request, not only through Hosting (ADR-0004: the
      invoker is allUsers).

  The route needs a Hosting rewrite for /session/end. `firebase.json` is NOT yours. Report
  the exact rewrite entry required; the Lead Architect routes it.

CONSTRAINTS
  - Python 3.12. System python3 is 3.8 and will not run this suite. Use uv:
      /home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
  - Every tracked *.sh beginning with a shebang must be committed 100755. /mnt/c reports
    every file as 0777, so verify with `git ls-files -s`, NEVER `ls -l`. This broke CI once
    already, after a specialist had run the script locally and repeatedly.
  - NO git mutations, NO gh mutations, NO cloud mutations. You write files and report. The
    Lead Architect stages, commits, pushes and deploys.
  - `gh` is not on PATH. If you need it: GH="/mnt/c/Program Files/GitHub CLI/gh.exe".
    Everything you need should be in the repository; prefer reading the repo.
  - Do not quote private content anywhere in your handoff.
  - No secret, token or key in any file you write.

TESTING — and the standard this sprint now holds
  Your tests must fail when the thing they test is broken. Prove it: break each new guard
  deliberately, show it red, restore it, show it green, and put both transcripts in the
  handoff.

  This is not ceremony. Three guards in this sprint passed while proving nothing — a leak
  check with no private items published, a private-link check over a single page, and the
  entire logging layer, whose tests passed only because pytest's caplog attached the very
  handler production was missing. Each was found by asking "what would this look like if it
  were broken?", never by a suite going red.

  Specifically: do NOT use caplog to assert your new event= line. It masks exactly this
  class of defect. tests/test_logging_config.py shows the pattern that works — assert the
  property directly.

DEFINITION OF DONE
  Both items implemented, with tests that have been shown to fail and then pass. The full
  gate suite green under Python 3.12. The exact live-probe commands for the health path
  written down for the Lead Architect. The firebase.json rewrite entry for /session/end
  reported, not applied.

OPEN QUESTIONS
  Record anything you could not settle, with the evidence that would settle it. Do not guess
  and do not ask the owner.

ADR CANDIDATES
  Name any durable decision implied by your implementation but written down nowhere.

GIT
  None. You make no commits, no branches, no pushes.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/gate-wave-0.md
  ## Summary
  ## Assumptions
  ## Recommendations
  ## Alternatives considered
  ## Risks
  ## Open questions
  ## Related docs
  ## ADR candidates
  plus: a Validation section with verbatim command output, the break-it/restore-it
  transcripts, the live-probe commands, and the requested firebase.json entry.
```

## Cross-references

- `llm/sprints/2026-09-hub/STATE.md` §Checkpoint 4 execution record — the `/healthz`
  evidence; §Follow-ups — SD-4
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `__session`,
  `allUsers`, cache behaviour
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-2, SEAM-9
- agentic-governance `llm/governance/patterns/prompt-patterns.md` — Universal
  Bounded-Contract Skeleton
