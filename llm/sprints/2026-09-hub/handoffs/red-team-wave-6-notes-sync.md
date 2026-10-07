# Handoff — `Red Team`, Wave 6 notes-sync (D18, #107)

Agent: Red Team (independent; authored nothing in this wave — report only, **no fixes**)
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md` (AN-SYNC-7)
ADR: `llm/governance/adr/0022-annotation-export-transport.md` (amended, Accepted on D18)
Branch: `feat/annotations-sync` HEAD `f333a62` — hub `/home/djjay/code/website`
Artifacts under test (sha256):

```
notes_sync.py 796cf3f34d12c54194510df780f4fb226dae16855635cddffd51c8607c6eb844
main.py       d7796fa115b13b6c5f48b8ae1d11576f5a20a18b627cf6793ac5ba7798b56292
annotations.py e89eee40e2eee1b8737cf8167dfd790dcce5ebffda5e9f5fc93cc9c4b4e31f25
notes-sync.tf 0fdcfcc056e25be079caaff541fc39e37f090d9321868f117f546e636462b262
```

Working tree: I changed **no tracked file** (the only new file is this handoff) and ran **no
git/gh mutation**. All scratch is under `/tmp/opencode/redteam-w6ns/`
(`probe_notes_sync.py`, `probe_routes.py`). No credential was created; no production system was
contacted — every probe drove `notes_sync` directly or `create_app()` against the in-memory
`Static*` fakes. `cd gate && .venv/bin/python -m pytest` is **context only**: `643 passed` before
and after; the repo has no notes-sync lock-in marker beyond `tests/test_notes_sync.py` (17 tests).

## Summary

**19 attacks: 11 REFUSED, 5 BYPASS, 1 REFUSED/N-A, 2 OBSERVED / NOT TESTED.** The authorisation-shaped targets hold:
routing cannot be steered by content, item identity or query; traversal and commit-message
injection are refused; the retry/backoff/dead-letter bounds hold; nothing is ever committed to
`main`; unchanged content does not re-commit; disabled/dormant mode makes no GitHub call and does
not touch the routes; the App JWT is ≤10 min. The credential redactor covers GitHub tokens and
JWTs.

The five bypasses:

1. **RT6NS-01 — a deleted note is never tombstoned when it was the item's only note (most serious).**
   `NotesSync._write_job` calls `destinations()`, which **excludes deleted entries**; when every
   entry is a tombstone `by_repo` is empty and the function returns *before rendering*. The drain
   then calls `queue.success(job)` and logs `action=commit` — so a delete is recorded as a
   successful commit while the repo still contains the deleted note's passage and **no tombstone is
   ever written**. Verified end-to-end through `POST /annotations` → `DELETE /annotations/{id}`
   (AN-SYNC-1/AN-SYNC-3 requirement violated; the log is a false audit trail).
2. **RT6NS-02 — `section` is not part of the export path, so distinct items collide.**
   `notes_path(source, slug)` = `notes/<source>/<slug>.md`; item identity is
   `(section, source, slug)`. Two items that share `source`+`slug` and differ only in `section`
   write the same file and **overwrite each other** (verified: the first item's passage is gone).
   A member may pick any `section` (the create validator checks syntax only, not item access), so a
   member can clobber another item's export.
3. **RT6NS-03 — the credential redactor is a GitHub-only denylist; the Google OAuth token and the
   App private key are not redacted.** `_short_error` matches `gh[sphou]_…`, `github_pat_…` and
   `eyJ….….…` but **not** `ya29.…` (the ADC token `SecretManagerRestProvider` puts in its
   `Authorization` header) nor a PEM private key. A planted `ya29.` token appears verbatim in the
   `event=retry` log line **and** in the dead-letter `export.error` a member reads back from
   `GET /annotations` (AN-SYNC-6 / Security-Tester "never logged or returned" fails for the two
   credentials this subsystem itself holds).
4. **RT6NS-04 — a comment is not collapsed to one line, so NUL/control bytes reach the commit.**
   `_entry_block` applies `one_line()` to the quote but **not** to the comment; `_annotation_fields`
   accepts a comment containing `\u0000`. A note comment `ok\x00NUL\x1b[31m\x0dCR` is written into
   `notes/….md` with the NUL, ESC and CR intact (AN-SYNC-7 target 4 "binary/NUL … non-text
   rejected" fails).
5. **RT6NS-05 — no per-item note cap.** The create caps are per-note; nothing bounds the number of
   notes on one item. 5 000 notes on one item render a **~674 KB** commit in one write (member
   triggerable; unbounded repo/queue growth). Closely related to target 4.

The **most serious is RT6NS-01**: a member's delete returns `200 ok`, the gate logs a successful
commit, the job is deleted from the queue (so nothing retries), and the private passage the member
believed deleted remains in the owner's repository indefinitely. No owner action, no downstream
renderer, no attacker tooling needed.

## Attack table

| # | Target (AN-SYNC-7 / task tail) | Exact setup | Observed | Verdict | Code path |
|---|---|---|---|---|---|
| RT6NS-01 | Tombstone-only item | drive `NotesSync` with `[live]` then `[live(deleted)]`; also `POST` then `DELETE` via `create_app` | after delete: `delivered=1`, `commits` stays 1, file still contains the live passage, `tombstone` never appears; log line says `action=commit repo_jobs=1` | **BYPASS (critical)** | `notes_sync.py:780-785` (`destinations` skips `deleted`), `:762-769` (`success`+log) |
| RT6NS-02 | Cross-item path collision (item identity) | two items `(phd,phd-milestones,committee-dossier)` and `(projects,phd-milestones,committee-dossier)` | second drain overwrote the first: victim header+passage gone, attacker header present; 2 commits to one path | **BYPASS (integrity)** | `notes_sync.py:101-108` (`section` absent from path), `main.py:1378-1392` (no item-access check) |
| RT6NS-03 | Token/key exfiltration | plant `ya29.LEAKED…` in a raised exception; read log + `state_for` after dead-letter | log `event=retry … error=403 Bearer ya29.LEAKED_GOOGLE_OAUTH_TOKEN_abc123`; dead-letter `state_for` (what `GET /annotations` returns) `{'state':'dead_letter','error':'…ya29.LEAKED…'}`; `ghs_`/`ghp_`/`github_pat_`/`eyJ` are redacted, PEM is not | **BYPASS (credential)** | `notes_sync.py:309-325` `_short_error`/`_TOKEN_PATTERN`; `:438-439`, `:496-498` state exposure |
| RT6NS-04 | Binary/NUL payload | render `comment="ok\x00NUL\x1b[31m\x0dCR"`; and `_annotation_fields` on the same | NUL, ESC, lone CR all survive into the `.md`; the create validator accepts the NUL comment | **BYPASS (target 4)** | `notes_sync.py:154-171` (`_entry_block`: `one_line` on quote only); `main.py:1409-1411` |
| RT6NS-05 | Huge note count | render 5 000 `ExportEntry` for one item | 673 900 bytes / 40 001 lines in a single commit; no cap anywhere | **BYPASS (DoS)** | `notes_sync.py:189-206`; no file/entry bound |
| RT6NS-06 | Cross-repo by **content** | `paper` note quoting `repo: djjay0131/agentic-kg-research` | committed repos `{soa-agentic-se}` only | **REFUSED** | `notes_sync.py:261-273` |
| RT6NS-07 | Cross-repo by **item identity** | enqueue `(djjay0131, agentic-kg-research, evil)` with a `paper` note | committed repo `soa-agentic-se`; path `notes/agentic-kg-research/evil.md` | **REFUSED** | `notes_sync.py:261-273` |
| RT6NS-08 | Cross-repo by **`?scope`/query** | `GET /annotations?scope=all[&source|&intent|&slug]`, `scope=OWN` | 200/400 list behaviour only; `len(queue._jobs)==0` after all GETs | **REFUSED** | `main.py:862-892`; enqueue is on POST/DELETE only |
| RT6NS-09 | Commit-message injection | `commit_message` with `../evil`, newline, overlong slug | message `notes: update item` (unsafe → constant) or `one_line`d safe identity | **REFUSED** | `notes_sync.py:209-216` |
| RT6NS-10 | Path injection | `notes_path` with `../x`, `..%2f`, `a/../../b`, `/abs`, `a\b`, `a//b`, `.`, `..`, `""`, `x\ny`, 600-char | every hostile form → `None`; nested `slug` allowed by design | **REFUSED** | `notes_sync.py:101-108`, `:90-98` |
| RT6NS-11 | Retry storm / dead-letter / `main` | force `put_file` failures repeatedly; check backoff, queue growth, branch ref | bounded `[60,120,240,960,3600,3600…]`; one job (no growth); branch `notes`; job kept with `dead_lettered=True` | **REFUSED** | `notes_sync.py:76-82`, `:408-427`, `:474-490` |
| RT6NS-12 | Duplicate commit (unchanged) | drain same content twice | commits stays 1 | **REFUSED** | `notes_sync.py:802-804` |
| RT6NS-13 | Commit to `main` | default branch `main`/`master`/`develop` | every commit ref was `notes`; branch created from the default's head | **REFUSED** | `notes_sync.py:44,711-719,805-812` |
| RT6NS-14 | Dormant mode | `NotesSync(enabled=False)` and `create_app(notes_sync=None)` | enqueue no-op, `due==[]`, `drain==0`, no commit; GET rows have **no** `export` field; lifespan task `False` | **REFUSED** | `notes_sync.py:748-758`; `main.py:1534-1547` |
| RT6NS-15 | Intent routes to a repo not in routing | `destinations` with `question` / missing key | `question→None` skipped; `parse_routing` raises on a missing intent (loud startup, no silent default) | **REFUSED / N/A** | `notes_sync.py:228-273` |
| RT6NS-16 | App JWT lifetime | intercept `jwt.encode` + `requests.post` (no network) | `alg=RS256`, `iss=12345`, `exp-iat=600` (≤10 min), `iat` in the past (skew), token `ghs_…` | **REFUSED** | `notes_sync.py:586-598` |
| RT6NS-17 | Branch-creation race | two `create_branch` calls; `RealGitHubAppClient` treats 422 as success | static records two creates; real path returns on `unprocessable_entity`; `branch_sha` stable | **REFUSED (race handled)** | `notes_sync.py:630-640`, `:711-719` |
| RT6NS-18 | Reserved `.git` path component | `source=".git"` / slug segment `.git` | accepted by the create validator; path `notes/.git/config.md` — a `.git` path component, which Git/GitHub refuse | **OBSERVED / NOT TESTED (no network)** — probable permanent job failure → dead-letter | `main.py:1391` (`safe_prefix` allows `.git`); `notes_sync.py:101-108` |
| RT6NS-19 | Secret Manager wrong identity | inspect `SecretManagerRestProvider` + TF binding | code uses ADC `default()`; TF binds `hub_gate` to the one secret (`secretAccessor`, secret-scoped); not testable without cloud | **NOT TESTED (no cloud)** | `notes_sync.py:518-542`; `infra/notes-sync.tf:23-28` |

Counts: **19 attacks — 11 REFUSED, 5 BYPASS, 1 REFUSED/N-A, 2 OBSERVED/NOT-TESTED** (plus one
additional observation, RT6NS-20, not a separate attack).

---

## Bypass reproductions

### RT6NS-01 — the delete that never tombstones (most serious)

`destinations()` explicitly drops deleted entries (`notes_sync.py:266-267`), and `_write_job`
returns early when it produces no repo (`:783-785`). The drain then still marks the job successful
and logs a commit (`:762-769`):

```
A) TOMBSTONE-ONLY ITEM: does a delete tombstone reach the repo?
after live create: commits = 1 file exists = True
after soft-delete: delivered = 1 commits = 1
repo file still contains the live passage: True
tombstone ever written: False
```

Route-level (real `create_app`, `POST` then `DELETE`, then `drain`):

```
POST: 200 {'id': '7wKpV_GF6rIkoQtpvQxHfw', 'created': '…'}
INFO gate event=allow scope=annotation action=create id=7wKpV_GF6rIk by=djjay@vt.edu
INFO gate event=allow scope=notes_sync action=commit repo_jobs=1 item_hash=4d00dcbceb59
commits after create: 1
INFO gate event=allow scope=annotation action=delete id=7wKpV_GF6rIk by=djjay@vt.edu
DELETE: 200 {'status': 'ok'}
INFO gate event=allow scope=notes_sync action=commit repo_jobs=1 item_hash=4d00dcbceb59   <-- no commit happened
commits after delete: 1
repo file still holds deleted private passage: True
repo file holds a tombstone: False
```

Impact: the deleted passage stays in `djjay0131/soa-agentic-se` (or `agentic-kg-research`)
forever; the queue job is deleted so nothing retries; and the operator sees a successful commit.
The renderer's tombstone branch (`_tombstone_block`, tested in isolation by
`test_render_records_a_tombstone_instead_of_dropping_the_entry`) is never reached through the
orchestrator for a tombstone-only item. Mixed items are unaffected *only* because a surviving live
entry forces a write of the whole render.

