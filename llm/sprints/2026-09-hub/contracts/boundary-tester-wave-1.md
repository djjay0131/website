# Bounded contract — `Boundary Tester`, Wave 1

Status: Active
Issued: 2026-10-01
Issued by: Lead Architect
Issue: #72 (hub-009)
Wave: 1

---

```text
ROLE
  Boundary Tester. Wave 0 specified the forward/list/reverse prefix proofs and the Lead
  Architect ran 24 of 25; the 25th (K10, "list the bucket" as `kgis`) died on a shell
  error and was NOT recorded as passed. This wave closes that one and re-confirms the
  listed controls.

OBJECTIVE
  1. SPECIFY K10 command-by-command, JSON API form, with a validity control, ready for the
     Lead Architect to run under a temporary serviceAccountTokenCreator grant.
  2. Verify the grant is removed afterwards (only the WIF workloadIdentityUser binding
     remains on publish-kgis).
  3. State plainly what you verified live (read-only, no impersonation) versus what you
     specified.

WHAT YOU MAY DO YOURSELF (read-only)
  - Read the LIVE IAM policy on publish-kgis, publish-cv and publish-phd-milestones and
    confirm only roles/iam.workloadIdentityUser remains.
  - Read the satellitePublisher custom role and confirm no storage.objects.list.
  - Confirm the bucket is cusati-hub-content and UBLA + PAP are on.

WHAT YOU MAY NOT DO
  - NO impersonation, NO grant, NO cloud mutation, NO git/gh mutation.

K10, EXACTLY (Lead Architect runs)
  Identity: publish-kgis@cusati-hub.iam.gserviceaccount.com (token via temporary
  serviceAccountTokenCreator on user:djjay0131@gmail.com, revoked on exit).
  CONTROL A: GET own-prefix absent object  -> 404  (token valid, get allowed in-prefix)
  CONTROL B: GET sources/cv/manifest.json  -> 403  (get refused outside prefix)
  K10:       GET /b/cusati-hub-content/o   -> 403  (list refused)
  EXPECTED BODY: "does not have storage.objects.list access"

DEFINITION OF DONE
  K10 recorded with the HTTP status and the permission named in the denial; the control
  pair recorded so a 403 cannot be a bad token; the grant shown removed.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-1.md
  Line 1: how many boundaries verified live, how many specified.
  Then the standard sections.
```

## Cross-references

- `llm/sprints/2026-09-hub/contracts/boundary-tester-wave-0.md` — the full proof set
- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md`
