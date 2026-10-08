# Handoff — Skeptic Verifier, owner decision D19 (secrets-sync)

Status: Delivered
Date: 2026-10-08
Role: Skeptic Verifier (independent; authored nothing in this wave — break the
guards and report; **no fix applied**)
Branch: `feat/secrets-sync` (PR **#116**), head `c7e5ac3`
Authority under test: owner decision **D19** — all secrets are handled by a
GitHub workflow, never by a manual `gcloud` step
Contract: `llm/sprints/2026-09-hub/contracts/adversarial-d19-secrets-sync.md`
Design authority: `llm/governance/adr/0022-annotation-export-transport.md` §5
(amended on D19); pattern `llm/governance/patterns/secrets-management.md`

Read-only statement: I made **no** git/gh/gcloud/terraform **mutation** and
applied **no** infrastructure. I changed no tracked file but this handoff. All
breaking was done in scratch copies under `/tmp/opencode/skeptic-d19/`
(`falsify-*.yml`, `planroot/`, `bin/gcloud`); the committed workflow and
`infra/` were never edited, so "restore" is a no-op by construction. Read-only
commands: `git status`, `gh api` GETs, `python3`/PyYAML, `jq`,
`terraform show -json` (real state, read-only), and a scratch-mirror
`terraform init`/`plan`/`show` against the read-only GCS state (no apply, no
state write — `-lock=false`, `-out` under `/tmp`).

Under test (sha256):

```
.github/workflows/secrets-sync.yml   1a15cf1e310c108cbccab43b9037bc1bb4502c74bc065ced29115f176ba1f331
infra/secrets-sync.tf                6c2ccd90cac223b365edb8b4da05a82090e93ab749308935e5f69a3bbf3a8a4f
```

## Verdict

**No un-failable guard.** All six NEW guards were shown **red by name** with a
counterexample reproduced from the committed tree; none is vacuous. One nuance
the owner must see, not a reversal: the **no-op guard's literal clause** ("an
absent/empty key skips every credentialed step, including the `terraform` job")
**resisted falsification** — I could not make an *empty* `NOTES_EXPORT_APP_KEY`
produce `have_key=true`, and the `terraform` job is correctly gated. Its red is a
**fail-open on a present-but-invalid key** (whitespace), which is an input-
validation gap, not the headlined property. Every other guard (trigger, leak,
empty-version, allowed-origins, adds-only) was broken outright.

## Guard table — break → red-by-name → restored

| # | Guard | How I tried to break it | Red-by-name evidence | Restored |
|---|---|---|---|---|
| 1 | **No-op** (`steps.guard` → `have_key`, `secrets-sync.yml:90-100`) | (a) absent key; (b) empty string; (c) **whitespace-only**: `" "` and `" \t\n "`; (d) show the `terraform` job could run with the key absent | (c) **falsified**: `guard_check.py` → `case: single space … have_key_output='have_key=true'`; end-to-end through the stub the whitespace is written as a **new Secret Manager version** and the **real prior version is disabled** (`match=True`, `versions disable 41`) → self-inflicted outage. (a)/(b) held: `have_key=false`, `terraform` job `if` = `"needs.sync-secret.outputs.have_key == 'true'"` → False | no-op (falsify copies only) |
| 2 | **Trigger** (`secrets-sync.yml:45-52`) | Parse `on:` with PyYAML; then three scratch copies adding `pull_request`; adding `pull_request_target`+`workflow_run`+`issue_comment`; widening `push.paths` to `**` | Source **PASS** (`actionlint` clean): `on: {workflow_dispatch: null, push: {branches: [main], paths: [.github/workflows/secrets-sync.yml]}}`. Falsified: `falsify-pull_request.yml` → `FAIL trigger set is ['pull_request','push','workflow_dispatch']`; `falsify-multi.yml` → `dangerous trigger \`pull_request_target\`/\`workflow_run\`/\`issue_comment\` present`; `falsify-widepaths.yml` → `push.paths is ['**'], want ['.github/workflows/secrets-sync.yml']` | no-op |
| 3 | **Leak** (sync `run:` block, `secrets-sync.yml:116-165`) | Extract the block, run under a stub `gcloud` with a canary key in 4 scenarios (success, add-fails, create/enable, empty-version); assert canary never in stdout+stderr+argv+`$GITHUB_OUTPUT`. Then add `echo`; then add `set -x` | Real block **PASS**: 4/4 `leak=clean`, `sha_reached_file=True`, `temp_mode_600=True`, `residue=[]`. **Falsified**: `falsify-echo.yml` → leaked line `DEBUG KEY=LEAKCANARY_9f3a2b7c`; `falsify-xtrace.yml` → leaked line `+ printf %s LEAKCANARY_9f3a2b7c` | no-op |
| 4 | **Empty-version** (`secrets-sync.yml:142-151`) | Stub `versions add` returns empty (success, no name) while `versions list` reports the just-added `…/versions/42`; run as-is, then with the `if [ -z "${NEW_FULL}" ]` block removed | As-is **PASS**: `rc=1`, `disable calls: (none)` — aborts before the loop. **Falsified** (`falsify-noemptyguard.yml`) → `rc=0`, loop runs `secrets versions disable 40 …` **and** `secrets versions disable 42 …` → `new version 42 disabled by loop? True` | no-op |
| 5 | **Allowed-origins (MF-3)** (`secrets-sync.yml:260-271`) | Reconstruct `TF_VAR_gate_extra_allowed_origins` from live state with the real repo variables, then with `SITE_URL=""` (the A-11 residual) | Real vars **PASS**: `EXTRAS=["https://hub-gate-ywkmredngq-ue.a.run.app"]`, `AFTER == CURRENT`, `origins_same=true`. **Falsified**: `SITE_URL=""` → `BASE_DOMAIN=''`, `EXTRAS=["https://jason.cusati.us","…ywkmredngq…"]`, `AFTER` duplicates the site origin, `origins_same=false` | no-op |
| 6 | **Adds-only** (`secrets-sync.yml:281-291`) | tfvars-free scratch mirror + real vars → plan; then drop `TF_VAR_gate_extra_allowed_origins`; then feed the A-11 mis-derived value; compare `GATE_ALLOWED_ORIGINS` before/after | Real **PASS**: `Plan: 1 to add, 1 to change, 0 to destroy`; `BEFORE == AFTER` (`origins_same=true`); only `GATE_NOTES_APP_ID ""→id`, `GATE_NOTES_INSTALLATION_ID ""→id`, `GATE_NOTES_EXPORT_ENABLED 0→1`. **Falsified**: unset var → `AFTER` drops the hash origin (3→2); A-11 value → `AFTER` duplicates the site origin | no-op |

## Per-guard findings

**Guard 1 — no-op.** The test is pure emptiness (`[ -z "${NOTES_EXPORT_APP_KEY}"
]`, `secrets-sync.yml:95`) and GitHub resolves an unset repository secret to
`""`, so the intended fresh-install case is correct and the `terraform` job
cannot start on an empty key (`:172` gated on the `:78` job output). But the
guard does not distinguish a *malformed* key: a whitespace-only secret yields
`have_key=true`, every credentialed step runs, `printf '%s' "${KEY}"`
(`:126`) writes the whitespace into Secret Manager as a new version, and the
disable loop (`:154-163`) disables the real prior version. This is a
**fail-open availability** bug reachable only by a misconfigured secret (owner
action), not an exfiltration and not a break of the literal absent-skip clause.

**Guard 2 — trigger.** Source is `workflow_dispatch` + `push[main, paths=this
file]` only; no `pull_request`/`pull_request_target`/`workflow_run`/
`issue_comment`; `actionlint` clean. The parser flags each injected trigger by
name, so the check is sensitive, not vacuous.

**Guard 3 — leak.** The committed block never leaks the canary across four
execution shapes, and the value is provably delivered (sha match) to a `0600`
file removed with no residue. The harness is sensitive: a one-line `echo` or a
`set -x` makes it red. (Note: this guard tests the *block*; it cannot see other
workflows — the Red Team covered that separately.)

**Guard 4 — empty-version.** The `-z "${NEW_FULL}"` abort is load-bearing.
Without it, an add-success/output-empty return disables the just-added version
too (self-inflicted outage). Reproduced red exactly.

**Guard 5 — allowed-origins.** With the real repository variables
(`SITE_URL=https://jason.cusati.us`, `GCP_GATE_SERVICE=hub-gate`,
`GCP_GATE_REGION=us-east1`, provider number `410552878319`, read via `gh api`)
the reconstruction is correct and preserves the #62 hash origin. It is
**failable**: the reconstruction's base depends on `SITE_URL` exactly equalling
`https://<var.domain>`. With `SITE_URL=""` (or any different value) the domain
is not subtracted and the rendered origin list **duplicates** the site domain —
the A-11 residual the Chief Reviewer recorded (Round 3, `A-11`).

**Guard 6 — adds-only.** In a tfvars-free mirror of `infra/` (the repo's
`terraform.tfvars` and local state removed) with the workflow's exact `TF_VAR_*`
set, the targeted plan is `1 to add, 1 to change, 0 to destroy` and
`GATE_ALLOWED_ORIGINS` is **unchanged**; the change is exactly the notes env.
Falsifiable two ways (omitting the reconstructed var reverts the #62 origin;
the A-11 value duplicates it), which is precisely why MF-3 was needed.

## Assumptions

- "Break the guard" = produce a counterexample that makes the guard's protective
  property fail, or a scratch regression the guard's own check would catch. A
  check is "failable" if such a counterexample exists; "un-failable" only if no
  input/regression can turn it red.
- GitHub platform behaviour (unset secret ⇒ `""`; forks receive no secrets) is
  taken from documentation and cannot be exercised from this session; the guard
  scripts model it by setting/omitting the env var.
- The real `gcloud` is replaced by a stub for the leak and empty-version guards
  (no credentials); the stub verifies the data-file hash without printing it.
- The "adds-only" plan is read from the remote state via a scratch `init`/
  `plan` against the same GCS backend — read-only; no state object was written
  (`-lock=false`, plan saved under `/tmp`).
- The real repository variables are accepted as the owner-set ground truth
  (`gh api repos/djjay0131/website/actions/variables`, 14 variables) for guards
  5 and 6.

## Recommendations

1. **Harden the no-op guard against a non-empty-but-invalid key** (Guard 1). A
   cheap `grep -q 'BEGIN .*PRIVATE KEY'` (or a length/format check) before
   setting `have_key=true` would convert the whitespace fail-open into a red
   run, so a misconfigured secret never silently rotates the good one away.
2. **Make the origin reconstruction not depend on `SITE_URL` agreement**
   (Guard 5 / A-11): subtract the known `var.domain` default, or fail closed when
   `SITE_URL` is empty or does not match it, and add `SITE_URL` /
   `GCP_GATE_SERVICE` / `GCP_GATE_REGION` to the workflow header's owner/config
   notes (they are now load-bearing for `secrets-sync`).
3. **Keep the anti-regression checks as cheap tests.** The trigger parser and
   the canary harness are small and deterministic; they are worth committing as
   a scripted pre-merge check so a future edit to the workflow cannot silently
   drop the trigger scoping or reintroduce a print.
4. **No guard needs a code change to be "failable"** — the point of this round
   is that each *check* is sensitive; recommendations 1 and 2 are the two real
   control improvements the break surfaced.

## Alternatives

- **Accept the whitespace fail-open as owner-error.** Defensible: the secret is
  set by the owner only, and GitHub's masking means no leak. Rejected here only
  because the guard is named "is the key configured" and it currently answers
  yes for a non-key.
- **Validate the key cryptographically** (parse the PEM / exchange an
  installation token) instead of pattern-matching. Stronger, but it moves the
  check into the credentialed path; a format check at the guard is the cheap
  80%.
- **Derive the origin base from Terraform itself** (an output/`local`) rather
  than reconstructing it in shell — removes the `SITE_URL` coupling entirely.

## Risks

- **R1 (open, from Guard 1).** A whitespace/placeholder `NOTES_EXPORT_APP_KEY`
  silently becomes the live secret version and disables the prior good version;
  notes-sync breaks until re-dispatched. Availability, not disclosure.
- **R2 (open, from Guard 5 / A-11).** If `SITE_URL` is unset or changed, every
  `secrets-sync` dispatch appends a duplicate site origin to
  `GATE_ALLOWED_ORIGINS` (grows unbounded); if the value were ever dropped, the
  #62 hash origin is reverted (Guard 6 falsify A). Not live today
  (`SITE_URL=https://jason.cusati.us`).
- **R3 (inherent).** Guards 2 and 3 certify the committed block only; a merged
  edit to `main` is the acknowledged residual (the guards' sensitivity is what
  makes that detectable, not prevented).

## Open questions

- Q1. Should the no-op guard reject a non-PEM value (Recommendation 1), or is a
  whitespace secret purely an owner-error out of scope?
- Q2. Should the origin reconstruction harden against `SITE_URL` drift in this
  PR, or is A-11 accepted with the repo variable set?
- Q3. Is there value in committing the trigger parser + canary harness as a
  pre-merge job (and where — `ci.yml`)?

## Related docs

- `.github/workflows/secrets-sync.yml` (`:45-52` triggers, `:90-100` guard,
  `:142-151` empty-version, `:154-163` disable loop, `:235-271` supply step,
  `:281-291` plan/apply)
- `infra/secrets-sync.tf`, `infra/notes-sync.tf`, `infra/versions.tf`
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-d19-secrets-sync.md`
  (Round 3 `A-11`; MF-3), `{security-tester,red-team}-d19-secrets-sync.md`
- `llm/governance/adr/0022-annotation-export-transport.md` §5;
  `llm/governance/patterns/secrets-management.md`

## ADR candidates

- **C-D19-6** (carried from Chief Reviewer Round 3): a CI job that reconstructs
  an input from operator-machine configuration should derive it from the same
  source of truth the configuration uses (the `var.domain` default), not from a
  second variable that must be kept in exact agreement. Guard 5 is its red
  demonstration.
- **C-D19-7** (new): a presence guard should require the secret to be *valid*,
  not merely non-empty; "is it set" and "is it a key" are different questions,
  and conflating them turns a misconfiguration into a destructive rotation.

## Reproductions (scratch)

```
# Guard 2 — source PASS, then failable
python3 /tmp/opencode/skeptic-d19/trigger_check.py /home/djjay/code/website/.github/workflows/secrets-sync.yml   # PASS
for f in falsify-pull_request falsify-multi falsify-widepaths; do \
  python3 /tmp/opencode/skeptic-d19/trigger_check.py /tmp/opencode/skeptic-d19/$f.yml; done                      # FAIL x3

# Guard 1 — whitespace fail-open
python3 /tmp/opencode/skeptic-d19/guard_check.py   # single-space -> have_key=true

# Guard 3 — canary harness; red on echo / set -x
python3 /tmp/opencode/skeptic-d19/leak_check.py /home/djjay/code/website/.github/workflows/secrets-sync.yml   # PASS
python3 /tmp/opencode/skeptic-d19/leak_check.py /tmp/opencode/skeptic-d19/falsify-echo.yml                    # LEAK!!
python3 /tmp/opencode/skeptic-d19/leak_check.py /tmp/opencode/skeptic-d19/falsify-xtrace.yml                  # LEAK!!

# Guard 4 — empty-version
#   as-is: rc=1 / no disables ; falsify-noemptyguard.yml: rc=0 and "disable 42"

# Guard 5 — origin reconstruction
GCP_WIF_PROVIDER=projects/410552878319/... SITE_URL=https://jason.cusati.us \
  /tmp/opencode/skeptic-d19/origins_check.sh      # EXTRAS=[hash], origins_same=true
GCP_WIF_PROVIDER=projects/410552878319/... SITE_URL="" \
  /tmp/opencode/skeptic-d19/origins_check.sh      # EXTRAS=[site,hash], origins_same=false

# Guard 6 — adds-only, tfvars-free (scratch mirror planroot/infra has no terraform.tfvars/state)
terraform -chdir=/tmp/opencode/skeptic-d19/planroot/infra plan -refresh=false -lock=false \
  -target=google_secret_manager_secret_iam_member.hub_gate_notes_export_key \
  -target=google_cloud_run_v2_service.gate -out=/tmp/opencode/skeptic-d19/adds-only.tfplan   # 1 to add, 1 to change, 0 to destroy
#   GATE_ALLOWED_ORIGINS before == after ; unset / mis-derived var -> origin changes
```

No fix applied; no tracked file changed but this handoff.
