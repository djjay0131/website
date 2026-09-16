> Persisted by the Lead Architect, verbatim, with machine paths rewritten to
> repo-relative form (1 occurrences). No wording altered.
>
> This is the Chief Reviewer's **final** report. An earlier interim version was
> posted to PR #17 before it had incorporated the `cv` CI resolution; this one
> supersedes it and is the review of record.

# Chief Reviewer — Phase 2 (Publishing contract), PR #17

**Reviewed:** hub `djjay0131/website` @ `3591254` (code identical to `bbd85a4`; everything after it touches `llm/` records only) · satellite `djjay0131/cv` PR #13 @ `d9b402d`, companion PR #14 @ `5ee7515`
**Instruments:** canon `review-checklist.md` (Universal + Alignment throughout; Architecture/Documentation on the ADRs and design-doc amendments; Implementation on the code), `governance-levels.md`, `definition-of-done.md` §Implementation Work and §ADR Work, and the delta's three domain review questions.
**Stance:** I verified Part A from the Terraform and the workflows themselves. Where a claim rests on a third party, I read that third party's source at the pinned SHA rather than its documentation. Where I could not verify without cloud access, I say so and name the check.

---

## Part A — The credential boundary

All six invariants hold **in the artifacts**. One does not yet hold **in the world**, and that is the most important thing in this review.

### A.1 — No satellite identity is granted `storage.objects.list` by any path — **PASS**

Traced exhaustively through `infra/`, not taken from comments:

- `infra/satellite-role.tf` — `google_project_iam_custom_role.satellite_publisher` has `permissions = ["storage.objects.create", "storage.objects.delete", "storage.objects.get"]`. Three, no `list`.
- `infra/satellites.tf` — the **only** grant to a satellite service account is `google_storage_bucket_iam_member.satellite_publish_prefix`, whose `role` is that custom role. There is no second binding.
- No `google_project_iam_member` exists for any satellite principal. The only project-level bindings in the whole module are `hub_deploy_hosting_admin` and `hub_deploy_api_keys_viewer`, both for `hub-deploy`.
- Nothing grants a project-level storage role to anyone, so there is no inheritance path to a satellite. The hub's own `roles/storage.objectViewer` is bound on the **bucket**, not the project (`infra/storage.tf`), and to `hub-deploy` only.

The reasoning for the exclusion is correct and correctly sourced: `list` is granted at bucket level and cannot be narrowed by `resource.name`, so a conditioned listing grant would be a fiction. The asymmetry with the hub's unconditioned viewer grant is deliberate and justified in place.

**Not verifiable without cloud access:** that no *pre-existing or out-of-band* project-level binding gives `publish-cv@…` anything. Terraform sees only what it declares.

### A.2 — Prefix condition on the write-granting binding, and UBLA enabled — **PASS** (the highest-consequence line)

I checked both fail-open invariants myself rather than confirming your conclusion.

- **UBLA:** `infra/storage.tf` sets `uniform_bucket_level_access = true` on `google_storage_bucket.content`. Present.
- **Same binding:** the condition is attached to `google_storage_bucket_iam_member.satellite_publish_prefix` — the identical resource that carries `role = google_project_iam_custom_role.satellite_publisher.name`. The condition and the write grant are one binding, not two. Confirmed.
- **Trailing slash:** the expression is
  `resource.name.startsWith('projects/_/buckets/${bucket}/objects/sources/${each.key}/')`
  — it ends with `/`. So `sources/cv-other/…` does **not** satisfy a condition written for `sources/cv/`. Confirmed by reading the interpolation, not the comment. Conjoined with `resource.type == 'storage.googleapis.com/Object'`.
- Prefix-escape by crafted object name is not possible: GCS's namespace is flat, so `sources/cv/../x` is a literal name that still starts with `sources/cv/`. `hierarchical_namespace` is deliberately not set, which is what keeps that true.

**This is the pair that fails open and fails silently**, and nothing in CI currently asserts either one. The infra stream itself recommended a `satellite-role-guard` mirroring `budget-guard`; I endorse it and raise it to SHOULD-FIX (see findings).

**Checkpoint 3 — the owner must run:**
1. `gcloud storage buckets describe … --format="value(uniform_bucket_level_access.enabled,public_access_prevention,versioning.enabled)"` → expect `True enforced True`. **If the first value is not `True`, stop: no prefix condition is in effect.** (Already in `infra/README.md` step 2.)
2. `gcloud iam roles describe satellitePublisher --project … --format="value(includedPermissions)"` → expect exactly `storage.objects.create;storage.objects.delete;storage.objects.get`. (Step 3.)
3. **Not currently in the runbook, and I recommend adding it** — prove there is no *other* grant:
   - `gcloud projects get-iam-policy $PROJECT --flatten="bindings[].members" --filter="bindings.members:publish-cv@…" --format="table(bindings.role)"` → expect **no rows**.
   - `gcloud storage buckets get-iam-policy gs://$BUCKET` → expect exactly two bindings: `hub-deploy` objectViewer unconditioned, and the custom role conditioned to `sources/cv/`.

