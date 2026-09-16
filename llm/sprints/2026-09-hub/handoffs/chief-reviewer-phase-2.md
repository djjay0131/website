> Persisted by the Lead Architect. The Chief Reviewer's report, verbatim, with one
> mechanical change: 8 absolute machine paths were rewritten to repo-relative form
> so no workstation path enters this repository. No wording was altered.

# Chief Reviewer — Phase 2 (Publishing contract)

**Reviewing:** hub PR #17, branch `feat/publishing-contract`, head **`bbd85a4`** (re-reviewed from `9be8d98` after the CI fix) · satellite `cv` PR #13, branch `feat/publish-contract`, head `d9b402d` · companion `cv` PR #14
**Instruments:** canon `review-checklist.md` (Universal + Alignment throughout; Architecture/Documentation on the ADRs and design-doc amendments; Implementation on the code), `governance-levels.md`, `definition-of-done.md` §Implementation Work and §ADR Work, and the delta's three domain review questions.
**Verified without cloud credentials.** No command in this review created, changed or read a cloud resource; no `terraform plan` or `apply` was run; no git or `gh` mutation was made in either repository.

---

## A. The credential boundary

I verified each point from the Terraform and the workflows themselves. Where the ADRs, handoffs and commit messages assert a property, I ignored the assertion and read the source.

**A1 — No satellite identity is granted `storage.objects.list` by any path. HOLDS.**

`infra/satellite-role.tf` defines `google_project_iam_custom_role.satellite_publisher` with `permissions = ["storage.objects.create", "storage.objects.delete", "storage.objects.get"]` and nothing else. I then enumerated every binding in the module rather than trusting that file in isolation. The only two resources that touch a satellite service account are `google_service_account_iam_member.satellite_publish_wif` (grants `roles/iam.workloadIdentityUser` **on the service account itself** — impersonation, not storage) and `google_storage_bucket_iam_member.satellite_publish_prefix` (the custom role, on the bucket). No satellite appears in any `google_project_iam_member`; the only two project-level bindings in the module are `hub_deploy_hosting_admin` and `hub_deploy_api_keys_viewer`, both for `hub_deploy`. There is no `google_storage_bucket_iam_binding` or `_policy` anywhere — which matters, because an authoritative binding resource could silently replace the conditioned member grant. There is no second role, no predefined role, and no `google_project_iam_custom_role` other than this one.

What Terraform **cannot** prove is the absence of a project- or organization-level binding created outside this module. Named Checkpoint 3 check below.

**A2 — The prefix condition is on the binding that actually grants write, and UBLA is enabled. HOLDS. This is the line I checked hardest, and I checked it independently rather than confirming your conclusion.**

Both invariants fail *open*, so I treated them as the highest-consequence lines in the PR.

*Uniform bucket-level access:* `infra/storage.tf` sets `uniform_bucket_level_access = true` on `google_storage_bucket.content`, alongside `public_access_prevention = "enforced"`, `versioning { enabled = true }` and `force_destroy = false`. It is present and correct. The reasoning in the file is also correct: without UBLA an IAM condition does not apply at all, every satellite's prefix condition stops constraining anything, and each write grant silently covers the whole bucket, with nothing else in the module looking different.

*The condition is attached to the write grant, not to a decorative sibling:* the `condition { }` block sits **inside** `google_storage_bucket_iam_member.satellite_publish_prefix` — the same resource whose `role` is `google_project_iam_custom_role.satellite_publisher.name`. There is no unconditioned duplicate of that binding anywhere in the module.

*The trailing slash:* the expression is

```
resource.type == 'storage.googleapis.com/Object' &&
resource.name.startsWith('projects/_/buckets/${bucket}/objects/sources/${each.key}/')
```

The literal terminates `…/objects/sources/cv/'` — the trailing slash is present. Without it, `sources/cv-other/` would satisfy a condition meant for `sources/cv/`. It does not. The infra handoff's Checkpoint 3 test 1 includes exactly that `sources/cv-other/` probe as a deliberate third case, which is the right instinct.

The flat-namespace argument in the comments is also sound: Cloud Storage object names are literal strings, so `sources/cv/../phd-milestones/x` is a single name that still `startsWith` the prefix — not a traversal out of it. The boundary therefore does not depend on the publish action's path checks, though those exist too.

**Neither of these can be confirmed as *applied* without cloud access** — Terraform describes intent, and a console edit or an out-of-band change would not show up here. Checkpoint 3 checks named below. This is also the basis of my strongest SHOULD-FIX: nothing in CI asserts either invariant.

**A3 — The publish path genuinely never lists the bucket. HOLDS — verified from the pinned version's source, not from documentation.**

`contract/publish/action.yml` runs three validations, then `google-github-actions/auth`, then `google-github-actions/upload-cloud-storage`. No `gcloud`, no `gsutil`, no `rsync`, no recursive copy.

