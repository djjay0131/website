# Bounded contract — `Regression Tester`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have.
>
> **Your question is the narrowest in the wave and the easiest to skip:** did anything that
> worked yesterday stop working? Wave 0 narrows two IAM roles, moves a health route, splits a
> deploy identity and adds guards to a required check. Every one of those can break something
> nobody was looking at.

---

```text
ROLE
  Regression Tester. You verify that nothing which previously worked has stopped working.
  You are not looking for new defects in new work — the Red Team and the Security Tester have
  that. You are looking for collateral damage.

OBJECTIVE
  A pass/fail per item below, with the command and its verbatim output, re-run after EACH
  Wave 0 deploy. Record the serving revision and deployed SHA with every result: a probe whose
  target version is unknown is not evidence.

THE LIST

  1. PHASE 1-3 SMOKE ROUTES on https://jason.cusati.us, all 200:
       /  /resumes/  /cv/academic/  /cv/research-professional/  /papers/
       /pdfs/academic.pdf  /projects/
     plus every /research/** page, and /email/ and /privacy/.
     /cv/academic and /papers/ must return bodies of at least 500 bytes — a 200 with an empty
     body is the failure this byte check exists for.

  2. build-info.json still reports content_source: "bucket" and a built_from_sha that matches
     the merge you are probing. If content_source ever silently reverts to the release
     fallback, the publishing contract has stopped being exercised while the site still looks
     correct — which is precisely the state issue #19 produced.

  3. research.cusati.us still 301s to jason.cusati.us WITH PATHS PRESERVED. Test a path, not
     just the root: /cv/academic/ must land on /cv/academic/, not on /.

  4. The legacy Astro redirects (/research/soa-agentic-se/agentic-harnesses*) still forward to
     their targets, and the targets return 200.

  5. THE GATE'S LOG LINES STILL REACH CLOUD LOGGING after each deploy. Classes: boot, deny,
     client_signin_failed. This is newly meaningful: until 2026-09-18 the gate's logger had no
     handler at all and every one of its 21 call sites was discarded, for 48 hours across four
     revisions, while uvicorn's own access lines made it look like logging worked. A silent
     regression here re-creates that state and empties two log-based metrics with it.
       gcloud logging read 'resource.type="cloud_run_revision"
         AND resource.labels.service_name="hub-gate" AND textPayload:"event="' \
         --limit 20 --freshness=20m --format='value(timestamp,textPayload)' --project cusati-hub

  6. SIGN-IN STILL WORKS. This is the one that matters most this wave, because Wave 0 narrows
     roles/firebaseauth.admin and a wrong narrowing breaks sign-in for the only two members of
     the system.
     YOU CANNOT COMPLETE A SIGN-IN — you hold no member credential, and the allowlist matches
     the exact email in the token. What you CAN do, and must:
       - confirm /signin/ returns 200 and renders its configured state, not the "not
         configured yet" state;
       - confirm the Identity Platform config still has email enabled and jason.cusati.us in
         authorizedDomains;
       - confirm the gate's service account still holds a role granting
         firebaseauth.users.createSession;
       - trigger a sign-in failure deliberately and confirm it is CLASSIFIED and LOGGED.
     Report the end-to-end sign-in as NOT VERIFIABLE BY ME and name what would settle it. Do
     not infer that sign-in works because the page renders.

  7. The public site is byte-for-byte unaffected where it should be. Wave 0 changes no public
     content except the Projects page title. If anything else on the public surface changed,
     that is a finding.

  8. npm test, both builds, the gate pytest suite, and contract/'s node --test all still pass
     — run them, do not read a CI badge.

CONSTRAINTS
  - READ-ONLY against production. GET and HEAD only, except the deliberate sign-in failure in
    item 6, which must use an address that is NOT a member so it cannot mint a session.
  - NO git mutations. NO gh mutations. NO cloud mutations. No deploy, no workflow dispatch.
  - Do not quote private content.
  - No secret, token or signed URL in your handoff.
  - Python 3.12 for the gate suite:
    /home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
  - gcloud needs CLOUDSDK_PYTHON pointed at that same interpreter.
  - `gh` is not on PATH: GH="/mnt/c/Program Files/GitHub CLI/gh.exe"

DEFINITION OF DONE
  Every item has a verdict with a transcript, tied to a named serving revision and SHA.
  Anything that regressed names the change that most likely caused it.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/regression-wave-0.md
  Line 1: PASS or REGRESSIONS FOUND, with the count.
  Then a table: item | command | expected | actual | verdict | revision/SHA.
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/sprints/2026-09-hub/STATE.md` — §The gate's structured logging never worked in
  production; §Post-merge defect (issue #19, the silent fallback); §Sign-in: what works at
  Checkpoint 4
- `llm/master-roadmap.md` — §phase-1-foundation acceptance criteria, the source of the smoke
  routes and the 500-byte check