### RT6NS-02 — `section` is not in the path, so items collide

`notes_path` builds `notes/<source>/<slug>.md`; `section` appears only in the in-file header. Two
items sharing `source`+`slug` and differing by `section` share one file:

```
B) SECTION IGNORED BY PATH: two items differing only by section collide
commits: 2
victim header still present: False
attacker header present:    True
victim passage present:     False
```

`_annotation_fields` validates `section`/`source`/`slug` for *syntax* only — it never checks that
the member may see the item — so any member can create notes for an arbitrary `(section, source,
slug)` and force this clobber on a guessed item. (This is the same root cause as the observation
that members can annotate items they cannot read; recorded here because it has a repository side
effect.)

### RT6NS-03 — the redactor misses the Google OAuth token and the PEM key

```
D) TOKEN/KEY REDACTION: _short_error coverage
github installation (ghs_) -> 'boom [redacted] head'          leaked: False
github PAT classic (ghp_)  -> 'boom [redacted] head'          leaked: False
github fine-grained        -> 'boom [redacted] head'          leaked: False
app JWT (eyJ)              -> 'boom [redacted] head'          leaked: False
google oauth (ya29.)       -> 'boom ya29.a0AfH6SMBxxxx… head' leaked: True
PEM private key            -> 'boom -----BEGIN RSA PRIVATE KEY----- MIIEow… -----END… head' leaked: True
secret manager bearer      -> 'boom Bearer abcdef… head'      leaked: True
```