I downloaded the action at its pinned SHA `6397bd7208e18d13ba2619ee21b9873edc94427a` and inspected it:

- `package.json` → `"version": "3.0.0"`, so the SHA and the version comment agree (the pin is honest).
- `grep` across `src/` for `getFiles`, `.list(`, `listObjects` → **no match**.
- Enumeration is local: `src/main.ts:84` calls `expandGlob(absoluteRoot, computedGlob)`, and `src/util.ts:21` imports `fast-glob`.
- Upload is per file: `src/client.ts:260` calls `storageBucket.upload(source, uploadOpts)`.

So the no-list property is a real property of this version's source. ADR-0007 is right to record it as a source property rather than a documented guarantee, and right to require re-verification on any bump.

Two further details are correct and non-default, and worth affirming: **all three validations run before authentication**, so a malformed or malicious manifest is rejected before a credential is minted and before a byte is uploaded; and `parent: false`, `gzip: false`, `process_gcloudignore: false` are each set deliberately, with `predefinedAcl` left unset because UBLA rejects per-object ACLs.

**A4 — No GitHub credential for `website` exists anywhere in `cv`. HOLDS in the code. The live secret is the real gap.**

I grepped rather than skimmed. On `feat/publish-contract`, `git grep 'secrets\.' -- .github/` returns **nothing at all** — the workflow references no secret of any kind. Zero hits for `WEBSITE_DISPATCH_PAT`, `WEBSITE_REPO` or `repository_dispatch` in `.github/`. Comparing against `master`, which still carries the step at lines 183–189, confirms the step was **deleted, not disabled or commented out**. The remaining textual mentions in `cv` are in memory-bank and feature docs describing the deletion, plus the stale April spec `llm/features/cv-website.md`, which the satellite stream correctly flagged as historical rather than rewriting.

But: **`WEBSITE_DISPATCH_PAT` still exists as a live secret in the `cv` repository**, per STATE Risk 14, and deleting the workflow step does not remove it. Any future workflow in `cv` could use it, and by `build-cv.yml`'s own former comment it is a `repo`-scoped PAT on `website` — a long-lived credential giving a satellite write access to the hub. That is precisely the condition ADR-0007 forbids, principle 3 prohibits and the delta's domain question 2 asks about. **Until the secret is deleted and the token revoked at the account level, the credential boundary this phase claims is asserted but not achieved.** It is correctly sequenced first in the Checkpoint 3 order.

**A5 — No JSON key, key file or long-lived secret in either repository. HOLDS.**

Scanned both repos for private-key markers, `"type": "service_account"`, `private_key_id`, `credentials_json`, `ghp_`, `github_pat_` and Google API-key shapes. Hub hits are prose in handoffs only; `cv` returns nothing. No key-like file is tracked. No `google_service_account_key` resource exists anywhere in `infra/` — I read every `.tf`. Authentication is WIF in both repositories.

One deliberate false positive worth knowing about: `contract/examples/invalid/unknown-top-level-field.json` contains `"dispatch_token": "ghp_notARealTokenButThisFieldMustNeverBeAccepted"`. That is a fixture proving the schema rejects exactly the field a future contributor might add to smuggle a dispatch credential through the manifest. It is good design, not a leak — but a secret scanner will flag it, so it is worth an allowlist entry if scanning is ever added (review recommendation 5 from Phase 0).

**A6 — `cv`'s WIF condition admits `refs/heads/master` and cannot be satisfied by a fork, a `pull_request_target` run, or another repository. HOLDS.**

Admission is decided twice, and I checked both halves.

*Provider* (`infra/satellites.tf`): `assertion.repository_id == '1211056144' && assertion.repository_owner_id == '5666389' && assertion.repository == 'djjay0131/cv' && assertion.event_name != 'pull_request_target'`.

*Binding:* `principalSet://…/attribute.repository_id_ref/1211056144/refs/heads/master`, built from `refs/heads/${default_branch}` where `default_branch = "master"`. Correct — `master`, not `main`. A binding written for `main` would admit nothing and fail with an error that looks like a misconfigured provider, which is the trap ADR-0008 decision 6 exists to avoid.

So: a **fork** PR carries the fork's `repository_id` and fails the provider condition. A **same-repo** PR carries `refs/pull/<n>/merge`, producing `1211056144/refs/pull/N/merge`, which does not match the bound attribute and fails the binding. **`pull_request_target`** is refused outright at the provider. `cv` is public, so anyone can open a PR against it — and neither half admits one.

The **separate `satellites` pool** is what makes this structural rather than a review obligation, and it correctly closes Phase 1's finding F4 / candidate C12: a `principalSet` is scoped to the *pool*, so the hub's deploy binding is safe only while every provider in its pool maps `attribute.repository_id_ref` identically. No satellite provider exists in the hub's `github-actions` pool at all, so no satellite token can even be presented against a hub binding.

