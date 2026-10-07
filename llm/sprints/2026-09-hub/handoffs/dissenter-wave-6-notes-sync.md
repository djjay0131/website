# Handoff — `Dissenter`, Wave 6 notes-sync (D18)

Agent: Dissenter (independent; authored nothing in this wave)
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md`
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md` (AN-SYNC-1..8)
Design authority: ADR-0022 (amended, "Accepted" per D18; file `Status:` still
"Proposed"), issue #107
Repo: `/home/djjay/code/website` · branch `feat/annotations-sync` · HEAD reviewed:
`f333a62` (`feat(wave-6): gate commits annotations to a notes branch (D18)`)
Issue: #107

## Summary

I read the contract, the seams, ADR-0022, the gate/infra wave contracts, and the
implemented code: `gate/app/{notes_sync,annotations,main,config}.py`,
`gate/tests/test_notes_sync.py`, `infra/{notes-sync,gate,variables}.tf`,
`site/notes-routing.json`, and `site/scripts/export-notes.mjs` (the pre-existing
renderer the gate is said to mirror). Read-only commands only; I wrote no file
but this one and modified no tracked file; no git/gh write command was run.

**I raise nine objections. Two would block: B1 and B2.**

- **B1 (BLOCK).** A soft delete does **not** propagate when it removes the last
  routed live entry for a repo: `destinations()` skips tombstones, so
  `_write_job` returns before writing, and the repository keeps the deleted
  passage published. "Firestore is the source of truth; the repo is a projection
  that catches up" is false for exactly the case a member cares about (delete).
- **B2 (BLOCK).** The transport's liveness premise is unimplemented and
  contradicts its own contract. ADR-0022/contract require "every gate request
  opportunistically kicks a drain"; nothing kicks a drain on request, and the
  only drain is a 15 s `asyncio` loop under `cpu_idle = true` / `min = 0`. With
  no in-flight request there is no CPU, so "near real time" rests on a later
  request happening to resume the timer — or on a Cloud Scheduler that does not
  exist.

The remaining seven are should-fix/note: the branch-vs-PR and commit-on-save
surprise (a frozen, never-rebased `notes` branch; tombstones permanent in
history); the file path that omits `section` and ignores `route.dir`, colliding
two items onto one path and diverging from the site renderer's layout; the
credential blast radius (installation token is whole-repo Contents:write, the
"never main / Markdown-only" bounds are code not credential, and the gate is
`allUsers`); App id / installation id as unvalidated plain env vars (a permanent
misconfiguration is retried 24 h, shown only as `pending`); plan-time routing
duplication into an env var with two divergent parsers and an unused `dir`;
per-row queue reads coupling `GET /annotations` availability to Firestore; and
dead-letter cleanup/visibility gaps.

Objection table. "Block?" means block the Wave 6 notes-sync exit/merge.

| # | Objection (claim) | Severity | Block? |
|---|---|---|---|
| **B1** | Last live routed entry deleted ⇒ repo never regenerated; the deleted passage stays published | BLOCK | **Yes** |
| **B2** | Drain model has no request-time kick and no scheduler; `cpu_idle`/`min=0` means it may never run | BLOCK | **Yes** |
| **D1** | `notes` branch is frozen at creation and never rebased; commit-on-save writes every intermediate state into history, tombstones included | should-fix | No |
| **D2** | `notes_path` omits `section` and ignores `route.dir`; two items collide, and the gate diverges from `export-notes.mjs` layout | should-fix | No |
| **D3** | Repo write credential is whole-repo Contents:write on an `allUsers` service; "never main"/"Markdown only" are code invariants, not credential bounds | should-fix | No |
| **D4** | App id / installation id are unvalidated plain env vars; a mismatch is a permanent error retried 24 h and shown as `pending` | should-fix | No |
| **D5** | Routing duplicated into `GATE_NOTES_ROUTING` at plan time; two parsers (`INTENTS` vs `_INTENTS`), `dir` accepted but unused, no cross-parser test | should-fix | No |
| **D6** | `GET /annotations` does a queue read per row; a Firestore blip 500s the whole list | should-fix | No |
| **D7** | Dead-letter has no cleanup or re-drive; a delete-only dead-letter is invisible on My notes (deleted rows are hidden) | note | No |