### A.3 — The publish path genuinely never lists the bucket — **PASS, verified from the action's source**

`contract/publish/action.yml` runs five steps: three validations (local `node`), then `google-github-actions/auth@7c6bc770…` (v3.0.0), then `google-github-actions/upload-cloud-storage@6397bd7208e18d13ba2619ee21b9873edc94427a`.

I downloaded that action at that exact commit and read it:

- `package.json` → `"version": "3.0.0"` — the SHA↔version claim in the comment is true.
- `grep -rn "getFiles|\.list(|listObjects" src/` → **no match**.
- Enumeration is `expandGlob()` in `src/util.ts`, built on `fast-glob` — a local filesystem walk.
- Upload is `storageBucket.upload(source, uploadOpts)` per file, `src/client.ts:260`.

So the claim rests on that version's source, as the contract required, and the source supports it. `parent: false`, `gzip: false`, `process_gcloudignore: false` and an unset `predefinedAcl` are each justified correctly (the last because UBLA rejects per-object ACLs).

The standing risk is correctly recorded in ADR-0007 Risks and `contract/README.md`: this is a property of the source, not a documented guarantee, so **any version bump must re-verify it**. Keep that rule; it is the one that protects the boundary.

Ordering is right and worth crediting: all three validations run **before** authentication, so a malformed or hostile manifest is rejected before a credential exists.

### A.4 — No GitHub credential for `website` anywhere in `cv` — **PASS in the repository tree; NOT YET TRUE of the repository**

Grepped, not skimmed, across all tracked files in the `cv` worktree:

- `.github/workflows/` contains **zero** `secrets.*` references of any kind.
- `build-cv.yml` has no `WEBSITE_DISPATCH_PAT`, no `vars.WEBSITE_REPO`, no `repository_dispatch`. Comparing against `master`, the step that carried them (lines 183–189 there) is **deleted, not commented out** — which is what ADR-0007 decision 2 requires.
- No PAT, no App, no private key, no `credentials_json`. The publish job's only credential is the run-time OIDC token.

**But the secret itself is still live.** Per STATE Risk 14, `WEBSITE_DISPATCH_PAT` exists in `cv` today (created 2026-08-17) with `WEBSITE_REPO` beside it, and by the workflow's own former comment it is a PAT with `repo` scope on `website`. Removing the last consumer does not remove the credential, and any future workflow in `cv` could pick it up. That is a long-lived credential giving a satellite write access to the hub — the exact condition principle 3 forbids and domain review question 2 exists to catch.

Merging this PR strictly improves the situation, so I do not treat it as blocking the merge. It **is** blocking the phase's central claim, and therefore Checkpoint 3.

### A.5 — No JSON key, key file, or long-lived secret in either repository — **PASS**

Scanned both trees for private-key headers, `"type": "service_account"`, `private_key_id`, `credentials_json`, `ghp_`/`github_pat_` and API-key shapes. The only hits are prose in handoffs *describing* the scan, plus the deliberate `dispatch_token` string inside `contract/examples/invalid/unknown-top-level-field.json` — which is a fixture asserting that such a field is rejected, and it is not a real token. `infra/` declares no `google_service_account_key` resource anywhere. The hub's only workflow secret is the optional, pre-existing `NOTIFICATION_WEBHOOK`.

### A.6 — `cv`'s WIF condition admits only `refs/heads/master`, and cannot be satisfied by a fork, a `pull_request_target` run, or another repository — **PASS**

Admission is decided twice, and I checked each leg against each attack:

Provider `github-cv` (`infra/satellites.tf`) —
`repository_id == '1211056144' && repository_owner_id == '5666389' && repository == 'djjay0131/cv' && event_name != 'pull_request_target'`.
Binding member —
`principalSet://…/attribute.repository_id_ref/1211056144/refs/heads/master`, where `attribute.repository_id_ref` maps from `assertion.repository_id + '/' + assertion.ref`.

- **Fork:** the fork's token carries the fork's own `repository_id`, so it fails the provider condition. Blocked at leg 1.
- **Same-repo pull request:** ref is `refs/pull/<n>/merge`, so `repository_id_ref` is `1211056144/refs/pull/<n>/merge` and does not match the binding. Blocked at leg 2.
- **`pull_request_target`:** refused outright at the provider — correctly, since it runs with the base ref while handling PR input.
- **Another repository:** fails `repository_id`, `repository_owner_id` and name.
- **Tag push:** `refs/tags/*` does not match the binding.

