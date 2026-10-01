# Handoff — `Boundary Tester`, Wave 1

Agent: boundary-tester (contract) + Lead Architect (execution)
Contract: `llm/sprints/2026-09-hub/contracts/boundary-tester-wave-1.md`
Wave: 1 · Issue: #72

Line 1: **1 boundary verified live (K10, with controls), 0 specified-only.**

## Summary

K10 — "as `kgis`, list the bucket" — the 25th Wave 1 proof, which did not execute in the
2026-10-01 run (`line 33: $3: unbound variable`), is now executed and **passed**. The
kgis publish identity holds no `storage.objects.list`. The temporary
`roles/iam.serviceAccountTokenCreator` grant used to mint its token was removed on exit
and verified removed.

## Results

Identity: `publish-kgis@cusati-hub.iam.gserviceaccount.com`, token via temporary
`serviceAccountTokenCreator` on `user:djjay0131@gmail.com`. Storage JSON API only (object
permissions), never `gcloud storage`.

| Id | Action | Expected | HTTP |
|---|---|---|---|
| CTRL-A | GET own-prefix absent object (`sources/kgis/__k10_absent__`) | 404 (token valid) | **404** |
| CTRL-B | GET another source's object (`sources/cv/manifest.json`) | refused | **403** |
| **K10** | GET `/b/cusati-hub-content/o` (list the bucket) | refused | **403** |
| K10b | GET `/b/cusati-hub-content/o?prefix=sources/kgis/` (list own prefix) | refused | **403** |

Denial body (both list calls), verbatim:

```
publish-kgis@cusati-hub.iam.gserviceaccount.com does not have storage.objects.list
access to the Google Cloud Storage bucket. Permission 'storage.objects.list' denied
```

**The controls are what make the 403s a proof.** CTRL-A returning 404 shows the token was
valid and `storage.objects.get` works inside the prefix; CTRL-B returning 403 shows the
same permission is refused outside it. Without CTRL-A, a 403 on list could have been a bad
token — the failure mode that made the first Checkpoint 3 harness read like a boundary.

## Grant removed — verified

`gcloud iam service-accounts get-iam-policy publish-kgis@...` after the run returns exactly
one binding:

```json
{ "role": "roles/iam.workloadIdentityUser",
  "members": ["principalSet://iam.googleapis.com/projects/410552878319/locations/global/workloadIdentityPools/satellites/attribute.repository_id_ref/1295802912/refs/heads/main"] }
```

No token, no key and no signed URL is recorded here.

## Assumptions

- The Wave 0 contract's JSON-API method is used because `gcloud storage` needs
  `storage.objects.list` even for a single-file operation and refuses before attempting the
  write, so its failures are bucket refusals rather than prefix proofs.

## Recommendations

- Fold K10/K10b into the standing boundary-proof harness so the next satellite's run is one
  command, not a hand-assembled one. The `$3: unbound variable` class is exactly what a
  harness removes.

## Alternatives considered

- Trust K11 + C2 as covering `objects.list`. Rejected: covered is not the same as tested,
  and STATE already recorded that distinction.

## Risks

- None new. The property (no list on any satellite role) is now both declared and tested.

## Open questions

- None.

## Related docs

- `llm/sprints/2026-09-hub/STATE.md` §Wave 1 (#72) boundary proofs
- `agentic-kgis` `docs-site/manifest.json`

## ADR candidates

- None.