---

## Objections

### B1 — A soft delete of the last routed entry never reaches the repository · BLOCK

**Claim.** The seam says "the file is regenerated from Firestore each time, so it
always reflects the current non-`question` entries … with tombstones for deleted
entries", and ADR-0022 says "Firestore remains the source of truth; the
repository catches up." Neither holds for the deletion path.

`NotesSync._write_job` computes its destination set with
`destinations(entries, routing)` and **returns early when that set is empty**
(`gate/app/notes_sync.py:782-785`). `destinations()` **skips tombstones**
(`notes_sync.py:261-273`, `if entry.deleted: continue`) and skips `question`.
So if the only entry routed to a repo is deleted (one note on an item, or the
last `paper`/`experiment`/`brainstorm` note), the set is empty:

1. On `DELETE /annotations/{id}` the route soft-deletes and enqueues
   (`gate/app/main.py:963-964`).
2. At drain, `all_for_item` **does** return the tombstone
   (`gate/app/annotations.py:333-343`), but `destinations()` drops it.
3. `_write_job` returns before `install_notes_branch`/`get_file`/`put_file`
   (`notes_sync.py:786-812`), so the repo file is never touched.
4. The repository still contains the live entry and its **quoted passage** — the
   exact text the member deleted to remove.

This also applies per-repo with mixed intents: delete all of an item's
`experiment` entries but keep a `paper` one, and the `agentic-kg-research` file
is never regenerated, so the deleted `experiment` entries stay live there while
the `soa-agentic-se` file is correctly updated.

**Why it is a design objection, not a bug-fix request.** The design chose
"regenerate the whole file from Firestore" *as* the append-only mechanism and
chose tombstone emission *as* the delete semantics (AN-SYNC-3). The gating
condition ("only write if some live entry routes here") is not in the seam; it is
the mechanism silently defeating the semantics. The design's own safety story
("never silently dropped") is violated in the one direction that matters:
content the member removed remains published.

**Evidence that would settle it.** A test with `entries=[paper, deleted=True]`
asserting the `soa-agentic-se` file is regenerated to the tombstone (or emptied)
and that `sync.drain` returns 1, not 0. A passing test of that shape would settle
it; today `test_destinations_group_by_intent_and_exclude_question_and_tombstones`
(`gate/tests/test_notes_sync.py:174-185`) asserts the exclusion that causes the
defect.

### B2 — The drain has no request-time kick and no scheduler; liveness is unproven · BLOCK

**Claim.** The gate wave contract requirement 6 says: "Enqueue on create and
delete after the Firestore write; **kick a drain (non-blocking) on each
request**; a startup background loop drains while warm." ADR-0022 §2 says "every
gate request opportunistically kicks a drain." The implementation does neither.

- The only drain call site is the lifespan background loop
  (`gate/app/main.py:1550-1565`), started only when configured
  (`main.py:376-384`). `_enqueue_notes_export` (`main.py:1539-1547`) only calls
  `enqueue`; it does not kick a drain, and no route does.
- The service is deployed with `min_instance_count = 0` and
  `cpu_idle = true` (`infra/gate.tf:262, 285`): CPU is allocated **only during
  requests**. Between requests the 15 s loop (`NOTES_SYNC_POLL_SECONDS`,
  `main.py:186`) cannot progress; it can only be resumed by a request that
  happens to give the event loop CPU.
- The ADR's "recorded limitation" is about genuinely zero traffic
  (ADR-0022:121-124). The gap is larger: even with traffic, the request that
  enqueued the job does not wait for or trigger its drain, so delivery is
  deferred to whatever later request resumes the loop — unbounded in a quiet
  window, and unordered relative to the write the member just saw.

The design explicitly rejected a scheduler ("Cloud Scheduler ping … is the
follow-up") and rejected the owner-triggered workflow (D18). The result is a
"commits on save" transport whose "on save" is only true while some other
request is concurrently making the instance warm.

**Why BLOCK.** The contract states a required behaviour that is absent, and the
ADR's central promise ("notes reach the repository in near real time with no
manual step") is not established. This is a design decision (queue+warm worker
vs scheduler), which is precisely what this round asks the Dissenter to press.