Two structural points are right and worth naming. First, `master` not `main` — a binding written for `main` would admit nothing and fail with an error that reads like a broken provider. Second, satellites live in their own `satellites` pool, so the shared-pool `principalSet` invariant that `wif.tf` documents becomes structural for the hub: no satellite provider exists in the hub's pool at all. Within the satellites pool the same invariant currently holds structurally too, because every provider is generated by one `for_each` from one `attribute_mapping` — that is a property of the current file, not of Terraform, and a future hand-written provider could break it. The file says so; keep it said.

`cv`'s workflow adds a third, nearer lock: `if: github.ref == 'refs/heads/master' && github.event_name != 'pull_request'`.

**Part A conclusion:** the boundary holds as designed and as written. It is not yet closed in reality, for one reason only — the live PAT.

---

## Part B — Contract coherence

**I tried to find a manifest the two ends disagree on, and could not.**

I wrote a 33-case differential probe running each manifest through *both* implementations — the publish-side `contract/validate-manifest.mjs` (dependency-free, the one the action actually runs) and the hub-side Zod mirror in `site/src/content.config.ts` — and compared accept/reject.

**Result: zero disagreements.** The cases included both directions of the `data`/`schema_version` `if/then/else`; `schema_version: "1.2.3"`; duplicate and over-count `tags`; every length boundary (`slug` 65, `title` 0 and 201, `summary` ""); `path` with a backslash, a control character, a leading slash, a `..` segment, a bare `.`, and `C:/x.pdf`; `published` with a lowercase `z`, a `+05:30` offset and fractional seconds; `source` at 40 chars and uppercase; `items` as a non-array, `null` items, string items, empty items; unknown fields at both levels; `__proto__` as an item field (rejected by both, no pollution); and a missing `published`.

Corroborating evidence:

- `contract` suite: **54/54 pass**, and it independently cross-checks the dependency-free interpreter against **ajv** on every fixture — so three implementations agree, not two. Its interpreter also *throws* on any schema keyword it does not implement, so the schema cannot silently outgrow the validator.
- `site` suite: **102 passed, 1 skipped.** It asserts every pattern is character-for-character identical to the schema's own `pattern` string, plus both enum lists, every length/count, both `required` lists, and `additionalProperties: false` at both levels. Drift fails the build rather than passing silently.
- Both ends reject the **same 12 invalid fixtures** — the contract suite asserts each rejection is for the reason the filename claims; the site suite asserts `loadSources()` throws `HubContentError` for every one.

**End-to-end, on live data:** I ran `cv`'s real generator (`tools.manifest.build_manifest()`) against `cv`'s actual variant files and validated the output with the hub's validator → `Manifest check "schema" passed`. The satellite's generator and the hub's schema agree on real content, not only on fixtures.

**The asymmetries are deliberate and correct, not drift:**

| Rule | Where enforced | Correct? |
|---|---|---|
| Field presence, types, fixed sets, closed objects | the JSON Schema, both ends | yes |
| `slug` unique | named code both sides (`validateManifestShape` contract-rule layer; `findDuplicateSlugs`) | yes — and both suites *assert the schema accepts a duplicate*, so nobody discovers it by accident |
| `path` resolves inside `dist/` incl. symlinks | publish action only (`checkPaths`, `realpath`) | yes — only the satellite's filesystem knows |
| Unclaimed `data` item / unknown `schema_version` | hub only | yes — ADR-0008 rules, not schema rules |

**Path-escape rule is enforced where it is claimed.** Textual half in the schema `pattern`; filesystem half in step (b) of the action, unit-tested against a real tree including a symlink that leaves `dist/` **and** one that stays inside (the second test is what proves the check is not simply rejecting all symlinks).

One small observation, NOTE only: `path: "C:/x.pdf"` and `path: "."` are accepted by *both* schema layers and caught only by the action's filesystem check (`path.win32.isAbsolute`). That is the right layering — the hub never resolves those paths outside the synced tree — but it means the hub's textual validation is, by design, slightly weaker than the publish gate. Worth knowing; not worth changing.

---

## Part C — ADR-0008, an independent view

**Would I have decided the same way? Yes — with two conditions attached.**

**Is the reasoning sound?** Substantially. The premise is checkable and checks out: six hub pages import `cv-data.ts`, which mirrors `cv/tools/resolver.py` including the extended DSL. The CV genuinely is data the hub renders, and the five existing formats are all documents the *satellite* renders. The ADR's refusal to pretend otherwise — "no wording makes §3 hold for `data`" — is the strongest thing in it. Recording a bounded, named exception is better than either misdescribing the CV as a `bundle` or quietly weakening §3 for all six formats.

