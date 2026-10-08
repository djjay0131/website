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

---

# Round 2 — re-attack the landed fixes (D18, #107)

Agent: Red Team (independent; report only, **no fixes**). Branch
`feat/annotations-sync` HEAD `293dc3a` ("fix(wave-6 notes-sync): close Red Team
round-1 bypasses"), hub `/home/djjay/code/website`. Re-ran Round 1's five
attacks against the fixed tree, then attacked the fix code itself.

Artifacts under test (sha256, current tree):

```
notes_sync.py 271b5a9b74b608b7553095f7a51b348ce942cab8198d5d1b52f716c5deb79042
main.py       d1fc5c47a3aa9280eba2c2690b4e5f5ae5c7d8d1b90b7ec243d9afe185867c5f
annotations.py e89eee40e2eee1b8737cf8167dfd790dcce5ebffda5e9f5fc93cc9c4b4e31f25
notes-sync.tf 0fdcfcc056e25be079caaff541fc39e37f090d9321868f117f546e636462b262
```

Working tree: I changed **no tracked file** except this handoff and ran **no
git/gh mutation**. Scratch is `/tmp/opencode/redteam-w6ns-r2/`
(`probe_unit.py`, `probe_routes.py`, `probe_cr_route.py`). No credential was
created and no production system was contacted; probes drove `NotesSync` and
`create_app()` against the in-memory `Static*` fakes. `cd gate && .venv/bin/python
-m pytest` → **650 passed** (round 1: 643; +7 committed tests). The increase does
not include a CR test — see R2-04.

## Verdict on the five fixes

| Fix | Verdict | Why |
|---|---|---|
| RT6NS-01 tombstones | **CLOSED** | `destinations()` now includes `deleted` entries (`notes_sync.py:281-297`); `_write_job` renders them. Tombstone-only item commits a tombstone; a delete replaces the live passage with a struck-through tombstone, both unit and through `POST`→`DELETE`→drain. One residual audit defect (R2-N1), no stale content. |
| RT6NS-03 credential redactor | **CLOSED (for the named secrets)** | `ya29.`, PEM (`RSA`/`EC`/`OPENSSH`), `ghs_` and JWT are all replaced by `[redacted]` in `_short_error`, in the `event=retry` log line, and in `_job_from_document`/dead-letter `export.error`. One denylist gap remains (R2-N2: `ghr_`). |
| RT6NS-04 control bytes | **NOT CLOSED** | `_CONTROL` (`notes_sync.py:58`) omits `\x0d` (CR). NUL and ESC are now stripped, but a CR planted in a **comment** survives to the committed file end-to-end. This is exactly round 1's `\x0d` byte. See R2-04 / new BYPASS. |
| RT6NS-05 per-item cap | **CLOSED (stated goal)** | `MAX_ENTRIES_PER_ITEM = 2000` (`notes_sync.py:55`, applied `:210-226`). 2500 entries → 2000 blocks, 247 561 bytes, omission note `_(500 earlier entries omitted here; see My notes.)_`. Boundary exact: 2000 → no note, 2001 → singular note. Residuals are by-design (R2-N3). |
| Dissenter B2 `_kick_drain` | **CLOSED as specified** | Fires only when `sync is not None and sync.enabled`; returns without raising (disabled, `None`, no running loop, and a raising `drain` all safe). One new latent log-redaction gap (R2-N4). |

**4 of 5 CLOSED. RT6NS-04 is NOT CLOSED.** One genuinely new bypass in the fix
code (the CR that the fix's own docstring claims to remove); three lower-severity
new defects (unredacted kick-future traceback, false `action=commit` audit line,
`ghr_` denylist gap); the round-1 section/slug collision is still open and
owner-specified.

## R2-04 (new BYPASS) — `_CONTROL` skips CR, so `\r` still reaches the commit

`escape_markdown`'s docstring (`notes_sync.py:121-123`) says "Control characters
(NUL, ESC, CR, …) are removed first". The regex does not remove CR:

```python
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")   # notes_sync.py:58
```

The ranges are `\x00-\x08`, `\x0b`, `\x0c`, `\x0e-\x1f`, `\x7f`. TAB (`\x09`)
and LF (`\x0a`) are intentionally kept; **CR (`\x0d`)** is skipped by the
`\x0c`→`\x0e` jump, so it survives. The comment above the regex only claims the
TAB/LF exemption, so the code also disagrees with that comment.

Per-byte check of `escape_markdown`:

```
\x00 stripped   \x08 stripped   \x09 TAB kept   \x0a LF kept
\x0b stripped   \x0c stripped   \x0d CR KEPT    \x0e stripped   \x1f stripped   \x7f stripped
```

End-to-end through the real route (no network; `Static*` fakes):

```
POST /annotations comment = "A\x00B\x1b[31mC\x0dD"  -> 200
drain -> 1 commit
committed file control bytes (excl. TAB/LF): ['0xd']
NUL present: False   ESC present: False   CR present: True
comment region: 'Comment**\n\n> AB\\[31mC\rD\n\n- **Item:** phd/…'
```

The quote path is safe only incidentally: `_entry_block` runs `one_line()` on the
quote before `escape_markdown`, and `one_line` collapses `\r` to a space. The
comment path is `escape_markdown(entry.comment)` with no `one_line`
(`notes_sync.py:167-168`), so the CR reaches the blob. `_annotation_fields`
accepts the CR (comment is length-checked only, `main.py:1415-1417`), so this is
member-triggerable.

Fix shape (for the author, not applied here): make the regex match the stated
intent, e.g. `[\x00-\x08\x0b\x0c\x0d\x0e-\x1f\x7f]` (or `[\x00-\x08\x0b-\x1f\x7f]`
with TAB/LF carved out), and add `\x0d` to `test_renderer_strips_control_characters_from_a_comment`.
The committed test plants only `\x00` and `\x1b` (`test_notes_sync.py:374`), so
it cannot catch this; the Skeptic Verifier's round-2 note (g-9 style, separate
handoff) makes the same point about the redaction test.

## New BYPASSes and defects found in the fix code

### R2-N4 (MEDIUM, new) — `_kick_drain`'s un-awaited future logs a raw, unredacted exception

`_kick_drain` (`main.py:1557-1571`) does `loop.run_in_executor(None, sync.drain)`
and drops the returned future. If `sync.drain` raises **outside** its per-job
`try` — i.e. from `self._queue.due(moment)` (`notes_sync.py:792`), which is not
wrapped — the exception is stored on the never-awaited future and CPython's
asyncio handler logs it verbatim:

```
Future exception was never retrieved
future: <Future finished exception=RuntimeError('boom ya29.LEAKEDKICK_abc')>
RuntimeError: boom ya29.LEAKEDKICK_abc
```

This bypasses `sanitize_error`: the per-job retry path redacts, and the
background loop wraps the same call in `try/except … sanitize_error` (`main.py:1584-1588`),
but the kick path has no such wrapper. I demonstrated the mechanism with a
credential in the escaping exception; I did not find a real `due()` error that
carries a token, so this is a latent redaction gap rather than a proven token
leak. Fix shape: `asyncio.ensure_future(sync.drain())` plus an awaited wrapper
that logs via `sanitize_error`, or a done-callback that consumes the exception.

Also observed: a fresh job is enqueued with `next_attempt = now + debounce`
(45 s default, `notes_sync.py:410`), so the immediate kick finds nothing due and
drains 0; the docstring's "should not wait for the background loop's next tick"
holds only for a job already past its debounce (e.g. one a crashed instance
left behind). Not a security defect.

### R2-N1 (LOW, new) — `action=commit` is logged with zero commits for a no-repo item

`_write_job` returns early when `by_repo` is empty (`notes_sync.py:814-816`), but
`drain` still calls `queue.success(job)` and logs `action=commit` unconditionally
(`notes_sync.py:793-800`). A `question`-only item — the **default** intent — is
the common case:

```
question-only item: drain -> delivered=1, actual commits=0
log: event=allow scope=notes_sync action=commit repo_jobs=1 item_hash=cf5032c678a4
```

The RT6NS-01 fix removed the *stale-content* half of the false audit trail but
not this half. Impact: the export commit signal over-counts for notes that are
never exported. Fix shape: distinguish "wrote nothing because there was nothing
to publish" from "committed", and log it differently (or return a bool from
`_write_job`).