**Evidence that would settle it.** Either (a) a scheduler (Cloud Scheduler →
an authenticated drain endpoint, or `min-instances=1`) with a recorded cost and
an IAM story for the invoker, plus a test that a job enqueued by a request is
attempted within the debounce window with no other traffic; or (b) a
request-time, non-blocking drain kick wired into the routes (matching contract
req 6) and a test that a create/delete triggers a drain on that same request.
Today a grep for `.drain`/`_notes_sync_loop` in `gate/app/` returns only the
loop.

### D1 — The `notes` branch is frozen at creation and commit-on-save writes every state into history · should-fix

**Claim.** `install_notes_branch` creates `notes` once from the default branch
HEAD and never rebases or re-points it (`gate/app/notes_sync.py:711-719`). The
owner "merges `notes` into `main` when he likes" (ADR-0022). Once merged, `main`
advances while `notes` stays at its creation base, so every future merge of
`notes` re-applies commits against a stale base — a recurring manual conflict,
not the "review and merge on their own schedule" the ADR describes. If the owner
deletes `notes` after merging, the next drain recreates it from the *new* default
HEAD, which is the only path that stays clean; nothing tells the owner to do
that.

Commit-on-save compounds it. A branch-per-PR would give the owner an
approve/reject gate per export and leave `main` authoritative; instead every
debounced edit is a commit, and a soft delete is a commit that **re-writes the
deleted quote as a tombstone** (`_tombstone_block`, `notes_sync.py:174-186`,
emits `~~{quote}~~`). The design intends the tombstone to be a visible record;
the consequence is that a member's "delete" never removes the passage from the
repository or from git history, and once the owner merges `notes`, it is
permanent in `main`. That is a materially different privacy promise from "delete".

**Evidence that would settle it.** A written decision on the branch lifecycle:
does the owner merge-and-delete `notes`, or is it never merged? Plus a stated
position on whether a tombstone may carry the deleted `quote` (the seam says it
does, AN-SYNC-3) and whether "delete" is expected to remove published content —
with the ADR naming the git-history persistence as accepted. A PR-based
alternative would need Pull-requests:write on the App and is a design fork worth
recording even if rejected.

### D2 — Path omits `section` and ignores `route.dir`; items collide and the gate diverges from the site renderer · should-fix

**Claim.** Two independent problems in the file identity:

1. **Collision.** `notes_path(source, slug)` returns
   `notes/<source>/<slug>.md` (`gate/app/notes_sync.py:101-108`) — it does **not
   include `section`**, even though item identity is the triple
   `(section, source, slug)` and `job_id` hashes all three
   (`notes_sync.py:85-87`). Two jobs (`job_id` differs) can therefore target the
   same repo path (two sections, same `source`+`slug`); each drain overwrites the
   other's file, and every subsequent edit ping-pongs. The design says "one file
   per annotated item" (AN-SYNC-3); the path does not guarantee it.
2. **`dir` is dead and the layout diverges.** `parse_routing` accepts and
   validates `route.dir` and the file carries `DEFAULT_ROUTING_DIR = "notes"`
   (`notes_sync.py:45, 251-257`), but `_write_job` hardcodes `notes_path`, which
   begins `"notes"`. Change the route `dir` and the gate ignores it. Meanwhile
   the pre-existing `site/scripts/export-notes.mjs` writes
   `<repo>/<dir>/<section>/<source>/<slug...>/<note-id>.md`
   (`noteOutputPath`, `site/scripts/export-notes.mjs:128-147`) — a different tree
   (includes owner/name as directories, `dir`, `section`, and one file per
   *note*, named by note id). Enabling both produces two layouts for the same
   notes in the same repositories.

**Evidence that would settle it.** A test with two items sharing
`(source, slug)` and differing `section` asserting distinct repo paths; and a
written decision that the gate's `notes/<source>/<slug>.md` (one file per item)
deliberately supersedes the local renderer's `<dir>/<section>/<source>/<slug>/<id>.md`
(one file per note), with `route.dir` either honoured or removed from parsing and
from the routing file. Today `route.dir` is parsed and never read.

### D3 — The repo credential is whole-repo Contents:write on an `allUsers` service · should-fix

