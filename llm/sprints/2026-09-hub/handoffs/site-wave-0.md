# Handoff — `site`, Wave 0

Status: Complete
Date: 2026-09-18
Contract: `llm/sprints/2026-09-hub/contracts/site-wave-0.md`
Issue: #44 (hub-007)
Branch: none cut, no commits, no pushes, no `gh` or cloud mutations (per contract §GIT).

---

## Summary

All three contracted items are done, plus one cross-stream addition the coordinator
requested mid-flight.

1. **`phd-milestones` is `required: true`.** Flipped in `site/src/lib/hub-content.mjs`, with
   the `note` rewritten to record that it has published and when (Checkpoint 4, 2026-09-17).
   The guard was **shown failing on an absent prefix and then passing again** — both
   transcripts are in §Validation, from real builds, not from reasoning.

2. **The Projects page title is "Projects".** One occurrence named the page and was changed;
   six further occurrences of "Projects"/"Selected Projects" were found, examined and left,
   each with a stated reason. Full list in §Validation.

3. **The private-sync identity split is specified, not implemented.** SEAM-10 below. No
   change to `.github/workflows/build.yml`, `infra/**` or any check script — every one of
   those is named in the seam as infra's to make.

4. **Added on the coordinator's request (in my file contract):** `firebase.json` gains a
   separate literal rewrite for `/session/end` → `hub-gate`/`us-east1`. §The `/session/end`
   rewrite records the SEAM-6 ordering fact the coordinator asked to have on the record.

### The three shell-script changes, which the coordinator asked me to explain up front

`site/scripts/sync-content.sh` (+51), `site/scripts/fetch-data.sh` (+9) and
`site/scripts/sync-local-data.sh` (+6) are **all item 1**. None of them is item 3, and item 3
touches no file at all.

Here is why item 1 could not be a one-line flip.

The synced tree the build reads is produced by two different paths. The contract path is
`sync-content.sh --bucket`, which carries every source. The fallback path is `fetch-data.sh`,
which builds the tree from the **cv GitHub release** and therefore carries `cv` **and nothing
else, by construction** — there is no second source in that release and no bucket in the
picture. That path is not an edge case: a `pull_request` run carries `refs/pull/<n>/merge`
and the deploy binding admits only `refs/heads/main` (`infra/wif.tf`), so a PR **cannot**
authenticate to the content bucket and **every pull-request build takes the fallback**
(`build.yml`, the `Fetch the CV payload from the cv release` step in both `build` and
`build-firebase`). `sync-local-data.sh` has the same property for local development.