### R2-N2 (LOW, new) — `ghr_` GitHub refresh tokens are not in the denylist

`_TOKEN_PATTERN` (`notes_sync.py:346-351`) covers `gh[sphou]_`, which omits the
documented `ghr_` (GitHub App refresh-token) prefix:

```
_short_error("boom ghr_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 head")
  -> 'boom ghr_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 head'   # leaked
```

This subsystem mints only `ghs_` installation tokens and does not itself hold a
`ghr_`, so relevance is limited; recorded because the module is a denylist whose
whole purpose is to fail safe. Fix shape: `gh[sphour]_`.

### R2-N3 (LOW / by-design, new) — the cap is a member-controllable suppression lever

The cap keeps the **newest** 2000 entries by `created` (`notes_sync.py:210-214`).
Any member may annotate any item (the create validator does not check item access,
`main.py:1376-1442`), so a member can add 2000 junk notes to an item and push
another member's older entry — or an old tombstone — out of the repository
projection. Verified: an old live entry is dropped once 2000 newer entries exist;
its tombstone (`created` unchanged by deletion, same sort rank) is dropped with
it, so **no stale live text survives**. Firestore keeps every row and the
omission note is present, so this is repository-projection loss, not source-of-
truth loss. Worst-case file with maximum-size entries is **14 272 008 bytes
(~14.3 MB) per repo file** — bounded, but the cap is count-based, not byte-based.
Recorded as an accepted design tradeoff with a member-triggerable trigger.

## Round-2 attack table

