# Handoff — `gate`, Wave 3 follow-up 2: a share stores and serves its `entry`

Status: Delivered
Date: 2026-10-03
Stream: `gate` (`gate/**`)
Issue: `hub-004`
Branch: `feat/sharing`
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (requirements 1, 2, 3, 5; ruling 7)
Seams: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, amended again 2026-10-03)
Predecessor: `llm/sprints/2026-09-hub/handoffs/gate-wave-3-doc.md` (follow-up 1: the `_doc/` prefix)

## Summary

A share now carries the item's document name. `Share` gains `entry`, the item's
document filename **relative to `_doc/`** (the basename of the manifest's
`path`, e.g. `committee.html`, `anthropic-fellow.pdf`, possibly several
segments). `POST /share` accepts `entry`, defaulting to `index.html` when the
field is absent, and validates it with the same segment allowlist and prefix
containment a served path passes. `GET /share` returns it. `GET /s/{token}/`
(the empty path) now serves `_doc/<entry>` instead of a hardcoded
`index.html`, so a `pdf` item is returned as `application/pdf` rather than
`text/html` over PDF bytes (the bug this follow-up fixes). The served prefix is
unchanged: `_share_item_prefix` still returns
`<section>/<source>/<slug>/_doc`; `entry` is appended inside it.

## What changed

All under `gate/**`; no `site/**`, `firebase.json`, `infra/**` or other `llm/**`
was touched.

- **`gate/app/shares.py`.** `Share` gains `entry: str` after `slug`
  (`shares.py:64`). `_share_from_document` reads `entry` and requires it
  (`shares.py:103-116`): a Firestore document missing it is malformed and
  `get`/`list_active` return/omit it, because defaulting an absent `entry` to
  `index.html` would serve the wrong bytes for a `pdf`. `FirestoreShareStore.create`
  writes `entry` (`shares.py:154`). The module docstring's stored shape and the
  `get`-vs-default rationale are updated.
- **`gate/app/main.py`.** New `_share_entry(payload)` helper
  (`main.py:924-941`): returns the body's `entry`, defaulting to
  `serve.INDEX_DOCUMENT` (`index.html`) when absent, `None` when the value is
  not a plain relative object path. It reuses `safe_prefix`, so `entry` may be
  several segments but is refused if empty, absolute, contains `..`/`.`/`//`, an
  illegal character or a backslash/NUL. `mint_share` calls it and treats a
  `None` as a 400 (`main.py:533-543`), stores `entry=entry` (`main.py:550`), and
  logs it: the mint line is now
  `event=allow scope=share action=mint id=%s entry=%s by=%s` — the short id
  still names the row and the item triple is still never logged (D5). `list_shares`
  adds `"entry": share.entry` (`main.py:596`). `serve_share` resolves the empty
  path to the stored `entry` before the existing
  `safe_object_path(path, prefix)` call (`main.py:647-657`), so the entry is
  re-validated inside the prefix and a corrupt/traversal stored `entry` is a 404
  with no bucket read.
- **`gate/tests/conftest.py`.** Added two `PRIVATE_OBJECTS` under the
  committee-dossier `_doc/`: `anthropic-fellow.pdf` (PDF bytes) and
  `dossier.html` (a non-`index.html` document entry), so the pdf and empty-path
  tests have real objects to serve.
- **`gate/tests/test_shares.py`.** `_seed` takes `entry="index.html"` and passes
  it to `Share`; `_mint` still omits `entry` by default, so the existing suite
  exercises the default path. Four new tests (each on both transports):
  - `test_the_empty_path_serves_the_stored_entry_not_index_html` — a
    `dossier.html` entry is what `/s/{token}/` returns;
  - `test_a_pdf_entry_is_served_as_a_pdf` — an `anthropic-fellow.pdf` entry is
    served with `application/pdf` from the root and by its own name;
  - `test_entry_may_be_several_segments` — `site/index.html` mints and lists;
  - `test_entry_defaults_to_index_html_when_omitted` — omission lists/serves
    `index.html`.
    The mint-validation parametrize gains seven `entry` cases (`../secrets`,
    `/etc/passwd`, `""`, `None`, `a//b`, `a/b/../c`, `5`) that must be 400, and
    the list test now asserts `entry`.
