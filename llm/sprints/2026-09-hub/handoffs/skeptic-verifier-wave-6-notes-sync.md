# Handoff — Skeptic Verifier, Wave 6 notes-sync (D18)

Status: Complete
Date: 2026-10-07
Owner: Skeptic Verifier
Issue: #107 · Branch: `feat/annotations-sync`
Contract: `contracts/adversarial-wave-6-notes-sync.md` · Seams:
`contracts/wave-6-notes-sync-seams.md` (AN-SYNC-7)
Source under test: `gate/app/notes_sync.py` (sha256
`796cf3f34d12c54194510df780f4fb226dae16855635cddffd51c8607c6eb844`)
Tests: `gate/tests/test_notes_sync.py` (17 tests, all green before and after)

Method: every new guard was **broken → red → restored → green**. Each break
patched an anchor asserted to occur **exactly once** before editing
(`assert content.count(anchor) == 1`; the harness aborted otherwise), then ran
the named test(s) from `gate/` with `.venv/bin/python -m pytest`, then restored
the file and re-verified its sha256 equals the pre-break value. `git diff` is
empty, no tracked file is left changed, no git/gh command ran, scratch lives in
`/tmp/opencode` (`skeptic_wave6.py`, `skeptic_wave6_probes.py`,
`skeptic_wave6_probes2.py`, `skeptic_wave6_result.json`).

## Result in one line

**9 named guards tested (11 break-checks), 1 un-failable (the branch "once"
early-return), 8 coverage gaps — 6 are duplicate/unreachable code paths, 2 are
redundant defence; no open bypass.** Every fail-able break reds a named test;
every restore returns green.

Command prefix for the tables below: `cd gate && .venv/bin/python -m pytest`

---

## New-guard rows (one per guard)

| # | Guard (seam) | Break applied (anchor → replacement) | Failing test by name | Verdict |
|---|---|---|---|---|
| 1 | debounce clamp (AN-SYNC-1, `debounce_seconds`) | `...high=MAX_DEBOUNCE_SECONDS, default=...` → `...high=10**9, default=...` (`high=MAX_DEBOUNCE_SECONDS` count==1) | `tests/test_notes_sync.py::test_debounce_and_backoff_are_bounded_and_deterministic` (`debounce_seconds(999) == 60` fails) | **fail-able** |
| 2 | backoff (AN-SYNC-2, `backoff_seconds`) | `return min(BASE_BACKOFF_SECONDS * (2**exponent), MAX_BACKOFF_SECONDS)` → `return BASE_BACKOFF_SECONDS * (2**exponent)` | `tests/test_notes_sync.py::test_debounce_and_backoff_are_bounded_and_deterministic` (`backoff_seconds(10) == 3600` fails) | **fail-able** |
| 3 | dead-letter at 24h (AN-SYNC-2/5, `StaticExportQueue.failure`) | `if now - job.first_attempt >= DEAD_LETTER_AFTER or attempts >= MAX_ATTEMPTS:\n            self._jobs[job.doc_id] = replace(` → `if False:\n            self._jobs[...] = replace(` | `tests/test_notes_sync.py::test_queue_retries_with_backoff_then_dead_letters_after_24h` | **fail-able** |
| 4 | branch created from default HEAD (AN-SYNC-3, `install_notes_branch`) | `github.create_branch(repo, NOTES_BRANCH, head)` → `github.create_branch(repo, default, head)` | `tests/test_notes_sync.py::test_drain_creates_notes_branch_from_default_once_and_commits` (`branches_created == [(SOA, NOTES_BRANCH)]` fails) | **fail-able** |
| 5 | branch created **once** (AN-SYNC-3, `install_notes_branch`) | `if github.branch_sha(repo, NOTES_BRANCH) is not None:\n        return` → `if False:\n        return` | none — whole file `tests/test_notes_sync.py` stays green | **UN-FAILABLE** (gap g-1) |
| 6 | idempotent no-op on unchanged content (AN-SYNC-3, `_write_job`) | `if existing is not None and existing[0] == text:\n                continue` → `if False:\n                continue` | `tests/test_notes_sync.py::test_drain_is_idempotent_when_content_is_unchanged` (2 commits instead of 1) | **fail-able** |
| 7 | path sanitisation (AN-SYNC-6, `notes_path`) | safety block (`is_safe_segment` + `..`/empty checks + `return None`) → `return "/".join(["notes", source, *str(slug).split("/")]) + ".md"` | `tests/test_notes_sync.py::test_notes_path_is_nested_and_refuses_traversal` | **fail-able** |
| 8 | message sanitisation (AN-SYNC-6, `commit_message`) | `safe = f"{section}/{source}/{slug}" if item_is_safe(...) else "item"` → `safe = f"{section}/{source}/{slug}"` | `tests/test_notes_sync.py::test_commit_message_and_error_text_carry_no_content_or_credential` (`../evil` reaches the message) | **fail-able** |
| 8b | render escaping (AN-SYNC-6, `escape_markdown` in `_entry_block`) | `quote = escape_markdown(one_line(entry.quote))[...]` → `quote = one_line(entry.quote)[...]` | `tests/test_notes_sync.py::test_render_neutralises_link_and_block_injection` | **fail-able** |
| 9 | token redaction (AN-SYNC-6, `_short_error`) | `text = _TOKEN_PATTERN.sub("[redacted]", text)` → `text = text` | `tests/test_notes_sync.py::test_commit_message_and_error_text_carry_no_content_or_credential` (`ghs_`/`ghp_`/JWT survive) | **fail-able** |
| 10 | disabled mode (AN-SYNC-4, `NotesSync.enqueue`) | `if not self._enabled:\n            return\n        self._queue.enqueue(...)` → `self._queue.enqueue(...)` | `tests/test_notes_sync.py::test_disabled_sync_is_a_noop` (`queue.due(...) == []` fails) | **fail-able** |
| 11 | routing validation (AN-SYNC-6/7, `parse_routing`) | `if not isinstance(repo, str) or repo.count("/") != 1:\n            raise ValueError(...)` → `if False:\n            raise ValueError(...)` | `tests/test_notes_sync.py::test_parse_routing_rejects_missing_intent_and_bad_repo` | **fail-able** |