Planted in a raised exception, the `ya29.` token reaches both surfaces:

```
_short_error(ya29): '403 Bearer ya29.LEAKED_GOOGLE_OAUTH_TOKEN_abc123'
drain@60s -> 0
stored last_error: '403 Bearer ya29.LEAKED_GOOGLE_OAUTH_TOKEN_abc123'
dead-letter state_for (this is GET /annotations export):
    {'state': 'dead_letter', 'error': '403 Bearer ya29.LEAKED_GOOGLE_OAUTH_TOKEN_abc123'}
log line:
    event=retry scope=notes_sync item_hash=4d00dcbceb59 attempts=1 error=403 Bearer ya29.LEAKED_GOOGLE_OAUTH_TOKEN_abc123
```

The docstring promises redaction so "a client exception that happens to echo a header cannot leak
one"; the header `SecretManagerRestProvider` sets is `Authorization: Bearer <ya29.…>`, which the
pattern does not cover. The private key is a PEM, likewise uncovered. Severity is bounded by
whether a real exception echoes the header/body, but the guard fails *open* for exactly the two
credentials this subsystem handles, and the dead-letter path returns it to a client.

### RT6NS-04 — comment control bytes reach the commit

```
C) CONTROL CHARACTERS / NUL in comment reach the committed file
NUL in output: True  ESC in output: True  lone CR: True
snippet: '**Comment**\n\n> ok\x00NUL\x1b\\[31m\rCR\n\n- **Item:** phd/s/y …'
create validator accepts NUL comment: True
```

