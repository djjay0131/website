# Handoff — Skeptic Verifier, Wave 6 (annotations)

Status: Complete
Date: 2026-10-07
Owner: Skeptic Verifier
Issue: #107 · Branch: `feat/annotations`
Contract: `contracts/skeptic-verifier-wave-6.md`
Seams: `contracts/wave-6-annotations-seams.md`
Method: every guard below was **broken → red → restored → green**. Each break
patched an anchor asserted to occur **exactly once** before editing
(`assert count == 1`; the harness aborted otherwise), and the file's sha256 was
re-verified after restore. No tracked file was left changed (`git diff` empty),
no git/gh command ran, scratch scripts live in `/tmp/opencode`.

Reproduce with: `python3 /tmp/opencode/break_guard.py --file F --old OLD --new NEW --cmd CMD --cwd DIR`.

## Result in one line

**16 guards tested, 0 un-failable, 3 coverage gaps (all masking/redundancy, no
open bypass).** All gate and site suites restore green (gate `624 passed`,
site `488 passed | 2 skipped`).

---

## Gate guards (`cwd=gate`, command prefix `.venv/bin/python -m pytest`)

| # | Guard | Break applied (anchor → replacement, count==1) | Failing test(s) by name | Verdict |
|---|---|---|---|---|
| 1 | Cross-member read refusal | `main.py` `rows = deps.annotations.list_for(member)` → `list_all()` | `test_annotations.py::test_a_member_cannot_read_another_members_note[hosting]`, `[direct]`; `::test_the_default_list_is_only_the_callers_own[hosting]`, `[direct]` | **fail-able** |
| 2 | Owner-only `scope=all` | `if not _is_owner(principal, deps):` (list block) → `if False:` | `test_annotations.py::test_a_non_owner_asking_for_all_is_refused_not_downgraded[hosting]`, `[direct]` | **fail-able** |
| 3 | Delete ownership (member-own / owner-any) | `if not _is_owner(principal, deps) and existing.member != member:` → `if False:` | `test_annotations.py::test_a_member_cannot_delete_another_members_note[hosting]`, `[direct]` | **fail-able** |
| 4a | Field bound — quote/`exact` ≤2000 | `or not 1 <= len(exact) <= MAX_EXACT_CHARS` → `or not 1 <= len(exact)` | `test_annotations.py::test_create_rejects_bad_input_with_400[hosting-overrides8]`, `[direct-overrides8]` | **fail-able** |
| 4b | Field bound — comment ≤5000 | `len(comment) > MAX_COMMENT_CHARS` → `len(comment) > 10**9` | `test_create_rejects_bad_input_with_400[hosting-overrides22]`, `[direct-overrides22]` | **fail-able** |
| 4c | Field bound — tags ≤10 | `len(tags) > MAX_TAGS` → `len(tags) > 10**9` | `test_create_rejects_bad_input_with_400[hosting-overrides24]`, `[direct-overrides24]` | **fail-able** |
| 4d | Field bound — intent enum | `intent not in ANNOTATION_INTENTS` (create) → `False` | `test_create_rejects_bad_input_with_400[hosting-overrides0]`, `[direct-overrides0]` | **fail-able** |
| 5 | Selector validation (type) | `_text_quote_selector`: `value.get("type") != QUOTE_SELECTOR_TYPE` → `False` | `test_create_rejects_bad_input_with_400[hosting-overrides5]`, `[direct-overrides5]` | **fail-able** |
| 6 | Origin check on POST + DELETE | `_refuse_cross_origin`: `if not _same_origin(request, deps.settings):` → `if False:` | `test_annotations.py::test_create_refuses_a_cross_origin_request[hosting]`, `[direct]`; `::test_delete_refuses_a_cross_origin_request[hosting]`, `[direct]` | **fail-able** |
| 7 | `Cache-Control: private, no-store` | `security_headers`: `PRIVATE_CACHE_CONTROL` → `"public, max-age=3600"` | `test_annotations.py::test_every_annotation_response_is_private_no_store[hosting]`, `[direct]`; `test_headers.py::test_every_private_response_is_private_no_store[hosting]`, `[direct]` | **fail-able** |
| 8 | No quote/title in logs | create log line gets `quote=%s` + `fields["quote"]` | `test_annotations.py::test_the_create_log_carries_no_quote_or_comment[hosting]`, `[direct]` | **fail-able** |
| 9a | `X-Frame-Options` SAMEORIGIN half | `_is_payload_object` `return name == "_payload" or ...` → `return False` | `test_headers.py::test_a_served_payload_document_is_frameable_by_the_same_origin[hosting]`, `[direct]`; `::test_a_payload_document_under_a_private_prefix_is_frameable` | **fail-able** |
| 9b | `X-Frame-Options` DENY-otherwise half | same anchor → `return True` | `test_headers.py::test_a_non_payload_document_keeps_deny[hosting]`, `[direct]`; `::test_security_headers_are_present[hosting-x-frame-options-DENY]`, `[direct-...]` | **fail-able** |

Note on 9b: `test_a_refused_or_missing_payload_keeps_deny` stayed green under the
forced-`True` break. That is **by design** — `served_object_name` is only set on
the 200 path, so a 404/refusal keeps `DENY` regardless. The DENY-otherwise
property is still falsified by `test_a_non_payload_document_keeps_deny`. Not a
gap.

---

## Site guards