**Are the alternatives fairly costed, especially "cv renders its own HTML"?** Directionally yes, but the costing leans toward the chosen option in one respect the owner should see.

Fairly stated: the CV pages would lose the hub's layout, typography and `schema.org/Person` JSON-LD, or `cv` must duplicate the design system and keep it in step — the coupling inverted, not removed. `cv` would carry a second renderer and a second visual-regression suite. And the decisive point, which I think is correct and is the reason I land where the ADR lands: **`/resumes/` and the `/cv/` variant index are hub-authored views over variant metadata, and `format: html` gives the hub no metadata to build them from.** Those pages have no natural home under the alternative. I looked for a middle path — publish the PDFs plus a small declared metadata document so the hub can build the index pages — and it does not work, because `/cv/<variant>` needs the full resolved pool, not just labels.

Understated: the ADR compares the two options as if both costs were one-time. They are not. `format: html` costs `cv` a renderer **once**; `format: data` costs the hub a maintained coupling **continuously** — every `cv` schema change is a potential hub change, forever, and the hub is the thing that must outlive the PhD. The Negative/Tradeoffs section acknowledges the coupling but not the recurrence asymmetry. That is the honest counter-argument, and the owner should weigh it knowing the ADR did not put it in those terms.

**Is the containment real?** Yes, and I verified it rather than accepting it:

- An unclaimed `data` item fails the build — I confirmed both `("cv","some-other-payload")` and `("agentic-kg","cv-data")` throw.
- An unknown `schema_version` fails the build — confirmed with `"2"` against a claim list of `["1"]`.
- The claimed set is one table with one row in `site/src/lib/hub-content.mjs`, imported by the config, the staging script, the pages and the tests — one declaration, not four.
- Critically, validation lives inside `loader.load()`, not at module scope. The site stream found that Astro *logs and skips* a content-config error at module scope but *propagates* a rejection from `load()` — so validating in the obvious place would have produced a green build with no content. That detail is what makes the containment real rather than nominal, and it deserves explicit credit.

**Reversible, or does it harden?** Mostly reversible; one genuine ratchet. Reversible: `data` is one enum member, one claim row, one renderer — if `cv` ever ships HTML, all three come out. The ratchet is that `additionalProperties: false` plus fixed enums means the *contract itself* cannot evolve gracefully: a satellite cannot send a field before the hub accepts it, so removing or re-shaping `data` later is a coordinated breaking change. STATE C20 identifies this precisely and proposes `manifest_version` — optional in Phase 3, required in Phase 5. I endorse that and would raise its priority, because `data` is exactly the format most likely to need contract evolution.

**My two conditions:**

1. Make "a second `data` source requires its own ADR" **normative in ADR-0008**, not advisory. Today the ADR says the review bar "should be high" and STATE C19 records the intent. Intent recorded in a sprint file will not survive to Phase 5; a decision sentence in the ADR will.
2. Land `manifest_version` (C20) before Phase 3.

Decision 6 (cv is public, default branch `master`) is correct and I verified it independently — the Terraform binds `refs/heads/master` and `repository_id 1211056144`, and both cv PRs target `master`.

One presentational note: the amended `fetch-data.sh` paragraph now sits inside ADR-0008's **Consequences**, where it reads as a correction embedded in an accepted decision. It is honest and dated, which matters more than tidiness, but an explicit "Amended 2026-09-16" note would age better.

---

## Part D — Scope and phase boundary

**No Phase 3 has leaked in.** I grepped the code diff (not the prose) for `dist-private`, `HUB_OUTPUT`, leak checks, private buckets, `hub-gate`, Cloud Run and Hosting rewrites. Every hit is documentation: schema field descriptions, ADR text, and `source: "phd-milestones"` inside the shared fixture — which is the design-doc §4 example **verbatim** and correct to keep. Concretely:

- No private bucket, no two-output build, no leak check, no gate, no rewrites. `firebase.json` untouched.
- `var.satellites` has exactly one entry, `cv`. No `phd-milestones` identity.
- `visibility: private` is **accepted** by both validators and **handled** by neither. That is required — the §4 shared fixture is a `private`/`phd` item, so the mirror must take it — and accepting is not publishing.
- `.github/workflows/ci.yml`, `CLAUDE.md`, `AGENTS.md`, `.claude/` — empty diff, verified.