`_entry_block` (`notes_sync.py:154-171`) runs `one_line()` on the quote but emits
`escape_markdown(entry.comment)` directly. `escape_markdown` escapes Markdown metacharacters but
does not strip C0 controls, so a NUL/ESC/CR survives into a git blob that Git treats as binary. The
route cap (`MAX_COMMENT_CHARS = 5000`) permits it.

### RT6NS-05 — unbounded commit from one item

```
J) HUGE NOTE COUNT: no per-item cap -> unbounded commit
5000 entries -> file bytes: 673900 lines: 40001
```

Nothing caps entries-per-item, so a member can grow the export (and the Firestore scan on every
drain) without limit.

---

## Refused reproductions (highlights)

```
E) CROSS-REPO STEERING
paper + content naming RESEARCH -> repos committed: ['djjay0131/soa-agentic-se']
item identity naming RESEARCH  -> repos committed: ['djjay0131/soa-agentic-se'] path: ['notes/agentic-kg-research/evil.md']
destinations for paper entries always: {'djjay0131/soa-agentic-se'}

F) PATH / MESSAGE INJECTION   (notes_path / commit_message)
'../x','..%2f','a/../../b','/abs','a\\b','a//b','.','..','', 'x\ny'  -> all None / 'notes: update item'

G) RETRY   bounded backoff [60,120,240,960,3600,3600,3600,3600]; one job; branch 'notes'; never 'main'
H) DORMANT disabled enqueue -> due: []; disabled drain -> 0 commits: []
M) DORMANT ROUTE POST 200; GET row has no 'export' key; lifespan task configured: False
N) ?scope      scope=all/OWN/… never enqueues; jobs enqueued by GET: 0
O) APP JWT     alg RS256; exp-iat 600 (<=600); iat in the past; token ghs_…
P) NO 'main'   default main/master/develop -> every commit ref 'notes'; branch created from default head
```

