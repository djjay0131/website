# Security Tester — Wave 6 notes-sync (D18)

- **Role:** Security Tester (owns the gate; VETO on any FAIL).
- **Wave / issue:** Wave 6, issue #107, decision D18, ADR-0022 (amended).
- **Branch:** `feat/annotations-sync` (head `f333a62`).
- **Date:** 2026-10-07.
- **Contract:** `contracts/adversarial-wave-6-notes-sync.md`; seams
  `contracts/wave-6-notes-sync-seams.md` (AN-SYNC-1..8).
- **Method:** test, not prose review. All probes ran against the in-memory
  fakes (`StaticExportQueue`, `StaticGitHubAppClient`, `StaticAnnotationStore`,
  `FakeVerifier`) and the real `TestClient`. No network, no key, no Cloud
  credential, no tracked-file change. Scratch: `/tmp/opencode/probe_notes_sync.py`,
  `/tmp/opencode/probe_extra.py`; gate venv
  `/home/djjay/code/website/gate/.venv`.

## Verdict

**No FAIL. No veto.** All eight owned checks PASS.

| # | Check | Result |
|---|---|---|
| 1 | Token/key never logged or returned; `_short_error` redacts | **PASS** |
| 2 | Routing is server-side; a client cannot steer a note to an unnamed repo | **PASS** |
| 3 | Path and commit-message injection refused | **PASS** |
| 4 | Content caps (create-time) and renderer bounds a corrupt oversized row | **PASS** |
| 5 | Never a commit to `main`; the branch is `notes` | **PASS** |
| 6 | IAM: only `secretmanager.secretAccessor` on the one secret; no key file; no project grant; secret not created by Terraform | **PASS** |
| 7 | Dormant mode makes no network call; routes behave as before | **PASS** |
| 8 | Wave-1 security properties still hold | **PASS** |

Regression baseline: `pytest gate/tests` → **643 passed** (gate only; no
`site/dist-*` build).

---

## Check 1 — token/key never logged or returned — PASS

**Probe.** (a) `_short_error` on a poison string carrying an installation token,
an App JWT and a fine-grained PAT; (b) a `NotesSync` whose `put_file` raises an
exception containing `ghs_FAKEINSTALLTOKEN0123456789` and
`eyJhbGciOiJSUzI1NiJ9.FAKESIGNATURE.FAKESIGNATURE`; drive the create route
(so the row wires `notes_sync`), then `drain(now=first+25h)` to force the
dead-letter branch while capturing every record on the `gate` logger; then
`GET /annotations` and inspect the body and the `export` field.

```
[PASS] 1a _short_error ...: 'boom [redacted] [redacted] [redacted] trailing'
[PASS] 1b ...: delivered=0 logs_have_redacted=True
       export={'state': 'dead_letter', 'error': 'upstream 401: [redacted] [redacted]'}
```

**Result.** Token, JWT and PAT never appear in the log record or the response
body; the persisted `last_error` and the returned `export.error` both show
`[redacted]`. The credential never reaches a response.

**Residual (not a FAIL, not client-reachable).** `_notes_sync_loop`
(`main.py:1563`) wraps `sync.drain` in `logger.exception`, which does **not**
run `_short_error`. I confirmed a planted token in a `queue.due()` exception
would be logged raw (`probe_extra.py`, `loop-level traceback contains raw
token: True`). But `due()` reads only Firestore; every GitHub-credential path
(`install_notes_branch`, `get_file`, `put_file`) is inside the per-job `try`
and is redacted twice. So there is no reachable path by which a GitHub
token/key lands in that traceback. Recorded for defence-in-depth.

## Check 2 — routing is server-side — PASS

**Probe.** `NotesSync` over the real `site/notes-routing.json`
(`paper→soa-agentic-se`, `experiment`/`brainstorm→agentic-kg-research`,
`question→null`). Varied (a) intent, (b) hostile content that names a repo
(`see djjay0131/agentic-kg-research`, `repo=evil/evil`), (c) hostile identity
(`slug` = a repo name, `notes/../agentic-kg-research`, …), then inspected
`github.commits`. Separately, POSTed a body carrying `repo: "evil/evil"` and a
`routing` object and drained.