| # | Attack | Setup | Observed | Verdict |
|---|---|---|---|---|
| R2-01a | Tombstone-only item | `NotesSync` with `[paper(deleted)]` | `delivered=1`, 1 commit, `## tombstone` + quote in file | **CLOSED** |
| R2-01b | Live → delete replaces text | one `paper` note, commit, `replace(deleted=True)`, drain | before has live; after has `~~…~~` struck-through, no `> live` line | **CLOSED** |
| R2-01c | Route end-to-end | `POST`→drain→`DELETE`→drain via `create_app` | commit log on create and delete; tombstone replaces live | **CLOSED** |
| R2-03a | `_short_error` coverage | plant `ghs_`/`ghp_`/`github_pat_`/`eyJ`/`ya29.`/PEM×3 | all `boom [redacted] head` | **CLOSED** |
| R2-03b | Log + dead-letter + document | raising `put_file` with `ya29.`+PEM; `_job_from_document` with raw `last_error` | log `error=403 Bearer [redacted] and [redacted]`; doc `last_error` fully redacted | **CLOSED** |
| R2-04a | NUL/ESC/CR in comment+quote | render `quote\x00\x1b\rQ`, `comment="ok\x00…\x0dCR"` | NUL/ESC gone; **CR present** | **BYPASS** |
| R2-04b | CR via real route | `POST` comment `"A\x00B\x1b[31mC\x0dD"`, drain | committed file control bytes `['0xd']` | **BYPASS** |
| R2-05a | 2500 entries | render | 2000 blocks, 247 561 B, `(500 earlier entries omitted here; see My notes.)` | **CLOSED** |
| R2-05b | Boundary | 2000 / 2001 | no note / `(1 earlier entry omitted here; see My notes.)` | **CLOSED** |
| R2-05c | Worst-case size | 2000 max quote+comment | 14 272 008 B | **OBSERVED** |
| R2-B2a | kick only when enabled | `_kick_drain` enabled/disabled/`None` | 1 call / 0 calls / returns | **CLOSED** |
| R2-B2b | kick cannot raise | raising `drain` | `_kick_drain` returns; future logs raw `RuntimeError('…ya29…')` | **CLOSED (but R2-N4)** |
| R2-A | Tombstone intent routes nowhere | `destinations([question(deleted)])` | `{}`; full drain writes nothing | **REFUSED** (R2-N1 log defect) |
| R2-B | Live question + deleted paper | both in one item | file = paper tombstone; live question absent | **REFUSED** |
| R2-C | Omission note spoofed by content | comment = the omission sentence | `_` escaped (`\_(`), exact bytes not forgeable | **REFUSED** |
| R2-D | Cap drops a tombstone | old tombstone + 2000 newer | tombstone omitted, but its live text omitted in the same render | **OBSERVED** (no stale content) |
| R2-E | Very long single quote | 50 000-char quote | truncated to 2000 | **REFUSED** |
| R2-F | `MAX_ENTRIES_PER_ITEM` boundary | 2000 / 2001 | no note / singular note | **REFUSED** |
| R2-G | `section`/`slug` collision | two items differ only by `section`, same `source`+`slug` | second clobbers first (`notes_path` ignores `section`) | **BYPASS (unchanged, owner-specified)** |
| R2-N1 | False audit «commit» | question-only item drain | `delivered=1`, `commits=0`, `action=commit` logged | **BYPASS (new, low)** |
| R2-N2 | `ghr_` token | `_short_error("ghr_…")` | token returned verbatim | **BYPASS (new, low)** |
| R2-N4 | Kick future traceback | `drain` raises with `ya29.` in message | asyncio logs the raw exception | **BYPASS (new, medium)** |

Counts: 22 rows (R2-04a/R2-04b are the same defect, sampled twice) — **9 CLOSED,
5 REFUSED, 2 OBSERVED, 6 BYPASS rows**, i.e. **5 distinct new-or-remaining
bypasses**: R2-04 (CR), R2-G (section collision, unchanged/owner-specified),
R2-N1 (false commit), R2-N2 (`ghr_`), R2-N4 (unredacted kick traceback).

## Reproduction index (round 2)

| Pointer | Command |
|---|---|
| R2-01, R2-03, R2-04, R2-05, R2-A..G (unit) | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns-r2/probe_unit.py` |
| R2-01 route, R2-03 log/doc, R2-B2 (kick) | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns-r2/probe_routes.py` |
| R2-04 end-to-end CR through `POST /annotations` | `cd gate && .venv/bin/python /tmp/opencode/redteam-w6ns-r2/probe_cr_route.py` |
| Context (must-not-regress) | `cd gate && .venv/bin/python -m pytest` → `650 passed` |

## Disclosures / side effects (round 2)

None. No credential, secret, GitHub App, PAT, WIF provider or IAM binding was
created. No `git`/`gh` mutation; the only tracked file I changed is this handoff
section. No production endpoint was contacted: the probes drove `NotesSync`,
`render_item_markdown`, `_short_error`, `_job_from_document` and `_kick_drain`
directly, and `create_app()` with `Static*`/`Fake*` doubles. `git status
--porcelain` before writing this section showed only an uncommitted change to
`handoffs/skeptic-verifier-wave-6-notes-sync.md` made by a concurrent agent (its
own round-2 section); I did not touch that file.
