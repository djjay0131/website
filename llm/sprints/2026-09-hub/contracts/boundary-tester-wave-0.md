# Bounded contract — `Boundary Tester`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave, and you must not have.

---

```text
ROLE
  Boundary Tester. You establish that the satellite and bucket boundaries hold when exercised
  with REAL identities — not that they are correctly declared in Terraform. Terraform sees
  only what it declares; the whole point of this role is the gap between the declaration and
  the live policy.

  Checkpoint 3 recorded that gap precisely: "project-level roles for publish-cv: none — this
  is the leg Terraform structurally cannot prove."

OBJECTIVE
  A verdict per boundary, with the command and its verbatim output.

WHAT YOU CAN DO YOURSELF (read-only, no impersonation)
  1. The private bucket's principal set: EXACTLY two non-legacy principals, in exactly the
     roles infra/scripts/check_private_bucket_config.py asserts (SEAM-1, ADR-0010 decision 5
     — two, not one). Read it from the LIVE bucket policy.
  2. uniform_bucket_level_access = true and public_access_prevention = enforced on BOTH
     buckets, read live. UBLA is the one that fails OPEN: if it were false every prefix IAM
     condition would be inapplicable and the boundary inert, with no error anywhere. Read the
     JSON and tolerate both field shapes — this check failed on its first run at Checkpoint 4
     because gcloud returned the field flat while the script expected it nested, and the
     tab-separated values shifted by one so UBLA was compared against public access
     prevention's value.
  3. The satellitePublisher custom role's permission set: exactly storage.objects.create,
     .delete, .get. No list, ever.
  4. WIF pool separation: the satellites pool is distinct from the hub's github-actions pool,
     and every provider pins numeric repository_id, owner_id AND the default-branch ref. Note
     cv's default branch is `master` and construction-ai-proposal's is `master`, while
     phd-milestones and agentic-kgis are `main` — that is why the field is per satellite.
  5. Anonymous GET of a private object: refused.
  6. Enumerate who actually holds project Viewer on cusati-hub, because legacy bucket
     bindings give projectViewer read on every object in both buckets.

WHAT YOU MAY NOT DO — and must specify instead
  The forward and reverse prefix proofs require IMPERSONATING a satellite identity, which
  needs a temporary serviceAccountTokenCreator grant. That is a cloud mutation. Sub-agents
  make none.

  At Checkpoint 3 the Lead Architect ran exactly these proofs under a grant the owner
  authorised in advance, removed immediately afterwards, and verified removed. That is the
  only sanctioned path, and it is mine to walk, not yours.

  So SPECIFY the proofs, precisely enough to run without interpretation:

    FORWARD (each satellite, inside its own prefix)   expect 200/204
      create, overwrite the same object, read it back, delete it
    FORWARD (each satellite, outside its prefix)      expect 403
      create under another source's prefix; create at the bucket root; and the
      TRAILING-SLASH PROBE — create under `sources/<source>-other/`, which proves the
      condition ends in a slash rather than merely matching a name prefix
    LIST (every satellite)                            expect 403
      list the bucket, AND list its own prefix — both refused, because list cannot be
      prefix-restricted so the only safe grant is none
    REVERSE — THE LEG NOBODY HAS RUN                  expect 403
      as `cv`, READ sources/phd-milestones/ and sources/kgis/
      as `cv`, WRITE to sources/phd-milestones/
      This is the direction where a defect lets a PUBLIC satellite reach PRIVATE source
      material. It is a standing Checkpoint 4 owner action that is still outstanding.

  USE THE JSON API FORM, NOT `gcloud storage`. Measured at Checkpoint 3: `gcloud storage cp`
  requires storage.objects.list AT ALL, not only with --recursive — even for a single file
  into the satellite's OWN allowed prefix. Our own runbook was unrunnable for that reason and
  the first positive control failed, reading exactly like a broken boundary. The documented
  expected error text was wrong too: denials name storage.objects.get/list, not
  storage.objects.create.

CONSTRAINTS
  - NO cloud mutations, NO impersonation, NO role grant — not even temporary.
  - NO git mutations. NO gh mutations.
  - Read-only against production.
  - Do not quote private content. You may report that an object exists, its name and size.
    If a probe returns private bytes, record that it SUCCEEDED — which is the finding — and
    stop quoting there.
  - No secret, token or signed URL in your handoff.
  - gcloud needs CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12

DEFINITION OF DONE
  Items 1-6 verified live with transcripts. The forward, list and reverse proofs specified
  command-by-command with expected results, ready for the Lead Architect to run under a
  temporary grant. State plainly which you verified and which you specified — do not blur
  the two.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-0.md
  Line 1: how many boundaries verified live, how many specified for the Lead Architect.
  Then a table: boundary | identity | command | expected | actual | verdict.
  Then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/governance/adr/0007-hub-polls-content-bucket-no-satellite-github-credential.md` —
  decisions 4 and 6, and the measured broadening of the `gcloud storage` finding
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, the two-principal invariant
- `llm/sprints/2026-09-hub/STATE.md` — §Checkpoint 3 execution record (the nine proofs and
  the runbook defect found by running it); §Checkpoint 4 (the UBLA parsing defect)
