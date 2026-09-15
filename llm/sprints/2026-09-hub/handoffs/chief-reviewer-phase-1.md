# Chief Reviewer: Phase 1 review of PR #12

- **Reviewed:** `feat/foundation` at `8867946` (the palette re-work, STATE A16, is included), compared with `origin/main` `d32cd36`
- **Date:** 2026-09-15
- **Contract:** `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-1.md`
- **Level:** declared L2. I confirm L2. The delta and contract edits are L1 content absorbed at L2, so there is no escalation.
- **Independence:** I authored and certified none of this work. Constellize is not installed, so I did the system-architect, QA and data checks myself. Primary-source lookups were delegated to research sub-agents; their quotes and URLs are listed in the claim register (A.3).
- **Access:** no cloud access, no Terraform plan or apply, no file writes, no git or gh mutations.

---

## Part A: PR review

### A.1 Evidence gathered

| Check | Result |
|---|---|
| CI on head `8867946`, `build-and-deploy` run 34930495246 (event `pull_request`) | `check` passed. `build` (Pages variant): 47 passed, 1 skipped, 33 pages. `build-firebase`: 47 passed, 1 skipped, 33 pages. Every deploy, smoke and notify job skipped. |
| CI on head `8867946`, `ci` run 34930495248 | `governance-checks`: 4 of 4 PASS (links, adr-index, adr-status, layout) |
| `terraform fmt -check -recursive`, `init -backend=false`, `validate` (Terraform 1.14.0, google and google-beta 8.2.0) | all exit 0, "The configuration is valid." |
| actionlint 1.7.12 on `build.yml` | 0 errors |
| Governance check `--layout` (installed plugin script) | 4 of 4 PASS |
| `npm test` from `site/` | 6 files; 47 passed, 1 skipped |
| Pages build (`SITE_URL=https://djjay0131.github.io SITE_BASE=/website/`) | 33 pages; `generate-redirect-map --check`: 48 routes, 48 entries, all covered; robots sitemap URL points at Pages |
| Default build (run last) | 33 pages. 0 files contain `/website/`. `/phd/` carries `noindex`, is absent from `sitemap-0.xml`, and no page links it. No Google Fonts, jsDelivr, unpkg or cdnjs references. |
| `node scripts/contrast.mjs` | 52 pairs, 0 below AA |
| `git log --follow site/src/lib/cv-data.ts` | shows history from before the move (`8e60281`, `e61465b`, `4bd3837`) |
| Action pins, checked against the GitHub API tag refs | all 7 SHAs match their tags (checkout v5, setup-node v5, upload-pages-artifact v5.0.0, upload-artifact v7.0.1, download-artifact v8.0.1, deploy-pages v5.0.1, auth v3.0.0) |
| Repository state via GitHub API (GET) | 0 Actions secrets; 0 Actions variables (so the Firebase jobs are dormant); 0 forks; default workflow token `read`; `main` requires `governance-checks`; `github-pages` environment has a custom branch policy; OIDC `use_immutable_subject: false`; repo id 1212933399 and owner id 5666389 match `infra/variables.tf` |
| Diff scans | No private keys, service-account JSON, tokens, billing-account IDs or machine paths. The only email address is the fixture's `ada@example.org`. No bucket, Artifact Registry, Cloud Run, Identity Platform, Firestore, rewrites, React or satellite identity. `ci.yml` untouched. |

### A.2 Findings (most severe first)

