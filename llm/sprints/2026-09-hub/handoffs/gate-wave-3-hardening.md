# Handoff — Gate Stream, Wave 3 test hardening

Agent: Gate stream
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-3.md` (findings only; no gate contract was written)
Seam: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1 (both 2026-10-03 amendments)
Repo: `/home/djjay/code/website` · branch `feat/sharing`
Issue: `hub-004`
Scope: `gate/**` and this handoff only. Nothing committed.

## Summary

The Skeptic Verifier (Wave 3) found two guards no test turned red for
(`_share_from_document`'s missing-`entry` refusal, the mint log's omission of
the item material), two "un-failable" tests whose names promised the member
frame / `_payload` were unreachable but only exercised traversal (W1/W2), and a
third that stayed green under its own mutation (W3, the corrupt stored section).
This change adds fail-able coverage for every one of them.

**Added 8 test cases (5 functions; three are transport-parameterised). Gate suite
now `455 passed` (was `447`). `ruff check .` clean; `ruff format --check .`
clean; `git diff` under `gate/app` clean after each mutation probe.**

| File | Change |
|---|---|
| `gate/tests/test_shares.py` | 5 new test functions (8 cases), 1 hardened test |
| `gate/tests/conftest.py` | one new item-local `_payload/<source>/...` fixture object |

## Tests added, and the mutation each catches

Every mutation below was applied in place, the named test run to red, then
`git checkout -- <file>` and `git diff --exit-code -- <file>` (clean).

### 1. `_share_from_document` missing-`entry` refusal (unit) — 2 cases

- `test_a_stored_document_missing_entry_is_refused_not_defaulted`
- `test_a_stored_document_with_every_field_builds_a_share`

Drives the production parser directly (import `_share_from_document`), bypassing
`StaticShareStore`, which stores whole `Share` objects and never enters it. The
first asserts `None` for `entry=None` and for the key absent; the second is the
contrast: all fields present returns a `Share` with `entry="dossier.html"`.

**Mutation (Skeptic break #3):** `data.get("entry")` →
`data.get("entry", "index.html")` **and** drop `entry` from the required tuple at
`app/shares.py:107`. Verified red:
`FAILED test_a_stored_document_missing_entry_is_refused_not_defaulted`.

### 2. Mint log carries no item material — 2 cases (`[hosting|direct]`)

- `test_the_mint_log_carries_no_item_material`

Mints with known `section/source/slug/entry`, captures at INFO with pytest
`caplog` (pytest 9 attaches to non-propagating loggers too, so the gate's
`propagate=False` logger is captured), then asserts every captured record is free
of `"phd"`, `"phd-milestones"`, `"committee-dossier"` and `"dossier.html"`, that
the short id `token[:12]` is present, and that the full token is not.

**Mutation (Skeptic break #12):** add `item=%s/%s/%s entry=%s` (and the args) to
the mint line at `app/main.py:562`. Verified red, both transports:
`FAILED test_the_mint_log_carries_no_item_material[hosting]` and `[direct]`.

### 3. Direct (non-traversal) frame and `_payload` unreachability — 4 cases

- `test_the_member_frame_is_not_served_by_a_direct_request[hosting|direct]`
- `test_a_direct_payload_request_is_confined_to_the_doc_namespace[hosting|direct]`

These replace the gap the old traversal-only tests left (Skeptic W1/W2/C3) by
making the requests the traversal tests never made:

- `GET /s/{token}/index.html` must fetch exactly
  `phd/phd-milestones/committee-dossier/_doc/index.html` and return its bytes,
  never the member frame at `.../index.html` (which exists in the store).
- `GET /s/{token}/_payload/phd-milestones/site/committee.html` must fetch
  `.../_doc/_payload/phd-milestones/site/committee.html` and 404, never the
  item-local payload sibling (added to `PRIVATE_OBJECTS`) which exists at the
  non-`_doc` name.

Both assert `store.fetches` exactly, which is the fail-able signal.

**Mutation (Skeptic break #2):** drop `/_doc` from
`_share_item_prefix` (`app/main.py:983`). Verified red, all four cases.

**Interpretation note.** The task text said to assert both requests are 404. The
frame request cannot be 404 under correct code: `entry` defaults to
`index.html`, so `/s/{token}/index.html` legitimately serves the staged
`_doc/index.html` at 200. The property under test is "the member frame is never
what is fetched/served", so the frame case asserts the fetched name and the
bytes; the mutation that serves the frame 200 (same status, different name and
body) still turns it red. The `_payload` case asserts 404 exactly as specified.

### 4. Hardened `test_a_corrupt_stored_section_is_refused` — existing test

Seeds a sentinel object at the *escaped* name
`a/b/phd-milestones/committee-dossier/_doc/index.html` that would serve 200, then
seeds the corrupt row `section="a/b"` and requests its root. Asserts the generic
404, the sentinel bytes are not served, and `store.fetches == []`.

**Mutation (Skeptic break #8, W3):** delete the
`if "/" in clean_section or "/" in clean_source: return None` check at
`app/main.py:981`. Verified red, both transports:
`FAILED test_a_corrupt_stored_section_is_refused[hosting]` and `[direct]`.

## Verification

```
cd gate && .venv/bin/pytest          # 455 passed
.venv/bin/ruff check .               # All checks passed!
.venv/bin/ruff format --check .      # 20 files already formatted
git diff --exit-code -- gate/app     # clean after every probe
```

The four mutations above were each applied, run, and reverted; the tree is clean
and no tracked file is modified other than the two test files named here. This
handoff is the only new untracked file from this stream (the Wave 3 reviewer
handoffs were already untracked).