**Claim.** ADR-0022 bounds the new blast radius as "Markdown and the branch is
never `main`" (ADR-0022:114-128). Neither bound is enforced by the credential.
A GitHub App installation token with **Contents: Read and write** can write **any
branch of any repo the installation covers**; GitHub cannot scope a token to one
branch. The `notes`-only / never-`main` property is an invariant of
`NOTES_BRANCH = "notes"` in the gate code (`notes_sync.py:44, 780-812`),
not of the token. And the credential holder — `hub-gate` — is the service whose
invoker is deliberately `allUsers` (ADR-0004, `infra/gate.tf`), so a code
execution or dependency compromise that reaches the drain path can write
arbitrary content to arbitrary branches of both repositories. That is a wider
radius than the ADR's "bounded by the App installation and a one-hour token"
phrasing implies. Separately, the App private key is a second repo-write
credential now readable by that same SA via `secretAccessor`
(`infra/notes-sync.tf:24-29`) — correctly scoped to the one secret, but it is the
same blast radius.

Two smaller credential observations: `_token()` re-reads the secret from Secret
Manager and re-mints an installation token on **every** API call
(`RealGitHubAppClient._headers` → `_token`, `notes_sync.py:580-604`), so one job
generates several Secret Manager accesses plus several token mints, with no
caching for the ≤1 h life; and `infra/gate.tf:153` still asserts "There is no
secret" while `hub-gate`'s description says it "has no keys".

**Evidence that would settle it.** A written, D-numbered acceptance of the
whole-repo write scope (since branch scoping is not expressible), naming the fact
that `notes`-only/never-`main` is a code invariant an attacker with execution
would not honour; plus a decision on installation-token caching within its TTL.
A comment correction in `infra/gate.tf` for the "no secret" claim, and a
description update for `hub-gate`.

### D4 — App id / installation id are unvalidated env vars; a permanent error is retried 24 h and shown as `pending` · should-fix

**Claim.** The App id and installation id are plain identifiers, not secrets, so
plain env vars are the right *storage* (ADR-0022 §1; `infra/gate.tf:311-338`).
The design objection is the **failure handling**: startup validates only that
they are non-empty (`build_dependencies`, `gate/app/main.py:268-287`) and
`parse_routing` fails boot loudly on bad routing. Nothing validates that the App
id, installation id, secret, and the two repos are mutually consistent. A wrong
App id or installation id produces an HTTP 401/403/404 from GitHub — treated as
any transient failure by `drain` (`notes_sync.py:770-777`) — so the gate retries
with backoff for **24 hours** before dead-lettering. During that entire window
`state_for` reports `{"state": "pending"}` (`notes_sync.py:429-440`), which is
indistinguishable from a job queued seconds ago; no attempt count or last error
is surfaced until the 24 h mark. Contrast the routing path, which fails at boot.

**Evidence that would settle it.** A startup (or first-drain) validation that
mints one installation token and fails fast/loud on 401/404 rather than
retrying; and a `state_for` that surfaces `attempts`/`last_error` (or a
`"retrying"` state) before dead-letter, with a test asserting a permanently-401
client is surfaced promptly. A D-decision that silent 24 h retry of a
misconfiguration is intended would also settle it.

### D5 — Routing is copied into an env var at plan time; two parsers, an unused `dir`, and no cross-check · should-fix

**Claim.** `site/notes-routing.json` is declared the single source of truth, and
`infra/notes-sync.tf` reads it with `file("../site/notes-routing.json")` into
`GATE_NOTES_ROUTING` (`locals.notes_routing_json`). This is duplication in two
senses the seam does not acknowledge:

1. **Plan-time, not deploy-time.** The JSON is baked into the gate's revision at
   `terraform apply`. Editing the site file and deploying the site does **not**
   change the gate; routing changes require an infra apply. The two can drift
   silently between applies — the opposite of "one source".
2. **Two parsers, one file.** The gate's `parse_routing` requires the four
   intents in `_INTENTS` (`notes_sync.py:56, 228-258`) and accepts `dir`; the
   site's `parseRouting` uses `INTENTS` and `isSafeRelativeDir`
   (`site/src-private/lib/annotations.mjs:45, 673-715`). They must be kept in
   step by hand; no test asserts the two agree on the shipped file. And the
   gate's parser is the wrong shape for what it does: `dir` is validated then
   discarded (D2), so the routing the gate *applies* is only `intent → repo`.