**Every changed file is within a declared scope.** `contract/**` → contract; `infra/**` → infra; `site/**` + `build.yml` + `.gitignore` → site; `docs/satellites.md` + `llm/**` → Lead Architect. The seam discipline visibly worked: the `cv` stream found a defect in `docs/satellites.md` and **reported** it rather than editing another owner's file, and the Lead corrected it — which is exactly SEAM-6's purpose.

**Route parity — verified, not accepted.** The seven page diffs are import-and-path-constant changes only; `cv-data.ts`'s resolver logic is untouched (only its *arguments* changed); `site/src/lib/` gains `hub-content.mjs` and nothing else substantive. In a clean clone at the reviewed head, after `./scripts/sync-content.sh --from fixtures/content`:

- `npm run build` → exit 0, 25 pages
- `npm run check:smoke-routes` → **all 7 smoke routes present in `dist-public`**
- `npm test` → **102 passed, 1 skipped**

`/pdfs/<variant>.pdf` is preserved by `stage-public-assets.mjs` copying into `public/pdfs/` — driven by the manifest rather than by globbing, so a withdrawn item stops being served even though its bytes remain in the bucket. That is the only behaviour consistent with "the manifest is the authority", and it is tested. I did not independently re-run the handoff's stronger byte-identical claim across 155→159 files, but the mechanism is sound and every structural check I ran is consistent with it.

**"Section pages render from collections" — can Phase 2 close without it? Yes, and it should.**

Three reasons:

1. **It conflicts with this phase's own binding requirement.** Phase 2 requires rendered output not to change. You cannot add collection-driven section pages *and* keep the CV byte-identical unless the new pages are unreachable — and shipping unreachable pages is worse than not shipping them.
2. **There is nothing for it to show.** With `cv` as the only satellite — four PDFs and one `data` payload — a collection-driven section page displays exactly what `/cv/` and `/resumes/` already display. The first *useful* consumer is a second satellite, which is Phase 5.
3. **The risky half already landed.** The collection, its loader, and its validation are built and exercised; only the rendering is deferred. The deliverable that could have gone wrong is done.

Close it explicitly rather than leaving it ambiguous: the roadmap line and STATE C26 already record it honestly as the Lead Architect's omission, which is the right way to handle it. The owner should tick it as deferred-to-Phase-5. The one honest cost to name: nothing currently renders from the collection, so it is exercised only by tests and the build's validation path — latent code until Phase 5.

**On `fetch-data.sh` being retained — does the reasoning hold, and is the fallback safe?** Yes to both.

The reasoning is correct and I checked its premise: the hub reads the bucket as `hub-deploy`, whose binding admits only `<repository_id>/refs/heads/main` (`infra/deploy.tf`), and a pull-request run carries `refs/pull/<n>/merge`. A PR build therefore *cannot* authenticate. Deleting the script would have broken every PR build (failing `check:smoke-routes` on `/cv/academic`) and left `main` with no CV source between merge and Checkpoint 3 — while GitHub Pages is still authoritative and serving live CV links. Reversing SEAM-4 was the right call, and reversing it *by amending the seam and the roadmap* rather than silently was the right way to do it.

The implementation is safe because the fallback is not a second code path: all four producers write the same bucket-shaped tree and the same manifest, and everything downstream — schema validation, the claim check, staging — runs identically. The mode decision is made once in the `check` job and reused by every job, so the poll and the builds cannot disagree about provenance. Every run prints a `::notice::` naming its source and why, and `build-info.json` records `content_source`, so the deployed site states which path produced it. That last point matters: it converts the one real risk (an accidentally-unset `GCP_CONTENT_BUCKET` silently reverting to the release and looking healthy) from invisible into observable. **Checkpoint 3 should confirm `content_source` reads `bucket`.**

---

## Part E — Governance

**Level declaration — L2 is correct.** The PR mixes L1 (two ADRs, design-doc amendments, roadmap, delta) with L2 (Terraform, workflows, schema, application code), and canon classifies at the highest level touched. One observation the owner should have: here "highest" (L2) is not "most consequential" (L1) — ADR-0008 knowingly weakens a design-authority property, which is the weightiest thing in the PR. The practical consequence is nil, since L1–L3 all require owner review and owner-only merge, but the L2 label undersells the decision.

