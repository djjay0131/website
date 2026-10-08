# Handoff — Chief Reviewer, Wave 6 notes-sync (D18, #107)

Stream: Chief Reviewer (authored nothing in this wave; this handoff is its only write)
Wave: 6b — notes sync (gate commits on save)
Branch: `feat/annotations-sync`, HEAD `3198e64` (4 commits ahead of `main`)
Date: 2026-10-08
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md` §Chief Reviewer
Seams: `llm/sprints/2026-09-hub/contracts/wave-6-notes-sync-seams.md` (AN-SYNC-1..8)
Design authority: issue #107; **ADR-0022 (amended on D18; `Status:` still `Proposed`)**
Roster / gate: `llm/plans/2026-10-01-completion-brief.md` §5, §6, §7

**VERDICT: Comment — zero must-fix, merge is unblocked.** The implementation
matches the seams and ADR-0022 (amended); the two owner hard stops are the only
credential steps and are clearly printed; and the D18 records (STATE, ADR-0022,
memory bank) land in this same PR. Every Round-2 closure claim (`99b2c99`) is
verified in the code. The findings below are advisory: one real seam deviation
(the debounce lower bound is not enforced in production wiring), one imprecise
record, and several recorded tradeoffs. None is a safety, security or
correctness block.

Read-only. I wrote no tracked file but this one and ran no git/gh/gcloud/
terraform/firebase mutation. I read the committed tree, ran the gate suite, the
governance `--layout` check, `terraform fmt -check` and `terraform validate`, and
small `python -c` probes (no scratch file, no network). No credential created; no
remote contacted.

**Governance level: L2** — implementation plus an ADR body amendment; the gate
route/IAM surface is L2, `infra/**` and `gate/**` are L0-deny-listed, `llm/**` is
links-only in the allowlist. No L3: no private content reaches the public path,
no long-lived credential is introduced, and no satellite scope changes.

---

## What I verified rather than accepted

- **Seam mapping (AN-SYNC-1..8).** Trigger/debounce (`main.py:850-855`, `:969-970`
  after the Firestore write), soft-delete tombstone (`annotations.py:326-347`),
  queue shape and `backoff(n)=min(60·2^(n-1),3600)` (`notes_sync.py:83-89`,
  `:390-529`), `notes/<source>/<slug>.md` from the default HEAD, never `main`
  (`notes_sync.py:44,108-115,742-750,845-855`), App JWT→installation token and
  Secret Manager via ADC (`:590-692`), dormant default (`:779-795`,
  `main.py:268-294,371-384,1540-1596`), and the dead-letter flag on
  `GET /annotations` (`main.py:909-925`). I found one deviation (advisory 1) and
  two nit-level shape mismatches (advisory 6).
- **The two owner hard stops are the only credential steps and are clearly
  printed.** Step 1 creates the App on exactly the two repos with Contents:
  write and reports App id + installation id; step 2 is the exact `gcloud secrets
  create notes-export-app-key --project=cusati-hub --replication-policy=automatic`
  plus `gcloud secrets versions add … --data-file=…` (STATE.md:3822-3838,
  `infra/notes-sync.tf:5-17`, ADR-0022:80-91, seam AN-SYNC-8:107-115). No third
  credential step exists: `terraform apply` consumes identifiers only, and the
  gate SA's `secretAccessor` is granted by Terraform.
- **Records land in the same PR.** STATE.md §Wave 6b (`:3757-3850`), ADR-0022
  amended (`:1-162`), `llm/governance/adr/README.md` index row (`:36`), and the
  memory bank (`activeContext.md`, `progress.md`) are all in this diff.
- **The `adr-status` deferral reasoning is correct.** `checkAdrStatus`
  (`governance-checks.mjs:405-416`) fails any *changed* ADR whose Status line
  changed together with any other changed line. Amending the body and flipping
  `Proposed→Accepted` in one PR would therefore FAIL; a status-line-only
  (`L0` allowlist `llm/governance/adr/[0-9][0-9][0-9][0-9]-*.md`, delta:141) plus
  `index-table-rows` follow-up is the only green choreography. The ADR carries a
  prominent status note (`0022:8-12`). `adr-status` is green here.
- **Round-2 closure claims (`99b2c99`), each reproduced against the tree:**
  - **R2-04 (CR).** `_CONTROL = [\x00-\x08\x0b-\x1f\x7f]` now spans `\x0d`
    (`notes_sync.py:58`); probe `escape_markdown("A\x00B\x1bC\x0dD") == "ABCD"`,
    and `test_renderer_strips_control_characters_from_a_comment`
    (`test_notes_sync.py:377-388`) asserts `"\r" not in text`. **CLOSED.**
  - **R2-N1 (false commit log).** `_write_job` returns an int
    (`notes_sync.py:821-857`); `drain` logs `action=commit repos=N` only when
    `wrote` is truthy, else `action=noop` (`:799-810`). **CLOSED** (advisory 5:
    no committed log assertion).
  - **R2-N2 (`ghr_`).** `_TOKEN_PATTERN` is `gh[sphour]_` (`:346-351`); probe
    returns `[redacted]`. **CLOSED** (advisory 5).
  - **R2-N4 (kick traceback).** `drain` catches `due()` (`:791-795`) and
    `_kick_drain` runs its future through `_safe_drain`, which catches and logs
    via `sanitize_error` (`main.py:1557-1578`). The un-awaited future can no
    longer carry an exception. **CLOSED.**
- **Dormant-mode guarantee holds.** `build_dependencies` wires `notes_sync=None`
  unless enabled AND app id AND installation id (`main.py:268-294`); `enqueue`/
  `drain` gate on `_enabled` (`notes_sync.py:779-795`); the lifespan task starts
  only when configured (`main.py:376-384`); and the list path skips
  `state_for` when `sync is None`. `test_disabled_sync_is_a_noop` passes; the
  Security Tester's raising-socket probe is consistent with the code. **No
  network in dormant mode.**
- **"Never commits to `main`" holds.** The only commit ref is `NOTES_BRANCH`
  (`notes_sync.py:44,845-855`); `install_notes_branch` creates `notes` from the
  default HEAD and returns early if it already exists (`:742-750`). There is no
  code path that passes `main`/`master`/`develop`/`trunk` to `put_file`.
- **IAM is exactly one secret-scoped accessor.** `google_secret_manager_secret_
  iam_member` on `notes-export-app-key` only (`infra/notes-sync.tf:23-29`); no
  `google_secret_manager_secret`, no project-level grant, no key resource, no
  `.pem` tracked. `terraform fmt -check` and `terraform validate` both pass.
- **Suites (this review, at `3198e64`).** `gate/.venv/bin/python -m pytest` →
  **652 passed** (26 in `test_notes_sync.py`); `ruff check` clean; `governance-
  checks.mjs --layout` → **4/4 PASS**. Working tree clean.
- **No `main` commit, no credential leak, no scope escape** in the diff
  `main...HEAD`: only `gate/**`, `infra/**`, `llm/**` (the handoffs), as the
  Regression Tester recorded.

## Must-fix

**None.** I attempted to falsify the closure claims, the dormant guarantee, the
never-`main` guarantee, the two-owner-steps-only claim, and the adds-only plan,
and found no block. In particular:

- The IAM binding referencing a secret Terraform does not create is **correct and
  intended**: `secret_id = "notes-export-app-key"` is a name reference, the
  resource is a new entry (so `terraform plan` does not refresh a nonexistent
  secret), and the apply ordering is the documented owner step 2. No
  `depends_on` is needed if the owner follows the printed order (advisory 7).
- The plan "adds only" claim is met in the binding sense that matters:
  **0 destroy / 0 replace**; §7 permits an in-place change. STATE records it
  honestly as `1 to add, 1 to change, 0 to destroy/replace` (advisory 2 is the
  wording only).
- The `section`/`slug` collision (RT6NS-02 / R2-G) is **acceptable and does not
  block**, but the recorded rationale needs a correction (advisory 3).

## Advisory

1. **The debounce lower bound is not enforced in production; the tested clamp is
   dead code (real seam deviation, one-line fix).** AN-SYNC-1 requires
   `GATE_NOTES_EXPORT_DEBOUNCE_SECONDS` "inside 30–60". `debounce_seconds()`
   clamps to `[30,60]` (`notes_sync.py:78-80`) and is the function the Skeptic's
   row #1 proves fail-able, but production never calls it: `load_settings` uses
   `_positive_int(..., maximum=60)` (`config.py:185`), which accepts `1..60`, and
   `build_dependencies` passes that straight to `NotesSync` (`main.py:287`), which
   forwards it unclamped (`notes_sync.py:782`). **Repro:**
   `GATE_NOTES_EXPORT_DEBOUNCE_SECONDS=5 … load_settings().notes_debounce_seconds
   == 5` while `debounce_seconds(5) == 30`. Severity is low (owner-set env var,
   not client-controlled; default 45), but the seam bound is not enforced and the
   committed test guards a function production does not use. **Fix:** call
   `debounce_seconds()` in the wiring, or enforce `min 30` in config; add the
   config bound test.
2. **"Adds only" vs "1 to change" wording.** AN-SYNC-8:115 says the plan "must be
   adds only"; the recorded plan is 1 add + 1 in-place change (the gate Cloud Run
   env block, `infra/gate.tf:311-341`). The binding §7 rule is "no destroy or
   replace of a stateful resource", which holds (Cloud Run is stateless). Suggest
   STATE/ADR wording "no destroy/replace" rather than "adds only" so the two
   authorities agree.
3. **Section/slug collision — recorded acceptably, but the record is imprecise.**
   The seam (AN-SYNC-3:53) and ADR-0022:63 explicitly prescribe
   `notes/<source>/<slug>.md`, and for *legitimate* items `(source, slug)` is
   unique because the manifest contract enforces slug uniqueness within a
   source's manifest (`contract/manifest.schema.json:52-57`), so two real items
   never collide. A collision requires a **forged section**: annotation create
   validates syntax only, never item existence or access
   (`main.py:1376-1398`), a pre-existing ADR-0021 property. The effect is
   projection ping-pong on the repo (Firestore stays the source of truth), not a
   cross-member content leak. **Not a must-fix.** However STATE.md:3789's
   rationale — "`(source, slug)` is the item key; a member can only affect their
   own note's file, not another member's content" — is false in its second
   clause: a member can make a forged-section job overwrite a *different* item's
   repo file. Recommend amending that row to state the forged-section reachability
   and that it is accepted as a projection-only effect. (Optionally add `section`
   to the path in a follow-up; that would change the seam.)
4. **`enqueue` on POST/DELETE is not wrapped, so a queue-write failure 500s an
   already-successful annotation write.** `_enqueue_notes_export` is called
   unguarded at `main.py:850-855` and `:970`, after `annotations.create`/
   `soft_delete` has committed. A Firestore `notes_export` set() error then
   reaches the generic handler (`main.py:443-446`) and returns 500, so the client
   may retry and create a duplicate row. This is the write-side twin of Dissenter
   D6 (which was fixed to *degrade* on read, `main.py:913-917`). Suggest the same
   best-effort try/except for the write path; the queue is a projection, not the
   source of truth.
5. **R2-N1 and R2-N2 are code-fixed without a committed falsifier.** The `noop`
   log and the `ghr_` alternation (`notes_sync.py:346-351`, `:802-810`) have no
   by-name test; the redaction test feeds only `ghs_`/`ghp_`/`eyJ`/`ya29.`/PEM
   (`test_notes_sync.py:208-218`). Same class as the Skeptic's g-9, now closed
   for `ya29.`/PEM but not for `ghr_`. Add the two cases so the denylist cannot
   silently regress.
6. **Protocol/field shape deviates slightly from the seam text.** AN-SYNC-4:66-69
   names `installation_token()` and `head_sha(repo, ref)`; the shipped Protocol
   is `branch_sha` with a private `_token()` (`notes_sync.py:576-588`). AN-SYNC-2
   lists an `updated_at` queue field the writer never sets (`:407-424`). Neither
   is load-bearing; note them so the seam and code do not diverge silently.
7. **Terraform apply ordering is owner-enforced, not expressed.** If the owner
   enables the sync before creating the secret, the IAM-member create 404s and
   the Cloud Run env update may already have landed, leaving the gate enabled but
   unable to read the key (jobs retry→dead-letter — fail-closed, as documented).
   A `depends_on` cannot force the secret into existence; a precondition or a
   stated "create the secret, then apply" is the mitigation. The plan itself is
   not reproducible here (no cloud), consistent with RT6NS-19.
8. **Zero-traffic drain and dead-letter retention remain recorded limitations.**
   The per-request kick (`main.py:1557-1578`) fires immediately but a fresh job is
   not due until the debounce elapses, so prompt delivery still needs the warm
   loop; under `min=0`/`cpu_idle` a quiet window defers the write (ADR-0022:121-124,
   STATE D-B2). Dead-letter has no purge/re-drive, and a delete-only dead-letter
   is invisible on My notes (Dissenter D7). Both are honestly recorded; a Cloud
   Scheduler ping + a re-drive affordance are the follow-ups.
9. **Routing duplication / cross-parser drift remains open.** Routing is baked
   into `GATE_NOTES_ROUTING` at plan time (`infra/notes-sync.tf:32-34`) with two
   independent parsers (gate `parse_routing`, site `parseRouting`), and `route.dir`
   is parsed and then ignored (`notes_sync.py:45,272`; `_write_job` hardcodes
   `notes_path`). Dissenter D5/D2, recorded, no cross-parser test. A contract
   test running both parsers over `site/notes-routing.json` would settle it.

## UNVERIFIABLE (and what would settle each)

- **Live `terraform plan` (1 add / 1 change / 0 destroy).** No state/GCP here.
  Settled by the saved `-detailed-exitcode` plan referenced in STATE:3780-3782,
  or a plan run from `main` after the owner's hard stops.
- **The Cloud Run service update is in-place, not a replace.** Reasoned from
  `google_cloud_run_v2_service` env semantics; settled by the same plan output
  (no `# forces replacement`).
- **Secret Manager access under the gate SA.** Code (ADC `default()`) and the
  secret-scoped binding agree on inspection; not exercisable without cloud
  (RT6NS-19). Settled by one live drain after apply.
- **A real GitHub App token exchange / first live commit.** No App, no key, no
  network. Settled by the owner's two hard stops plus the first live drain.
- **`no-commit-on-main` against the real API.** Proven in the fake (branch
  `notes`, default SHA untouched) and by inspection; the real client only ever
  refs `NOTES_BRANCH`.

## Scope check (`git diff --stat main...HEAD`)

| Changed tree | Clause |
|---|---|
| `gate/app/{notes_sync,main,annotations,config}.py`, `gate/tests/test_notes_sync.py`, `gate/README.md` | gate-wave-6-notes-sync; AN-SYNC-1..7 |
| `infra/{notes-sync,gate,variables}.tf` | infra-wave-6-notes-sync; AN-SYNC-8 |
| `llm/governance/adr/0022*`, `adr/README.md` | the amended design authority |
| `llm/sprints/2026-09-hub/STATE.md`, `contracts/*`, `handoffs/*` | the D18 records and this round's reports |
| `llm/memory_bank/{activeContext,progress}.md` | §8 memory-bank close |

No changed file falls outside a contract's intent. `site/**` and `contract/**`
are untouched (Regression Tester, confirmed).

## Related docs

- `llm/sprints/2026-09-hub/contracts/adversarial-wave-6-notes-sync.md`,
  `contracts/wave-6-notes-sync-seams.md`,
  `contracts/{gate,infra}-wave-6-notes-sync.md`
- `llm/sprints/2026-09-hub/handoffs/{red-team,dissenter,skeptic-verifier,security-tester,regression-tester}-wave-6-notes-sync.md`
- `llm/governance/adr/0022-annotation-export-transport.md`,
  `llm/governance/adr/README.md`
- `llm/plans/2026-10-01-completion-brief.md` §5/§6/§7,
  `llm/governance/governance-delta.md` §Domain Review Questions,
  canon `review-checklist.md`
- `gate/app/notes_sync.py`, `gate/app/main.py`, `gate/app/config.py`,
  `gate/app/annotations.py`, `gate/tests/test_notes_sync.py`,
  `infra/{notes-sync,gate,variables}.tf`
- `llm/sprints/2026-09-hub/STATE.md` §Wave 6b

## ADR candidates

- **The status-line-only rule forces a two-PR choreography for any ADR that both
  amends its body and is accepted in the same change.** This is a governance
  usability candidate (not this wave's to decide): the `adr-status` check could
  distinguish a machine-readable `Accepted-on: D18` note from the `Status:` line,
  or the rule could be scoped to the L0 lane only, so accepting an ADR and
  amending its body can land together without a follow-up flip.
- **The notes-export path omits `section`.** No new ADR is needed while the seam
  prescribes it, but if a future wave returns to item identity, record whether
  the hub's item key is the triple `(section, source, slug)` or the pair
  `(source, slug)` — the current docs assert both.