3. **Ordering/edge semantics.** The gate requires every intent present and treats
   a malformed file as a boot error; the site parser's behaviour on a missing
   intent is not asserted equivalent. An intent added on one side and not the
   other is a silent divergence.

**Evidence that would settle it.** A contract test that runs both parsers over
`site/notes-routing.json` and asserts identical `intent → (repo, dir)` maps, plus
a D-decision on whether routing lives in Terraform-applied config, a dedicated
config asset (Secret/Parameter), or a gate-read file; and either honour `dir` or
remove it from both parsers and the file. If plan-time baking is intended, the
ADR should say routing is an infra-plane artifact, not a site-plane single
source.

### D6 — Per-row queue reads couple the annotations list to Firestore · should-fix

**Claim.** `GET /annotations` builds each row with
`sync.state_for(section, source, slug)`, which does a Firestore document `get()`
per row (`gate/app/main.py:910-918` → `notes_sync.py:429-440`). An owner
`?scope=all` listing N annotations issues at least N document reads plus the list
read. Worse, if the queue read raises (Firestore outage, permission blip), the
exception propagates out of `_row` to the generic handler and the entire list
returns 500 (`main.py:442-446`) — an export-queue outage takes down a read-only
feature unrelated to it. The seam only says the field is present; it does not
decide the failure mode of the read that fills it.

**Evidence that would settle it.** A test that `state_for` raising still returns
200 with the annotations (export omitted/`"unknown"`), and a decision on batching
(one queue query for the item set) vs N per-row reads. A recorded acceptance of
the N+1 cost and the availability coupling would also settle it.

### D7 — Dead-letter has no cleanup or re-drive, and a delete-only dead-letter is invisible · note

**Claim.** On exhaustion the job is flagged and **never deleted**
(AN-SYNC-2; `notes_sync.py:408-427`), so `notes_export/` only grows; `due()`
filters dead-lettered jobs but there is no retention, purge, or re-drive. The
stated recovery is "the owner can re-trigger by editing" (ADR-0022:126) — but
editing calls `enqueue`, which `set()`s `dead_lettered: False` and resets
`attempts`/`first_attempt` (`notes_sync.py:376-393`); there is no explicit retry
action. For a **delete-only** job there is no live note to edit, and
`list_for`/`list_all` hide deleted rows (`annotations.py:310-331`), so the item
has no row on My notes at all — the dead-letter flag **cannot be shown**, despite
AN-SYNC-5's "My notes must show it". That is the same deleted-row visibility gap
as B1, now applied to the failure surface.

**Evidence that would settle it.** A visible retry affordance (or an owner route)
that works for a delete-only item, plus a documented retention/purge for
dead-lettered jobs. A test asserting a delete-only item that dead-letters is
observable somewhere would settle the visibility half.

---

## Cross-cutting note on record truth

Three shipped comments now assert the opposite of the code, which matters because
this wave's own reviewers rely on them:

- `infra/gate.tf:153` — "roles/secretmanager.\*. There is no secret." is false
  after `infra/notes-sync.tf`.
- `gate/README.md:86-87` — "the gate does no rendering or routing" is false after
  `gate/app/notes_sync.py`.
- ADR-0022's `Status:` line is still `Proposed` while both wave contracts and the
  seams call it "Accepted (amended)". The ADR explains this as a mechanical
  follow-up; the Chief Reviewer should confirm the flip and the index row land in
  the same PR, as the contract requires.

## Evidence run

Read-only: `git show --stat f333a62`; `grep`/read over `gate/app`, `gate/tests`,
`infra`, `site/scripts/export-notes.mjs`, `site/src-private/lib/annotations.mjs`,
`site/notes-routing.json`, the ADR and all four contracts. No test suite was run
(the round is design-level); no git/gh write, no fix applied.

## Related docs

- `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md`
- `llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md`
- `llm/sprints/2026-09-hub/contracts/{gate,infra}-wave-6-notes-sync.md`
- `llm/governance/adr/0022-annotation-export-transport.md`
- `site/scripts/export-notes.mjs`, `gate/app/notes_sync.py`