**Definition of Done.** §Implementation Work: approved issue (#16) ✓, design docs/ADRs exist ✓, reviewed via PR ✓ (this), tests/validation included ✓ (I re-ran them), documentation updated ✓, security/privacy impacts documented ✓, memory bank updated ✓. §ADR Work for both 0007 and 0008: context, decision, alternatives, consequences, status, related docs/PRs — all present and substantive. §Merge Readiness: **not yet met** — still draft, and unlabelled.

**ADRs well-formed and indexed.** Both added to `adr/README.md`; ADR-0002 correctly amended to record that its dispatch step is *not built* and is completed by ADR-0007, with decisions 2–4 explicitly standing. Governance checks at the reviewed head: **4 of 4 PASS** (governance-links, adr-index, adr-status, layout), run from the canon checkout.

**Artifacts-slot declaration matches reality.** The delta declares `docs/`; `docs/satellites.md` is its only content, is a genuine derived view, and names the control-plane documents it projects. Exactly as STATE A1/A22 said it would go.

**Were the mid-phase corrections complete and consistent? Mostly — three spots were missed, one of them in the delta.**

The amendments themselves are present and mutually consistent: SEAM-4, the two roadmap lines, ADR-0008's Consequences and `docs/satellites.md` all now say the same thing. Both gaps the `cv` stream reported in the how-to (*generate, don't hand-write, your manifest*; the `schema_version` bump rule) **were** closed — I confirmed both are on the page. But the sweep found survivors:

1. **`llm/governance/governance-delta.md:249`** still reads "…formalized under the manifest contract in Phase 2, **after which `fetch-data.sh` is removed**." This directly contradicts the amended roadmap, SEAM-4 and ADR-0008 — in the governance document whose job is to declare project facts.
2. **Design doc §9**, repository-layout comment: `build.yml # push + repository_dispatch: …` — still describes the trigger this phase removed.
3. **Design doc §11**, phase table row 2: "Contract schema, publish action, content bucket, **dispatch rebuild**."