| # | Guard | Break applied | Exact command | Failing test(s) by name | Verdict |
|---|---|---|---|---|---|
| 10a | Leak needle `/annotations` removed | array drops `/annotations` | `npx vitest run scripts/check-no-private-in-public.test.ts -t "annotation tooling and endpoints never reach the public output"` | `declares exactly the four AN-LEAK needles`; `flags a planted needle in CONTENTS and in a PATH`; `scans gzip Pagefind payloads, so a needle inside one is caught` | **fail-able** |
| 10b | Leak needle `/p/notes` removed | array drops `/p/notes` | same as 10a | `declares exactly the four AN-LEAK needles` (only) | **fail-able**, **coverage gap** (see f-1) |
| 10c | Leak needle `hub:annotation:` removed | array drops `hub:annotation:` | same as 10a | `declares exactly the four AN-LEAK needles`; `flags a planted needle in CONTENTS and in a PATH` | **fail-able** |
| 10d | Leak needle `data-annotation-` removed | array drops `data-annotation-` | same as 10a | `declares exactly the four AN-LEAK needles`; `flags a planted needle in CONTENTS and in a PATH` | **fail-able** |
| 11a | Capture island absent from public **source** tree | planted `src/pages/notes.astro` (removed after) | `npx vitest run scripts/wave-6-structure.test.ts` | `has no notes page or annotation island under src/`; `the private pages tree routes /notes/ and the public tree does not` | **fail-able** |
| 11b | Capture island absent from `dist-public` | planted `dist-public/notes/index.html`, `_astro/AnnotationsIsland.deadbeef.js`, `leak.html` (removed after) | `npx vitest run scripts/wave-6-structure.test.ts` | `has no notes page under the public output`; `contains none of the annotation needles in any path or file's contents`; `emits no annotation island chunk` | **fail-able** |
| 12a | Routing parser rejects a missing intent | `for (const intent of INTENTS)` → `Object.keys(raw.routes)` | `npx vitest run src-private/lib/annotations.test.ts -t "notes-routing.json is validated"` | `requires every intent and accepts a null route as My notes only` | **fail-able**, **coverage gap** (see f-2) |
| 12b | Routing parser handles a `null` route | `if (route === null)` → `if (false)` | same as 12a | `requires every intent and accepts a null route as My notes only`; `routeNote skips question and routes paper to its repo` | **fail-able** |
| 12c | Routing parser rejects a bad repo | `!REPO_PATTERN.test(route.repo)` → `false` | same as 12a | `refuses a bad version, a bad repo and an unsafe dir` | **fail-able** |
| 13a | Export deep-link shape | `export-notes.mjs` `${base}/p/...` → `${base}/private/...` | `npx vitest run scripts/export-notes.test.ts` | `deepLink and qualifiedId are the documented shapes`; `carries the qualified id, deep link, quote, comment and intent` | **fail-able** |
| 13b | Export qualified-id shape | `qualifiedId` separators `/` → `:` | `npx vitest run scripts/export-notes.test.ts` | `deepLink and qualifiedId are the documented shapes`; `carries the qualified id, deep link, quote, comment and intent` | **fail-able** |
| 13c | Export `question`-skip | `routeNote` question branch `render: false` → `render: true` | `npx vitest run scripts/export-notes.test.ts src-private/lib/annotations.test.ts` | `writes one file per routeable note and skips question`; `routeNote skips question and routes paper to its repo` | **fail-able**, **masking note** (see f-3) |

---

## Coverage gaps and findings

- **f-1 — `/p/notes` leak needle has no committed planted-leak test.** Removing
  it reds only the exact-array declaration test; no committed test plants a
  `/p/notes` leak, so the detection path is unverified by the suite. A scratch
  probe (`/tmp/opencode/leak_probe.mjs`: one file per needle, one needle each)
  shows `findAnnotationLeaks` **does** catch `/p/notes` (all four needles
  `CAUGHT` on an unpatched run; removing one needle drops exactly that needle).
  The detector works; the committed coverage does not non-vacuously exercise
  `/p/notes`. Recommend a planted `/p/notes` case in the AN-LEAK test.
- **f-2 — routing missing-intent branch is redundant and its message is not
  pinned.** Deleting only `if (!(intent in raw.routes)) throw ...` leaves the
  whole routing suite **green**: a missing key falls through to the type check,
  which throws `route "question" must be an object or null` — a message the
  test's `toThrow(/question/)` also matches. The property (a routing file missing
  an intent is rejected) is still enforced, so this is a redundancy / message-
  specificity gap, not a bypass. The guard is fail-able only by changing the
  `INTENTS` loop source (12a). Recommend asserting on the specific missing-route
  message.
- **f-3 — the export `question`-skip assertion is regex-masked.** Deleting the
  explicit question branch (rather than flipping it) leaves `export-notes.test.ts
  > writes one file per routeable note and skips question` **green**, because
  `notes-routing.json` maps `question → null` and the fallback reason
  `no route for intent "question"` still matches `/question/`. Only the exact
  `toEqual` in `annotations.test.ts > routeNote skips question...` reds; the true
  violation (`render: true`, 13c) reds both. Not a bypass — the routing data is a
  second guard — but the export test alone does not prove the explicit branch.
  Recommend asserting the exact reason string in the export test too.

## Non-findings worth recording

- The **`_payload` served-name exception (AN-GUARD-8)** falsifies cleanly in both
  directions, and the refusal/404 path correctly keeps `DENY` because it never
  sets `served_object_name`. The narrower served-name design holds under test.
- The gate's shared middleware **`private, no-store`** is asserted on annotation
  refusals and 400/413 outcomes too, not just 200s — the break reds the
  annotation, malformed, reserved, list-refused, signed-out, delete and
  cross-origin cases at once.

## Evidence

- Harness: `/tmp/opencode/break_guard.py` (exactly-once anchor assert; sha256
  restore verification).
- Leak probe: `/tmp/opencode/leak_probe.mjs`.
- Post-restore full suite: `gate/` → `624 passed`; `site/` → `488 passed |
  2 skipped (490)`; `git diff` empty, no new files under `gate/**` or
  `site/**`.