| # | Severity | Artifact and location | Defect | Failure scenario | Owner | Fix |
|---|---|---|---|---|---|---|
| F1 | **must-fix** | `infra/budget.tf` guard comment (lines 15–20); `infra/README.md` §Guardrails ("Removing the budget takes a reviewed commit that deletes that guard first"); infra handoff §Budget recipients and the guard, and §Manual steps step 10 ("revert the Terraform change by PR and `terraform apply`") | The PR claims `prevent_destroy` means only a commit that deletes the guard can remove the budget. Terraform's own docs refute this: prevent_destroy "doesn't prevent Terraform from destroying a resource if you remove its configuration". Deleting the `google_billing_budget.hub` block, or `budget.tf`, destroys the budget in one step. Apply runs locally from any checkout, so an unreviewed branch can do it. | The owner follows step 10 and reverts PR #12's infra. The plan now lacks `budget.tf`, prevent_destroy is never evaluated, and apply deletes the $5 alert. That breaks design doc §12.6 and delta principle 6 while the docs say it cannot happen. | infra | (1) Correct all three texts: the guard stops destroy and replace only while the resource block is in configuration. (2) Rewrite step 10 so an infra rollback never removes `budget.tf`: use `terraform destroy -target=<address>` for specific resources, or a revert that keeps `budget.tf`, and state that the budget is never removed. (3) Make removal visible before any apply: a step in `build.yml`'s `check` job that fails when `infra/budget.tf` lacks `resource "google_billing_budget" "hub"` or `prevent_destroy = true`. Add a runbook rule that apply runs only from a clean checkout of the reviewed PR head or `main`, with the SHA recorded in STATE. Items 1 and 2 clear the blocker; item 3 is strongly recommended. |
| F2 | should-fix | `infra/deploy.tf` lines 20–24; STATE §Decisions for the owner at Checkpoint 2 ("`apiKeysViewer` — leave it out") | The deploy identity omits `roles/serviceusage.apiKeysViewer`. Firebase's docs say a CLI deploy member "must also be assigned the API Keys Viewer role". The omission rests on tracing firebase-tools 15.30.1, which was released 2026-09-14, the day before this review. | The first Firebase deploy at Checkpoint 2 fails on a permission error, and "cusati.us serves the site" waits on another PR and apply. Or a later firebase-tools bump reaches the API Keys client on the hosting path and breaks deploys with no Terraform change. Pages is unaffected either way. | Owner (Jason) decides; infra implements | Recommended: grant `roles/serviceusage.apiKeysViewer` to `hub-deploy` now. It is read-only, and the project has no API keys in Phase 1. Update the comment and the STATE default. If the owner keeps the omission, record it in C11 as a deliberate departure from Firebase's docs, with the exact expected error. |
| F3 | should-fix | STATE §Decisions ("tighten to a custom role once a real deploy has proved the permission set"); STATE C11; `infra/deploy.tf` lines 16–18; infra handoff §Alternatives and ADR candidate I-3 | The recorded tightening path is not supported. Firebase: "Custom roles cannot currently be used for controlling access to Firebase Hosting resources." | At a later checkpoint the owner follows the recorded default and swaps in a custom role with the four permissions. Hosting access control ignores custom roles, so deploys fail, or the plan is dropped only after an outage. | Chief Architect (STATE, C11); infra (comment, handoff) | Remove the custom-role alternative. Record that `roles/firebasehosting.admin` (plus the F2 outcome) is the narrowest supported grant, citing the Firebase IAM permissions page. |
| F4 | should-fix | `infra/wif.tf` lines 22–24 ("a future provider in the same pool … can never satisfy this binding"); STATE C12; infra handoff I-2 | `principalSet://…/attribute.repository_id_ref/…` is pool-scoped, and each provider defines its own attribute mapping. The "can never" holds only if every future provider in `github-actions` maps `repository_id_ref` from `assertion.repository_id + '/' + assertion.ref`. Nothing records or enforces that. | Phase 2 adds a satellite provider to the shared pool with a different mapping. Its `main` tokens then satisfy `hub-deploy`'s binding, so the satellite can deploy the hub site, which breaks principle 3. | Chief Architect (C12); infra (comment) | Phase 1: reword the comment and C12 to state the invariant. Phase 2 ADR: prefer a separate pool for satellites (pool as trust domain), which makes the invariant structural. Otherwise require the mapping in every provider and check it in review. |
| F5 | should-fix | `.github/workflows/build.yml` lines 337–346 (`npx --yes "firebase-tools@${FIREBASE_TOOLS_VERSION}"`) | firebase-tools is pinned by version, but its dependency tree is resolved at run time with no lockfile, inside the one job holding `id-token: write` and the impersonation credentials. That undercuts the workflow's own reason for SHA pins ("a retagged action cannot change this pipeline without a commit"). | A malicious transitive release inside firebase-tools' semver ranges runs during the deploy step with `GOOGLE_APPLICATION_CREDENTIALS` in the environment. It can publish arbitrary content to cusati.us as Hosting Admin. | infra | Commit `infra/deploy-tools/package.json` and `package-lock.json` pinning firebase-tools 15.30.1. In `firebase-deploy`, run `npm ci --prefix infra/deploy-tools` before the auth step and invoke `infra/deploy-tools/node_modules/.bin/firebase`. Bump through reviewed lockfile changes. |
| F6 | should-fix | PR #12 body: "Draft. One re-work item is open", "Open: design tokens … being re-worked", "`npm test` 45 passed", "Chief Reviewer — pending the palette re-work" | The merge record contradicts head: A16 landed in `8867946`, and CI shows 47 passed, 1 skipped. | The owner decides at Checkpoint 2, and later contributors audit, from a PR record that misstates validation and open work. | Chief Architect | Update the body: A16 done (`8867946`), CI run 34930495246 results, a link to this review, and the Checkpoint 2 decisions this review adds (F2, F7). |
| F7 | should-fix | `site/src/styles/tokens.css` `:root` block (`--color-muted: #636a68`, `--color-caution: #87620d`, `--color-ok`, `--color-ok-bg`); STATE §Decisions for the owner at Checkpoint 2 | Design doc §5 says to carry over the tracker palette. The site uses two different light-theme text colours for AA and adds a status green the palette lacks. Neither appears in the owner's Checkpoint 2 decision list; they are only in the site handoff (Recommendation 5) and STATE A16 and risk 11. | The owner ratifies from STATE's list and never sees the deviation. When phd-milestones joins as a satellite in Phase 3, the site and tracker disagree on muted and caution text and status colours with nothing recorded. | Chief Architect (list it); Owner (Jason) decides | Add: "Accept AA-adjusted light muted #636a68 and caution #87620d for text (originals kept for non-text use), and a status green absent from the tracker palette. Recommended: accept; the tracker adopts the same values when it becomes a satellite." |
| F8 | should-fix | `site/src/lib/cv-data.test.ts` §"fetched CV data (structure only)"; compare `origin/main:src/lib/cv-data.test.ts` §loadVariantSummaries (`toContain("academic")`, `toContain("research-professional")`) | A15 removed the one pre-deploy check that the CV variants the smoke test requests exist in the fetched data. | A `cv` release renames `research-professional`. Tests and build pass, `deploy` publishes to the authoritative Pages site without `/cv/research-professional`, and only the post-deploy smoke test goes red. Before this PR, the test failed before deploy. | site (check script); infra (`build.yml` step) | After `npm run build` in `build` and `build-firebase`, run a small script that fails if any `SMOKE_ROUTES` entry in `site/scripts/site-routes.mjs` has no file in `site/dist-public` (`<route>/index.html` or the file itself). The smoke-test loops can read the same list later, which also serves C13. |
| F9 | note | Canon DoD §Implementation Work, memory-bank item; PR #12 §Memory Bank Updates ("needed in follow-up — after PR #11 merges") | PR #11 is still OPEN (GitHub API), so the deferral has no tracked end. | Phase 1 merges, #11 stalls, and the memory bank keeps describing a root-level Astro app on Pages into Phase 2. | Chief Architect | Add a checklist item to issue #10, or open an issue, for the memory-bank sync. Merge #11 first and sync in the Checkpoint 2 bookkeeping. |
| F10 | note | `build.yml` lines 316–324 (`check-latest: true`) | Node floats to the newest 22.x at deploy time. That dodges the known 22.23.0 regression but un-pins the runtime. | A future 22.x regression of the same kind breaks the Firebase deploy with no commit. | infra | Pin an exact known-good version (e.g. `node-version: 22.23.1`) and bump deliberately. |
| F11 | note | `build.yml` Pages path: checkout v4 to v5, setup-node v4 to v5, upload-pages-artifact v3 to v5, deploy-pages v4 to v5; PR body and infra handoff | Major-version bumps on the authoritative Pages path are not described as behaviour changes. `upload-pages-artifact` v5 and `deploy-pages` v5 never run on a pull request. | The first post-merge Pages deploy fails on an action behaviour change. The smoke test and tracking issue catch it, and Pages keeps its last deployment. | infra (handoff); Chief Architect (PR body) | List the bumps and name the first post-merge `build-and-deploy` run as their verification step at Checkpoint 2. |
| F12 | note | `infra/firebase.tf` lines 25–33; infra handoff step 5 ("already exists … import `google_firebase_hosting_site.default`") | The provider adopts an existing site (GET, then update), so the import fallback is unnecessary. UNVERIFIED: whether a site Terraform creates with id equal to the project id is typed `DEFAULT_SITE`. firebase-tools' default-site lookup needs that, because `firebase.json` names no site. | Apply succeeds, but the first deploy fails with "no default site". | infra | Add `lifecycle { postcondition { condition = self.type == "DEFAULT_SITE" … } }` so apply fails at Checkpoint 2, not at deploy. Drop the site import line from step 5. |
| F13 | note | STATE §Decisions, Billing ("Billing Account Administrator or User … so budget emails reach you") | Right for email recipients (VERIFIED). But creating the budget needs `billing.budgets.create`, held by Billing Account Administrator or Costs Manager and not by Billing Account User (UNVERIFIED this session). | An owner holding only Billing Account User gets a 403 on `google_billing_budget.hub` at apply. | Chief Architect | Reword: "confirm you are Billing Account Administrator (needed to create the budget; also receives its emails)". |
| F14 | note | infra handoff "Status: Draft"; site handoff "Status: … awaiting re-verification and Lead Architect reconciliation" | Status lines are stale, since reconciliation and A16 are done. | A reader takes both deliverables as unverified drafts. | Chief Architect (Lead Architect persists handoffs) | Set both to Complete with their commit references (`0ce2865`, `9f0718a`, `8867946`). |