## Observations / not tested

- **RT6NS-18 — `.git` path component.** `_checked_segments` rejects only `""`/`"."`/`".."`, so
  `source=".git"` and slug segments named `.git` pass the create validator and render
  `notes/.git/<slug>.md`. Git refuses `.git` tree entries and the GitHub Contents API is expected
  to 422 it, so the job would fail every attempt and dead-letter — a member-triggerable permanent
  export failure. Not confirmed because there is no network here. Recommend a reserved-name check
  on every segment (`.git`, case-insensitive, trailing dot/space).
- **RT6NS-19 — Secret Manager identity.** `SecretManagerRestProvider` uses ADC `default()`; in
  Cloud Run that is `google_service_account.hub_gate`, and `infra/notes-sync.tf:23-28` grants that
  identity `secretAccessor` **scoped to the one secret** (no project-level `secretmanager.*`). I
  could not exercise it without cloud credentials; code and TF are consistent on inspection.
  Note: `infra/gate.tf:153` ("There is no secret.") and `:179-183` ("this wave creates no … IAM
  binding for export") now contradict `notes-sync.tf` — stale comments, no functional effect, but a
  reviewer trap.
- **RT6NS-20 — coalesce resets the dead-letter clock.** `enqueue` resets `attempts=0` and
  `first_attempt=now` (`notes_sync.py:376-393`, `:449-464`), so an item re-edited inside 24 h never
  reaches the 24 h bound. Low severity (new content is arguably new work), but a scripted member can
  keep a wedged job alive indefinitely and defeat dead-letting.
- **Un-failable guards (echo of the Skeptic Verifier).** `MAX_ATTEMPTS` (200), the `_job_from_document`
  doc-id tamper check, the `StaticExportQueue.enqueue` identity guard, and the content caps have no
  negative test; probes above supply a few of the missing cases (NUL comment passes; 5 000-entry
  render has no cap).

## Disclosures / side effects

None. No credential, secret, GitHub App, PAT, WIF provider or IAM binding was created. No `git`/`gh`
mutation; no tracked file changed (only this new handoff is untracked). No production endpoint was
contacted: `probe_notes_sync.py` drove `NotesSync`/renderer/queue directly, and `probe_routes.py`
drove `create_app()` with `Static*` fakes. `_token()` was exercised with `jwt`/`requests` replaced
in `sys.modules` — no socket was opened. `git status --porcelain` before writing this file showed
only pre-existing untracked handoffs.

## Reproduction index

| Pointer | Command |
|---|---|
| RT6NS-01..16 (unit) | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns/probe_notes_sync.py` |
| RT6NS-01..05, 08, 13..17 (routes, JWT, dormant, no-main) | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns/probe_routes.py` |
| RT6NS-03 dead-letter response-body exposure | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns/probe_deadletter.py` |
| Context (must-not-regress) | `cd gate && .venv/bin/python -m pytest` → `643 passed` |