```
[PASS] 2 ...: all commits within named routing repos
create: 200
commits repos: {'djjay0131/soa-agentic-se'} -> PASS
bodies honored evil/evil: PASS
```

**Result.** Every commit lands in a repo the routing names for the entry's
intent; content, identity and an extra `repo`/`routing` body field cannot add a
destination. `parse_routing` is read only from server config
(`config.py:184`, `GATE_NOTES_ROUTING`); no request path feeds it.

**Observation (not security).** `parse_routing` reads `route.dir` but
`_write_job` (`notes_sync.py:799`) hardcodes the `notes` prefix and never uses
`route.dir`. That cannot be steered (owner config; client cannot set it), but
the configured `dir` is inert. For the Dissenter/Chief Reviewer.

## Check 3 — path and commit-message injection refused — PASS

**Probe.** (a) `notes_path` against `../x`, `..`, `.`, `/abs`, `a/../../b`,
`a\b`, `""`, `a//b`, newline, NUL, literal `..%2f`, and `../source`;
(b) HTTP create with hostile `slug`/`source`/`section`; (c) `commit_message`
with unsafe and newline-bearing identities.

**Result.** All refuse. `notes_path` returns `None` for every traversal /
absolute / empty / control-char / literal-percent identity; nested-but-contained
(`notes/x`) yields `notes/source/notes/x.md`, still inside `notes/`.
`commit_message("phd","s","../evil") == "notes: update item"`; a newline
identity collapses and never reaches the message. HTTP: all of
`slug_newline`, `slug_nul`, `../secrets`, `..%2fsecrets`, `/etc/passwd`,
`a\b`, `source=a/b`, `section=../secrets` return **400**.

**Overlong nuance.** `notes_path` itself has no length cap, so
`notes_path("source", "a"*600)` is non-`None`. The client-controlled seam
refuses it: `_annotation_fields` validates via `safe_prefix`
(`MAX_PATH_LENGTH=512`, `MAX_SEGMENTS=24`), so create returns **400** for a
600-char slug and for 30 segments. A corrupt queue row is the only way to reach
the drain seam with an overlong identity, and the character allowlist still
makes traversal impossible (GitHub would 422 a too-long path → retry/dead-letter,
never a write outside `notes/`).

## Check 4 — content caps — PASS

**Probe.** (a) HTTP create at/over each create-time bound; (b) feed the renderer
an `ExportEntry` with a 1,000,000-char quote, a 500,000-char comment and a
500,000-char member and measure the emitted lines.

```
[PASS] 4 ...: problems=[] raw=2000000 rendered=7458
       longest_line=5002 tomb_longest=2042
```

**Result.** Create refuses `exact=2001` (400), `comment=5001` (400),
`tags=11` (400), `tag=41` (400), `prefix=65` (400); accepts the exact boundary
(`exact=2000`, `tags=["t"*40]*10`); a body over 16 KiB returns 413. The
renderer bounds a corrupt row: quote ≤ 2000, comment line ≤ 5000, member ≤ 320;
the tombstone line is a bounded 2000-char quote plus a fixed suffix (2042), not
proportional to the input. `raw 2,000,000 → rendered 7,458`.

## Check 5 — never a commit to `main` — PASS

**Probe.** Fresh `StaticGitHubAppClient({soa:"main", research:"main"})` with
`main` seeded; drain an item with a `paper` and an `experiment` entry; inspect
`commits`, `branches_created`, and both `main` and `notes` SHAs. Repeated with
default branch `trunk`.

```
[PASS] 5 ...: branches_created=[('...agentic-kg-research','notes'),
       ('...soa-agentic-se','notes')] commit_branches=['notes']
trunk default: commits= [('djjay0131/soa-agentic-se','notes')] -> PASS
trunk main sha untouched: t-sha -> PASS
```

**Result.** The only branch created is `notes`, from the default branch's HEAD;
every commit is on `notes`; the default branch SHA is unchanged. `main` (and
`trunk`) are never written.

## Check 6 — IAM — PASS

**Probe.** `git diff main...feat/annotations-sync -- infra/` plus tree-wide
searches for key material and project-level grants.

