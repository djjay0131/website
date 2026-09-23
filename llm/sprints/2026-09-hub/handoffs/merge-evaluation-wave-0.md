ORDER DISPUTED — certified order is **#45 → #48 → #53 → (owner `terraform apply`, verified) → #47**

# Merge evaluation — Wave 0

Role: Merge Evaluator (read-only). Date: 2026-09-21.
Scope: every §8 condition **except** §7 security, which the Security Tester owns and which is
assumed nothing about here.
Evidence base: `main` at `f98a928`, PR heads `e8f6a25` / `1fb0bc2` / `3f1a58a` / `e776df3`.
No git, `gh`, cloud or Terraform mutation was made. Worktree left on `admin/wave-0-preconditions`.

---

## 0. The one fact that gates all four

**All four PRs are drafts** (`isDraft: true` on #45, #48, #47, #53). Nothing merges from a
draft, and marking ready is a `gh` mutation this contract forbids me. It is the first
owner-only step on every row of the table below, and it is not counted again per PR.

---

## 1. Governance level, derived from the diff

Canon: `agentic-governance llm/governance/governance-levels.md` — a mixed PR classifies at its
**highest** level; AI roles escalate up only; uncertainty takes the lowest plausible *semantic*
level.

| PR | Level from the diff | Why | Label | Body declares | Verdict |
|---|---|---|---|---|---|
| #45 | **L3** | Amends the design-authority document's status line (Phase 0–3 → 0–6) and its §8 rewrite list; retires roadmap assumption R-A3; defines Checkpoints 5–7; answers §10 Q3/Q4/Q6; records D8 private-by-default, which is a privacy/visibility default. Scope, prioritisation and privacy policy are L3 by the canon's own list. The two new ADRs and the ADR-0004 amendment are L1 underneath it. | `gov-L3` ✓ | **L2** ✗ | **Label right, body wrong.** The body under-declares by one level, against its own label. |
| #48 | **L2** | Astro 6.4.8 → 7.3.3 (a framework major, and the fix for a critical RCE and a base-path authorization bypass), `firebase.json` rewrite (deployment configuration), required-source enforcement, build scripts. | `gov-L2` ✓ | L2 ✓ | Match. |
| #47 | **L2** | A new state-changing route, a CSRF control, cookie handling, `.github/workflows/gate.yml` (CI behaviour). Security controls and auth are L2 by name. | `gov-L2` ✓ | L2 ✓ | Match. |
| #53 | **L2** | Cloud IAM on the gate's runtime identity, a new service account and two custom roles, CI guards, a workflow kill switch. | `gov-L2` ✓ | L2 ✓ | Match. |

**One open question on #48, recorded not resolved.** The Projects page title change
("Selected Projects & Research" → "Projects") is user-visible product wording decided by the
owner as **D7** — and D7 exists only in #45. Taken alone that string is arguably L3. It stays
L2 here because it *implements* an already-given owner decision rather than making one, but
that reading holds only if #45 lands first. It is the same defect shape as ADR-0013 and it
reinforces the same conclusion.

---

## 2. Mergeability

| PR | `mergeable` | `mergeStateStatus` | Behind `main` | Conflicts | Local head = remote |
|---|---|---|---|---|---|
| #45 | MERGEABLE | CLEAN | 0 | none | `e8f6a25` ✓ |
| #48 | MERGEABLE | CLEAN | 0 | none | `1fb0bc2` ✓ |
| #47 | MERGEABLE | CLEAN | 0 | none | `3f1a58a` ✓ |
| #53 | MERGEABLE | CLEAN | 0 | none | `e776df3` ✓ |

`main` has not moved since `f98a928`, so no branch is behind. Required status checks are
**non-strict**, so a branch need not be rebased to merge even after the first one lands.

**No two of the four touch the same file.** Verified by name: #45 is `llm/**` only; #48 is
`firebase.json` + `site/**`; #47 is `gate/**` + `.github/workflows/gate.yml`; #53 is `infra/**`
+ `.github/workflows/build.yml`. Every conflict risk in this wave is semantic, not textual —
which is exactly why the dependency section below matters more than this one.

---

## 3. CI — every check, and the ones that are absent

Every rollup below was confirmed to have run against the PR's **current** head SHA, not a
stale one.

### Required contexts on `main`
`governance-checks` and `budget-guard`, non-strict. `enforce_admins` off,
`required_approving_review_count` **0**. **All four PRs are green on both required contexts.**
`governance-checks --layout` also returns **4 of 4 PASS** run locally against #45's tree.

### #45 — 15 checks, 0 failing, 0 pending
`check`, `contract-tests`, `budget-guard`, `governance-checks`, `deploy-tools`,
`leak-check-self-test`, `build`, `build-firebase` — **SUCCESS**.
`deploy`, `firebase-deploy`, `private-sync`, `smoke-test`, `firebase-smoke-test`,
`notify-failure`, `notify-recovery` — SKIPPED (all correctly gated off pull requests).

### #48 — 15 checks, 0 failing, 0 pending
Identical set and identical outcomes to #45.

### #47 — 17 checks, 0 failing, 0 pending
Same as above, **plus** `gate / test` **SUCCESS** and `gate / build-and-deploy` SKIPPED.

### #53 — 16 checks, 0 failing, 0 pending
Same as #45, **plus** `private-bucket-live-iam` **SKIPPED**.

### Absent when it should have run

1. **#53 ran no gate test at all, and `infra/monitoring.tf` is guarded by nothing else.**
   `gate.yml` filters on `paths: ["gate/**", ".github/workflows/gate.yml"]`. #53 rewrites
   `infra/monitoring.tf` (+200 lines, three alert policies moved to
   `local.alert_notification_channels`, one new log metric, one new alert policy) — and the
   **only** guard on that file anywhere in the repository is
   `gate/tests/test_monitoring_contract.py`, which that filter excludes. #53's most
   security-relevant file was reviewed by no automated check. This is the mechanism behind
   issue #57 and it is the sixth instance of this sprint's defining defect: *a check that did
   not run is indistinguishable from a check that passed.*

   A precise correction to STATE's §8 note while I am here. STATE says "merging **#47 + #53**
   turns the gate suite red". Because of that same path filter, merging #53 alone does **not**
   turn `main` red — `gate.yml` does not run on a commit that touches only `infra/**`. It
   plants a latent failure that detonates on the *next* gate change. The effect is the same and
   the ordering conclusion is unchanged; the timing claim is wrong and would mislead whoever
   looks for the red run that never appears.

2. **#53's own live check never ran on #53.** `private-bucket-live-iam` is SKIPPED on pull
   requests by design (`wif.tf` admits `refs/heads/main` only). The job that exists to close
   #58 is therefore unexercised by the PR that introduces it. This is disclosed and reasoned in
   the workflow comments, not hidden — but it means the script's live path is first exercised
   on `main`.

3. **#47's sign-out smoke assertions have executed nowhere.** `gate / build-and-deploy` is
   skipped on PRs, so the three new `curl` assertions added to `gate.yml` (cookie set, `Max-Age=0`,
   cross-origin → 403) have never run. Confirms Skeptic Verifier U-2 and is directly
   load-bearing for the order dispute in §7.

4. **#45 and #48 ran no gate test either** — correct in both cases: neither touches `gate/**`.
   Recorded so the absence is not later read as a gap.

---

## 4. PR body against `.github/pull_request_template.md`

The template's required sections: Governance Level (**first**), Problem, Motivation, Summary of
Changes, Type of Change, Design Decisions, Tradeoffs / Alternatives Considered, Files Changed,
Data Security and Privacy Impact, Related Documents, Related Issues (`Closes #`), Related ADRs,
Memory Bank Updates, Review, Open Questions, Notes for Reviewer.

**Systemic, all four:** Governance Level is correctly the first section in every body ✓, and
the Data/Security/Privacy section is present and genuinely substantive in every body ✓ — it
answers the delta's three domain review questions rather than writing "none". But **no body
carries any of the three checkbox blocks** (Type of Change, Related ADRs, Memory Bank Updates),
none uses `Closes #` (all four write "Tracks #44" in prose), and none carries Problem,
Motivation, Tradeoffs, Related Documents, Open Questions or Notes for Reviewer as named
sections. That is one template gap repeated four times, not four oversights. The bodies are
strong narratives; they are not the template.

Per-PR, beyond the systemic gap:

- **#45** — Governance Level declares **L2** against an L3 diff and a `gov-L3` label (§1).
  The diff modifies `llm/memory_bank/activeContext.md`, so a Memory Bank Updates declaration is
  not optional bookkeeping here — the update is *included* and undeclared. Two ADRs are
  included with no Related ADRs block.
- **#48** — the **Verification block describes the wrong head.** It states "Nine files changed"
  and "`npm test` 210 passed / 1 skipped". The head `1fb0bc2` changes **16** files, and STATE's
  own astro record puts the corrected baseline at **241 passed / 1 skipped**. Both claims
  predate the astro commit. A reviewer checking the body against the diff finds a mismatch on
  the two numbers the body offers as proof.
- **#47** — the **most serious body defect of the four.** Under "Sign-out (SD-4)" it still
  reads: *"`Origin` is compared against the host the request was addressed to. No allowlist to
  drift."* That is the design commit `3f1a58a` **deleted** — precisely the forgeable
  header-against-header comparison the Security Tester broke three ways. The body now
  advertises the vulnerability as the shipped design and does not mention `GATE_ALLOWED_ORIGINS`
  anywhere, on the PR whose single most important change is that variable. Anyone reviewing from
  the body reviews code that is not there.
- **#53** — body is accurate to its head. "Closes nothing yet" is correct. It promises a
  required-check promotion (`contract-tests`, `leak-check-self-test`) that is **not in the
  diff** — correctly, since that is a branch-protection change, but the body does not say so.

---

## 5. Diff scope against each branch's FILE CONTRACT

| PR | Files | Contract(s) | Verdict |
|---|---|---|---|
| #45 | 47, **all** under `llm/**` | no stream contract; `llm/**` is Lead Architect's in every Wave 0 contract | **Clean** |
| #48 | 16 = `firebase.json` + 15 × `site/**` | `site-wave-0` (allows `site/**` + `firebase.json`); `site-wave-0-fixes` (narrows to `site/**`, explicitly forbids `firebase.json`) | **Clean.** `firebase.json` changed in commit `34b9bc7`, under the contract that granted it; the fixes commit `ab70dde` stayed inside `site/**` |
| #47 | 9 = 8 × `gate/**` + `.github/workflows/gate.yml` | `gate-wave-0` (allows both); `gate-wave-0-fixes` (**"you may NOT touch `.github/workflows/gate.yml` this time"**) | **Clean, and this one was a live risk.** Verified commit-by-commit: the fixes commit `3f1a58a` touches 7 files, **none of them `gate.yml`**. The workflow change is entirely in `d5b8d06`, under the contract that granted it |
| #53 | 10 = 9 × `infra/**` + `.github/workflows/build.yml` | `infra-wave-0` and `infra-wave-0-fixes` (both allow `infra/**`, `build.yml`, `ci.yml`) | **Clean.** `ci.yml` is granted and untouched — so the required-check promotion is genuinely absent rather than smuggled in |

**Nothing in any of the four PRs touches a path its contract excluded.** After a sprint in
which scope was contested repeatedly, that is worth stating plainly.

One governance gap found *inside* #45's own diff: `handoffs/site-astro-upgrade.md` lands with
**no matching file in `contracts/`**. Every other Wave 0 stream — all fourteen roles — has a
committed contract. The astro upgrade, which is the change that bumped a framework major and
closed Security check 6, is the one stream whose bounds are not in the repository. Same class as
B-7 / R-5 (the run brief is not a repository artifact), at a smaller scale.

---

## 6. Cross-PR dependencies

### 6a. `GATE_ALLOWED_ORIGINS` absent or empty — exactly what the gate does

Read from `gate/app/config.py` and `gate/app/main.py` at `feat/gate-signout@3f1a58a`.

**It fails closed, and it refuses every origin.** Specifically:

1. **The gate boots normally.** `allowed_origins` is deliberately *not* required at startup,
   unlike `GATE_PRIVATE_BUCKET` which raises `ValueError` and kills the revision. The reasoning
   is in the code: an unset bucket means the gate has nothing to serve; an unset origin list
   means one route cannot be used, and refusing to boot on it "would take the private area down
   to protect a nuisance-grade POST."
2. **It says so twice, loudly.** `create_app()` logs `event=boot logging=… allowed_origins=none`
   and then `logger.error("event=misconfigured setting=GATE_ALLOWED_ORIGINS effect=signout_refuses_every_request")`.
3. **`POST /session/end` returns `403 {"status":"forbidden"}` to every caller**, before any
   Origin parsing, logging `event=deny scope=signout reason=no_allowed_origins_configured` at
   ERROR. **No `Set-Cookie` on that path** — a refused caller cannot clear anything.
4. **`_same_origin()` returns `False` unconditionally** when the set is empty. There is **no
   header fallback**; the docstring is explicit that a fallback "is the same bug returning under
   a better name."
5. **A malformed value degrades to the same state.** `_allowed_origins()` drops anything
   `parse_origin()` rejects rather than guessing, so a typo silently shrinks the set — visible
   only in the boot line.

**Blast radius is one route.** `allowed_origins` is read by `/session/end` alone. `/p/**`
(the private area), `POST /session` (the only working sign-in flow) and `/client-events` do not
consult it. So:

> **#47 without #53-applied is a single-route outage, not a degradation and not a system
> outage.** Sign-out goes from *"works on the `run.app` URL only"* (today, because `main`'s
> `firebase.json` has no `/session/end` rewrite) to *"works nowhere"*. With #48 merged, the
> member sees it: `PrivateBase.astro` surfaces a failed sign-out in a visible `role="alert"`,
> deliberately, because "a member who believes they signed out and did not is worse off."

**And the merge order cannot fix it.** This is the point I think the §8 note misses. #53 is
**Terraform**. Merging it renders nothing — only `terraform apply` writes `GATE_ALLOWED_ORIGINS`
into the Cloud Run env block. STATE already established this in the B-5 correction and then did
not carry it into the sequencing: the dependency is #47 → #53 **applied**, not #47 → #53
**merged**. Merging #53 at step 4 leaves sign-out 403 until the owner applies.

It is also loud in CI, and in the worst possible order. `gate.yml`'s `build-and-deploy` job runs
`gcloud run services update` **and then** smoke-tests; #47 adds three assertions to that smoke
test, including *"a same-origin `POST /session/end` must return a cleared cookie"* and
*"a cross-origin one must return 403."* So merging #47 before the apply: deploys the revision,
**then** fails the job, leaves the broken revision live, and turns `main` red. That sequence is
what forces the order dispute in §7.

### 6b. #53's red `main` — which job, and what it reaches

**The job is `private-bucket-live-iam`**, new in `build.yml` (workflow `build-and-deploy`).

Its condition:
`(schedule || push || workflow_dispatch) && vars.GCP_PROJECT_ID != '' && vars.GCP_PRIVATE_BUCKET != ''`.
**Both variables are set on this repository today** (`cusati-hub`, `cusati-hub-private`,
confirmed against the Actions variables API). So the job runs on the **first push to `main`
after the merge**, and hourly thereafter on the existing `cron: "0 * * * *"`.

Its first step fails: `vars.GCP_AUDITOR_SA` does not exist — the repository has ten Actions
variables and none of that name. The step fails rather than skipping, deliberately and with the
reasoning written into the error message (#58). Once the variable **is** set and the apply has
created `hub-auditor`, the job then fails a **second** time, correctly, on the unremediated
`roles/editor` grant (#55). Both reds are the guards working.

**What it blocks — and this is the part that is not recorded anywhere:**

- **Structurally, nothing.** It is not a required context (required = `governance-checks`,
  `budget-guard`), and it appears in the `needs:` of no build or deploy job. The site and the
  gate keep deploying; no merge is blocked.
- **But it is in the `needs:` of both `notify-failure` and `notify-recovery`.**
  - `notify-failure` (`if: failure() && event != 'pull_request'`) opens the `ci-failure`
    tracking issue on the first main push, then **comments on it every hour** on the schedule.
  - `notify-recovery` requires `!contains(needs.*.result, 'failure')`. While this job is red,
    **the recovery signal for the entire pipeline is suppressed** — the `ci-failure` issue can
    never auto-close, *including for an unrelated outage that genuinely recovers*. The next real
    build failure and its recovery both land inside a permanently-open issue.

  That is the one consequence that reaches past its own signal, it is not in STATE, and it
  persists for as long as `GCP_AUDITOR_SA` and #55 are outstanding. Smallest mitigation if the
  window will be long: exempt this job from `notify-recovery`'s `needs:` so recovery still
  fires. Cleanest: set the variable and settle #55 in the same window as the merge.

### 6c. A third dependency nobody has named — two of them

**T1 — the `run.app` origin spelling. This is the one that bites, and no CI on either branch
can see it.**

- #53 renders the accepted set from the **project number**:
  `gate_allowed_origins = "https://${var.domain}, https://hub-gate-${project_number}.${region}.run.app"`
  → `https://jason.cusati.us,https://hub-gate-410552878319.us-east1.run.app`.
- #47's new smoke test sends `Origin: ${URL}` where `URL` comes from
  `gcloud run services describe … --format 'value(status.url)'` — **whatever Cloud Run actually
  answers with**.
- #53's own `gate.tf` records, in a comment, that **this project has both URL spellings live**
  and that the Wave 0 live probe reached the gate on the older
  `hub-gate-<hash>-ue.a.run.app` form.

If `status.url` returns the older spelling, that Origin is **not** in the rendered set →
`_same_origin()` → `False` → **403** → the smoke test fails → `gate.yml` is red on every gate
deploy, *after* the revision has rolled out. Neither PR can catch this: #47's deploy job is
skipped on PRs, and no Terraform is planned in CI. The remedy exists and is unused —
`var.gate_extra_allowed_origins` plus the `gate_allowed_origins_check_command` output — but
nothing sequences it. **It must be verified after the apply and before #47 deploys**, which is
the second reason for the order in §7.

**T2 — the Firebase Hosting default aliases are not in the accepted set.**

`local.gate_allowed_origins` names `var.domain` and the `run.app` origin, and deliberately
excludes `var.redirect_domains` (`research.cusati.us`) — that exclusion is **correct**, those
hosts answer a 301 so a browser never POSTs from one. But the Hosting site's **own** aliases are
a different thing:

- STATE records the Hosting site as `cusati-hub.web.app`, with `jason` and `research` CNAME'd
  onto it.
- Red Team **A-6** confirmed live that the site is reachable on *"both Hosting aliases"* as well
  as the custom domain and the Pages mirror.
- `firebase.json`'s rewrites are **site-level**. `/p/**` and (after #48) `/session/end` are
  therefore served on `cusati-hub.web.app` and `cusati-hub.firebaseapp.com` exactly as on
  `jason.cusati.us`.

So a member who reaches the private area on either alias gets a **403 on sign-out**, surfaced by
#48's control as a visible error, with `event=deny scope=signout reason=cross_origin` in the
logs — which reads like an attack, not a configuration gap. Nothing in #47, #48 or #53 names
these origins. Remedy: add both to `var.gate_extra_allowed_origins` before the apply, **or**
record a decision that the aliases are out of scope for sign-out. Either is fine; silence is not,
because the failure mode is a log line that looks like a CSRF attempt.

**T3 — recorded, not blocking.** #48 gives `fetch-data.sh` and `sync-local-data.sh` an explicit
`--provenance … --partial`, but the **`--bucket`** caller in `build.yml` passes neither.
`sync-content.sh` defaults to `PROVENANCE="bucket"`, `complete=true`, so enforcement applies —
correct and intended. The note is that **no pull request exercises that path**: a PR build cannot
authenticate to the content bucket and falls back to `fetch-data.sh`. #48's required-source
enforcement therefore runs for real for the first time on the merge to `main`. Behaviour is right
by reading; it has simply never been observed.

---

## 7. Is the 1-2-3-4 order correct?

**No. The first two steps are right and the last two are inverted.**

Certified order:

> **#45 → #48 → #53 → `terraform apply` (verified) → #47**

**What holds from the revised order, and why it is right:**

- **#45 first.** Confirmed rather than accepted. ADR-0013 exists only on
  `admin/wave-0-preconditions`, and its decision 2 ("added to the design doc §8 rewrite list")
  is carried out only by #45's design-doc amendment. All three code branches carry a
  `/client-events` rewrite. #48 additionally needs that same amendment for `/session/end`, and
  its Projects-title change implements **D7**, which is recorded only in #45. Merging any code
  PR first ships a change whose authorising decision is not in the repository. The reasoning
  survives testing.
- **#48 before #47** (G-R1). Confirmed against `main`: `firebase.json` carries only `/p/**`,
  `/session`, `/client-events`, and `/session` is a **literal** that does not match
  `/session/end`. #47's handler is unreachable through Hosting until #48 lands.

**What forces the swap:**

`GATE_ALLOWED_ORIGINS` is **rendered by #53** and **read by #47**, and — the step that was
missed — **merging #53 renders nothing**. It is Terraform; only `apply` writes the variable into
the Cloud Run env block. Meanwhile **merging #47 deploys immediately**: `gate.yml` fires on
`gate/**`, updates the revision, and only then runs a smoke test that now asserts sign-out
returns 200.

Run both orders out:

| | Proposed: 45 → 48 → **47 → 53** | Certified: 45 → 48 → **53 → apply → 47** |
|---|---|---|
| At #47's merge | new revision deploys; `GATE_ALLOWED_ORIGINS` **unset**; boot logs `event=misconfigured`; `/session/end` **403 for every member on every origin**; smoke test fails **after** rollout; `gate.yml` red; the broken revision stays live | variable already present on the service; smoke test passes; sign-out works on the first deploy |
| Sign-out outage window | **from #47's merge until the owner applies** — open-ended | **none** |
| `gate.yml` on `main` | **red**, and stays red until the apply | green |
| #53's own red (`private-bucket-live-iam`) | at step 4 | at step 3 |
| Chance to verify the `run.app` spelling (T1) before it can break a deploy | **none** — the damage precedes the check | **yes**, that is exactly the window |

The certified order's only cost is that #53's unavoidable red starts one step earlier. That red
is orthogonal to the gate, is disclosed, and is the guard working. The proposed order's cost is a
member-visible outage of the feature this wave exists to ship, plus a red `main`, plus losing the
only window in which T1 can be caught before it fails a deploy.

**Between #53 and #47, three things happen, in this order:**

1. `terraform apply` from a saved, reviewed plan. Re-verify first that the plan destroys or
   replaces **no** stateful resource — the Firestore ruleset/release pair especially, per §8;
   PR #35 fixed the #30 idempotence defect but #45's own body says that is re-verified before
   each apply, not trusted from the record. The `firebaseauth.admin` binding destroy is an IAM
   binding and is not on the stateful list.
2. `terraform output -raw gate_allowed_origins_check_command` — compare the URL Cloud Run
   actually serves against the set the running revision printed in its `event=boot` line. If the
   older `-ue.a.run.app` spelling is live, add it via `var.gate_extra_allowed_origins` and
   re-apply **before** #47 merges (T1). Decide T2 in the same pass.
3. Set `GCP_AUDITOR_SA` from `terraform output -raw auditor_service_account_email`, which closes
   the first half of #53's red and stops the hourly issue comments.

A note for whoever executes: applying #53 while the **old** gate image is still deployed is safe.
Terraform carries `ignore_changes` on the image, so the env-var change produces a new revision
running the same code, and the old code ignores an env var it never reads. The narrowed
`gateSessionMinter` role covers `createSession` + `users.get`, which is what both the old and the
new code call — so the sign-in risk #53 flags in step (f) is identical in either order and is not
a reason to prefer one.

---

## 8. What is still owner-only

**All four:** mark the PR ready for review; merge it. Canon puts L1–L3 merge authority with the
human owner alone; D5 delegates it to the Lead Architect **only** when every §8 condition holds —
and §8 is still not a repository artifact (B-7 / R-5), so the condition governing the delegation
cannot be audited from the repository. That gap is unchanged by this evaluation.

**#45** — **accept ADR-0012 and ADR-0013.** Both land at `Status: Proposed`; the canon lifecycle
is Proposed → Accepted, and all eleven other ADRs in this repo sit at Accepted. A Proposed ADR
records a decision for review; it does not yet authorise anything. So merging #45 as written does
**not** by itself supply the authorising decision that Security check 7 found missing for
`/client-events` — it supplies a *proposal* of one. The subsequent status flip is L0 bookkeeping
and cites the merged PR.

**#48** — nothing beyond ready-and-merge.

**#47** — nothing beyond ready-and-merge, but it must not **deploy** before the apply (§7).

**#53** — the longest list, and none of it is an agent's:

- `terraform apply` from a saved, reviewed plan, with the add/change list pasted into STATE
  before and the result after, and a clean second plan afterwards.
- Set the repository Actions variable **`GCP_AUDITOR_SA`**.
- **Post-apply step (f)**: test **verify** as well as **mint** against the narrowed
  `gateSessionMinter` role. This needs a real member sign-in — the repo holds no member
  credential, and `djjay0131@gmail.com` is deliberately not a member. Testing only the mint is
  how a half-narrowed role ships looking healthy.
- Verify the `run.app` origin spelling (T1) and decide the Hosting aliases (T2).
- **#55 / the legacy bindings.** Removing `projectEditor`'s `legacyBucketOwner` /
  `legacyObjectOwner` needs an authoritative bucket policy that would also strip the **owner's
  own** object access, since `roles/owner` reaches objects through `projectOwner` by the same
  mechanism. `infra/README.md` records this as an owner decision, and it is the second half of
  `private-bucket-live-iam`'s red.
- **Verify the alert notification channels** in the Cloud Monitoring console — email, and the
  new SMS channel if `var.ops_sms_number` is set. D6.5 stands: all policies are enabled and
  deliver nothing while the channel is unverified, which also means #53's new
  `gate_misconfigured` alert — the one that would announce a missing `GATE_ALLOWED_ORIGINS` —
  fires into the void until this is done. Worth doing in the same session as the apply, since it
  is the alert that covers the failure mode this wave introduces.
- Optionally promote `contract-tests` and `leak-check-self-test` to required contexts. Not in
  this PR; a branch-protection change, with #53's own caution attached
  (`leak-check-self-test` carries `if: github.event_name != 'schedule'`, and a required context
  that never reports blocks merges indefinitely).

---

## 9. Verdict

| PR | Verdict | Blocking reason | Smallest change that unblocks |
|---|---|---|---|
| **#45** | **BLOCKED** | Draft. Body declares **L2** against an L3 diff and its own `gov-L3` label; canon permits escalation up only, so the body is the artifact that is wrong. | Change the Governance Level line to **L3** (one line), then mark ready. |
| **#48** | **BLOCKED** | Draft. The Verification block certifies the wrong head — "Nine files changed" / "210 passed" against a 16-file head whose true baseline is 241/1. | Refresh those two figures to the head, then mark ready. |
| **#47** | **BLOCKED** | Draft. The body still presents the **deleted** header-comparison CSRF check as the shipped design and never names `GATE_ALLOWED_ORIGINS` — on the PR whose central change is that variable. Plus the sequencing constraint: must not merge before #53 is merged **and applied**. | Rewrite the "CSRF-safe with no configuration" paragraph to describe the `GATE_ALLOWED_ORIGINS` design and its fail-closed behaviour; mark ready; merge last, after the apply. |
| **#53** | **BLOCKED** | Draft. Merging schedules an hourly-failing job that also **suppresses `notify-recovery` for the whole pipeline** (§6b), with no landing plan attached for `GCP_AUDITOR_SA` or #55. | Mark ready, and commit to the post-merge sequence in the same window — apply → verify origins → set `GCP_AUDITOR_SA` → decide #55. If that window will be long, drop `private-bucket-live-iam` from `notify-recovery`'s `needs:` so recovery is not suppressed. |

Every blocking reason above is a body or a sequencing fix. **No diff needs to change**, and no
PR fails a check, a contract or a mergeability test. **§7 security is a separate gate, running
concurrently, and nothing here anticipates its verdict.**