Defence in depth on the satellite side too: `cv`'s publish job is gated `if: github.ref == 'refs/heads/master' && github.event_name != 'pull_request'`, which is the nearer of two locks.

*Residual (NOTE):* within the `satellites` pool the same mapping invariant holds only because every provider is generated by one `for_each` from one `attribute_mapping`. A hand-written provider added later with a different mapping could satisfy another satellite's binding. `satellites.tf` states this explicitly and tells the reader to add a map entry instead. Documented, acceptable, worth carrying into Phase 3.

**Part A verdict: all six hold. Nothing in Part A is blocking.** Two invariants are unverifiable without cloud access and one live credential remains outside this PR's reach.

### Checkpoint 3 checks the owner should run (what I could not verify)

1. **UBLA / PAP / versioning actually applied** — `gcloud storage buckets describe` → expect `True  enforced  True`. If the first is not `True`, stop: every prefix condition is inert.
2. **Role contents** — `gcloud iam roles describe satellitePublisher` → expect exactly `storage.objects.create;storage.objects.delete;storage.objects.get`. If `storage.objects.list` appears, stop.
3. **No project-level binding reaches a satellite SA** *(this closes A1's one leg Terraform cannot prove)* — `gcloud projects get-iam-policy <project> --flatten=bindings --filter=bindings.members:publish-cv@…` → expect empty.
4. **No user-managed keys** — `gcloud iam service-accounts keys list --iam-account=publish-cv@… --managed-by=user` → expect empty.
5. **The three prefix-boundary proofs**, including the `sources/cv-other/` probe that tests the trailing slash.
6. **First bucket-mode run** — watch for a 403 naming `storage.buckets.get` (the hub's `objectViewer` grant does not include it), and confirm the deployed `build-info.json` reports `content_source: bucket`, not `cv-release`.
7. **After revocation** — `gh secret list --repo djjay0131/cv` shows no `WEBSITE_DISPATCH_PAT`.

---

## B. Contract coherence

**I tried to find a manifest one end accepts and the other rejects, and I could not.**

I built a differential harness running 33 adversarial manifests through both ends — the publish-side dependency-free interpreter (`contract/validate-manifest.mjs --check schema`, invoked as a subprocess, exactly as the action runs it) and the hub-side Zod mirror (`manifestSchema` from `site/src/content.config.ts`). Cases included: `schema_version` present/absent on `data` and non-`data`; `schema_version: "1.2.3"`; duplicate and over-count tags; boundary lengths (slug 65, title 0 and 201); backslash, control character, `..`, leading slash, bare `.` and Windows-absolute `C:/x` in `path`; lowercase `z`, `+05:30` offset and fractional seconds in `published`; non-string `date`; over-long and uppercase `source`; `items` not an array; a `null` item; a string item; empty `items`; unknown fields at both levels; a `__proto__` injection; and a missing `published`.

**Result: zero disagreements.** Every case was accepted by both or rejected by both.

This is not luck, and that is the part worth crediting. `site/src/content.config.ts` holds each pattern as a **string copied verbatim** from the schema, and `site/src/content.config.test.ts` asserts each one is still character-for-character identical to the schema's own `pattern`, along with both enum lists, every `minLength`/`maxLength`/`maxItems`, both `required` lists, and `additionalProperties: false` at both levels. A change on the contract side fails the hub build rather than drifting silently. That is a *checked* mirror, not an approximate one.

**Both ends reject the same invalid fixtures, from the same files.** The contract suite passes 54/54 — including an explicit test that ajv and the hand-written interpreter agree on every fixture, which is what licenses shipping the action without ajv. The site suite loads the *same* `contract/examples/invalid/*.json` through `loadSources()` and requires all 12 to throw. SEAM-1's "do not fork these files" is honoured on both sides.

**The two rules JSON Schema cannot express are handled deliberately and symmetrically.** Slug uniqueness is implemented in named code at both ends (`validateManifestShape`'s duplicate check; `findDuplicateSlugs`), and *both* suites assert that the pure schema **accepts** `duplicate-slug.json` — so nobody later discovers it by accident and assumes the schema covers it. That is exactly the right way to record a known gap.

**The path-escape rule is enforced where it is claimed.** The textual half (absolute, `..`, backslash, control characters) is in the schema `pattern` and therefore active at both ends. The filesystem half is publish-side only, which is correct — only the satellite's runner can resolve a symlink. `checkPaths()` resolves with `realpathSync` and rejects anything landing outside `dist/`; it is unit-tested against a real tree containing both a symlink that leaves `dist/` and one that stays inside, and I re-ran those tests.

**End-to-end seam check I ran myself:** I generated `cv`'s *real* manifest with its own tool (`tools.manifest.build_manifest()` against the actual CV data) and validated it with the hub's validator → `Manifest check "schema" passed`. Two independently authored implementations in two repositories agree on a real payload.

Observations, all NOTE:

- `C:/x.pdf` is accepted by both *schemas* and caught only by the action's `path.win32.isAbsolute` check. The layering is right, but the hub never resolves paths on disk, so a hub-side-only consumer would not catch it. Worth knowing for Phase 3.
- `date: "2026-13-45"` is accepted by both — the pattern is shape-only, with no calendar validation. Consistent across ends, so not mirror drift; a contract limitation.
- `schema_version: "1.2.3"` passes both schemas and is then rejected by the hub's claim check. That is STATE C24's point: the pattern invites compatibility reasoning the exact-match check does not implement. Deferring the pattern tightening mid-flight was the right call — desyncing the two ends is precisely the failure SEAM-1 exists to prevent.
- The hub deliberately rejects **more** than the schema (the claim checks). That is ADR-0008 decision 3, not drift.

---

## C. ADR-0008 — my independent view

**I would have decided the same way.** The owner asked for a view, not a ratification, so here is where I agree, where I think the ADR is stronger than it claims, and where it is weaker.

**Is the reasoning sound? Yes.** The CV genuinely *is* data the hub renders, not a document `cv` renders: seven hub pages read the payload, `/cv/` and `/resumes/` are hub-authored views over variant *metadata*, and `/cv/[variant]` composes resolved data into the hub's layout with a `schema.org/Person` block. Calling that a `bundle` would make the manifest lie while changing nothing about the coupling. Amending §4 states what is true. The alternative — quietly weakening §3 for every format — would be worse, and the ADR says so.

**Are the alternatives fairly costed, especially "cv renders its own HTML"? Yes, and honestly.** The ADR concedes this is "the only option that honours §3 completely," which is the intellectually honest framing rather than a strawman. The costs are real: a second renderer and a second visual-regression suite in `cv` beside the LaTeX one; either losing the hub's typography and JSON-LD or duplicating the design system; and `/resumes/` and `/cv/` — views over variant metadata — having no natural home.

Two corrections to the costing:

- **A cost the ADR does not name, which strengthens the rejection:** it would also invert *who owns the URL*. `/cv/<variant>` would become a framed foreign page, so hub-wide changes would stop reaching it — including exactly the kind of work Phase 1 just did (the AA-contrast palette re-work, nav, theme). That is a recurring tax, not a one-off.
- **A benefit the ADR undersells, which weakens it:** it would have eliminated schema drift entirely. Drift is now the ADR's own top risk, mitigated only by a discipline (`schema_version` bumping in `cv`) that the hub cannot enforce. To its credit the ADR states this plainly rather than burying it.

Net: the costing leans on the right axis and the conclusion survives both corrections.

**Is the containment real? Yes — and it is tested rather than asserted, which is better than the ADR claims.**

- Unclaimed `data` items fail the build: `findUnclaimedDataItems()` against `CLAIMED_DATA_ITEMS` in `site/src/lib/hub-content.mjs` — one table, one row, `("cv", "cv-data")`, versions `["1"]`. Tests cover an unclaimed slug, an unclaimed *source*, and an unknown `schema_version`.
- `schema_version` is checked by exact match against an explicit list.
- **The subtlety that decides whether containment is real or illusory was caught:** Astro *logs and skips* a content-config error raised at module scope, but *propagates* a rejection from `loader.load()`. Validating at module scope would have produced a **green build with no content** — a failure that looks like success. All validation is therefore inside `load()`. Finding that required reading Astro's `content-layer.js`, and it is the difference between a gate and the appearance of one.

The honest limit: containment binds the *hub*. Nothing stops `cv` publishing a shape change without bumping, and the failure mode of forgetting is a subtly wrong CV page rather than an error. The ADR says this.

**Is it reversible, or does it harden? It hardens — more than the ADR admits, and this is my main substantive disagreement.**

Two different things are being called reversible. The *format's existence in the schema* is genuinely cheap to undo: one enum member, and `additionalProperties: false` plus the claim table mean nothing else can accumulate behind it. But the *cv↔hub coupling* is not. Reversing means re-homing `/cv/`, `/cv/<variant>`, `/resumes/`, `/projects/` and `/` — and the argument used to reject "cv renders its own HTML" is exactly the argument that will be made against reversing later, growing stronger as more pages depend on the payload. "A narrow addition, not an open door" is true of the schema and optimistic about the coupling.

That does not change my answer, because the coupling **already existed** before this ADR — `cv-data.ts` has mirrored `cv/tools/resolver.py` since Phase 1. ADR-0008's real contribution is that it *names, versions and bounds* a coupling that was previously undocumented. That is strictly better than the status quo.

**Recommendation to the owner:** accept it, and treat "a second `data` source requires its own ADR" (STATE C19) as a hard rule rather than a preference — it is the only thing standing between this and `data` becoming the default for anything awkward. The Phase 5 re-examination when `agentic-kg` and `construction-ai-proposal` arrive is the right checkpoint. Flagging it for the owner at Checkpoint 3 (STATE A21) is correct: this is the one decision in Phase 2 a reasonable owner might overturn.

**One internal inconsistency — SHOULD-FIX.** ADR-0008 *rejects* the alternative "the hub keeps downloading the `cv` GitHub release" in Alternatives Considered, while its Consequences section now says `fetch-data.sh` is **retained as a fallback**. Both are defensible — the rejected alternative was "bring only the PDFs through the contract," whereas the retained fallback produces the same bucket-shaped tree and a full manifest — but as written the ADR argues against and for the same script in two places without reconciling them. One sentence in Alternatives pointing at the amended Consequences closes it.

---

## D. Scope and phase boundary

**No Phase 3 leakage.** I grepped the code diff (`site/`, `infra/`, `contract/`, `.github/`) for `dist-private`, `HUB_OUTPUT`, leak checks, private bucket, gate, Cloud Run, rewrites and a `phd-milestones` identity. Every hit is prose or fixture:

- `phd-milestones` appears only as the source name in the design-doc §4 **example manifest** (the shared SEAM-1 fixture, verbatim) and in comments explaining why the Phase 3 case motivates the no-list rule.
- `visibility: private` is **accepted** by the schema and the mirror — it must be, because the §4 shared fixture is a `private`/`phd` item — but nothing private is published and no private handling exists: no two-output build, no leak check, no `HUB_OUTPUT`, no private bucket, no gate rewrites. Accepting a value is not publishing it, and the mirror documents exactly that.
- `infra/` creates no `phd-milestones` identity; `var.satellites` has exactly one entry.
- `firebase.json`, `.github/workflows/ci.yml`, `CLAUDE.md`, `AGENTS.md` and `.claude/` are untouched — confirmed by diff.

This satisfies the delta's domain question 1 (nothing private on the public path) and question 3 (a satellite cannot affect anything outside its prefix).

**Every changed file is within a declared scope.** All paths map to a SEAM-6 owner: `contract/**`, `infra/**`, `site/**` + `build.yml` + `.gitignore`, `docs/satellites.md` + `llm/**` (Lead Architect), and the `cv` repository. The single cross-repository write — the satellite handoff into the hub's `handoffs/` — is the explicitly permitted exception in that stream's contract. No stream edited another's file.

**Route parity — verified, not accepted.** The seven page diffs are each one import plus one path constant; `site/src/lib/cv-data.ts` does **not** appear in the diff at all, so the resolver logic is genuinely untouched. `/pdfs/<variant>.pdf` is preserved by staging into the same `public/pdfs/` Phase 1 served from, driven by the **manifest** rather than by globbing the tree — so a withdrawn item stops being served, which is the only behaviour consistent with "the manifest is the authority" given a satellite cannot list and therefore cannot prune. `SMOKE_ROUTES` is unchanged. I then built it myself in a clean clone of `bbd85a4`: after `./scripts/sync-content.sh --from fixtures/content`, `npm run build` completes and `npm run check:smoke-routes` reports **all 7 present**. The parity claim holds under my own execution.

**D1 — the exec-bit defect, and that nothing guards it. SHOULD-FIX.**

I reached this by inspection before the fix landed, and I want to record the reasoning because it is the finding, not the slip. `site/scripts/sync-content.sh` was committed `100644` while four call sites invoke it directly — `site/scripts/fetch-data.sh:120`, `site/scripts/sync-local-data.sh:113`, `.github/workflows/build.yml:159`, and three `site/package.json` scripts (`content:sync`, `content:fixture`, and transitively `data:fetch`). On a Linux runner that is exit 126, `Permission denied`, roughly 11 seconds into the job. Commit `bbd85a4` fixes it; I verified the diff is exactly a mode change plus a STATE record, and that all three tracked `*.sh` are now `100755`.

The finding is that **this class of defect is invisible here and unguarded.** The repository lives on `<path>`, a DrvFs mount that reports every file as `0777`, so the script runs locally regardless of the mode git recorded — the site stream ran it repeatedly and could not have caught it, and `ls -l` actively lies. (My own fresh-clone test briefly *contradicted* the inspection finding, because your fix landed between my two commands. That is a nice illustration of the hazard: the empirical check was less reliable than reading `git ls-files -s`.)

STATE now records the rule, which is right. But a rule in STATE is a discipline, not a control — and this project has already faced that exact choice once and decided the other way: `prevent_destroy` on the budget was judged insufficient, so `budget-guard` was added to CI and made a required status check. I recommend the symmetric guard: a CI check asserting every tracked `*.sh` (or every file invoked as `./…`) has mode `100755`. It is a few lines, it mirrors an accepted precedent, and Phase 3's `gate/` adds more shell plus a Dockerfile.

**D2 — `npm test` is not hermetic on a fresh clone. SHOULD-FIX.**

In a clean checkout of `bbd85a4` with only `npm ci`, `npm test` gives **8 failures** (all 5 of `bib.test.ts`, 3 of `cv-data.test.ts`) and `npm run build` fails outright, both because `site/src/content/sources/` does not exist yet. After the documented `./scripts/sync-content.sh --from fixtures/content`, it is **102 passed, 1 skipped**, the build completes, and 7/7 smoke routes are present.

CI is unaffected — `fetch-data.sh` runs before `npm test` — so this is not a CI defect. But a new contributor's first `npm test` fails, and the error names a missing `meta.yaml` rather than a missing sync step. `site/README.md` does document the fixture command, so this is a sharp edge rather than a documentation gap. A `pretest` that runs the fixture sync, or a skip-with-message when the tree is absent, would remove it.

**On `fetch-data.sh` being retained: the reasoning holds, and the fallback is implemented safely.**

The justification is correct and I verified its premise independently: the hub reads the bucket as `hub_deploy`, whose impersonation binding is `principalSet://…/refs/heads/main` (`infra/deploy.tf`), so a `pull_request` run carrying `refs/pull/<n>/merge` genuinely cannot authenticate. Deleting the script would have made every PR build a CV-less site and fail `check:smoke-routes` on `/cv/academic`, and would have left `main` with no CV source between merge and Checkpoint 3 — while GitHub Pages is still authoritative and serving live CV links. Reversing SEAM-4 and the roadmap was the right call, and it was made by a stream *reporting* a seam defect rather than quietly working around it, which is the behaviour the seam discipline exists to produce.

The implementation is safe because the fallback is not a second code path: `fetch-data.sh` builds a bucket-shaped tree and a generated manifest, then hands it to the same `sync-content.sh --from`, so manifest validation, the claim check and asset staging run identically whichever transport supplied the payload. The mode decision is made **once** in the `check` job and reused by both build jobs, so the poll and the builds cannot disagree about provenance. Every run prints a `::notice::` naming its source and why, and `build-info.json` records `content_source` — which is what makes the silent-fallback risk (site handoff R3) detectable rather than invisible. The path is correctly recorded as temporary, gated on STATE C25.

**On "Section pages render from collections" (C26): yes, Phase 2 can close without it — but move the line rather than leave it.**

It sits in §Scope, not in the acceptance criteria, and none of the ten acceptance criteria depends on it. With `cv` as the only satellite — four PDFs and one `data` payload — a collection-driven section page would render exactly what `/cv/` and `/resumes/` already render first-party, so building it now would either duplicate those pages or change rendered output, which this phase explicitly forbids. The collection itself *is* built and validated (the loader populates the store for every item), so the data path is proven; only the rendering is deferred. Its natural home is Phase 5, when `agentic-kg` and `construction-ai-proposal` arrive and a section page would show something nothing else does.

My recommendation: have the owner accept the deferral and **move the line to Phase 5** rather than leaving a `NOT DONE` annotation inside Phase 2's scope. An unchecked box with a paragraph attached will read as an unmet requirement indefinitely. Recording it as the Lead Architect's omission is the right call and should stay recorded.

---

## E. Governance

**Level declaration — L2 is right, with one consistency question.** The PR mixes L1 (two new ADRs, design-authority amendments to §2/§3/§4, the delta) with L2 (Terraform, workflows, a JSON Schema, application code, and a composite action other repositories execute), and is correctly classified at the highest level touched. The question: the roadmap edits here **change acceptance criteria** — three added, two rewritten, one ticked — and PR #12 was escalated to **L3** for exactly that reason, per STATE's own header ("L3 for PR #12 — roadmap requirement changes"). By that precedent this PR arguably touches L3 as well. Nothing operational turns on it (L2 and L3 are both human-reviewed and owner-merged), but the declaration should match the precedent the sprint set. NOTE: either declare L3, or record why these roadmap edits are bookkeeping rather than requirement changes.

**Definition of Done — met.** §Implementation Work: approved issue (#16) and design authority exist; ADRs exist and are cited; tests and validation are included — and I re-ran them rather than reading the claims: contract **54/54**; site **102 passed / 1 skipped** after the fixture sync; `terraform fmt -check -recursive` clean and `terraform validate` → `Success! The configuration is valid.` (in `hashicorp/terraform:1.14.0`); `actionlint` clean across the hub's whole `.github/workflows/` tree (in `rhysd/actionlint:latest`). Documentation updated across `contract/README.md`, `infra/README.md`, `site/README.md`, `site/fixtures/README.md` and `docs/satellites.md`. Security/privacy impacts are documented unusually thoroughly. Memory bank updated and consistent with reality.

§ADR Work: both ADRs carry Context, Decision, Alternatives, Consequences, Status and linked docs/PRs. ADR-0002 is properly amended to point at ADR-0007 rather than being left self-contradictory, and its Superseded By records "**Completed by** ADR-0007… Decisions 2, 3 and 4 stand unchanged" — which is the accurate relationship (completion, not supersession). The ADR index carries 0007 and 0008. **Governance checks pass 4 of 4** at this head (`governance-links`, `adr-index`, `adr-status`, `layout`) — I ran them.

**The delta's artifacts-slot declaration matches reality.** `docs/` is now declared and `docs/satellites.md` exists, in the same PR that creates its first content — exactly as assumptions A1/A22 said it would be. Correct.

**Mid-phase corrections — substantially complete, but not fully.** You asked me to judge completeness, not presence. The corrections were driven by streams *reporting* upstream defects rather than papering over them, which is the review loop working: SEAM-4, ADR-0008's Consequences, two roadmap lines and `docs/satellites.md` were all amended. The satellite stream's "first real reader" defect (the page said "set the five values" while listing six inputs, of which two are literals) **is** fixed — `docs/satellites.md:156` and `contract/README.md:182` both now read "Set these four" — and both gaps that stream identified are closed: the page now carries "Generate the manifest from your build, don't hand-maintain it" and a complete "When to bump `schema_version`" rule including "bump the hub first."

Three places still assert the superseded state (SHOULD-FIX):

1. **`llm/governance/governance-delta.md:249`** — the satellites table still says `cv` is "formalized under the manifest contract in Phase 2, **after which `fetch-data.sh` is removed**." That is the same claim SEAM-4, the roadmap and ADR-0008 were all amended to retract. The delta is the project-facts document; leaving it asserting the retracted plan is the highest-value of the three to fix.
2. **`llm/specs/2026-09-10-research-hub-design.md:273`** — the §9 layout block still annotates `build.yml` as `# push + repository_dispatch: …`. §3 and §4 were amended for ADR-0007; §9 was not.
3. **Same file, line 309** — the §11 phase table still lists Phase 2 scope as "…content bucket, **dispatch rebuild**."

None is load-bearing for behaviour, but the design document is rank 2 of the authority hierarchy, so a stale line there formally outranks the code contradicting it. Cheap to fix, and this PR is what invalidated them.

**`contract/README.md` carries edit debris (SHOULD-FIX, trivial).** The five→four correction left a duplicated, truncated sentence immediately after the variables list:

```
secrets makes failures harder to read.
secret, and treating them as secrets only makes failures harder to read.
```

**A handoff is committed as a binary file (SHOULD-FIX).** `llm/sprints/2026-09-hub/handoffs/contract-phase-2.md` is recorded by git as binary — `git diff --numstat` reports `-  -` for it, and `git grep` says "Binary file … matches". I diagnosed the cause: it contains **two literal NUL bytes** (offsets 5437 and 5624), inside pasted validator output quoting the `path` pattern `[^\\\x00-\x1f]`. The validator's `report()` prints `schema.pattern` raw, so the error message emitted the *actual* control characters rather than their escapes, and the transcript was pasted verbatim into the handoff. The file is otherwise valid UTF-8 and reads fine.

Consequence: a control-plane record that cannot be diffed, cannot be reviewed in a PR view, and is skipped by text tooling. Nothing is failing today — the canon link checker passes — but a governance artifact that is opaque to diff defeats the traceability this project is built on. Fix: strip the two NUL bytes. Second, smaller recommendation (NOTE): escape the pattern when `validate-manifest.mjs` prints it, so any future manifest error quoting that pattern does not emit NUL into CI logs and anything that captures them.

**Commit and PR hygiene.** Commits are scoped per stream, reference #16, and describe what landed; the stream-by-stream sequence is legible. **PR #17 carries no labels** — the delta declares a full taxonomy including `gov-L2` and phase milestones, and PRs #9 and #12 were labelled. SHOULD-FIX before the PR goes out of draft.

**Durable decisions taken without an ADR: none found.** I looked specifically for this. The durable choices — polling over dispatch, the three-permission role, the separate pool, the `data` format, the claim table — are all in ADR-0007/0008. The remainder are recorded as candidates C19–C27, which is the correct instrument, and several are honest statements of *permanent consequences* rather than to-do items: C21 (the publish action cannot verify its own upload, because verifying means listing and satellites are denied it), C23 (an empty `items` array is the only retraction mechanism), C25 (no PR-usable read grant), C27 (a wholly vanished prefix is undetectable). Recording a permanent limitation as a candidate, rather than pretending it will be solved, is good decision hygiene.

**AI review:** no AI component is introduced in this phase, so that section of the checklist is not engaged.

**Data review:** raw source data is preserved — the bucket holds exactly the satellite's `dist/`, and versioning plus 7-day soft delete plus bounded lifecycle rules make a satellite's own overwrite or delete recoverable. The reasoning that **soft delete, not versioning, is what protects against the owning identity** is correct and easy to get wrong: the grant includes `storage.objects.delete`, which reaches a specific generation. Provenance is recorded end to end (`content_fingerprint`, `content_source`, `built_from_sha`, `run_id`). Schema evolution is versioned, and the *contract's own* versioning gap is recorded as C20 with the right constraint identified — `additionalProperties: false` means a `manifest_version` must land optional first and become required later, which most projects discover too late.

---

## Verdict: **Comment** — this can proceed; the issues below are non-blocking.

**Nothing is blocking.** The credential boundary holds on all six points as built, both validator ends agree under adversarial probing, the CV renders unchanged and every Phase 1 URL still resolves, no Phase 3 construct has leaked in, and governance checks pass 4 of 4.

It is not a clean **Approve** for two reasons: the design-authority document and the governance delta still assert a plan this PR retracted (E1–E3), and Phase 2's security criteria are by their nature unverifiable until Checkpoint 3 — I can confirm the Terraform expresses the right boundary, not that the applied project matches it.

**SHOULD-FIX (before the next phase; the first three are cheap and belong in this PR):**
1. `governance-delta.md:249` — still says `fetch-data.sh` is removed.
2. Design doc lines 273 and 309 — stale `repository_dispatch` in the §9 layout and the §11 phase table.
3. `contract/README.md` ~186 — duplicated sentence fragment left by the five→four fix.
4. Strip the two NUL bytes from `handoffs/contract-phase-2.md`; escape `schema.pattern` when the validator prints it.
5. Add a CI guard for the two invariants that fail **open and silently** — `uniform_bucket_level_access = true` and the custom role's exact three permissions — mirroring `budget-guard`, as the infra stream itself recommended.
6. Add a CI guard asserting the executable bit on directly-invoked scripts.
7. Make `npm test` hermetic on a fresh clone (`pretest` fixture sync, or skip-with-message).
8. Reconcile ADR-0008's Alternatives with its amended Consequences.
9. Label PR #17; settle the L2-vs-L3 consistency question.
10. Move the "Section pages render from collections" line to Phase 5 on the owner's decision.

**NOTE:** the `satellites`-pool mapping invariant is structural only while every provider comes from the single `for_each`; `cv` executes `djjay0131/website/contract/publish@**main**`, an unpinned first-party ref, in a job holding `contents: write` and `id-token: write` — defensible and probably right (SHA-pinning would make every contract change require a satellite commit), but it is an undocumented decision and deserves a sentence in `docs/satellites.md`, plus consideration of a moving `v1` tag; `cv`'s existing actions are tag-pinned, with `softprops/action-gh-release@v2` the one I would pin first since it shares that job; `cv` has two divergent memory banks; the `ghp_…` string in the invalid fixture will trip any future secret scanner.

**On CI:** I reviewed `bbd85a4`, where you report all six required checks green, and I independently reproduced the site build, test suite and smoke-route check at that head. **`cv`'s CI I treat as unresolved**, per your note — the `pull_request` failure is a `SimpleIcons.otf` font error unrelated to Phase 2 or the `bibtexparser` pin, and `cv`'s publish job runs only on push to `master`, so the push path is the one that governs whether publishing can work. That should be settled before anything merges.

---

## The single most important thing to look at before merging

**Revoke `WEBSITE_DISPATCH_PAT` in `cv` — the secret *and* the token — before merging either PR.**

Everything else in this review is about whether the boundary is correctly *designed*. This is the one place where it is currently not *true*. The code is clean: the dispatch step is deleted rather than disabled, and `cv`'s workflow references no secret at all. But a live, long-lived, `repo`-scoped PAT for `website` still sits in the `cv` repository, created 2026-08-17, alongside `WEBSITE_REPO`. Deleting the workflow step does not remove it, and any future workflow in `cv` could pick it up.

That is exactly the condition ADR-0007 was written to forbid, principle 3 prohibits, and the delta's second domain review question asks about — and it is live right now. Merging does not make it worse, which is why I am not calling it blocking on the PR; but the phase should not be recorded as having established the credential boundary while the credential it exists to eliminate is still valid. Both halves are needed: delete the repository secret **and** revoke the token at github.com/settings/tokens, since removing the secret alone leaves a working token in the account. It is correctly sequenced first in the Checkpoint 3 order — my recommendation is simply that it happen before the merges rather than alongside them.