(§11's "bucket + dispatch" at line 283 sits in a historical *ADRs to write* list — leave that one; it records what was decided then.)

None changes behaviour. All three undercut the checklist's final question — *would a future contributor understand this without reading the original chat?* — and #1 is in the delta.

**Undocumented durable decisions.** One worth pressing on: **withdrawal semantics**. "An empty `items` array is the only way a satellite retracts content, because it cannot list and therefore cannot prune" is now a durable cross-repository interface rule. It is asserted in the schema's own `items` description and in `contract/README.md`, but it has no ADR — it lives in STATE C23/C27 and as an ADR candidate in the site handoff. It spans the publish action, the bucket, the fingerprint, the staging step and Phase 3's private items, and no single document states it. Make it an ADR before Phase 3, when the withdrawn item may be private. Lesser candidates (poll interval, custom-role `deletion_policy = "PREVENT"`) are adequately captured as candidates.

**The contract stream's handoff is committed as a binary file.** `git diff --numstat` reports `- -` for `llm/sprints/2026-09-hub/handoffs/contract-phase-2.md`, and `git grep` says only *"Binary file … matches"*. I diagnosed the cause: the handoff quotes the validator's error text for the path fixtures, which embeds the schema's `[^\\\x00-\x1f]` pattern with **literal NUL and 0x1F bytes** (offsets 5437/5439 and 5624/5626). Git's heuristic sees a NUL inside the first 8 KB and stops treating the file as text. The file is otherwise valid UTF-8. Consequence: a control-plane record is not diffable, not reviewable in the PR, and not greppable. Fix is to escape those two bytes in the quoted text. This will silently recur every time a handoff quotes validator output.

**The executable bit, and what local validation can prove.** I reached this independently before it was reported: at the tree I first read, `git ls-files -s` recorded `site/scripts/sync-content.sh` as `100644`, while `fetch-data.sh:120`, `sync-local-data.sh:113`, `build.yml:159` and three `package.json` scripts all invoke it **directly** as `./scripts/sync-content.sh`. On Linux that is exit 126. It was invisible here because `<path>` is a DrvFs mount reporting every file as 0777 — my own fresh-clone test briefly *contradicted* the finding, because the fix landed between my two commands. Fixed in `bbd85a4`; at the reviewed head all three tracked `.sh` files are `100755` (verified from the committed tree, not from `ls -l`).

I agree this is a finding about the validation story, not a slip. And I agree a spelling-based scan is the wrong guard — twelve false positives against one real defect, and a noisy guard gets switched off. **I'd propose a reachability-independent rule instead:** *every tracked `*.sh` whose first two bytes are `#!` must be mode `100755`.* It needs no call-graph analysis and has no false-positive class, because marking a `bash`-invoked script executable is harmless. I ran it against the head: three files, all compliant, **zero violations** — it can land green today as a three-line CI step reading `git ls-tree`. `.mjs` files are reached via `node`/`import` and need no bit, so the rule correctly ignores them. STATE already records the DrvFs hazard as binding on Phase 3's `gate/`, which is the right place for it.

**Memory bank and STATE are synchronized to reality** — unusually well. STATE records C25/C26/C27, Risks 14/15, the corrected Checkpoint 3 ordering, and the exec-bit lesson as a constraint on later phases. Two cosmetic slips: STATE's header still says *Last updated: 2026-09-15* while its body records 2026-09-16 events, and `activeContext.md` has a duplicated "§10 Q3, Q4, Q6" bullet plus a leftover "K1–K13" line beside the corrected "K1–K12".

**PR hygiene.** #17 is still **draft** and carries **no labels**, where PR #12 carried `gov-L2` and the phase label. Both are pre-merge steps.

**Commit hygiene** is good: scoped commits per stream, messages that name the issue and describe the actual change, and a correction commit (`bbd85a4`) that states the failure and its cause rather than saying "fix CI".

**On the `cv` side**, per your confirmation I am not treating CI as a finding. I do endorse the observation you asked about: **every action in `build-cv.yml` floats on a tag** — including `xu-cheng/latex-action@v3`, which supplies the entire TeXLive toolchain, and `softprops/action-gh-release@v2`, which holds `contents: write` in the same job that now holds `id-token: write`. The hub pins everything by SHA; `cv` pins nothing. Recorded as STATE Risk 16, correctly out of scope here, and worth an issue in `cv`.

One related item that *is* in scope: **`cv` calls the hub action at `djjay0131/website/contract/publish@main`** — a floating ref, in a job holding `id-token: write` and `contents: write`. It is first-party so the trust relationship is different from a third-party action, and every document advertises `@main` consistently (design doc §4, `contract/README.md`, `docs/satellites.md`). But it means any push to the hub's `main` immediately changes what executes inside every satellite. That is a deliberate design property — it is how satellites get contract fixes without a PR each — and I am not asking to change it in this phase. I am asking that it be *stated* as a decision rather than left implicit, because it is the one place where the hub does hold power over a satellite's runtime.

---

## Findings

### BLOCKING

**None for the merge.** No finding in this review must change before PR #17 can merge.

One item is **blocking for Checkpoint 3**, not for the merge:

- **B1 — `WEBSITE_DISPATCH_PAT` is still live in `cv`.** (STATE Risk 14; domain review question 2; principle 3.) The phase claims no satellite holds a GitHub credential for the hub. Every artifact honours that; the repository does not. Deleting the workflow step does not remove the secret, and **deleting the secret does not revoke the token** — both halves are required, and both are owner actions. Phase 2 must not be signed off until this is done.

### SHOULD-FIX (before the PR leaves draft, or before the next phase)

- **S1 — The governance delta still says `fetch-data.sh` is removed** (`governance-delta.md:249`), contradicting the amended roadmap, SEAM-4 and ADR-0008. One line.
- **S2 — Two stale dispatch references survive in the design-authority document**: §9's `build.yml` layout comment and §11's phase-2 table row ("dispatch rebuild"). §3 and §4 were amended; these were missed.
- **S3 — The contract handoff is committed as a binary file** because it quotes validator output containing literal NUL/0x1F bytes. A control-plane record that cannot be diffed or reviewed. Escape the two bytes.
- **S4 — `contract/README.md` carries edit debris** from the five→four correction: a duplicated dangling sentence ("…secrets makes failures harder to read." immediately followed by "secret, and treating them as secrets only makes failures harder to read."). The number itself is now correct and matches `docs/satellites.md`.
- **S5 — Add a `satellite-role-guard` CI check**, mirroring `budget-guard`: assert `uniform_bucket_level_access = true` and that the custom role holds exactly its three permissions with no `list`. These are the two invariants whose breakage is invisible and fails **open**. The infra stream recommended this; it belongs in `build.yml`, which was the site stream's file this phase, so it lands at reconciliation or early in Phase 3.
- **S6 — Add the executable-bit guard** as described above (shebang-bearing `*.sh` must be `100755`). Zero violations at the current head, so it lands green.
- **S7 — Take PR #17 out of draft and label it** (`gov-L2` + phase label), per DoD §Merge Readiness and the Phase 1 precedent.
- **S8 — Raise `manifest_version` (STATE C20) to a near-term ADR**, and make "a second `data` source requires its own ADR" normative inside ADR-0008 rather than advisory in STATE C19.
- **S9 — Give withdrawal semantics an ADR** before Phase 3 (STATE C23/C27).
- **S10 — Add the no-other-binding checks to the Checkpoint 3 runbook** (project-level IAM policy filtered to the publish SA → expect no rows; bucket IAM policy → expect exactly two bindings). The runbook verifies the role and the bucket but not the absence of a second grant.
- **S11 — `cv`'s stale feature spec.** `llm/features/cv-website.md` still describes the PAT-based dispatch as the current design. The satellite handoff correctly identifies it as a dated historical record and declines to rewrite history — right call — but a status banner pointing at `llm/features/hub-publishing.md` would stop a future reader acting on it. `cv`-side.

### NOTE

- **N1** — `npm test` on a fresh clone produces 8 failures (`bib.test.ts` ×5, `cv-data.test.ts` ×3, all ENOENT under `src/content/sources/`) until content is synced; `./scripts/sync-content.sh --from fixtures/content` fixes it and `site/README.md` documents that. CI is unaffected (`fetch-data.sh` runs first). This property pre-dates Phase 2. A one-line hint in the failure path would save a contributor ten minutes.
- **N2** — `path: "C:/x.pdf"` and `path: "."` pass both schema layers and are caught only by the publish action's filesystem check. Correct layering; worth knowing.
- **N3** — The satellites-pool `attribute_mapping` invariant is structural only while every provider comes from the single `for_each`. Documented in the file; keep it documented.
- **N4** — ADR-0008's `fetch-data.sh` correction sits inside Consequences and reads as a correction embedded in a decision; an "Amended 2026-09-16" note would age better.
- **N5** — STATE's header date (2026-09-15) trails its content (2026-09-16); `activeContext.md` has a duplicated bullet and a leftover "K1–K13" line.
- **N6** — Nothing yet renders from the new content collection (consequence of the deferred section-pages item). Latent code until Phase 5.
- **N7** — `cv` calls the hub's composite action at the floating `@main`. Deliberate and consistently documented; worth recording as a decision rather than leaving implicit.
- **N8** — Genuinely good work worth naming, because it is the kind that is invisible when it succeeds: validating inside `loader.load()` after discovering that Astro logs-and-skips module-scope config errors; the fingerprint built over the whole object set so **deletions** change it; `stage-public-assets.mjs` driven by the manifest rather than by globbing, so withdrawal works; and the `contract` suite cross-checking its dependency-free interpreter against ajv on every fixture.

---

## Verdict

# Comment

**Nothing is blocking the merge.** Part A — the claim this phase stands on — holds, and it holds under independent verification rather than on the assurances of the ADRs, the handoffs or the commit messages. The two invariants that fail open are both correct: `uniform_bucket_level_access = true` is present, and the prefix condition does end in a trailing slash, so `sources/cv-other/` cannot satisfy a condition meant for `sources/cv/`. I checked both myself and reached your conclusion by a different route. The contract mirrors in both directions — I tried 33 adversarial manifests and found no disagreement between the two ends, and `cv`'s real generator validates against the hub's real schema. No Phase 3 work has leaked in, and every Phase 1 URL still resolves.

It is Comment rather than Approve because of S1–S4: a governance document and the design-authority document still contradict decisions this PR made, one control-plane record is unreviewable because git classifies it as binary, and a corrected page carries edit debris. Each is a small edit. None affects behaviour. All four should land before the PR leaves draft, because they are precisely the kind of residue that makes a future contributor reconstruct the decision from a chat log that no longer exists.

Phase 2 can close without "section pages render from collections," and closing it explicitly — as deferred to Phase 5 — is better than holding the phase open for a criterion that conflicts with this phase's own no-visible-change requirement and that has nothing to render.

### The single most important thing before merging

**Revoke `WEBSITE_DISPATCH_PAT`, and do both halves.**

This phase's entire claim is that no satellite holds a GitHub credential for the hub. Every file in both repositories now honours that claim. The `cv` repository still does not: a PAT with `repo` scope on `website`, created 2026-08-17, is live right now, with `WEBSITE_REPO` sitting beside it. Merging this PR does not touch it. Deleting the workflow step did not touch it. And deleting the repository secret **still leaves a valid token in the account** — it must also be revoked at github.com/settings/tokens.

Until that is done, the credential boundary this phase establishes is real in the design, real in the Terraform, real in the workflows — and open in the one place an attacker would actually look. It is first in the Checkpoint 3 ordering for good reason; it should stay first, and it is independent of everything else on that list, so there is no reason to wait for the Terraform apply to do it.

---

*Reviewed against `agentic-governance` v0.8.3 (`5689b69`). Governance checks 4 of 4 PASS at the reviewed head. `terraform fmt -check -recursive` and `terraform validate` clean via `hashicorp/terraform:1.14.0`; `actionlint` clean on the hub via `rhysd/actionlint:latest` (3 pre-existing findings in `cv`, none in Phase 2 code). Contract suite 54/54; site suite 102 passed / 1 skipped; site build exit 0; 7 of 7 smoke routes present. No cloud resource was created, changed or read, and no `git` or `gh` mutation was run in either repository.*