- **`gate/README.md`.** Route table `POST /share` body/validation, `GET /share`
    row fields, and `GET /s/{token}/{path}` (empty path serves the stored
    `entry`); the Sharing section documents `entry`, its `_doc/`-relative
    meaning, the `index.html` default and the validation.

## Test transcript

```
$ cd gate && .venv/bin/pytest
447 passed, 2 warnings in 3.60s

$ .venv/bin/pytest tests/test_shares.py --collect-only -q
tests/test_shares.py: 157          # was 135 after follow-up 1 (+4 tests x2
                                   # transports, +7 bad-entry cases x2)

$ .venv/bin/ruff check .
All checks passed!

$ .venv/bin/ruff format --check .
20 files already formatted
```

The suite runs entirely against in-memory doubles (`StaticShareStore`,
`StaticMemberDirectory`, `FakeStore`, `FakeVerifier`); no Firestore and no
credentials. `.venv` was current (Python 3.12.3), so it was not rebuilt.

## Assumptions

1. `entry` is relative to the token's `_doc/` prefix, so validating it with
   `safe_prefix` (no appended index document, several segments allowed) is the
   whole containment check; `safe_object_path(path, prefix)` re-checks it at
   serve time.
2. Ruling 7's default is applied only when the `entry` key is **absent**. A key
   present with a bad value (including `null` and `""`) is a 400, not a silent
   default — otherwise a mistyped pdf entry would serve the wrong bytes, which
   is the defect being fixed.
3. The mint log may name `entry`: it is a document filename, not the item's
   private `(section, source, slug)` address, which is still never logged. If
   the Lead Architect wants no `entry` in the log either, dropping the field is
   a one-line change.
4. The empty-path substitution is scoped to the token root (`path == ""`), which
   is what `GET /s/{token}/` produces. A non-empty path ending in `/` (e.g.
   `/s/{token}/sub/`) still resolves as before, to `_doc/sub/index.html`. This
   preserves multi-page prefix-root items: the site stages a built site's whole
   subtree under `_doc/` (site-wave-3-d1), and replacing every trailing-slash
   request with the single stored entry would break navigation inside it. It
   also means no traversal spelling that merely ends in `/` can be answered with
   the entry instead of a 404.

## Risks

- **A stored legacy row without `entry` becomes unservable.** `_share_from_document`
  refuses it (malformed → 404), by design (seam: "a document missing it is
  malformed"). Any share minted by the earlier revision stops serving. The
  gate has not been live (SEAM-S7 owner acceptance is pending), so there is no
  such row in production; the owner's existing-dev shares would need re-minting
  if any exist.
- **The `site` staging must name the entry.** Until the private build stages
  `_doc/<entry>` (e.g. `_doc/anthropic-fellow.pdf`) rather than always
  `_doc/index.html`, a `pdf` token 404s; that is the correct fail-closed result
  and is the `site` stream's deliverable. The gate tests prove the mapping.
- **`entry` is logged in the mint line.** See assumption 3; reversible.

## Open questions

1. None blocking. Follow-up 2's gate-side shape is complete and unit-tested.
2. Confirm the reading in assumption 4 — only the token root maps to `entry`,
   not every trailing-slash path — against the `site` staging of prefix-root
   items. Recorded, not a gate change; the alternative is a multi-page
   regression, so the gate fails closed here deliberately.

## Related docs

- `llm/sprints/2026-09-hub/contracts/gate-wave-3.md` (requirements 1, 2, 3, 5; ruling 7)
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1, amended again 2026-10-03)
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3-doc.md` (follow-up 1)
- `llm/sprints/2026-09-hub/handoffs/site-wave-3-d1.md` (staging `_doc/`)
- `gate/app/shares.py`, `gate/app/main.py`, `gate/tests/test_shares.py`,
  `gate/tests/conftest.py`, `gate/README.md`