So an unqualified flip would have failed **every pull-request build** on a "vanished prefix"
that never existed there — which is precisely the pathology ADR-0010 decision 4's 2026-09-17
amendment exists to prevent ("a guard that fails every build from the day it lands is removed
within a day"), one step further down the road. The module's own comment already said this in
so many words: *"the pull-request and fallback content paths only ever produce `cv`"*.

The fix is not to weaken the guard. It is to ask it only where its answer means something:

- `sync-content.sh` — the **only** writer of the synced tree, and the only thing that knows
  how the tree was produced — now writes a provenance marker at the tree's root
  (`.hub-content-source.json`: `{provenance, complete, syncedAt, objectCount}`). It rebuilds
  the destination from scratch first, so a marker can never outlive the tree it describes.
  Two new options: `--provenance NAME` and `--partial`.
- `fetch-data.sh` passes `--provenance cv-release --partial`; `sync-local-data.sh` passes
  `--provenance local-cv-checkout --partial`. Each declares what it already is.
- `hub-content.mjs` gains `CONTENT_PROVENANCE_FILE` and the pure policy function
  `expectedSourcesEnforcement(provenance)`; `content.config.ts` reads the marker and applies
  it. **Fail-closed**: an absent, unreadable or unrecognised marker **enforces**. A tree is
  exempt only when its own producer said `complete: false`. Silence never exempts anything.

Both halves are demonstrated live in §Validation: the same cv-only tree **fails** the build
without the marker and **builds** with it, and the difference is only what the producer wrote.

This is deliberately a **file, not an environment variable**. It travels with the tree it
describes, and it is written and read entirely inside `site/**` — so it is not a cross-stream
variable that nothing checks, which is the defect shape Phase 3 already paid for once
(`PRIVATE_BUCKET` rendered by infra, `GATE_PRIVATE_BUCKET` read by the gate). The precedent
is the private build receipt `.hub-private-build.json` (`scripts/private-build.mjs`): a later
step that must not guess is handed a fact by the step that knew it.

If the Lead Architect judges this to be more than Wave 0 wanted, the reviewable alternative is
in §Alternatives considered — but note that the alternative is *a red `build` and
`build-firebase` job on every pull request from the moment this merges*.

### Files changed (the whole set — `site/**` and `firebase.json`, nothing else)

```
 firebase.json                       |   7 ++      item 4 (coordinator request)
 site/scripts/fetch-data.sh          |  10 ++-     item 1
 site/scripts/sync-content.sh        |  51 ++++++++++++   item 1
 site/scripts/sync-content.test.ts   |  61 +++++++++++-   item 1
 site/scripts/sync-local-data.sh     |   7 +-      item 1
 site/src/content.config.test.ts     | 155 +++++++++++++++++++++++++++++++-----   item 1
 site/src/content.config.ts          |  29 +++++++  item 1
 site/src/lib/hub-content.mjs        |  96 ++++++++++++++++++--   item 1
 site/src/pages/projects/index.astro |   2 +-      item 2
 9 files changed, 384 insertions(+), 34 deletions(-)
```

**Note for staging.** The working tree also carries the `gate` stream's in-flight changes
(`.github/workflows/gate.yml`, `gate/**`, `gate/tests/test_signout.py`, and its handoff). I
did not touch any of them. Stage by path.

---

## Assumptions

1. **The handoff path is the one exception to "do not modify `llm/**`".** The contract's
   FINAL REPORT line and STATE §Standing constraints both name it. No other `llm/` file was
   touched.
2. **`site/fixtures/content/` is committed, non-private material.** Every validation
   transcript below was produced against the **fixture** tree rather than the real synced
   content, precisely so that no real private slug, title or byte appears in this document.
   The identifiers you see (`Programme Milestone Tracker (fixture)` and the two fixture
   slugs) are committed fixture values, already present in `site/fixtures/` and in
   `site/scripts/check-no-private-in-public.test.ts`.
3. **The real synced tree was restored byte-for-byte.** It was archived before the fixture
   swap and restored afterwards (23 files, both sources), public assets re-staged, both
   outputs rebuilt from it, and the archive deleted. Verified in §Validation C.
4. **Checkpoint 4's publish is the authority for the flip**, per STATE §Checkpoint 4
   execution record: "The satellite published for the first time, successfully". I did not
   and could not re-verify the bucket — no credential, and none may be created.
5. **`GCP_PRIVATE_SYNC_SA` is a name I am proposing, not one that exists.** It is not set on
   the repository and no Terraform declares it. Item 3 is a specification.

---

## Recommendations

1. **Land item 1 and item 2 together; they are independent of everything else in Wave 0.**
2. **Review the provenance marker as the design decision it is**, not as incidental script
   churn. It changes *where* ADR-0010 decision 4 applies, and that belongs in the ADR (see
   §ADR candidates). I would rather it were rejected in the open than merged unnoticed.
3. **Promote `leak-check-self-test` to a required check** (STATE S-4, still open). It now has
   something real to prove on every run, and it gates nothing.
4. **Prefer cutover Order B in SEAM-10** (one short, provably non-destructive red window)
   over Order A (a deliberately widened guard for a period). Both are specified; the owner
   applies Terraform by hand at a checkpoint anyway, so the window is minutes.
5. **Do not let SEAM-10 be described as "the public deploy identity can no longer see private
   material".** It cannot see the private *rendered output*. It still reads the private
   *source* bytes under `sources/phd-milestones/` in the content bucket, as SEAM-1 says it
   must. Anything stronger is a separate change (§ADR candidates).

---

## Alternatives considered

**Item 1 — flip `required` and change nothing else.** Simplest, and exactly what the contract
says on its face. Rejected on evidence: it reds the `build` and `build-firebase` jobs on every
pull request, because those jobs take the cv-release fallback. Demonstrated in §Validation B4
— that transcript *is* the PR failure, produced from the real fallback producer. A guard in
that state is deleted within a week, and then it protects nothing. I considered reporting it
and stopping (the contract's instruction for a blocking test), but the contract's stop clause
is about a test I believe is wrong; here no test is wrong, and a correct fix exists inside
`site/**`.

**Read `content_source` from `site/public/build-info.json`.** That file already exists, is
already written before the build, and already says `"bucket"` or `"cv-release"`. Rejected: it
is written by `build.yml`, which is **infra's** file this wave, so the site build would depend
on a field in a file it does not own and nothing would check the coupling — the exact defect
class the contract warns about. The marker is written and read entirely within `site/**`.

**Have `fetch-data.sh` set an environment variable.** Rejected: it runs in a different
workflow *step* from `npm run build`, so it would have to write `$GITHUB_ENV` — CI-specific,
invisible to `npm run data:fetch && npm run build` locally, and again a cross-file contract.

**Default to "exempt" when no marker is present.** Rejected outright. That is a guard that
silently stops running and still reports success. Fail-closed is asserted by test
(`enforces on an unreadable marker, rather than treating it as an exemption`), and the real
restored tree — which predates the marker entirely — enforces correctly (§Validation C1).

**Item 2 — also change the meta description and the CV section heading.** Rejected: the
owner's instruction is the page *title*, and D7 says the two sections stay separate. Both are
listed in §Validation with reasoning, and the description is raised as an open question
rather than changed silently.

**Item 3 — widen `/session` to `/session{,/**}` for the sign-out route.** Rejected, per the
coordinator's instruction and the gate stream's recommendation: `/session` is the one sign-in
flow that currently works, and broadening its match surface buys nothing. A second literal
entry was added instead.

---

## Risks

1. **The provenance marker is a new exemption surface.** Anything that writes
   `{"complete": false}` into the synced tree disables the required-source check for that
   build. Mitigations: only `sync-content.sh` writes it; the destination is rebuilt from
   scratch on every sync (asserted by test — `REWRITES the marker on every run, so a stale one
   cannot outlive its tree`); the deploy path always syncs `--bucket`, which is `complete:
   true`; and the skip is printed loudly on every build that takes it, naming the reason.
   **It is not a silent skip.**
2. **The exemption applies to the whole check, not source by source.** On a `cv-release`
   tree, a vanished `cv` prefix would also go unreported. In practice the fallback tree cannot
   be missing `cv` — it *is* the cv release, and `fetch-data.sh` fails earlier if the release
   is absent — but the shape is worth knowing. A per-source `availableFrom` would be the
   precise form; it is more machinery than the one real case justifies today.
3. **The flip makes a bucket fault a build failure on the deploy path.** That is the
   intention (ADR-0010 decision 3 and 5 depend on it), but it means a partial or failed bucket
   sync now stops the *public* deploy too, not only the private one. That is the correct
   trade — the alternative is deploying a public site from a tree the private sync would then
   prune against — but it is a new way for the public site to stop updating.
4. **SEAM-10's cutover has no zero-window ordering that also keeps the "exactly two
   bindings" invariant intact.** Specified explicitly rather than discovered during the
   apply. The failure mode of the short window is provably non-destructive: `sync-private.mjs`
   throws `PrivateSyncError` on any non-OK `objects.list` response (`sync-private.mjs:244`),
   so a 403 is a red job with nothing uploaded and nothing deleted.
5. **`/session/end` will 404 through Hosting until the gate's revision carrying that route is
   deployed.** Expected and harmless (see §The `/session/end` rewrite) — but if the rewrite
   merges and the gate deploy is then abandoned, sign-out stays broken while `firebase.json`
   claims a route. It should not merge long before the gate's PR.
6. **Unverifiable here:** every live cloud fact in SEAM-10. No credential exists in this
   session, and the contract forbids creating one. Every "how to prove it" step is written to
   be run by the owner or on the deploy path, not asserted as already true.

---

## Open questions

1. **The Projects page meta description still reads "Selected projects and research by Jason
   Cusati."** (`site/src/pages/projects/index.astro:24`, rendered as `<meta
   name="description">` and `og:description`). It names the page's *content*, not its title,
   and the owner's instruction was the title, so I left it. It is now slightly at odds with
   the page, which lists projects only — research lives at `/research/`. **Evidence that would
   settle it:** one line from the owner. Suggested replacement if yes: "Selected projects by
   Jason Cusati."
2. **Is `site/src/pages/cv/[variant].astro:127`'s `<h2>Selected Projects &amp; Research</h2>`
   in scope?** It is a section heading *inside the rendered CV document*, whose content comes
   from `cv`'s own `projects` pool, so it names a CV section rather than the hub's Projects
   page. I left it. It is also arguably the satellite's wording rather than the hub's.
3. **Should the required-source exemption be recorded per source rather than per tree?**
   (Risk 2.) Today one flag exempts the whole check. Evidence that would settle it: a second
   partial producer, or a source that publishes only on some paths.
4. **Does the owner want the content-bucket read split too?** SEAM-10 removes the public
   deploy identity's access to the private *output*. Its access to the private *source* bytes
   in the content bucket is untouched, and is load-bearing (it builds them).

---

## Related docs

- `llm/governance/adr/0010-withdrawal-semantics.md` — decisions 2, 3, 4 (and its 2026-09-17
  amendment), 5
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — no test was weakened or
  deleted; `private-structure.test.ts` is untouched
- `llm/governance/adr/0005-two-output-build-with-leak-check.md` — the leak check
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-4, SEAM-5, SEAM-6,
  SEAM-8, SEAM-9; SEAM-10 below is written in its style
- `llm/sprints/2026-09-hub/STATE.md` — §Checkpoint 4 execution record, §Follow-ups
  ("flip `phd-milestones` to `required: true`"), §Standing constraints
- `llm/master-roadmap.md` §phase-3-private-area — the bucket IAM criterion SEAM-10 changes
- `infra/README.md` §Phase 3, `infra/private-bucket.tf`, `infra/private-roles.tf`,
  `infra/outputs.tf`, `infra/scripts/check_private_bucket_config.py`,
  `infra/scripts/check-private-bucket-iam.sh` — all read-only here, all named in SEAM-10

---

## ADR candidates

1. **"The expected-source check applies to trees that could be complete."** ADR-0010 decision
   4 says a declared source whose prefix is entirely absent fails the build. It is silent on
   *which* synced trees that applies to, and the answer cannot be "all of them" — the
   cv-release fallback carries one source by construction and every pull request reads it.
   This work makes provenance the qualifier and fails closed. It amends the domain of a
   decision in an accepted ADR, so it should be recorded there rather than living only in a
   code comment and this handoff. **This is the one I would write first.**
2. **A dedicated private-sync identity** (SEAM-10). It amends SEAM-1's "exactly two
   principals" table and ADR-0010 decision 5's consequence that the hub's *deploy* identity is
   the pruning principal. The owner has chosen it; the decision and its cutover ordering are
   not yet written down anywhere but here.
3. **Whether the public deploy identity should keep reading private source bytes** under
   `sources/phd-milestones/` on the content bucket (§Open questions 4). SEAM-10 makes the
   asymmetry visible for the first time: after it, `hub-deploy` cannot read the private
   *output* but can still read every private *input*.
4. **Sign-out as a distinct Hosting route.** `/session` and `/session/end` are now two literal
   rewrites; the reasoning for not globbing is in the coordinator's instruction and the gate
   stream's recommendation, and it is a durable decision about the one authenticated flow.

---

## The `/session/end` rewrite (coordinator request, 2026-09-18)

`firebase.json` now carries a **separate literal** entry, `/session/end` → `hub-gate`,
`us-east1`, matching the shape of `/p/**` and `/session`. `/session` was **not** widened to a
glob. Final rewrite order, which is also match order:

```
/p/**          -> hub-gate us-east1
/session       -> hub-gate us-east1
/session/end   -> hub-gate us-east1
/client-events -> hub-gate us-east1
```

Two literals cannot shadow each other, so `/session` is unaffected. Nothing in the repository
asserts the rewrite set — `build.yml` names `firebase.json` only in a `contents: read`
permission comment — so no check needed updating.

**SEAM-6 ordering, for the record, as requested.** SEAM-6 forbids naming a Cloud Run service
that does not exist, because Hosting rejects such a configuration and that breaks *every*
deploy including the public site. `hub-gate` **does** exist and is serving (STATE records
revision `hub-gate-00005-n4g`), so this entry is safe to deploy now. What is not yet true is
that the deployed revision serves `/session/end`: that arrives with the gate's PR. A rewrite
pointing at an existing service for a route the current revision lacks yields **a 404 from the
gate**, not a broken deploy. So the two PRs may land in either order; the only observable
consequence of this one landing first is that sign-out 404s until the gate's revision ships —
which is the state it is in today anyway, through Hosting.

---

## SEAM-10 — The private-sync identity split (SPECIFICATION — infra implements)

> Written in the style of `phase-3-seams.md`. **No file was changed for this item.**
> `.github/workflows/build.yml` is infra's this wave; so are `infra/**` and both check
> scripts. Every name below is exact, because a cross-stream variable is a contract and
> nothing checks it — Phase 3 cost one defect exactly here (`PRIVATE_BUCKET` rendered,
> `GATE_PRIVATE_BUCKET` read).

### The change in one sentence

The destructive private sync stops running as the **public site's deploy identity**
(`hub-deploy`) and runs as a **dedicated identity** that does nothing else, so `hub-deploy`
holds **no** permission on the private bucket.

### S10.1 — Which step needs which identity, in order

`build.yml` has five `google-github-actions/auth@…v3.0.0` steps. **Exactly one changes.**

| # | job | step | identity after the change | `service_account:` reads |
|---|---|---|---|---|
| 1 | `check` | `Authenticate to Google Cloud` | `hub-deploy` — unchanged | `${{ vars.GCP_DEPLOY_SA }}` |
| 2 | `build` | `Authenticate to Google Cloud` | `hub-deploy` — unchanged | `${{ vars.GCP_DEPLOY_SA }}` |
| 3 | `build-firebase` | `Authenticate to Google Cloud` | `hub-deploy` — unchanged | `${{ vars.GCP_DEPLOY_SA }}` |
| 4 | `firebase-deploy` | `Authenticate to Google Cloud` | `hub-deploy` — unchanged | `${{ vars.GCP_DEPLOY_SA }}` |
| 5 | **`private-sync`** | **`Authenticate to Google Cloud`** (`id: auth`) | **`private-sync` — CHANGED** | **`${{ vars.GCP_PRIVATE_SYNC_SA }}`** |

Steps 1–3 read the **content** bucket (`GCP_CONTENT_BUCKET`), which is not in scope. Step 4
deploys Hosting. Only step 5 touches the private bucket, and only the two steps that follow it
in the same job use its token.

### S10.2 — The exact inputs, named

**New GitHub Actions variable on `djjay0131/website`** (a *variable*, never a secret — it is
a service-account email, like `GCP_DEPLOY_SA` and `GCP_GATE_DEPLOY_SA`):

```
GCP_PRIVATE_SYNC_SA = private-sync@<GCP_PROJECT_ID>.iam.gserviceaccount.com
```

**Unchanged and still required by the `private-sync` job:** `GCP_PROJECT_ID`,
`GCP_WIF_PROVIDER` (the *same* pool and the *same* provider — only the impersonated service
account differs, exactly as `gate-deploy` already does in `gate.yml`), `GCP_PRIVATE_BUCKET`.

**The auth step, verbatim, as infra should render it** (only the `service_account:` line
differs from today):

```yaml
      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3.0.0
        with:
          project_id: ${{ vars.GCP_PROJECT_ID }}
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_PRIVATE_SYNC_SA }}
          token_format: access_token
```

**The job gate gains the new variable**, so an unset variable skips the job with a readable
reason instead of failing `auth` with an empty `service_account`:

```yaml
    if: >-
      github.event_name != 'pull_request'
      && vars.GCP_PROJECT_ID != ''
      && vars.GCP_PRIVATE_BUCKET != ''
      && vars.GCP_PRIVATE_SYNC_SA != ''
```

**…and that skip must be loud.** A silently skipped destructive sync means a withdrawn private
item goes on being served — the exact failure ADR-0010 decision 5 exists to prevent. Mirror
the existing `Check deploy configuration` step in `firebase-deploy`: in a job that always
runs, fail (or at minimum `::error::`) when `vars.GCP_PRIVATE_BUCKET != ''` and
`vars.GCP_PRIVATE_SYNC_SA == ''`.

**The two sync steps do not change at all.** Named here so the contract is explicit about what
the site side reads — this is the entire surface:

```yaml
        env:
          GCS_ACCESS_TOKEN: ${{ steps.auth.outputs.access_token }}   # now private-sync's token
          PRIVATE_BUCKET: ${{ vars.GCP_PRIVATE_BUCKET }}
        run: node scripts/sync-private.mjs --bucket "${PRIVATE_BUCKET}"          # dry run
        run: node scripts/sync-private.mjs --bucket "${PRIVATE_BUCKET}" --apply  # apply
```

`site/scripts/sync-private.mjs` reads exactly two things: the environment variable
**`GCS_ACCESS_TOKEN`** and the **`--bucket`** argument. Neither changes, and no new name enters
`site/**`. If infra renames either, the sync breaks at runtime with a 401 and nothing at build
time would notice — that is the failure this section exists to prevent.

### S10.3 — Terraform, `infra/**`

| Change | File | Exact form |
|---|---|---|
| New service account | `infra/private-bucket.tf` or a new `private-sync.tf` | `google_service_account.private_sync`, `account_id = "private-sync"` |
| WIF binding | same | `google_service_account_iam_member.private_sync_wif_main`, `role = "roles/iam.workloadIdentityUser"`, `member = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository_id_ref/${var.github_repository_id}/${local.deploy_ref}"` — **identical in shape to `gate_deploy_wif_main`** (`infra/gate.tf`) and `hub_deploy_wif_main` (`infra/deploy.tf`); same pool, `refs/heads/main` only |
| Bucket binding moves | `infra/private-bucket.tf` | `google_storage_bucket_iam_member.hub_deploy_private_sync` (member `hub_deploy`) → `google_storage_bucket_iam_member.private_sync` (member `google_service_account.private_sync.member`), **same role** `google_project_iam_custom_role.private_sync_writer.name` |
| Custom role | `infra/private-roles.tf` | **unchanged.** `privateSyncWriter` keeps exactly `storage.objects.create/.delete/.get/.list`. `deletion_policy = "PREVENT"` — do not destroy it |
| New output | `infra/outputs.tf` | `private_sync_service_account_email`, and `GCP_PRIVATE_SYNC_SA = google_service_account.private_sync.email` added to the variables map (today `gate_github_actions_variables`) |
| Check command output | `infra/outputs.tf:223` (`private_bucket_iam_check_command`) | `HUB_SA=` must render the **private-sync** email, not `google_service_account.hub_deploy.email` |

**Two guards will fail until they are updated in the same commit — by design.**

- `infra/scripts/check_private_bucket_config.py`: `EXPECTED_PRIVATE_BUCKET_BINDINGS` maps
  `"hub_deploy_private_sync" → "private_sync_writer"`; the key becomes the new resource name
  (`"private_sync"`). This runs in `budget-guard`, which is a **required** status check, so
  the rename cannot merge half-done. That is the guard working.
- `infra/scripts/check-private-bucket-iam.sh:135` builds its expected policy from `HUB_SA`.
  Either set `HUB_SA` to the private-sync email, or rename the variable to `SYNC_SA` in the
  script, its usage block (line 25) and `infra/README.md:703–705`. **Name whichever you
  choose in the infra handoff** — this is exactly the variable-drift class.

**Documentation that names `hub-deploy` as the syncing principal** and must move with it:
`infra/README.md` lines 53, 54, 377, 538, 718; `phase-3-seams.md` SEAM-1's two-principal
table; `llm/master-roadmap.md` §phase-3-private-area's bucket-IAM criterion ("`hub-deploy`
with the four permissions a destructive sync needs"). The last two are the Lead Architect's.

### S10.4 — What must be true afterwards

- **H1 — the public deploy identity has no private-bucket permission.** `hub-deploy` appears
  in **no** binding on the private bucket, in the declared config and in the live policy. The
  bucket still carries exactly **two** non-legacy bindings: the gate's runtime SA with
  `privateObjectReader`, and `private-sync` with `privateSyncWriter`.
- **H2 — the private sync still works.** A real deploy run's `private-sync` job is green, its
  dry-run step prints a plan, and a deliberate withdrawal is pruned.
- **Unchanged, and must stay unchanged:** the gate's runtime SA holds exactly
  `storage.objects.get`; `public_access_prevention = "enforced"`; `uniform_bucket_level_access
  = true`; no `allUsers`/`allAuthenticatedUsers`; `hub-deploy` keeps
  `roles/storage.objectViewer` on the **content** bucket (it builds the private output from
  those bytes — SEAM-1).

### S10.5 — How to prove both halves, live

**H1, three independent proofs — run all three; none alone is sufficient:**

1. *Declared* (credential-free, every push, required check):
   `python3 infra/scripts/check_private_bucket_config.py` — passes only when the declared
   bindings are exactly the two expected resource names. `hub-deploy` cannot be declared here
   without failing it.
2. *Live policy equality* (the owner, at the checkpoint):
   ```
   PROJECT=<GCP_PROJECT_ID> BUCKET=<GCP_PRIVATE_BUCKET> \
   GATE_SA=<gate runtime SA email> HUB_SA=<private-sync SA email> \
   PROBE_OBJECT=index.html \
     bash infra/scripts/check-private-bucket-iam.sh
   ```
   Expected: `OK: exactly two non-legacy bindings…`, `OK: no allUsers…`, and the anonymous
   GET refused. This **fails** if `hub-deploy` holds any role, because the check is an
   equality assertion, not a "no reader other than" one.
3. *Behavioural denial* — the only one that proves a **denial** rather than an absence:
   ```
   gcloud storage objects list gs://<GCP_PRIVATE_BUCKET> \
     --impersonate-service-account=<GCP_DEPLOY_SA>
   ```
   Expected: `403 … storage.objects.list … denied`. Requires the operator to hold
   `roles/iam.serviceAccountTokenCreator` on `hub-deploy`; the owner can grant it to
   themselves and should revoke it afterwards. If that is declined, record proofs 1 and 2 as
   the evidence and say so — do not report an untested denial as verified.

**H2, in this order (it is the Chief Reviewer's Part C sequence, still open in STATE
§Follow-ups — do it now, while the bucket is nearly empty, not later on a full one):**

1. The first `private-sync` run after the cutover is **green**, and its
   `Authenticate to Google Cloud` step logs the **private-sync** service account (the action
   prints the identity it exchanged for). That log line is the cheapest proof the new identity
   is the one doing the work.
2. `Plan the private sync (dry run)` prints a plan; against a bucket already in sync the
   delete list is **empty**.
3. **Withdraw one private item deliberately** (drop it from the satellite's manifest,
   publish, let the hub rebuild). The **next dry run must name exactly that item's objects and
   no others — read it BEFORE the apply step runs.** Then confirm the apply removed exactly
   those, and that a signed-in member gets a 404 at the old path.
4. Re-run proof H1.2. The sync must not have widened anything.

**Fail-closed evidence, already true and worth knowing before the cutover:**
`sync-private.mjs` throws `PrivateSyncError` on any non-OK `objects.list` response
(`site/scripts/sync-private.mjs:244`), so an identity without permission produces a **red job
with nothing uploaded and nothing deleted** — never a "destination looks empty, delete
nothing / upload everything" misread. The deletion ceiling (34% of the destination) and the
build receipt (`P2`) remain in force regardless of identity.

### S10.6 — Cutover ordering (there is no zero-window order that also keeps "exactly two")

The bucket invariant is an **equality** over two bindings, so a state where both `hub-deploy`
and `private-sync` hold `privateSyncWriter` fails the guard. Either the guard is briefly
widened, or the sync is briefly unable to run. Both are acceptable; neither is silent. Pick
one deliberately.

**Order B — recommended. One short red window, provably non-destructive.**
1. Set `GCP_PRIVATE_SYNC_SA` (inert — nothing reads it yet).
2. Merge the `build.yml` change. *Window opens:* the sync now authenticates as an identity
   that has no binding yet, so a deploy in this window has a **red `private-sync` job**;
   nothing is uploaded and nothing is deleted (S10.5, fail-closed evidence). The private area
   is untouched and keeps serving.
3. `terraform apply` the atomic swap (new SA + WIF binding + bucket binding moved + both check
   scripts updated, all in one commit). *Window closes.*
4. Re-run the deploy (`workflow_dispatch`) and run the H1/H2 proofs.

Window length is the minutes between a merge and a manual apply the owner is performing
anyway. Worst case is a visibly failed job, which is the correct signal.

**Order A — zero red, at the cost of a deliberately widened guard.**
1. apply #1 adds `private-sync`'s binding **while keeping** `hub-deploy`'s, with
   `EXPECTED_PRIVATE_BUCKET_BINDINGS` updated **in the same commit** to the three-entry
   transitional set and the removal PR already drafted.
2. Set `GCP_PRIVATE_SYNC_SA`; merge `build.yml`; verify one green `private-sync` run.
3. apply #2 removes `hub-deploy`'s binding and returns the expectation to exactly two.

Choose A only if a red deploy job is unacceptable. It edits the security guard twice and
leaves the bucket with three principals in between — in the open, reviewed, and time-boxed,
which is the only acceptable way to do it.

---

# Validation

Every command was run in this session. Node v24 / npm 11, `site/` as the working directory
unless stated. No `git`, `gh` or cloud mutation was performed.

**Why the transcripts use the fixture tree.** `npm run content:fixture` syncs
`site/fixtures/content` — committed, non-private material carrying two `visibility: private`
*fixture* items — so that no real private slug, title or byte appears in this document. The
real synced tree was archived first and restored afterwards (§C). The identifiers below
(`Programme Milestone Tracker (fixture)`, `phd-milestones/milestones`,
`phd-milestones/committee-dossier`) are fixture values already committed under
`site/fixtures/` and asserted in `site/scripts/check-no-private-in-public.test.ts`.

## A — Everything green

```
$ npm test
 Test Files  16 passed (16)
      Tests  210 passed | 1 skipped (211)
```

(Baseline before this work: 199 passed, 1 skipped. Eleven tests added; none removed, none
weakened, none skipped. `site/scripts/private-structure.test.ts` is untouched — ADR-0011.)

```
$ npm run content:fixture
sync-content: synced 23 object(s) into src/content/sources.
sync-content: provenance local, complete=true.
stage-public-assets: public/pdfs/academic.pdf
... (4 more)

$ cat src/content/sources/.hub-content-source.json
{
  "provenance": "local",
  "complete": true,
  "syncedAt": "2026-09-19T03:20:17.690Z",
  "objectCount": 23
}

$ npm run build                      # public output
23:20:55 [build] 26 page(s) built in 12.68s
23:20:55 [build] Complete!
public build exit: 0

$ npm run check:smoke-routes
check:smoke-routes: all 7 smoke routes present in dist-public

$ npm run build:private               # private output
23:21:47 [hub-private-build] staged 3 payload file(s) for 2 private item(s) from their containing directories
23:21:47 [hub-private-build] checked 82 emitted path(s) against the gate's allowlist (SD-7)
23:21:47 [hub-private-build] wrote .hub-private-build.json: 2 private item(s), 82 file(s). scripts/sync-private.mjs will refuse to run without it.
23:21:47 [build] 3 page(s) built in 9.27s
23:21:47 [build] Complete!

$ npm run check:private-links
check:private-links: PASS — every link in 5 page(s) starts with /p/ and resolves to a file that exists.

$ npm run check:no-private-in-public
check:no-private-in-public: 2 private item(s) to look for in dist-public:
  phd-milestones/milestones — needles: qualified-id, slug, route, source, payload-path, title, summary
  phd-milestones/committee-dossier — needles: qualified-id, slug, route, source, payload-path, title, summary

check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary appears in any path or any file's contents under dist-public (157 files scanned).
```

### The leak check, still shown failing on a planted private slug

```
$ npm run demo:leak-check
  index.html
    contents: qualified-id of phd-milestones/milestones — "phd-milestones/milestones"
    …>Sign in</a></p> </footer><a href="/phd/phd-milestones/milestones/">Programme Milestone Tracker (fixture)…
  index.html
    contents: title of phd-milestones/milestones — "Programme Milestone Tracker (fixture)"
    …href="/phd/phd-milestones/milestones/">Programme Milestone Tracker (fixture)</a></body></html>…
  phd/phd-milestones/milestones/index.html
    path: slug of phd-milestones/milestones — "milestones"
  phd/phd-milestones/milestones/index.html
    path: source of phd-milestones/milestones — "phd-milestones"
  [9 findings in total: 6 in contents, 3 in paths]

The public output must not contain, name or link any private item (ADR-0005, design doc §12.1). Nothing has been deployed.

demo:leak-check: the check exited 1 (1 means it caught the leak).
demo:leak-check: PASS — the guard failed on the injected leak, which is what it is for. The real dist-public was never modified.
demo exit: 0
```

## B — The required-source guard: break it, then restore it

### B1 — BREAK IT. The required source's prefix is entirely absent → the build FAILS

```
$ mv src/content/sources/phd-milestones "$SCRATCH/vanished/"
$ ls src/content/sources
cv

$ npm run build
23:22:45 [content] Syncing content
23:22:45 [content] Clearing content store
expected published sources are missing from the synced tree:
  the expected source "phd-milestones" has no prefix at all under the synced tree. The hub has
  expected it since Checkpoint 4, so its complete absence is a FAULT, not a withdrawal: a source
  that withdrew everything still publishes a manifest with an empty items array (ADR-0010
  decisions 2 and 4). Either the sync did not complete, or the prefix was deleted. Found: cv.
  Location:
    /mnt/c/code/website/site/src/content.config.ts:205:11
  Stack trace:
    at loadSources (/mnt/c/code/website/site/src/content.config.ts:205:11)
PUBLIC BUILD EXIT: 1
```

**Before this change that build was green.** `required: false` meant a vanished private prefix
produced a successful build with an empty private area — C27, for the one source it was
written about.

### B2 — the PRIVATE build fails on the same tree, which is the half that matters

```
$ npm run build:private
23:23:12 [content] Syncing content
expected published sources are missing from the synced tree:
  the expected source "phd-milestones" has no prefix at all under the synced tree. … Found: cv.
  at loadSources (/mnt/c/code/website/site/src/content.config.ts:205:11)
```

The private build fails **before** it can write `.hub-private-build.json`, so
`scripts/sync-private.mjs` refuses to run (P2) and nothing is pruned from the private bucket.
That is ADR-0010 decision 3 gating decision 5, end to end.

### B3 — the cv-release fallback path, faithfully simulated, still builds

Not a hand-written marker: a cv-only staging tree handed to the **real producer command**
`fetch-data.sh` issues.

```
$ ./scripts/sync-content.sh --from "$SCRATCH/cv-only" --provenance cv-release --partial
sync-content: provenance cv-release, complete=false -- this tree cannot carry every declared source, so the expected-source check does not apply to it.

$ cat src/content/sources/.hub-content-source.json
{
  "provenance": "cv-release",
  "complete": false,
  "syncedAt": "2026-09-19T03:23:13.055Z",
  "objectCount": 19
}

$ npm run build
[hub-content] the expected-source check (ADR-0010 decision 4) did NOT run: the synced tree
declares provenance "cv-release" with complete: false, meaning its producer cannot supply every
declared source (the cv-release fallback carries "cv" alone). The expected-source check would
report a fault that is a property of the transport, not of the bucket, so it does not apply to
this tree.
23:23:48 [build] 26 page(s) built in 11.34s
23:23:48 [build] Complete!
```

The skip is **printed on every build that takes it**, naming the reason. It is not silent.

### B4 — the SAME cv-only tree WITHOUT `--partial` fails

The tree is byte-identical to B3; the only difference is what the producer declared. **This
transcript is also what every pull-request build would have looked like had the flip shipped
unqualified** — which is the whole argument for the marker.

```
$ ./scripts/sync-content.sh --from "$SCRATCH/cv-only"
$ npm run build
23:24:15 [content] Syncing content
expected published sources are missing from the synced tree:
  the expected source "phd-milestones" has no prefix at all under the synced tree. … Found: cv.
  at loadSources (/mnt/c/code/website/site/src/content.config.ts:205:11)
```

### B5 — RESTORE IT. The complete tree builds, and every guard passes again

```
$ npm run content:fixture
$ npm run build
23:24:49 [build] 26 page(s) built in 10.79s
23:24:49 [build] Complete!

$ npm run build:private
23:25:22 [hub-private-build] wrote .hub-private-build.json: 2 private item(s), 82 file(s).
23:25:22 [build] 3 page(s) built in 8.11s
23:25:22 [build] Complete!

$ npm run check:no-private-in-public
check:no-private-in-public: PASS — no private slug, source, route, payload path, title or summary appears in any path or any file's contents under dist-public (157 files scanned).
```

### The flipped declaration, as it now reads

```js
export const EXPECTED_SOURCES = [
  {
    source: "cv",
    required: true,
    since: "Phase 2",
    note: "Satellite #1. Publishes the CV variants and the cv-data payload.",
  },
  {
    source: "phd-milestones",
    required: true,
    since: "Checkpoint 4",
    note:
      "Satellite #2, the private one (SEAM-7). HAS PUBLISHED: first successful publish at " +
      "Checkpoint 4, 2026-09-17, and flipped to required: true on 2026-09-18. Its absence " +
      "is now a FAULT rather than a bootstrap state -- the private area silently emptying " +
      "is the consequence C27 names (ADR-0010 decision 4 and its 2026-09-17 amendment).",
  },
];
```

## C — The real synced tree, restored and verified

```
$ rm -rf src/content/sources && tar -xzf "$SCRATCH/real-sources-backup.tgz" -C .
files restored: 23 (expected 23)
sources present: cv
phd-milestones
provenance marker present? no — pre-change tree, fail-closed enforces

$ node scripts/stage-public-assets.mjs --sources src/content/sources
stage-public-assets: public/pdfs/academic.pdf … public/photo_jason_1.jpeg

$ npm run build          && npm run build:private
23:27:17 [build] 26 page(s) built in 11.37s        23:27:49 [build] Complete!
23:27:17 [build] Complete!                          (2 private item(s), 82 file(s))

$ npm test
 Test Files  16 passed (16)
      Tests  210 passed | 1 skipped (211)
```

The restored tree **carries no provenance marker** — it was synced before this change existed
— and it builds correctly because the fail-closed default enforces and both required sources
are present. That is an unplanned but useful proof that the change is backward-compatible with
every tree already on disk.

The archive and both scratch directories were deleted afterwards.

## D — Item 2: every occurrence of the title, and what was done with each

Searched the whole repository for `Selected Projects`, `Projects & Research`,
`Projects &amp; Research`, `Projects and Research`, and every occurrence of `Projects` in
`site/src/pages`, `site/src/layouts`, `site/src/components`, `site/scripts` and
`site/redirects`.

| # | Location | Text | Names the page? | Action |
|---|---|---|---|---|
| 1 | `site/src/pages/projects/index.astro:22` | `title="Selected Projects & Research"` | **Yes** — the page's `<h1>` | **CHANGED to `title="Projects"`** |
| 2 | `site/src/pages/projects/index.astro:23` | `pageTitle="Jason Cusati — Projects"` | Yes — `<title>` and `og:title` | Already correct. Unchanged |
| 3 | `site/src/pages/projects/index.astro:24` | `description="Selected projects and research by Jason Cusati."` | No — describes the page's *content*; renders as `meta description`/`og:description` | Unchanged. Raised as Open question 1 |
| 4 | `site/src/pages/cv/[variant].astro:127` | `<h2>Selected Projects &amp; Research</h2>` | No — a section heading **inside the rendered CV document** | Unchanged. Raised as Open question 2 |
| 5 | `site/src/pages/projects/[slug].astro:26` | `backLabel="Projects"` | Yes — the back-link to the page | Already correct. Unchanged |
| 6 | `site/src/pages/research/index.astro:20` | `listTitle="Projects"` | No — the heading over the **Research** page's list of research projects | Unchanged |
| 7 | `site/src/layouts/Base.astro:41` | `{ label: "Projects", section: "projects" }` | Yes — the primary-nav label | Already correct. Unchanged |
| 8 | `llm/sprints/2026-09-hub/STATE.md:434` (D7) | quotes the old title | n/a — control plane | Not mine to edit. Left for the Lead Architect |
| 9 | `llm/sprints/2026-09-hub/contracts/site-wave-0.md:79` | quotes the old title | n/a — my own contract | Left |

**Checked and carrying no page title at all**, so nothing to change: `site/scripts/site-routes.mjs`,
`site/scripts/route-inventory.mjs`, `site/scripts/check-smoke-routes.mjs`,
`site/redirects/github-pages.json`, and the generated sitemap (URLs only). No test anywhere
asserted the old string.

**The rendered result, from `dist-public` built from the real content tree:**

```
$ grep -o '<h1[^>]*>[^<]*</h1>' dist-public/projects/index.html
<h1 data-astro-cid-y3lfuyfp>Projects</h1>

$ grep -o '<title>[^<]*</title>' dist-public/projects/index.html
<title>Jason Cusati — Projects</title>

$ grep -o 'property="og:title" content="[^"]*"' dist-public/projects/index.html
property="og:title" content="Jason Cusati — Projects"

$ grep -o 'name="description" content="[^"]*"' dist-public/projects/index.html
name="description" content="Selected projects and research by Jason Cusati."   ← Open question 1
```

## E — File contract and repository hygiene

```
$ git status --short -- site firebase.json
 M firebase.json
 M site/scripts/fetch-data.sh
 M site/scripts/sync-content.sh
 M site/scripts/sync-content.test.ts
 M site/scripts/sync-local-data.sh
 M site/src/content.config.test.ts
 M site/src/content.config.ts
 M site/src/lib/hub-content.mjs
 M site/src/pages/projects/index.astro
```

Nine files, all inside `site/**` and `firebase.json`. **Not touched:**
`.github/workflows/build.yml`, `ci.yml`, `gate.yml`, `gate/**`, `infra/**`, `contract/**`,
`docs/**`, and `llm/**` apart from this handoff. Nothing in another repository.

**The working tree is shared with the other Wave 0 streams, and its contents moved while I
worked.** Mid-session it carried the `gate` stream's changes (`.github/workflows/gate.yml`,
`gate/**`, `gate/tests/test_signout.py`); by my final check those were gone and
`.github/workflows/build.yml` (infra's this wave) and `infra/gate-auth-role.tf` were modified
instead, alongside other streams' handoffs. **None of that is mine, at any point.** My change
set is exactly the nine files listed above, and it is stable. **Stage by path**, and do not
read a `git status` taken at any one moment as a statement about this stream.

Every tracked `*.sh` beginning with a shebang is still committed `100755`, read from the git
index rather than the filesystem (`/mnt/c` reports everything `0777`):

```
$ git ls-files -s | grep '\.sh$'
100755 … infra/scripts/check-private-bucket-iam.sh
100755 … infra/scripts/seed-members.sh
100755 … site/scripts/fetch-data.sh
100755 … site/scripts/sync-content.sh
100755 … site/scripts/sync-local-data.sh
```

No secret, token or key is present in any file written. No private slug, title or byte is
quoted anywhere in this document (§Assumptions 2). No test was weakened, skipped or deleted:
the three assertions that pinned `required: false` and the pre-flip `findMissingExpectedSources`
returns were **updated to pin the new behaviour**, and eight further assertions were added
around them.
