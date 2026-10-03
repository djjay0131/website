# Handoff — `gate`, Wave 3 follow-up: a share stores `(section, source, slug)`

Status: Delivered
Date: 2026-10-03
Stream: `gate` (`gate/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-3.md`
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md`
Predecessor: `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md`

## Summary

Lead Architect ruling 1 (gate-wave-3.md, 2026-10-03) is implemented: a share now
persists and serves **one item by `(section, source, slug)`**, and the served path
is confined to the item prefix `<section>/<source>/<slug>/`. This closes the
seam-level defect the first stream reported — the store kept `(source, slug)`
only, while the private build addresses an item at
`<section>/<source>/<slug>/` (`site/src/lib/frame-content.mjs: routeFor`,
e.g. `phd/phd-milestones/committee-dossier/`) and the gate holds
`storage.objects.get` only, so it cannot derive the section from the bucket.

`section` is validated with the same `safe_prefix` segment allowlist as `source`
and `slug`, and must be a single segment like `source`. It is **not** restricted
to a hardcoded enum: the gate does not own the hub's section set, and a mint for
a well-formed triple that does not exist still 404s at serve time.

## What changed

- **`gate/app/shares.py`.** `Share` gains `section`; `_share_from_document`
  reads and requires it (a document missing it is malformed → `None`, refused);
  `FirestoreShareStore.create` writes it; the module docstring is now the triple.
- **`gate/app/main.py`.** `mint_share` reads `section`, requires it be a string,
  and passes `_share_item_prefix(section, source, slug)`; the `Share(...)`
  construction includes `section`; `list_shares` returns `section`; the mint
  allow line is now `item=%s/%s/%s`; `serve_share` builds the prefix from the
  stored triple; `_share_item_prefix(section, source, slug)` returns
  `<section>/<source>/<slug>` and rejects a multi-segment `section`.
- **`gate/app/serve.py`.** `safe_prefix` docstring names `(section, source,
  slug)`. No behaviour change to `_checked_segments`.
- **`gate/tests/conftest.py`.** `PRIVATE_OBJECTS` share-layout keys move to the
  real triple layout (`phd/phd-milestones/committee-dossier/...`,
  `phd/phd-milestones/milestones/...`, `cv/cv/academic/...`) and add the two
  siblings a token must not reach: `projects/phd-milestones/internal-notes/...`
  (same source, different section) and
  `phd/phd-milestones/committee-dossier-evil/...` (slug extended by a string
  prefix). The `/p/**` object names are unchanged.
- **`gate/tests/test_shares.py`.** All share cases now use the triple:
  `OWNER_ITEM = ("phd", "phd-milestones", "committee-dossier")`,
  `OTHER_ITEM = ("cv", "cv", "academic")`; mint bodies include `section`; the
  served prefix is section-qualified. New coverage: missing `section` key is
  400; empty / multi-segment / illegal section (`a/b`, `..`, `%2e%2e`,
  `/absolute`, `None`, non-string) is 400; a corrupt stored section (`a/b`) is
  refused at serve; a token cannot reach a sibling section or a prefix-extended
  slug (bucket never touched); `safe_object_path` refuses the raw overlap; the
  list returns `section`.
- **`gate/README.md`.** Route table and Sharing section now say
  `{section, source, slug, expires_in_days}` and `<section>/<source>/<slug>/`.

No `site/**`, `firebase.json`, `infra/**`, `.github/**` or `llm/**` other than
this handoff was touched. The other files shown by `git status` on
`feat/sharing` (`firebase.json`, `infra/*`, `site/*`, one `llm/**` contract)
were already modified on the branch before this stream started and were not
edited here.

## Test transcript

```
$ cd gate && .venv/bin/pytest
419 passed in 2.90s

$ .venv/bin/pytest tests/test_shares.py --collect-only -q
129 tests collected            # was 106 before this change

$ .venv/bin/ruff check .
All checks passed!

$ .venv/bin/ruff format --check .
20 files already formatted
```

The suite runs entirely against in-memory doubles (`StaticShareStore`,
`StaticMemberDirectory`, `FakeStore`, `FakeVerifier`); no Firestore and no
credentials.

## Assumptions

1. The section values are taken from the committed manifests, not invented:
   `phd-milestones` items are `section: phd` (milestones, committee-dossier) and
   `section: projects` (internal-notes); `cv` items are `section: cv`. Hence the
   canonical triple `("phd", "phd-milestones", "committee-dossier")` and the
   sibling `projects/phd-milestones/internal-notes/...`.
2. `section` is single-segment, matching `source`; `slug` may be multi-segment.
   This is ruling 1's "single segment for `section` and `source`".
3. The `shares` fixture in `conftest.py` is an empty `StaticShareStore`, so no
   fixture share needed a `section`; every `Share(...)` construction in the
   repository (the `_seed` test helper and `mint_share`) carries it, and the
   Firestore create/read path carries it.

## Risks

- **`section` is not enumerated.** Deliberate per ruling 1, but it means a mint
  can name any well-formed section. Serving still 404s for an object that does
  not exist, and the prefix is fully qualified, so no cross-item reach; the
  residual is only that the platform keeps no allowlist of sections.
- **Live acceptance (SEAM-S7) still unproven here.** This stream makes the
  stored prefix match the real tree, but a live owner mint/open/revoke has not
  been exercised; that is the owner's step.
- **IAM unchanged.** The store already wrote before this change; SEAM-S5's write
  grant is the `infra` stream's (ruling 4). No cloud credential was created.
- The mint allow line's `item=` field is unconditional and now names the full
  triple (it named `source/slug` before). It is structural metadata rather than a
  served file path, and was already logged in two-thirds of the current form;
  flagged for completeness. No token is ever logged.

## Open questions

1. None blocking. The prior stream's six questions were answered by the Lead
   Architect's 2026-10-03 rulings; this change implements ruling 1. Rulings 2,
   3, 5 and 6 are recorded and unchanged here; ruling 4 is `infra`'s.
2. Should the mint allow/deny lines emit `item=%s/%s/%s` only when
   `GATE_LOG_OBJECT_PATHS` is set, to match `_log_path`'s discipline for private
   slugs? Left as-is (it was already logging `source/slug`); recorded.

## Related docs

- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (requirements and rulings)
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, amended)
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md` (predecessor)
- `site/src/lib/frame-content.mjs` (`routeFor`: `<section>/<source>/<slug>/`)
- `gate/app/shares.py`, `gate/app/main.py`, `gate/tests/test_shares.py`,
  `gate/tests/conftest.py`, `gate/README.md`
