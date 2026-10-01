# Handoff — `infra` / `satellite-kg-research`, Wave 2

Agent: infra + satellite (executed by the Lead Architect in the OpenCode session)
Issue: #72 (hub-009) · Wave: 2 · `agentic-kg-research`, private satellite 4

## Summary

`agentic-kg-research` is provisioned, boundary-proven, and publishing into the hub's private
area. The hub syncs it into the private bucket with no trace in `dist-public`. The wave's
one live gap is owner-only: D12 (who is on the team) is still pending, so the Firestore
member seed has not run and no member has signed in to see the item.

## What was done

- **Infra** (`infra` PR #77, merged `d512b22`): one roster entry, read from the GitHub API
  (repository_id 1384242888, owner 5666389, branch main, private true).
- **Apply, honestly recorded as two steps.** The first plan (4 adds) partially succeeded: the
  SA, impersonation binding and prefix-conditioned bucket binding were created, then the WIF
  provider failed because `GitHub: djjay0131/agentic-kg-research` (its display name) is 38
  characters and the cap is 32. Fixed in `satellites.tf` (fall back to the source key for
  names that overflow; the three existing providers are untouched). Second plan 1 add, 0
  change, 0 destroy; applied; second plan No changes.
- **Boundary proof**, temporary impersonation removed and verified removed: forward
  200/200/200/204 in-prefix; refusals 403 (other source, trailing-slash sibling, bucket root,
  reading cv); list 403/403; **reverse legs** cv→private and kgis→private 403. Transcript in
  STATE §Wave 2.
- **Satellite** (`agentic-kg-research` #3): `manifest.json` (one private html item,
  `section: research`, `path: index.html`) and a Quarto publish workflow. The workflow's
  first CI run failed on a stale `quarto-actions/setup` ref (`v1` predates the `setup/`
  layout); pinned to `v2`. Merge to main published 61 objects to `sources/agentic-kg-research/`.
- **Hub** (PR #79): the main build's leak check **failed on a clean build** — FP-1. The
  `payload-path` needle was unqualified, so the private item's bare `index.html` matched the
  KGIS payload's own links (13 "leaks"). The needle is now source-qualified. After the fix
  the main build deployed: leak check PASS, private build 3 items / 139 files, link check
  PASS, **private-sync 139 uploaded / 0 deleted**.

## Validation (verbatim)

```
404  /research/agentic-kg-research/research-store/     (no public route)
404  /p/research/agentic-kg-research/research-store/   (signed-out gate)
  0  in /sitemap-0.xml and /research/
170  objects in gs://cusati-hub-private/
private-sync: 139 object(s) to upload, 0 to DELETE
```

## Assumptions

- D11 applies the satellites-run roster under the D9 pattern; the plan showed no
  destroy/replace of a stateful resource.
- The member-view criterion cannot be exercised without D12 (owner) and a sign-in (owner).

## Recommendations

1. When the owner names the D12 team, run the member seed and verify a signed-in member sees
   `/p/research/agentic-kg-research/research-store/` and that a signed-out request is 404.
2. Add `agentic-kg-research` to `EXPECTED_SOURCES` (required false, then true after the
   member view is verified) so a vanished private prefix is a fault.
3. FP-1 confirms the leak check needs a normalization pass; see the ADR candidate.

## Alternatives considered

- Rename the item's `path` to something distinctive to dodge the false positive — rejected:
  the satellite's `path` is its own, and the guard must handle a bare `index.html`.
- Drop the `payload-path` needle entirely — rejected: source-qualified, it still catches a
  payload copied with its home preserved.

## Risks

- The private item's member view is unverified; the bucket and the signed-out refusal are
  verified, and the private build/link check passed, so the risk is narrow.

## Open questions

- Who is on the D12 team, and the exact seed command the owner will run (recorded as
  `node infra/scripts/seed-members.mjs` pending the owner's names).

## Related docs

- `llm/sprints/2026-09-hub/STATE.md` §Wave 2
- `docs/satellites.md`
- ADR-0007, ADR-0010, ADR-0014

## ADR candidates

- A render-aware (normalized) leak check, replacing the byte grep.