Checklist coverage:
- **Universal:** problem, motivation, scope, assumptions, open questions and cross-references are present. Undocumented durable decisions: see Part F, ADR candidates.
- **Alignment:** aligns with design doc §5, §8, §11 and ADR-0001, with the conservative K1 and K2 choices. The exceptions are F7 (palette deviation not put to the owner) and F1 (principle 6 documentation).
- **Architecture:** tradeoffs and alternatives are recorded in both handoffs. F3 and F4 correct two recorded durable claims.
- **Implementation:** maps to the contracts and seams, tests are included, error handling is reasonable (deploy config check, loud failures), and security is addressed except F5.

### A.3 Technical claims register

| Claim (by specialists, not in the design doc) | Status | Primary source and note |
|---|---|---|
| firebase-tools deploys with ADC from google-github-actions/auth, through WIF with a service account | **VERIFIED** | Without a login, `requireAuth.ts` falls back to `new GoogleAuth(...)`/`getAccessToken()` (<https://github.com/firebase/firebase-tools/blob/master/src/requireAuth.ts>). The auth action exports `GOOGLE_APPLICATION_CREDENTIALS` (<https://github.com/google-github-actions/auth/blob/v3.0.0/README.md>). In-the-field report and regression: <https://github.com/firebase/firebase-tools/issues/10716>. The regression window is firebase-tools 15.22.2 on Node 22.23.0 / 24.17.0; fixed in Node 22.23.1 (<https://nodejs.org/en/blog/release/v22.23.1>). |
| `roles/firebasehosting.admin` suffices for `firebase deploy --only hosting` | **UNVERIFIED; contradicted by Firebase docs** | The role's permissions are VERIFIED (<https://docs.cloud.google.com/iam/docs/roles-permissions/firebasehosting>), and the CLI's declared checks are `firebase.projects.get` and `firebasehosting.sites.update`. But Firebase requires API Keys Viewer for CLI deploys (<https://firebase.google.com/docs/projects/iam/roles-predefined-product>). See F2. |
| `google_billing_budget` with user ADC needs `billing_project` and `user_project_override` | **VERIFIED** | "you must specify a `billing_project` and set `user_project_override` to true … Otherwise the Billing Budgets API will return a 403 error" (<https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/billing_budget>). |
| `google_firebase_hosting_custom_domain` exposes DNS records and can skip DNS verification at apply | **VERIFIED** | `required_dns_updates` (`desired[].records[]` with `domain_name`, `type`, `rdata`, `required_action`) and `wait_dns_verification` (<https://registry.terraform.io/providers/hashicorp/google-beta/latest/docs/resources/firebase_hosting_custom_domain>). |
| Hosting `trailingSlash: true` does not redirect file paths such as `/pdfs/academic.pdf` | **VERIFIED for superstatic; UNVERIFIED for production Hosting** | Superstatic adds the slash only on the directory-index branch (<https://github.com/firebase/superstatic>, `src/middleware/files.js`). The Hosting docs are silent on files (<https://firebase.google.com/docs/hosting/full-config>). `firebase-smoke-test` (`curl -L` on `/pdfs/academic.pdf`) settles it at Checkpoint 2. |
| The budget's default IAM recipients include billing account administrators | **VERIFIED** | Default alerts go to "Billing Account Administrators and Billing Account Users on the target Cloud Billing account"; project owners are a separate option, which the module enables (<https://docs.cloud.google.com/billing/docs/how-to/budgets>). |
| `prevent_destroy` means removal needs a commit deleting the guard | **REFUTED** | "This rule doesn't prevent Terraform from destroying a resource if you remove its configuration" (<https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>). See F1. |
| A custom role with four permissions is a tighter deploy alternative | **REFUTED** | "Custom roles cannot currently be used for controlling access to Firebase Hosting resources" (<https://firebase.google.com/docs/projects/iam/permissions>). See F3. |
| The provider split (no-override alias enables APIs) follows the Firebase Terraform guide | **VERIFIED** | <https://firebase.google.com/docs/projects/terraform/get-started> |
| With `user_project_override` and `billing_project`, every provider request carries `X-Goog-User-Project` | **VERIFIED** | `transport/config.go`: `if c.UserProjectOverride && c.BillingProject != "" { headerTransport.Set("X-Goog-User-Project", …) }` (<https://github.com/hashicorp/terraform-provider-google/blob/main/google/transport/config.go>). The API must be enabled in the quota project (<https://docs.cloud.google.com/docs/authentication/troubleshoot-adc>). Only Service Usage is on by default (<https://docs.cloud.google.com/service-usage/docs/enabled-service>). So manual step 3 is necessary, and it is enough for `data.google_project` at plan. |
| auth v3.0.0 exports no `GOOGLE_CLOUD_QUOTA_PROJECT` | **VERIFIED** | It exports `CLOUDSDK_CORE_PROJECT`, `CLOUDSDK_PROJECT`, `GCLOUD_PROJECT`, `GCP_PROJECT`, `GOOGLE_CLOUD_PROJECT` and the credentials path (<https://github.com/google-github-actions/auth/blob/v3.0.0/README.md>). |
| `google_firebase_hosting_site` for the default site adopts an existing site | **VERIFIED (provider source)** | "Check if the Firebase hostng site already exits. Do an update if so." (<https://github.com/hashicorp/terraform-provider-google-beta/blob/main/google-beta/services/firebasehosting/resource_firebase_hosting_site.go>). See F12 for the remaining unknown. |
| firebase-tools 15.30.1 exists | **VERIFIED** | Released 2026-09-14 (<https://github.com/firebase/firebase-tools/releases/tag/v15.30.1>). |
| Google advises binding to numeric `*_id` claims over names | **VERIFIED** | "use the numeric *_id fields instead, which are unique and can't be reused" (<https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines>). |
| Repositories created after 2026-07-15 get immutable `sub` claims | **VERIFIED** | <https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/>. This repo has `use_immutable_subject: false`, and the condition does not rely on `sub`. |
| Pull-request runs carry `refs/pull/N/merge`; fork PRs cannot obtain `id-token: write` | **VERIFIED** | <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>; <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax> |
| Every action in `build.yml` is pinned to the SHA of its stated tag | **VERIFIED** | GitHub API `GET /repos/{owner}/{repo}/git/ref/tags/{tag}` for all 7 |
| Neither adding Firebase nor a Hosting custom domain needs Blaze | **VERIFIED (partly by inference)** | <https://firebase.google.com/docs/pricing>; addFirebase "does not modify any billing account information" |

---

## Part B: Definition of Done and acceptance criteria

### B.1 Canon Definition of Done, §Implementation Work

| Item | Status | Evidence |
|---|---|---|
| Approved issue or spec | met | Issue #10; design doc; roadmap §phase-1-foundation |
| Relevant design docs and ADRs exist | met | ADR-0001, 0003, 0004; C10–C13, plus the candidates in Part F |
| Code reviewed through PR | met by this review; owner review at Checkpoint 2 pending | This report |
| Tests or validation included | met | CI run 34930495246 (47 passed, 1 skipped, both variants); local fmt, validate, actionlint, contrast and build checks (A.1) |
| Documentation updated | met, subject to F1 | `infra/README.md`, `site/README.md`, both handoffs |
| Data, security and privacy impacts documented | met | PR body §Data, Security and Privacy Impact; F4 and F5 refine it |
| Memory bank updated if project state changed | **not met** (deferred) | F9 |

### B.2 Roadmap Phase 1 acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| `https://cusati.us/` serves over HTTPS with a valid certificate | Checkpoint 2 | Handoff steps 7 and 9; `custom_domain_state` output |
| Every current route returns 200 at cusati.us; Astro redirect sources forward | Checkpoint 2 | Local: 48-route inventory matches the map (A.1). The superstatic 84-probe result is from the site handoff and was not re-run. `firebase-smoke-test` covers the 7 routes. |
| `/cv/academic` and `/papers/` bodies at least 500 bytes | Checkpoint 2 | `firebase-smoke-test` body check |
| `dist-public` has no link, asset or redirect target under `/website/` | **met** | Local default build: 0 files; redirect pages target `/research/soa-agentic-se/…/` |
| `djjay0131.github.io/website/` still serves | Checkpoint 2 (first post-merge run) | Pages-variant build passes in CI; `deploy` needs only `build`; F11 |
| CV on cusati.us matches the latest release; fingerprint reads the new host | Checkpoint 2 | `check` reads `vars.SITE_URL` (SEAM-5); `fetch-data.sh` equivalence per the site handoff |
| `git log --follow` shows pre-move history | **met** | `site/src/lib/cv-data.ts` shows `8e60281` |
| Every Phase 1 cloud resource declared; `plan` reports no changes after apply | declared: **met**; no-change plan: Checkpoint 2 | 17 resources plus 1 data source; manual items enumerated |
| Manual steps written down | **met**, with F1 correction to step 10 | Infra handoff §Manual steps; `infra/README.md` |
| $5 budget emails the owner | Checkpoint 2 | `budget.tf`; recipients VERIFIED (A.3); F13 |
| WIF only; no JSON key in the repo or Actions secrets | **met** in the repository; key list at Checkpoint 2 | 0 Actions secrets (API); no key inputs; scans clean |
| `firebase.json`: no Functions, SSR or backend | **met** | `firebase.json` has no `rewrites`, `functions` or `frameworksBackend` |
| Spectral, Plex Sans, Plex Mono with `#0F5C5A`; light and dark | **met** in the build; visual check at Checkpoint 2 | `tokens.css`; `tokens.test.ts` (14 tracker values per theme); no CDN references in `dist-public` |
| Five section shells; no `phd` link in public navigation | **met** | Built `research/`, `projects/`, `writing/`, `cv/`, `phd/`; no `href` to `/phd` |
| GCP project personal; project id a Terraform variable | variable **met**; ownership Checkpoint 2 | `var.project_id`; step 1 checks for an empty parent |
| Redirect map covers every route the current build serves | **met** (snapshot) | 48 of 48 on the local Pages build; SEAM-6 regeneration clause |

---

## Part C: Domain review questions

1. **Does this change put a private-visibility item on the public path?** No.
   - No private content exists in the site. `/phd/` is an empty state with `noindex`, left out of the sitemap and unlinked (verified in the default build).
   - `firebase.json` has no rewrites, and no `dist-private` output exists.
   - The diff scan found no private material. The only email address is the fixture's invented `ada@example.org`. The home page's existing `mailto:` link is pre-existing public content.
2. **Does this change introduce a long-lived credential?** No.
   - Deploys use WIF with short-lived impersonation of `hub-deploy`, and no service-account key is created.
   - The repository has 0 Actions secrets. The deploy settings are non-secret Actions variables, and none is set yet.
   - The auth step's credentials file lands in the workspace root, outside `site/dist-public`, so it is never deployed.
   - F5 is a supply-chain exposure during the deploy step, not a long-lived credential.
3. **Can a satellite affect anything outside its prefix?** Not in Phase 1: no satellite identity, bucket or prefix exists.
   - Two forward-looking caveats. The shared WIF pool keeps satellites off the hub deploy binding only while every provider maps `repository_id_ref` identically (F4).
   - The existing `cv-updated` dispatch can trigger a hub build of `main`'s code but cannot change hub code. This is pre-existing and tracked as K13 and C1.

---

## Part D: Terraform module-structure review

- **File layout.** A flat root module split by concern:
  - `versions.tf` and `providers.tf`
  - `main.tf` (project data source, APIs)
  - `variables.tf` and `outputs.tf`
  - `wif.tf`, `deploy.tf`, `budget.tf` and `firebase.tf`

  For 17 resources this is the right shape, and child modules would add indirection with no reuse. Recommend a module only when Phase 2 adds per-satellite identities (a `for_each` over satellites). The lock file is committed; `.gitignore` covers state, tfvars and plans. Comments cite sources throughout, which is good practice.
- **Provider split and quota project.**
  - Default `google` and `google-beta` set `user_project_override = true` and `billing_project = var.project_id`. An aliased `google.no_user_project_override` enables the APIs. This matches the Firebase guide (VERIFIED).
  - Because the provider sends `X-Goog-User-Project` on every request (VERIFIED), `data.google_project` needs Cloud Resource Manager enabled in the project at plan time. Manual step 3 does that, and the README lists it as a prerequisite. IAM, Firebase, Hosting and Billing Budgets are reached only through `depends_on = [google_project_service.phase1]`.
  - `google_project_iam_member` has no direct `depends_on`, but it depends on the service account, and CRM is enabled in step 3. Sound.
  - The owner needs `serviceusage.services.use` on the project, which Owner holds.
- **Variable design.**
  - `project_id` is validated. `billing_account` is `sensitive` and validated. The public GitHub ids are variables with defaults, verified against the API.
  - `hosting_site_id` is nullable and falls back to the project id. The budget amount is a local constant, so changing it needs review, not a tfvars edit.
  - `region` is unused in Phase 1, as documented.
  - No secret or personal value is committed; the example tfvars uses `000000-000000-000000`.
- **Outputs.**
  - The SEAM-4 values are available individually and as one map. `hosting_default_url` guards the smoke-test default.
  - `custom_domain_dns_records` flattens `required_dns_updates[].desired[].records[]` defensively with `try`. `custom_domain_state` shows ownership, host and cert state.
  - No output exposes the billing account. Adequate.
- **Lifecycle guards.**
  - Budget: `prevent_destroy`, weaker than documented (F1).
  - Firebase project: cannot be removed, so it leaves state only.
  - Hosting site: `deletion_policy = "ABANDON"`.
  - APIs: `disable_on_destroy = false` and `disable_dependent_services = false`, which is correct for a foundation.
  - Custom domain: unguarded. Destroying it takes cusati.us offline, which is acceptable as an explicit action.
  - WIF pool: destroying it may block re-creation under the same id during Google's soft-delete window (UNVERIFIED this session). Keep the pool out of any `-target` destroy in the runbook.
  - Recommended: the F12 postcondition.
- **State handling.**
  - Local state, git-ignored and backed up privately (C10). State holds the billing account id but no credential.
  - State loss would leave the pool, provider and service account failing with "already exists" on re-apply, and could create a second budget. Document `terraform import` commands for those resources in the state-loss recovery.
  - A GCS backend in Phase 2 (when buckets arrive under K1) is the right sequencing.
- **Fresh-project apply in the documented order** (steps 1–5). **Expected to succeed.**
  - Step 1 creates the project and step 2 links billing.
  - Step 3 enables Service Usage and Cloud Resource Manager, which is required given the quota header.
  - Step 4 sets the ADC quota project. Step 5 runs init, then plan (17 to add, a count I confirmed from the configuration), then apply.
  - Caveats, all documented or found here: API propagation (retry documented), Firebase terms acceptance (documented), the `DEFAULT_SITE` type (F12, UNVERIFIED), budget-creation billing role (F13), USD billing currency (documented).
  - None of these can damage existing resources. Apply only reads the owner-created project and creates new ones.

---

## Part E: Verdict

**Request Changes.** One must-fix (F1) blocks merge.
- It is small: correct three texts and rewrite rollback step 10. The recommended CI presence check can follow.
- Once F1 is addressed, this becomes **Comment**. F2–F8 can be settled at Checkpoint 2 or as tracked follow-ups, and none changes what apply creates, except F2 if the owner accepts the grant.

**Checkpoint 2 manual steps (infra handoff §Manual steps):**
- Steps 1–9 are complete and in the right order.
  - Step 3 is necessary, as the quota-header verification shows.
  - Step 8 correctly holds back `SITE_URL` until `CERT_ACTIVE`.
  - Step 9's checks (build-info SHA, Pages still 200, no user-managed keys) are the right evidence.
- Step 10's infrastructure rollback is **not safe as written** (F1).
- Also:
  - expect a possible `apikeys.*` failure on the first deploy unless F2 is taken;
  - skip the site import line in step 5 (F12);
  - `gh` and `terraform` may not be on the PATH of the primary workstation (STATE risk 3);
  - record the commit SHA applied from.

**Open questions:**
- **(a) Is PR #12 safe for the owner to apply and merge at Checkpoint 2?**
  - **Apply:** yes. It creates only new, near-zero-cost resources in the owner's new project, needs no secret, and the WIF surface admits only `main` of this repository.
  - **Merge:** yes once F1 is fixed. The Firebase jobs stay dormant until the variables are set, and the Pages path keeps its structure (F11 is the only untested part).
- **(b) What most deserves the owner's attention?**
  1. **The budget guardrail (F1).** It is weaker than the documents say, and the written rollback would delete it.
  2. **The deploy-role decision (F2 and F3).** Recommended: grant API Keys Viewer now, and drop the custom-role tightening, which Firebase does not support.

---

## Part F: Handoff

### Summary
- PR #12 is careful, well-sourced work:
  - route parity holds in both variants;
  - the palette is carried over verbatim with AA enforced by tests;
  - the WIF condition and main-only binding are sound;
  - per-job permissions and SHA pins are verified;
  - Terraform validates and would apply in the documented order.
- One must-fix: the budget guardrail's documented protection is wrong, and the rollback runbook would remove the alert (F1).
- Should-fix items:
  - the deploy role needs an owner decision and a corrected tightening path (F2, F3);
  - the WIF pool-sharing invariant needs recording (F4);
  - firebase-tools installs without a lockfile (F5);
  - the PR body is stale (F6);
  - the palette deviations are not in the owner's decision list (F7);
  - A15 lost one pre-deploy route check (F8).

### Assumptions
- The review covers head `8867946` only. Later commits need a delta review.
- Without cloud access, the Hosting behaviour, domain, certificate, budget emails and first deploy stay unverified until Checkpoint 2.
- I did not rebuild the pre-PR site. Route parity against the old build relies on the site handoff's diff plus my own inventory and redirect-map check. I did not re-run the superstatic probe.
- The primary-source quotes in A.3 were gathered by research sub-agents and are relayed with their URLs. I checked the "custom roles cannot control Hosting" statement myself.
- A15 is judged sound: exact assertions moved onto an invented fixture, structural checks stay on fetched data, and coverage of selector behaviour and "every variant resolves" is stronger than before. F8 is the one loss.

### Recommendations
Ideas beyond Phase 1 scope; none are findings.
1. Phase 2 ADR: a separate WIF pool for satellites (F4).
2. Adopt the GCS state backend when Phase 2 introduces buckets (C10).
3. Make `build` and `build-firebase` required status checks on `main` alongside `governance-checks`.
4. Opt this repository into immutable OIDC `sub` claims. Nothing depends on `sub` today, so it costs nothing.
5. Add `site/src/pages/404.astro`, long-lived cache headers for `/_astro/**`, and latin plus latin-ext font subsetting (site handoff Recommendations 1, 3 and 4).
6. Clarify the delta §Governance Check Command. In the canon checkout the script sits under `plugin/scripts/`, not at the checkout root; "the same script under the Canon checkout" leaves the subpath to guesswork.
7. A `www.cusati.us` redirect domain (infra handoff Recommendation 3).

### Alternatives considered
- **Approve with comments:** rejected. F1 concerns a design doc §12 non-negotiable and a runbook step the owner may run.
- **Request Changes on F2:** rejected. It is an owner decision with a loud, Pages-safe failure mode.
- **Treating F5 as must-fix:** rejected. The blast radius is Hosting content only, and version pinning already limits drift.

### Risks
- **First Firebase deploy:** the permission set (F2) and default-site type (F12) are both unverified until run.
- **Pages path:** first post-merge run of new major action versions (F11).
- **Runtime drift** from `check-latest` (F10).
- **Palette margins** of 4.50 and 4.51 in the light theme break under any brass-soft change. The tests catch it.
- **Carried-forward risks:** local state loss (C10), shared owner token with admin bypass (STATE risk 9), data-dependent redirect-map entries going stale before Phase 6.

### Open questions
- Does the owner grant API Keys Viewer now (F2)?
- Does the owner accept the AA-adjusted text colours and the status green (F7)?
- Should the Firebase variant also build on unconfigured pushes to `main` (infra handoff open question)? Recommended: no, as implemented.

### Related docs
- **Repository:**
  - `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-1.md`, `phase-1-seams.md`, `site-phase-1.md`, `infra-phase-1.md`
  - `llm/sprints/2026-09-hub/handoffs/site-phase-1.md`, `infra-phase-1.md`
  - `llm/sprints/2026-09-hub/STATE.md`
  - `llm/specs/2026-09-10-research-hub-design.md` §3, §4, §5, §8, §11, §12
  - `llm/master-roadmap.md` §phase-1-foundation
  - `llm/governance/adr/0001-…`, `0003-…`, `0004-…`
  - `llm/governance/governance-delta.md`
  - `<canon checkout>/llm/governance/review-checklist.md`, `definition-of-done.md`, `governance-levels.md`
  - Issue #10; PR #12; PR #11
- **External primary sources:**
  - Terraform lifecycle meta-argument: <https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle>
  - `google_billing_budget`: <https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/billing_budget>
  - `google_firebase_hosting_custom_domain`: <https://registry.terraform.io/providers/hashicorp/google-beta/latest/docs/resources/firebase_hosting_custom_domain>
  - Provider transport config: <https://github.com/hashicorp/terraform-provider-google/blob/main/google/transport/config.go>
  - Hosting site resource source: <https://github.com/hashicorp/terraform-provider-google-beta/blob/main/google-beta/services/firebasehosting/resource_firebase_hosting_site.go>
  - Firebase Terraform guide: <https://firebase.google.com/docs/projects/terraform/get-started>
  - Firebase IAM permissions: <https://firebase.google.com/docs/projects/iam/permissions>
  - Firebase product-level predefined roles: <https://firebase.google.com/docs/projects/iam/roles-predefined-product>
  - Firebase Hosting roles reference: <https://docs.cloud.google.com/iam/docs/roles-permissions/firebasehosting>
  - Hosting configuration: <https://firebase.google.com/docs/hosting/full-config>
  - Superstatic: <https://github.com/firebase/superstatic>
  - Firebase pricing: <https://firebase.google.com/docs/pricing>
  - Cloud Billing budgets: <https://docs.cloud.google.com/billing/docs/how-to/budgets>
  - Troubleshoot ADC: <https://docs.cloud.google.com/docs/authentication/troubleshoot-adc>
  - Services enabled by default: <https://docs.cloud.google.com/service-usage/docs/enabled-service>
  - WIF with deployment pipelines: <https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines>
  - auth v3.0.0 README: <https://github.com/google-github-actions/auth/blob/v3.0.0/README.md>
  - firebase-tools `requireAuth.ts`: <https://github.com/firebase/firebase-tools/blob/master/src/requireAuth.ts>
  - firebase-tools issue 10716: <https://github.com/firebase/firebase-tools/issues/10716>
  - firebase-tools v15.30.1 release: <https://github.com/firebase/firebase-tools/releases/tag/v15.30.1>
  - Node v22.23.1 release: <https://nodejs.org/en/blog/release/v22.23.1>
  - GitHub immutable subject claims: <https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/>
  - GitHub OIDC reference: <https://docs.github.com/actions/reference/openid-connect-reference>
  - GitHub events that trigger workflows: <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
  - GitHub workflow syntax: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>

### ADR candidates
Durable decisions in PR #12 beyond C10–C13. Numbering is left to the Chief Architect.
- **Budget guardrail enforcement:** `prevent_destroy`, a CI presence check, and apply provenance, meaning which checkout may be applied (F1).
- **Canonical URL form:** `trailingSlash: true`, `cleanUrls: false`, directory URLs matching GitHub Pages, and the two-hop legacy redirects.
- **Design-token policy:** the tracker palette is the source of record, text colours are adjusted only when they fail AA, and the status green is added (F7). Theme switching uses `prefers-color-scheme` only, with no JavaScript.
- **Self-hosted fonts** via `@fontsource`, never a runtime CDN, plus a subsetting policy.
- **Host-agnostic build interface:** `SITE_URL` and `SITE_BASE` validation, and no base written into page code.
- **Redirect-map lifecycle:** generated from a build inventory, a snapshot in Phase 1, regenerated and re-checked when served in Phase 6.
- **Test-data policy:** exact assertions on committed fixtures, structural assertions on fetched satellite data (A15, F8).
- **CI supply-chain pinning:** actions by SHA, CLI tools by lockfile, runtimes by exact version (F5, F10).
- **Deploy activation by repository variables**, not secrets, including the `SITE_URL` ordering rule (SEAM-4).
- **Extend C12:** the WIF pool as a trust boundary, shared with satellites or separate per satellite (F4).
- **Extend C11:** predefined Hosting Admin is the narrowest supported grant; the custom-role option is withdrawn; decide on API Keys Viewer (F2, F3).