Reproduce any row, e.g. #1:

```
cd gate && .venv/bin/python -m pytest \
  tests/test_notes_sync.py::test_debounce_and_backoff_are_bounded_and_deterministic -q
# mutate the anchor in app/notes_sync.py, rerun → FAILED; restore → 1 passed
```

All 11 breaks had `anchor count == 1` (the HARD RULE held for every patch); the
harness would have aborted on a tie.

---

## Coverage gaps and findings

- **g-1 — the "create the branch only once" property is UN-FAILABLE.** Removing
  the `branch_sha(NOTES_BRANCH) is not None: return` early-return leaves all 17
  notes-sync tests green. `test_drain_is_idempotent_when_content_is_unchanged`
  drains twice (so `install_notes_branch` runs twice) but asserts only
  `len(github.commits) == 1`; it never asserts
  `github.branches_created == [(SOA, NOTES_BRANCH)]`. The correctness of the
  "once" behaviour is therefore unverified by the committed suite. Not a
  security bypass (a repeated `create_branch` is idempotent server-side and
  `RealGitHubAppClient.create_branch` treats the 422 "already exists" as
  success), but the seam claim "create it once" has no falsifier. Recommend
  adding `assert github.branches_created == [(SOA, NOTES_BRANCH)]` to the
  idempotency test.
- **g-2 — the Firestore dead-letter replica is un-failable.** The suite exercises
  only `StaticExportQueue`; the near-identical condition in
  `FirestoreExportQueue.failure` (`reference.update(...)`) can be broken and no
  test notices. Same logic, duplicated implementation — an untested copy of a
  security-relevant retry bound.
- **g-3 — `MAX_ATTEMPTS` cap un-failable.** No test drives `attempts` toward 200
  (`MAX_ATTEMPTS = 200` → `10**9` is green). The 24h bound is tested; the
  attempts bound is not.
- **g-4 — content caps un-failable.** `MAX_QUOTE_CHARS`/`MAX_COMMENT_CHARS`
  truncation has no test with an oversized stored row (removing the slices is
  green). Escaping itself *is* fail-able (row 8b); the cap is the gap.
- **g-5 — `_job_from_document` tamper check un-failable.** Dropping the
  `job_id(section, source, slug) != doc_id → None` guard is green; no forged-
  document test exists.
- **g-6 — drain-side disabled guard is redundant/un-failable.** With the enqueue
  guard intact, removing `if not self._enabled: return 0` from `drain` never
  changes `test_disabled_sync_is_a_noop` (the queue is empty). Defence in depth,
  but not independently falsified.
- **g-7 — `StaticExportQueue.enqueue` identity guard un-failable.** No test
  enqueues an unsafe `section/source/slug`; that guard can be removed green.
  `item_is_safe` is itself exercised transitively via `commit_message` only.
- **g-8 — `one_line` newline/NUL collapse un-failable in this suite.** No test
  puts a newline in a metadata field; comment injection is neutralised by
  blockquoting and quotes by escaping, so the collapse path is not reached.

## Non-findings worth recording

- The retry/dead-letter *lifetime* on the in-memory queue is genuinely
  fail-able: the break reds `test_queue_retries_with_backoff_then_dead_letters_after_24h`,
  which checks both `due()` exclusion and `state_for() == {"state": "dead_letter", ...}`.
- Routing is server-side: `destinations`/`parse_routing` take the routing table
  from the config, not the request. The validation break reds the parse test
  (missing intent, bad repo); no client input reaches the route map.
- Token redaction covers installation tokens (`ghs_`), PATs (`ghp_`/`gho_`/
  `ghu_`/`github_pat_`) and JWTs (`eyJ…`) in one pattern, and the break reds the
  test on all three classes.

## Evidence

- Harness (exactly-once anchor assert, sha256 restore check, `git diff` left
  empty): `/tmp/opencode/skeptic_wave6.py`,
  `/tmp/opencode/skeptic_wave6_probes.py`,
  `/tmp/opencode/skeptic_wave6_probes2.py`; machine-readable result
  `/tmp/opencode/skeptic_wave6_result.json`.
- Post-restore: `gate/app/notes_sync.py` sha256
  `796cf3f34d12c54194510df780f4fb226dae16855635cddffd51c8607c6eb844`;
  `git status --porcelain` empty; `tests/test_notes_sync.py` → `17 passed`.