```
infra files changed: infra/gate.tf  infra/notes-sync.tf  infra/variables.tf
+resource "google_secret_manager_secret_iam_member" "hub_gate_notes_export_key" {
+  secret_id = "notes-export-app-key"
+  role      = "roles/secretmanager.secretAccessor"
+  member    = google_service_account.hub_gate.member
project-level IAM additions? NONE
secret creation in TF?          NONE   (only *_secret_iam_member is declared)
.pem / *.key tracked anywhere?  NONE
variables added: only notes_export_enabled / notes_export_app_id / notes_export_installation_id
terraform fmt -check infra/{notes-sync,gate,variables}.tf -> exit 0
```

**Result.** The only added IAM is `secretmanager.secretAccessor` granted to the
gate SA on the single secret `notes-export-app-key`; there is no
`secretmanager.admin`, no `google_project_iam_*`, no `google_service_account_key`,
no key file, and no `google_secret_manager_secret` resource (Terraform does not
create the secret — owner hard stop 2 does, per the printed command). The
`gate.tf` additions are identifiers/config only (`GATE_NOTES_*`), never the key.
The two `.pem`/`admin` grep hits are inside explanatory comments, not
resources.

## Check 7 — dormant mode — PASS

**Probe.** (a) default `Dependencies` (`notes_sync=None`): run create/list/delete
with `socket.socket` and `socket.create_connection` replaced by raising stubs;
(b) `build_dependencies` with `RealGitHubAppClient`/`SecretManagerRestProvider`
monkeypatched to raise on construction, across three dormant configs.

```
[PASS] 7 dormant mode: no network, routes unchanged
       no network; create/list/delete unchanged; no export field
[PASS] all off: notes_sync=None
[PASS] enabled but no app id: notes_sync=None
[PASS] app id but disabled: notes_sync=None
```

**Result.** With the sync unconfigured the routes make no network call (a
raising socket proves it), create returns `{id, created}`, delete returns
`{status: ok}`, and the list row carries no `export` field — byte-for-byte the
pre-D18 behaviour. `build_dependencies` never constructs a real GitHub/Secret
Manager client when dormant, and a half-configured gate
(enabled-but-no-app-id, or app-id-but-disabled) also stays dormant.

## Check 8 — wave-1 properties still hold — PASS

**Probe.** Full gate suite plus targeted asserts on the live routes.

```
gate/tests: 643 passed
  test_annotations.py: 157 passed   test_notes_sync.py: 17 passed
  test_headers.py:     28 passed
[PASS] 8 wave-1 props: isolation, no-store, DELETE id, _payload SAMEORIGIN: all hold
```

**Result.** Cross-member isolation holds (a member's list never contains
another's quote; the owner's `?scope=all` enumerates but redacts the other
member's content). Every annotation response is `private, no-store`. A forged
DELETE id (`event=deny`, `%0aevent=deny`) is a 404 with a fixed value-free
line. A served `/p/_payload/...` document keeps `X-Frame-Options: SAMEORIGIN`.
Unchanged by the wave.

---

## Out-of-scope observation (NOT a veto — for the Dissenter / Chief Reviewer)

`destinations()` (`notes_sync.py:264`) drops deleted entries, and `_write_job`
returns early when the resulting `by_repo` is empty. Consequence: a **pure
soft-delete writes nothing**, so the previously committed *live* entry (with its
quote/comment) remains in the repository's `notes/` file instead of becoming a
tombstone; a delete whose only remaining entries route to a repo with no live
entry (e.g. delete the `experiment` note while a `paper` note lives) likewise
leaves that repo's old live content in place.

```
run([deleted paper])                     -> commits=[]
run([deleted experiment + live paper])   -> commits=[('...soa-agentic-se','notes/s/y.md')]
```

This contradicts AN-SYNC-1/3's tombstone guarantee and is a data-retention
concern, but it is not one of the eight checks this handoff owns (soft-delete /
tombstone semantics are assigned to the Dissenter in the contract). Flagged,
not vetoed.

## Attestation

- No git/gh commands mutated the repository; `git status` shows only new,
  untracked handoff files (this one and the other wave-6 agents').
- No tracked file was changed by this role; no `site/dist-*` build was run.
- No credential was created or used; probes are offline against fakes.
