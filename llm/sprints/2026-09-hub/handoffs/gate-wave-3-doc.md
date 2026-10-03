# Handoff — `gate`, Wave 3 follow-up: a share serves the `_doc/` namespace

Status: Delivered
Date: 2026-10-03
Stream: `gate` (`gate/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (requirement 5, ruling 1)
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, amended 2026-10-03)
Predecessors: `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md`,
`llm/sprints/2026-09-hub/handoffs/gate-wave-3-section.md`
Finding closed: Dissenter Wave 3 **D1** (BLOCK)

## Summary

Dissenter D1 is fixed. A share's served prefix is now
`<section>/<source>/<slug>/_doc` instead of `<section>/<source>/<slug>`, so a
token reaches the item's self-contained, item-scoped document namespace and
never the hub's **member frame**. The frame carries the members' navigation
(every private item's title and `/p/...` path) and absolute `/p/_payload/...`
and `/p/_astro/...` links, so serving it to a signed-out share holder was both a
privacy leak and functionally broken. The store is unchanged: it still keeps
`(section, source, slug)`, and only the mapping to the object namespace moves.
`_doc` is appended by the gate after the stored triple is validated, not accepted
as a new client field.

## What changed

All under `gate/**`; no `site/**`, `firebase.json`, `infra/**` or other `llm/**`
was touched.

- **`gate/app/main.py`.** `_share_item_prefix` now returns
  `f"{clean_section}/{clean_source}/{clean_slug}/_doc"` (`main.py:943`) and its
  docstring explains why (member frame vs. item bytes; SEAM-S1 amended
  2026-10-03). The module docstring's responsibility-4 line now says "that item's
  `_doc/` files". `serve_share` and `mint_share` are unchanged and inherit the new
  prefix from the one helper. The Lead Architect's in-tree mint log edit
  (`event=allow scope=share action=mint id=%s by=%s`, no item triple) is left
  exactly as it was.
- **`gate/tests/conftest.py`.** The share-layout `PRIVATE_OBJECTS` move under
  `_doc/`:
  `phd/phd-milestones/committee-dossier/_doc/{index.html,private.css}`,
  `phd/phd-milestones/milestones/_doc/{index.html,private.css}`,
  `cv/cv/academic/_doc/index.html`. Added the objects a token must never reach:
  the member frame `phd/phd-milestones/committee-dossier/index.html`, the item's
  `.../committee-dossier/_payload/hidden.html`, and the shared
  `_payload/phd-milestones/site/committee.html`. The sibling-item docs
  (`projects/phd-milestones/internal-notes`, `.../committee-dossier-evil`) now
  live under their own `_doc/`. The `/p/**` object names are unchanged.
- **`gate/tests/test_shares.py`.** Expectations updated to `_doc/`: empty path
  serves `_doc/index.html`; the `milestones` subpath serves
  `_doc/private.css`; the confined-path miss fetches
  `.../committee-dossier/_doc/assets/private.css`; the raw-traversal unit tests
  use the `_doc` prefix. New coverage (3 tests, each run on both transports):
  - `test_the_member_frame_is_unreachable_with_zero_bucket_fetches` — a traversal
    toward `<section>/<source>/<slug>/index.html` is 404 with `store.fetches == []`;
  - `test_the_payload_namespace_is_unreachable_with_zero_bucket_fetches` — the
    item-level `_payload/` sibling and the shared `_payload/<source>/...` tree are
    both 404 with zero bucket reads;
  - `test_a_token_cannot_reach_a_sibling_items_doc` — the `milestones` item's
    `_doc/` is unreachable from the `committee-dossier` token.
- **`gate/README.md`.** Route table `GET /s/{token}/{path}` and both Sharing
  paragraphs now name `<section>/<source>/<slug>/_doc/`, say the frame is never
  served, and note the frame and `_payload/**` are outside the token prefix.

Everything else is intentionally unchanged: owner 403s, 404 for
unknown/expired/revoked, `Cache-Control: private, no-store`, no `Set-Cookie` on
`/s/**`, traversal refusal, `expires_in_days` bounds, token entropy and the
token-less list all have their existing tests and still pass.

## Test transcript

```
$ cd gate && .venv/bin/pytest
425 passed in 3.10s

$ .venv/bin/pytest tests/test_shares.py --collect-only -q
tests/test_shares.py: 135          # was 129 before this change

$ .venv/bin/ruff check .
All checks passed!

$ .venv/bin/ruff format --check .
20 files already formatted
```

The suite runs entirely against in-memory doubles (`StaticShareStore`,
`StaticMemberDirectory`, `FakeStore`, `FakeVerifier`); no Firestore and no
credentials. `.venv` was current (Python 3.12.3), so it was not rebuilt.

## Assumptions

1. The amended SEAM-S1 and ruling 1 are the authority for the `_doc` suffix:
   `<section>/<source>/<slug>/_doc/`, at serve time only, with the store and the
   `POST /share` body unchanged.
2. The `site` stream stages the item-scoped `_doc/` tree (site-wave-3 contract
   addendum 8–11): the item's own document renamed to `index.html` plus its
   non-document assets, sibling-declared documents excluded. The gate fixtures
   model exactly that shape.
3. The only route to the member frame or to `_payload/**` from a token is `..`,
   which `safe_object_path` refuses before any bucket read. There is no legal
   path from `<...>/_doc` to a sibling of `_doc`.
4. `_doc` is appended by the gate as a literal; no `_doc` reserved-segment check
   is added here. That reservation (a source or slug may not be `_doc`) is the
   build's, per the site contract, and a token with such a triple would simply
   404 on serve.

## Risks

- **The `site` staging is not yet on this branch.** Until the build emits
  `<...>/_doc/`, a real token 404s on serve. That is the correct fail-closed
  behaviour for a prefix that has no objects, and it is the `site` stream's
  deliverable (site-wave-3 addendum). The gate tests prove the mapping; the
  end-to-end proof is the owner's live mint/open/revoke (SEAM-S7).
- **The shared `_payload/<source>/...` tree is excluded by construction.** The
  `_doc` staging is meant to copy each item's own non-document assets; an item
  that legitimately relies on a source-wide shared asset staged only under
  `_payload/` would render without it. The site contract records this residual
  (C28/non-document assets); the gate cannot compensate without widening the
  prefix, which would reintroduce cross-item reach.
- **No live verification here.** As before, no cloud credential was created and
  no live share was minted. D1's settling test (signed-out open of
  `/s/{token}/` renders the document, with no `/p/` link in the body) needs the
  `site` build and the owner's live step.

## Open questions

1. None blocking. D1's gate-side fix is complete and unit-tested.
2. Confirm with the `site` stream that the staged entry is exactly
   `<...>/_doc/index.html` and that `_doc/` contains no sibling-declared
   document — the gate tests assume this shape, and SEAM-S7 is where a mismatch
   would surface. Recorded, not a gate change.

## Related docs

- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (requirement 5, ruling 1)
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, amended 2026-10-03)
- `llm/sprints/2026-09-hub/contracts/site-wave-3.md` (addendum: staging `_doc/`)
- `llm/sprints/2026-09-hub/handoffs/dissenter-wave-3.md` (D1)
- `gate/app/main.py`, `gate/tests/test_shares.py`, `gate/tests/conftest.py`,
  `gate/README.md`
