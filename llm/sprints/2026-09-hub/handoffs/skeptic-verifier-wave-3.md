# Handoff — Skeptic Verifier, Wave 3 (Phase 4 sharing)

Agent: Skeptic Verifier (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/skeptic-verifier-wave-3.md`
Seam: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S1 (both 2026-10-03 amendments)
Repo: `/home/djjay/code/website` · branch `feat/sharing` · HEAD reviewed: `fcecfd8`
Issue: `hub-004`

## Summary

I broke every guard in the task list plus the four additional guards the contract
names, ran the test that claims to cover each one, captured the exact red test
name(s), and restored the file. Every anchor was asserted unique (`grep -c` = 1
or an exact two-line context) before patching, so no break landed on an
ambiguous occurrence. Each restoration was `git checkout -- <file>` followed by
`git diff --exit-code -- <file>`; the final full-tree `git diff --exit-code` is
clean and both suites are green (gate: 447 passed, `ruff check app` clean; site:
73 passed across the four touched test files).

**10 of 12 broken guards are fail-able. 2 are coverage gaps (no test turns red).
I also found 3 tests that stay green under the mutation they appear to guard
(un-failable tests), and one further coverage gap.**

| Count | Meaning |
|---|---|
| 10 | guards whose break produced a named red test |
| 2 | guards with **no test at all** (`_share_from_document`; mint log triple) |
| 3 | tests that stayed green under the mutation they nominate (weak tests) |
| +1 | additional coverage gap: direct item-local `_payload/` access |

The two most important findings are that the `_share_from_document`
corrupt-row defence is entirely untested (a `StaticShareStore` never parses a
document, so no committed test enters that function), and that the two tests
whose *names* promise the member frame and `_payload` are unreachable do **not**
fail when the `/_doc` suffix is removed — they only exercise traversal, and the
frame and item-local `_payload/` live *inside* the item directory once `_doc`
is gone.

## Guard results — one row per guard

Break column states the mutation. "Restore proof" is the command's output after
reverting; all were `git checkout -- <file>` then `git diff --exit-code -- <file>`.

| # | Guard (file:line) | Break applied | Exact failing test | Restore | Verdict |
|---|---|---|---|---|---|
| 1 | `_share_entry` entry validation `gate/app/main.py:934-940` | `return raw` (skip `safe_prefix`) | `test_mint_rejects_bad_input_with_400[hosting-overrides16]`, `[17]`, `[18]`, `[20]`, `[21]` and the same `[direct-…]` ids (entry `../secrets`, `/etc/passwd`, ``, `a//b`, `a/b/../c`) | clean | **fail-able** |
| 2 | `_share_item_prefix` `/_doc` suffix `gate/app/main.py:983` | drop `/_doc`: return `<section>/<source>/<slug>` | 16 red, incl. `test_the_minted_share_serves_its_item_without_a_session[hosting|direct]`, `test_a_share_directory_request_serves_the_entry_document[…]`, `test_a_pdf_entry_is_served_as_a_pdf[…]` | clean | **fail-able** (see weak-test W1/W2) |
| 3 | `_share_from_document` missing-`entry` refusal `gate/app/shares.py:103,107` | `entry = data.get("entry", "index.html")` and drop `entry` from the required-field tuple | **none** — full gate suite `447 passed` | clean | **coverage gap** |
| 4 | serve root uses stored `entry` `gate/app/main.py:653` | `path = INDEX_DOCUMENT` | `test_the_empty_path_serves_the_stored_entry_not_index_html[hosting|direct]`, `test_a_pdf_entry_is_served_as_a_pdf[hosting|direct]` | clean | **fail-able** |
| 5 | `docStagingPlanFor` sibling exclusion `site/src/lib/frame-content.mjs:297` | delete `if (declaredPages…has(relFromPrefix)) continue;` | `at the PREFIX ROOT keeps the site's undeclared pages but excludes a sibling item's` | clean | **fail-able** |
| 6 | bare `/share` rewrite `firebase.json:39-45` | remove the `{source:"/share"}` object | `keeps the existing four gate rewrites in order, with the sharing routes appended` | clean | **fail-able** |
| 7 | `sharesView` forbidden branch `site/src-private/lib/shares.mjs:191` | `canMint: true, canRevoke: true` on `forbidden` | `maps a forbidden read to a view with NO controls` | clean | **fail-able** |
| 8 | `_share_item_prefix` single-segment section/source `gate/app/main.py:981` | delete `if "/" in clean_section or "/" in clean_source: return None` | `test_mint_rejects_bad_input_with_400[hosting-overrides1]`, `[hosting-overrides9]`, `[direct-overrides1]`, `[direct-overrides9]` | clean | **fail-able** (see weak-test W3) |
| 9 | `/s/**` prefix containment `gate/app/main.py:656` | `safe_object_path(path)` (drop `prefix`) | 23 red incl. `test_a_share_cannot_reach_a_second_item[hosting|direct]`, `test_a_share_path_is_confined_to_the_token_prefix[…]` | clean | **fail-able** |
| 10 | `private, no-store` on `/s/**`+`/share/**` `gate/app/main.py:295` | `Cache-Control: public, max-age=3600` | `test_every_share_response_is_private_no_store[hosting|direct]` | clean | **fail-able** |
| 11 | owner check `_is_owner` `gate/app/main.py:951-955` | `return principal.email_verified` (non-owner passes) | `test_a_non_owner_member_cannot_mint[…]`, `…_cannot_list[…]`, `…_cannot_revoke[…]` (both transports) | clean | **fail-able** |
| 12 | mint log omits item triple `gate/app/main.py:562-566` | add `item=%s/%s/%s entry=%s` to the mint line | **none** — full gate suite `447 passed` | clean | **coverage gap** |

### Un-failable tests (stay green under their own mutation)

| # | Test | Mutated guard | Why it cannot fail |
|---|---|---|---|
| W1 | `test_the_member_frame_is_unreachable_with_zero_bucket_fetches` | #2 (`_doc` drop) | requests `…/%2e%2e%2findex.html` (traversal). It proves escape *out* of the item dir; after the break the frame is *inside* the prefix and is reached by the root request, which this test never makes. Still `passed`. |
| W2 | `test_the_payload_namespace_is_unreachable_with_zero_bucket_fetches` | #2 (`_doc` drop) | same shape: requests `…/%2e%2e%2f_payload%2fhidden.html`. After the break the item-local `_payload/` is directly reachable at `/s/{token}/_payload/hidden.html`; the test's traversal request is still refused. Still `passed`. |
| W3 | `test_a_corrupt_stored_section_is_refused` | #8 (single-segment check) | seeds `section="a/b"`, then only asserts `404`. With the check removed the prefix escapes to `a/b/…`, `store.fetch` misses, and the handler returns the same `404` for the wrong reason. Still `passed`. |

I reproduced W1/W2 with a temporary probe (since deleted): under the `_doc`-drop
break, the two committed tests reported `4 passed` while a direct
`GET /s/{token}/_payload/hidden.html` probe failed `2` — i.e. the payload sibling
*was* being served and the committed test could not see it.

## Coverage gaps (a thing no test would catch)

| # | Gap | Evidence |
|---|---|---|
| C1 | `_share_from_document`'s refusal of a row missing `entry`/`section`/`exp`… is never executed. `FirestoreShareStore` is not imported by any test, and `StaticShareStore` stores whole `Share` objects, bypassing parsing. | `grep -rn "_share_from_document\|FirestoreShareStore" gate/tests/` → no matches; break #3 leaves `447 passed`. |
| C2 | The mint/revoke log line's deliberate omission of `<section>/<source>/<slug>/entry` (Dissenter D5) is unguarded. No share test inspects log output (no `caplog`, no `through_the_gates_own_handler`), so re-adding the item triple is invisible. | break #12 leaves `447 passed`. |
| C3 | The item-local `_payload/` sibling is not tested for **direct** (non-traversal) access; the existing test only attempts traversal, so it passes even when `/_doc` is dropped and the sibling becomes servable. | temporary probe under break #2: committed test `passed`, direct-request probe `FAILED`. |

## Notes on scope

- The contract's "site island owner branch" is guard #7; the "site island owner
  branch — make a 403 render controls" is exactly `sharesView`. Its sibling
  assertion (`shares.test.ts` "is NOT reachable from the public srcDir") is a
  structural test and was not mutated here.
- The contract's "`check:no-private-in-public` still catching the Shares
  island/route if it were emitted publicly" is not a distinct unit-guarded check:
  the leak checker has no Shares-specific logic. A publicly-emitted Shares page
  would be caught only because it carries private item *titles*, and that
  content-needle path is already covered by
  `check-no-private-in-public.test.ts` ("CONTENTS: a private title rendered into
  a public index page"). No Shares-specific negative fixture exists; noted, not
  counted as a gap because the generic mechanism is tested.
- Guards 8–11 are the contract's extra list; guards 1–7 and 12 are the task list.

## Method / restore proof

Every mutation was applied to the tracked file in place, the targeted test (or
full suite) run, then reverted:

```
git checkout -- <file> && git diff --exit-code -- <file>   # prints nothing = clean
```

Final state: `git diff --exit-code` (whole tree) clean; no tracked file
modified; only the pre-existing untracked handoffs plus this one. Full suites
re-run green after the last restore: gate `447 passed`, `ruff check app` "All
checks passed!"; site `73 passed`.

---

## Addendum — re-verification against the hardening tests (`gate/` only)

After this handoff, the gate stream added tests (working tree, uncommitted) that
close the two coverage gaps and the three weak tests above. Gate baseline is now
`455 passed`. I re-broke the four guards and confirmed each red by name, then
restored. `git diff --exit-code gate/app/` is clean; `git diff --exit-code gate/`
is non-zero **only** because of the gate stream's pre-existing uncommitted
`gate/tests/{conftest,test_shares}.py` additions (untouched by me).

| Guard (file:line) | Break applied | Exact failing test | Restore | Verdict |
|---|---|---|---|---|
| `_share_from_document` `gate/app/shares.py:103,107` | `data.get("entry", "index.html")` + drop `entry` from required tuple | `test_a_stored_document_missing_entry_is_refused_not_defaulted` | clean | **fail-able** (was C1) |
| mint log `gate/app/main.py:562-566` | append `item=%s/%s/%s entry=%s` to the mint line | `test_the_mint_log_carries_no_item_material[hosting|direct]` | clean | **fail-able** (was C2) |
| `_share_item_prefix` `/_doc` `gate/app/main.py:983` | drop `/_doc` suffix | `test_the_member_frame_is_not_served_by_a_direct_request[hosting|direct]` **and** `test_a_direct_payload_request_is_confined_to_the_doc_namespace[hosting|direct]` | clean | **fail-able** (closes W1/W2/C3) |
| `_share_item_prefix` single-segment check `gate/app/main.py:981` | delete `if "/" in clean_section or "/" in clean_source: return None` | `test_a_corrupt_stored_section_is_refused[hosting|direct]` | clean | **fail-able** (closes W3) |

**Updated counts.** All 12 guards that were brittle in the first pass are now
fail-able. Remaining un-failable guards: **0**. Remaining coverage gaps: **0**.
The direct-request frame/payload tests watch the fetched object name and bytes,
so they catch the `_doc` removal the old traversal-only tests missed; the
corrupt-section test seeds a serve-able escaped sentinel, so it fails for the
right reason rather than 404-ing on a missing object. The four restores were
verified with `git diff --exit-code -- <file>` before the final full-suite run:
gate `455 passed`.
