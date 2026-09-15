# Chief Reviewer: PR #9 Review and Phase 0 Governance Audit

> **Redaction (Lead Architect, 2026-09-15):** one commit SHA is redacted throughout,
> because that commit remains retrievable by SHA until GitHub purges cached views.
> The report is otherwise verbatim.

Status: Review
Last updated: 2026-09-14
Owner: Chief Reviewer (Specialist 2, sprint 2026-09-hub)
Contract: `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-0.md`
Reviewed: PR #9, branch `gov/establish-hub` at `08e69ba` (31 files, +3,394). CI ran on merge commit `654c865` (`08e69ba` merged into `main` at `75fe634`). Line numbers refer to `08e69ba`.

**Independence and method.**
- I wrote and certified none of the work under review.
- Constellize is not installed, so I did the test-rigor, architecture and data-model checks myself.
- I wrote no files and made no git or gh changes.
- Tools used, all read-only:
  - `git diff`, `log`, `show` and `ls-tree`
  - `gh pr view` and `gh pr checks`
  - `gh api` GET calls and `gh label list`
  - the declared governance check command
  - web lookups of primary documentation
- Owner-authored inputs (the design doc and the brief) are reported to the owner. They are not counted as defects of this PR's authors.

---

## Part A: PR review

Scope: the review checklist's Universal, Alignment, Documentation, Architecture and Implementation sections, plus the delta's domain review questions. Findings are ordered most severe first.

| # | Severity | Artifact and location | Defect | Failure scenario or contradiction | Owner | Concrete fix |
|---|---|---|---|---|---|---|
| A1 | **must-fix** | Branch `handoff/research-hub` at `[commit SHA redacted until GitHub purges cached views — see STATE.md §Incident A1]` on the public remote: `llm/plans/handoff/phd-milestones.tar.gz` (68,565 bytes, committed 2026-09-10). `STATE.md` §Follow-ups L177–178 | **Private material is downloadable from a public repository today.** Design doc §2 L35 lists this tarball's contents as the private milestone tracker, committee dossier and VT policy, and §4's example describes the dossier as "Twelve vetted external committee candidates, ranked". I verified the repo is `public` and the GitHub contents API serves the file on that branch. STATE.md defers deleting it to Phase 3. The tarball is *not* in PR #9's tree (verified), but PR #9's STATE records the decision to defer. | Anyone can fetch the ranked list of named external candidates now. This breaks design doc §3 ("Private content never enters a repository that could become public") and §12.1, and domain question 1 fails today, not in Phase 3. Deleting the file from the branch in Phase 3 still leaves it reachable through commit `[commit SHA redacted until GitHub purges cached views — see STATE.md §Incident A1]`. | **Owner (Jason)** decides the fix. Chief Architect updates STATE.md. | The owner should act before Checkpoint 1 closes: (1) confirm the copy outside the repo (brief §4 location) is intact; (2) delete the remote branch `handoff/research-hub` (its two documents are byte-identical on PR #9, sha256 verified, and its README is superseded); (3) ask GitHub Support to purge cached, unreferenced objects for `[commit SHA redacted until GitHub purges cached views — see STATE.md §Incident A1]`. `forks_count` is 0 (verified), so no fork holds a copy. (4) The Chief Architect replaces the Phase 3 follow-up with an immediate item and records the exposure window (from 2026-09-10 to removal) in STATE.md. |
| A2 | **must-fix** | `adr/0005` Decision 2 (L18–20) vs design doc §5 (L148–149) | **ADR-0005 weakens the leak check the design authority specifies.** Design doc: "A post-build check greps `public/` for any private slug", i.e. it searches file contents. ADR: "fails the job if any **path** under `site/dist-public` matches". The narrower wording comes from brief §4 L249, which ranks below the design doc. Canon's hierarchy says an ADR that conflicts with the design-authority document must be fixed before implementation proceeds. | Phase 3 builds a path-only check. The public sitemap, navigation or a section index contains `/phd/phd-milestones/committee-dossier/`, but no file *path* matches, so the check passes. §12.1 is breached while ADR-0005 is satisfied. The ADR's own Risks (L59–63) concede that sitemap leaks pass. | Chief Architect (ADR); CPO (roadmap L273) | Amend Decision 2 to: "greps every file under `site/dist-public`, both paths and contents, for every private slug and fails on any hit (design doc §5)". Path matching stays as an extra check. Record brief §4 L249 as a new conflict (see A9). Roadmap L273: "…when a private slug appears in any path or file content under `site/dist-public`". |
| A3 | **must-fix** | `adr/0002` Decisions 1 (L22–27) and 2 (L28–29); Risks L77–84 | **ADR-0002's two accepted decisions cannot both hold.**<br>• GitHub's "Create a repository dispatch event" endpoint needs a fine-grained token with **Contents: write** on `website` (a classic PAT needs the `repo` scope).<br>• A workflow's own `GITHUB_TOKEN` is "limited to the repository that contains your workflow", so a satellite's token cannot call `website` at all.<br>• So any credential a satellite uses to fire the dispatch (Decision 1) can write to the hub, which contradicts Decision 2 ("No satellite has write access to the hub repository") and §12.3.<br>• The Risk text's two escape routes are false: a GitHub App installation token needs the same Contents: write, and "the publish action's own token scoped to dispatch only" does not exist. | Phase 2 follows the ADR's suggestion: a GitHub App with Contents: write on `website`, its private key stored in each satellite. A compromised `cv` workflow pushes a branch to `website`. Workflows triggered by same-repo branches run with the hub's secrets and `id-token: write`, so the attacker reaches the hub's WIF deploy identity. That breaks principle 3 and domain question 3, and the App key is itself a long-lived secret (domain question 2). | Chief Architect (ADR); **Owner (Jason)**, because design doc §3 and §4 carry the same contradiction | Replace L77–84 with the verified facts above and cite the sources. Mark Decision 1's dispatch step "conditional on the C1 ADR". State the constraint C1 must meet: *no satellite holds any GitHub credential for `website`*. Options C1 could evaluate: (a) a GCS object-finalize notification via Pub/Sub, consumed by a hub-owned component that holds the only GitHub credential; (b) a scheduled hub workflow that compares bucket manifest generations. Add the contradiction to STATE's conflict list for the owner (K13 in A9). |
| A4 | **must-fix** | PR #9 body: Summary of Changes (last bullet), Files Changed (`llm/master-roadmap.md — pending`), Review ("pending") | **The PR body is stale.** The roadmap landed in `08e69ba` and this review exists. Brief §7's "docs updated" item is not met. | At Checkpoint 1 the owner reviews from the PR body, reads that the roadmap "lands in a follow-up commit", and approves without reviewing 478 lines of phase scope that merging makes authoritative. | Chief Architect | Before marking the PR ready: update those three sections; add the roadmap, the CPO handoff and this review under Related Documents; add K1–K8 and how each must-fix in this report was resolved under Open Questions. |
| A5 | should-fix | `adr/0001` Decision 3 (L32–36); roadmap Phase 0 AC L102; design doc §10 Q5 (L293) | **ADR-0001 records an owner-reserved decision as settled.** §10 says of Q5: "Agent proposes in ADR 1; owner approves." ADR-0001 is `Accepted` and states the `site/` layout as decided. The rule that merging PR #9 approves Q5 appears only in the PR body and STATE L105. | The owner merges PR #9 for the delta and CI, intending to discuss Q5 later. The durable record says Accepted with no trace of approval, and the Phase 1 site contract runs `git mv` into `site/`. Roadmap AC L102 ("ADR-0001 states the Q5 proposal for owner approval") cannot be checked true against the ADR text. | Chief Architect | Add to Decision 3: "Proposed under §10 Q5 for owner approval at Checkpoint 1; merging PR #9 records that approval." Add PR #9 under Related Issues / PRs. |
| A6 | should-fix | `adr/0004` Alternatives, IAP (L37–40) | **The claim "IAP requires an external HTTPS load balancer" is refuted.** Google now recommends enabling IAP "directly on a Cloud Run service", with no load balancer to provision and no load-balancer cost, and supports projects with no organization. The cost claim holds only for the load-balancer setup: a global forwarding rule is $0.025/hour, about $18/month, which is over $5. | The owner or a future maintainer checks the claim, finds it false, and the gate-versus-IAP decision loses its recorded reasoning. IAP could later be reopened without the real reasons on record. | Chief Architect | Rewrite the alternative: IAP can run directly on Cloud Run at no load-balancer cost (cite). Reject it because it admits only authenticated principals, so it cannot provide §7's anonymous, expiring, single-slug Shared tier. Mark "cannot sit behind a Hosting rewrite" UNVERIFIED unless tested. Keep the ~$18/month figure, scoped to the load-balancer setup. |
| A7 | should-fix | `adr/0004` Risks, CDN caching (L72–74) | **The claim "Hosting caches rewrite responses unless told not to" is refuted.** Firebase docs: "By default, Firebase Hosting sets Cache-Control to private for dynamic content." Hosting also adds `Cookie` and `Authorization` to `Vary`. The real risk is a gate response that *explicitly* sets `public` or `s-maxage`. | A Phase 3 reviewer tests a gate response without the header, sees no CDN caching, and decides the header is optional. A framework default that sends `public, max-age` on a file-serving path never gets tested. | Chief Architect; CPO (roadmap L271, L325) | Restate the risk: the CDN caches a rewrite response only when it carries `public` or `s-maxage` (cite). Keep `private, no-store` per §6. Add a required test that no `/p/` or `/s/` response carries `public` or `s-maxage`. |
| A8 | should-fix | PR #9 Governance Level; label `gov-L2`; issue #7 | **The declared level may understate the content.** Under the mixed-level rule, a PR takes the highest level it touches. The roadmap's per-phase acceptance criteria and phase boundaries are requirements and MVP scope, and design doc §7 (access tiers) is privacy policy. `governance-levels.md` lists all of these under L3, and architecture-governance §Design Authority Hierarchy treats product artifacts as L3. The PR's justification considers only L1 and L2. | The wrong Definition of Done gets applied: Implementation Work instead of Design Work for product documents. A later roadmap scope edit cites PR #9 as precedent for treating such changes as L2. | Chief Architect (PR body and label); **Owner (Jason)** decides | I escalate to L3; canon lets AI roles move a classification up. Either relabel `gov-L3` and tick L3 in the template, or the owner states on the PR that the roadmap and design doc are L1/L2 (only the owner may move a level down). Brief §0's "L2 for every work stream" was written before this content existed. |
| A9 | should-fix | `STATE.md` §Brief vs design-doc conflicts (L69–97); CPO handoff Risks (L121); roadmap O2 (L448) | **The conflict list is incomplete, mislabelled in places, and out of date.**<br>(i) Missing items:<br>• the Phase 1 dispatch stub (brief L174–176 vs §11 Phase 2);<br>• Phase 3 ordering (brief L121 runs gate before infra; L228 says launch them in parallel);<br>• leak-check semantics (A2);<br>• brief §4 L143's "the real path on this machine" vs canon's one permitted machine path. The delta correctly overrode the brief here but never recorded why.<br>(ii) The heading misattributes K6 and K7 (conflicts inside the brief) and K8 (conflicts inside the design doc).<br>(iii) K2 still says "Unverified". It is now verified by the Hosting REST reference. The CPO's cited firebase-tools #1444 is a different error (a 2019 `FAILED_PRECONDITION`). | The owner rules on K1–K8 at Checkpoint 1. The Phase 1 contract is then written from brief §4 with the dispatch stub, and the Phase 3 contract with a path-only leak check. Neither choice was ever put to the owner. | Chief Architect (STATE); CPO (handoff L121, roadmap O2) | Retitle the section "Brief / design-doc / canon conflicts". Add K9 (dispatch stub), K10 (Phase 3 ordering), K11 (leak-check semantics), K12 (check-command path) and K13 (the ADR-0002 dispatch contradiction, A3). Update K2 to VERIFIED and cite the REST reference. In the handoff, replace #1444 with that reference. In roadmap O2, change "is reported to reject" to "rejects". |
| A10 | should-fix | `adr/0001` Consequences (L88–106); `STATE.md` Risk 1 (L158–162); roadmap Phase 1 L142, L151, L163 | **`main` changed after this branch was cut, and the migration records miss it.** PR #8 (merged 2026-09-14 18:31) added `redirects` to `astro.config.mjs` with hardcoded `/website/research/soa-agentic-se/...` targets, and moved the research routes. No migration record names them. | On `cusati.us`, `/research/agentic-harnesses` redirects to `/website/research/...` and returns 404. Roadmap AC L151 ("no link or asset reference under `/website/`") fails. Redirect-map AC L163 covers only the smoke-test routes, so the gap passes review. | Chief Architect (ADR-0001, STATE); CPO (roadmap) | Add "the existing `astro.config.mjs` redirects (PR #8) and the `/research/**` routes" to ADR-0001's Negative consequences and STATE Risk 1. Change roadmap L163 to "covers every route in the current build, including `/research/**` and the existing Astro redirects". |
| A11 | should-fix | `llm/memory_bank/activeContext.md` L10–18; `progress.md` | **The memory bank does not reflect project state.** It ranks first in canon's authority hierarchy, above the design doc, yet it holds only adoption stubs: no Q1/Q2 answers, no ADRs, no "stopped at Checkpoint 1". Brief §7 and the canon Definition of Done require an update when project state changes. | A fresh agent session follows CONTRIBUTING's "Read First" step 1, finds no stop instruction, no domain and no Q5 status, and either starts Phase 1 or re-asks answered §10 questions. | Chief Architect | activeContext: current position (Phase 0; stop at Checkpoint 1; no Phase 1 work without the owner's go) and pointers to ADRs 0001–0005, the roadmap and STATE. progress: governance adopted; Phase 0 roadmap items pending merge. |
| A12 | should-fix | `adr/0004` Decision 1 L15 ("maximum 3 instances", citing §6 and §8); `adr/0005` Decision 4 L23; `adr/0003` Risks L68–70 | **ADRs attribute brief parameters to the design doc.** Maximum 3 instances (brief L238) and "private navigation only in the private build" (brief L252) are cited to design doc sections that do not contain them. ADR-0003 also adds a rule the design doc does not have ("Islands in the public build may call only the gate…"). An unsupported decision is an undocumented decision. | A Phase 3 reviewer looks for the instance limit in §6 or §8, finds nothing, and cannot tell whether the owner or the brief set it. If the brief is amended at Checkpoint 1, the ADRs silently diverge from it. | Chief Architect | Attribute each parameter to "brief §4 L238" or "brief §4 L252", in the decision text and in Related Documents. Present ADR-0003's island rule as a constraint the ADR adds, with its reason (§12.4), and list it as an ADR candidate. |
| A13 | should-fix | `.claude/settings.json` L9 (`autoUpdate: true`); delta §Related Repos (canon row) and §Canon Location | **Local tools and CI can run different canon versions, and this is not recorded.** CI pins canon at `5689b69`, but agent sessions on the workstation auto-update the plugin (checker, skills, charters). The delta says "Pinned at v0.8" without saying that only CI is pinned, and nobody owns bumping the SHA. | canon v0.9 changes a checker rule. Local sessions pass under v0.9 while CI fails under v0.8.3, or the reverse, and agents apply v0.9 charters in a repo pinned to v0.8. | Chief Architect | Add to delta §Canon Location: "The CI SHA is the binding pin; the plugin auto-updates locally; bumping the SHA is an L2 PR that also updates the delta's `Governance:` line." Or set `autoUpdate: false`. |
| A14 | note | `ci.yml` L25, L36 | `actions/checkout@v4` and `actions/setup-node@v4` are pinned by mutable tags, while canon is pinned by SHA for exactly that reason (L15–17). The run log warns that Node 20 is deprecated and the actions were forced onto Node 24. | A retagged action or the Node 20 removal changes the governance gate with no commit in this repo. | Chief Architect | Pin both to full SHAs (the run log resolved checkout to `11d5960a…` and setup-node to `49933ea5…`), or move to v5 pinned by SHA. |
| A15 | note | `CONTRIBUTING.md` L70 | Points to "The memory bank's own README", which does not exist. The row comes verbatim from the canon template, and the link check cannot see it because it is not a link. | A contributor looking for when to update the memory bank finds nothing. | Chief Architect (also raise it against canon) | Add a `llm/memory_bank/README.md` stub (structure, reading order, update triggers), or point the cell at `activeContext.md`. |
| A16 | note | `adr/0001` L22; issue #7 (outside the diff) | ADR-0001 publishes the owner's personal email address in a public repo; the design doc does not. Issue #7 publishes the GCP billing account ID and shell-profile details. Neither is a machine path: the delta's `Canon checkout` is the only machine path in files this PR authored (verified by grep). | The billing account ID and email address become material for phishing or support-desk social engineering. | Chief Architect (ADR); Owner (issue #7) | ADR: write "the owner's personal Google account". Owner: edit issue #7 to remove the billing account ID. |
| A17 | note | CPO handoff L3 | `Status: Complete (awaiting Lead Architect verification)` is not canonical status vocabulary (architecture-governance §Documentation Standards). | Status-based tooling and audit check 11 misread it. | CPO | Use `Status: Review`. |
| A18 | note | Roadmap L97; L180, L439 | L97 attributes "links to design doc sections" to canon DoD §ADR Work; the requirement is actually brief §4 step 5. L180 and L439 say Q5 is "pending owner approval at Checkpoint 1", which goes stale at merge and cannot be fixed by a checkbox flip. | Once PR #9 merges, the roadmap misstates Q5 and correcting it takes an L1 PR. | CPO | L97: cite brief §4 step 5. L180 and L439: "Proposed in ADR-0001; approved by merging PR #9". |
| A19 | note | `adr/README.md` L31–34; roadmap L30–35 | Both restate canon's L0/L1 policy (ADR status flips; checkbox-only edits) instead of citing it, which breaks the consolidation principle. | canon changes the status-flip form and these copies drift. | Chief Architect (README); CPO (roadmap) | Replace each with a one-line citation of `l0-fast-track.md` §L0 Path Allowlist and `architecture-governance.md` §ADR Process. |
| A20 | note | ADRs 0001–0005, Related Issues / PRs; PR #9 labels | The ADRs link issue #7 but not PR #9. The PR has no priority label, although issue #7 is `priority-high` (labels.md §Labeling Rules). | A later L0 status flip cannot find the approving PR from the ADR. | Chief Architect | Add "PR #9" to each ADR. Add `priority-high` and `adr` to PR #9. |
| A21 | note | Owner-authored inputs, brought across verbatim | Design doc:<br>• L6 pins governance v0.5.<br>• L7 names the handoff branch.<br>• L9–11 says "rank 2 … beneath the governance delta", but canon's rank 1 is the memory bank and the delta is not in the hierarchy.<br>• L3's status is not canonical vocabulary.<br>• §10 Q4 names a third party in a public repo.<br><br>Brief:<br>• Machine paths at L53, L57, L151 and L254, and an email address at L34.<br>• L7–9 says the handoff branch holds only three files; it carries the whole site.<br>• L86 calls the phase-end audit an "L0 Governance Audit".<br>• L143 conflicts with canon (see A9). | Agents that read the design doc header apply v0.5 rules, or rank the delta above the memory bank. | **Owner (Jason)** | Fix each in the next L1 PR that touches the document. |
| A22 | note | `STATE.md` Done, L30 | Brief §2 assigns `/governance:establish` and the delta to the Repository Steward. STATE does not record which persona actually ran them. | A later audit cannot tell who wrote the delta, which the auditor-independence rule depends on. | Chief Architect | Record which persona ran establish and why that departs from brief §2. |

**Summary against the checklist sections:**
- **Universal:** problem, motivation, assumptions and cross-references are present. The PR introduces undocumented or unsupported decisions (A3, A12, A13).
- **Alignment:** fails the design authority at ADR-0005 (A2). Domain question 1 fails at repository level (A1).
- **Documentation:** header gaps and stale content (A4, A11, A17, A19).
- **Architecture:** alternatives and trade-offs are present, but two of them rest on refuted claims (A6, A7).
- **Implementation (`ci.yml`):** it maps to the delta and canon establish step 11, is validated by green runs, and handles errors adequately; only A14.

---

## Part B: Definition of Done

### Brief §7

| Item | Status | Evidence |
|---|---|---|
| Approved issue exists | Met | Issue #7 is open and labelled `governance`, `in-progress`, `priority-high`, `phase-0-establish`; it declares Mode 3 and L2 and was opened as brief §4 step 1 instructs. No owner approval comment exists on #7; approval rests on the owner-authored brief. |
| Design doc and ADRs present | Met | The design doc and brief are byte-identical to `handoff/research-hub` (sha256 `035229bf…` and `8af072c3…`). ADRs 0001–0005 are present with an index, and `adr-index` passes. |
| Code reviewed via PR by Chief Reviewer | Not met yet | PR #9 has 0 reviews and 0 comments. Met once this report is persisted and posted. |
| Tests included and passing | Met | CI run `34881417434` on merge commit `654c865`: `governance-checks` reported "4 of 4 checks passed" against canon checked out at `5689b69`, with no SKIP. In `build-and-deploy`, `check` and `build` passed; deploy and smoke tests were skipped, as expected on a PR. The PR adds no application code. |
| Docs updated | Not met | The PR body is stale (A4). |
| Data, security and privacy impact documented in the PR | Met, with a caveat | The PR body answers all three domain questions. Its answer to question 3 ("not applicable") understates ADR-0002's accepted dispatch design (A3). |
| Memory bank updated if project state changed | Partially met | Only adoption stubs (A11). |
| Governance checks pass with `--layout` | Met | Locally: default mode 3/3 and `--layout` 4/4, via both the plugin and the declared canon checkout. CI: 4/4. |

### Canon §Design Work (roadmap and ADRs)

| Item | Status | Evidence |
|---|---|---|
| Captured as Markdown | Met | All files are `.md`. |
| Status and last-updated date | Met | Roadmap: Draft, 2026-09-14. ADRs: Status and Date lines. STATE: Active. |
| Purpose, scope, assumptions, open questions | Met | Roadmap has all four (L7–L55 and L427–L453). The ADRs follow the canon ADR template, which is identical to the repo's `0000-template.md`. |
| Aligns with design authority | **Not met** | A2 (ADR-0005 Decision 2); A12 (brief parameters attributed to the design doc). |
| Cross-references | Met | Roadmap L463–478; each ADR's Related Documents section. |
| ADR candidates identified | Met | STATE C1–C4; CPO handoff P1–P8. |
| Memory-bank updates if context changed | Partially met | A11. |
| PR reviewed | Not met yet | This report. |

### Canon §ADR Work

| ADR | Context | Decision explicit | Alternatives | Consequences | Status | Related docs / PRs |
|---|---|---|---|---|---|---|
| 0001 | Met | Met (Q5 approval not stated, A5) | Met: 3 | Met | Accepted | Design doc and #7 linked; PR #9 not linked (A20) |
| 0002 | Met | Explicit, but Decisions 1 and 2 conflict (A3) | Met: 2 | Met | Accepted | Same |
| 0003 | Met | Met | Met: 5 | Met | Accepted | Same |
| 0004 | Met | Met | Met: 2 (IAP reasoning refuted, A6) | Met (caching claim refuted, A7) | Accepted | Same |
| 0005 | Met | Explicit, but narrows the design doc (A2) | Met: 2 | Met | Accepted | Same |

### Canon §Implementation Work (`ci.yml`)

| Item | Status | Evidence |
|---|---|---|
| Approved issue or spec | Met | Issue #7; delta §Governance Check Command; canon establish step 11. |
| Relevant design docs or ADRs exist | Met | The delta cites `ci.yml`. The choice to keep it separate from `build.yml` is recorded in the `ci.yml` comment (L20–21), the PR body and STATE A4. |
| Reviewed through PR | Not met yet | This report. |
| Tests or validation | Met | Green `governance-checks` runs on `effd377`, `36c6fce`, `fcdb1eb` and `08e69ba`. The two checkouts sit side by side (`repo/` and `governance-canon/`). `fetch-depth: 0` makes `origin/main` available to `adr-status`. The pinned SHA `5689b69` is canon `main`'s head (`compare` returns `identical`) and is tagged `v0.8.3`. Canon is public, so the default token can check it out. |
| Documentation updated | Met | Delta §Governance Check Command. |
| Data, security, privacy impact documented | Met | `permissions: contents: read`; no secrets referenced. |
| Memory bank updated | Not applicable | Covered by A11. |

---

## Part C: Domain review questions

1. **Does this change put any private-visibility item on the public path?**
   - **The PR diff: no.** It touches only `llm/`, `.github/`, `.claude/` and root Markdown files. It adds no `src/`, `public/`, `site/` or build output. `git ls-tree` finds no tarball in the PR tree.
   - **The repository: yes.** The private `phd-milestones` tarball is publicly served from `handoff/research-hub`, and PR #9's STATE.md defers removing it to Phase 3 (A1).
   - **The design records:**
     - ADR-0005's path-only leak check would let slugs in the sitemap, navigation or indexes through (A2).
     - ADR-0004 misstates the caching risk (A7).
     - ADR-0003's rule limiting islands to calling the gate is sound, but it is unattributed (A12).
2. **Does this change introduce a long-lived credential?**
   - **The PR diff: no.** `ci.yml` uses the default token with `contents: read` and references no secrets. `.claude/settings.json` registers the plugin by git URL, with no token. The diff contains no key files or credential strings (grep).
   - **The design records:** ADR-0002's dispatch step cannot be built without a credential that is either long-lived (a PAT or GitHub App key) or held by the satellite with write access to the hub (A3).
3. **Can a satellite affect anything outside its prefix?**
   - **The PR diff: no publishing path exists yet.**
   - **The design records: yes, as ADR-0002 is written.** Firing `repository_dispatch` requires Contents: write on `website`, so a satellite could affect hub code (A3).
   - **K5 is real.** Brief §4 L213 scopes satellite identities to `cv/`, but design doc §4 L126 uploads to `sources/cv/`. An IAM condition on a literal object-name prefix written from the brief would grant nothing where satellites actually write, or would be widened to `sources/` and grant every source.

---

## Part D: Phase 0 Governance Audit (audit procedure checks 1–11)

### Governance check command

| Mode | Result |
|---|---|
| Default, via the plugin | `governance-links`, `adr-index` and `adr-status` PASS (3 of 3), exit 0 |
| `--layout`, via the plugin | Same three plus `layout` PASS (4 of 4), exit 0 |
| `--layout`, from the declared canon checkout | 4 of 4 PASS, exit 0. The declared `Canon checkout` resolves on the review workstation: `VERSION` is 0.8.3 and `llm/governance/` is present. |
| CI on PR #9 (merge commit `654c865`, canon `5689b69`) | "4 of 4 checks passed, 0 failed", no SKIP |

### Branch protection: delta §Platform Enforcement Reality compared field by field with `gh api`

| Delta claim | API value | Match |
|---|---|---|
| Pull requests required | `required_pull_request_reviews` present | yes |
| Approvals: 0 | `required_approving_review_count: 0` | yes |
| Stale reviews dismissed | `dismiss_stale_reviews: true` | yes |
| Code-owner review off | `require_code_owner_reviews: false` | yes |
| Conversation resolution required | `required_conversation_resolution.enabled: true` | yes |
| Force pushes blocked | `allow_force_pushes.enabled: false` | yes |
| Deletions blocked | `allow_deletions.enabled: false` | yes |
| `enforce_admins` off | `enforce_admins.enabled: false` | yes |
| Required status checks: none | No `required_status_checks` key | yes |
| No rulesets | `rulesets: []` | yes |
| Public, user-owned, single collaborator | `visibility: public`, `owner.type: User`, collaborators `[djjay0131]` | yes |
| Not claimed, and not required by canon | `require_last_push_approval: false`, `required_signatures: false`, `required_linear_history: false`, `lock_branch: false`, `allow_auto_merge: false` | Consistent |

Where this departs from canon `branch-protection.md`: approvals are 0 (canon requires approvals), and code-owner review is off even though CODEOWNERS exists. Both are recorded honestly, with reasons.

### Labels

There are 41 labels: 9 GitHub defaults plus 32 created. Every canonical label is present:
- type (12)
- status (5)
- priority (3)
- `gov-L0` to `gov-L3` (4)
- special (3): `memory-bank-update`, `adr-needed`, `security-privacy`
- milestones (7): `phase-0-establish` to `phase-6-polish`

This matches the delta and STATE.

### Checks

| # | Check | Result |
|---|---|---|
| 1 | Adoption and version | **PASS.**<br>• The delta exists with every template section filled and no placeholders.<br>• It pins `v0.8`, matching canon `VERSION` 0.8.3; canon `main` is still at `5689b69`, so there is no drift.<br>• The v0.2 fields are present: memory-bank path, roadmap path, check command, L0 allowlist, Platform Enforcement Reality, Steward Activation Status.<br>• The `## Repository Layout` block is present and `--layout` passes.<br>• Mission, principles and domain questions are verbatim (compared programmatically against design doc §1 and §12 and brief §4). |
| 2 | ADR health | **PASS, with finding.**<br>• The ADR directory, `0000-template.md` (identical to canon's ADR template) and the README index are present; each ADR has Status, Context, Decision, Alternatives and Consequences; none is superseded.<br>• Orphan-decision scan: the memory bank has no decision language, and design doc §9's five decisions map to ADRs 0001–0005.<br>• Decisions with no ADR: the branch-protection and identity-model choice (recorded only in the delta), branch naming (STATE A3), the governance CI gate kept separate from `build.yml` (STATE A4), the canon pin policy (A13), and ADR-0003's island rule (A12). See Part F. |
| 3 | Workflow compliance | **PASS.**<br>• `main`'s first-parent history shows PR merges only (`75fe634` for #8, `3693167` for #6, and earlier).<br>• No direct commits since adoption began.<br>• Governance is not on `main` yet, so PR #8 (merged 2026-09-14) is exempt as pre-adoption.<br>• PR #9 was opened as a draft and uses the full template (content stale, A4). |
| 4 | Governance levels | **Finding (should-fix, A8).** PR #9 declares exactly one level (L2) and carries exactly one `gov-*` label, and they match, but the L3 content means the level is understated. There are no L0 PRs. PRs #1–#8 predate adoption. |
| 5 | L0 allowlist and steward activation | **PASS.**<br>• The `l0-allowlist` block parses, and every `allow` line has a valid shape (`path-only`, `index-table-rows`, `status-line-only`, `checkbox-only`, `link-target-only` ×2).<br>• It instantiates canon's template, adds documented denies (`public/**`, `site/**`, `gate/**`, `contract/**`, `infra/**`, `firebase.json`), and keeps the template's denies.<br>• Status INACTIVE; no activation ADR or PR is claimed, and no `L0:`-titled PRs exist.<br>• `origin/main` has no delta yet, so the read-from-base rule only takes effect after merge. This PR is semantic anyway. |
| 6 | Governance checks | **PASS** (see the table above). |
| 7 | GitHub surface | **PASS, with notes.**<br>• The PR template puts the governance level first; compared with canon it only adds a canon-location note, the mixed-level sentence and a Data/Security/Privacy section.<br>• All five issue templates are present, and CODEOWNERS is `* @djjay0131`.<br>• CONTRIBUTING differs from the canon template only in its header; it points to a memory-bank README that does not exist (A15).<br>• Branch protection and labels match, as tabled above. |
| 8 | Memory-bank currency | **Finding (should-fix, A11).** The path exists with three stubs dated 2026-09-14 that do not reflect decisions made in this PR. |
| 9 | Control-plane content under the artifacts directory | **PASS.** `docs/` does not exist, there is no `docs/superpowers/**`, and CLAUDE.md contains the output-location override. |
| 10 | Undeclared layout paths | **PASS, with note.**<br>• Paths in use are all declared: `llm/governance/` (including `patterns/`), `adr/`, `specs/`, `plans/`, `sprints/`, `memory_bank/`, and `llm/master-roadmap.md` (under §Roadmap).<br>• The artifacts slot is deliberately undeclared, with the reason recorded in the delta.<br>• CLAUDE.md matches the canonical block exactly except for the permitted changes: paths filled in, and the constitution, features and artifacts table rows deleted. `<artifacts dir>` is filled with the canonical default `docs/`, which is acceptable per the audit procedure's rule for undeclared slots.<br>• AGENTS.md matches the canonical block exactly.<br>• Paths hardcoded in the ADR README and `ci.yml` comments equal the declared ones (note only). |
| 11 | Documentation standards | **Finding (notes).**<br>• CPO handoff status vocabulary (A17).<br>• Canon policy restated in the ADR README and roadmap (A19).<br>• The delta has no Owner line; neither does canon's template, so this is canon-level.<br>• Owner-authored design doc and brief headers do not conform (A21). |

### Technical claims not taken from the design doc

| Claim (where) | Verdict | Primary source |
|---|---|---|
| Firebase Hosting forwards only `__session` to Cloud Run rewrites (ADR-0004 L64–67; STATE) | **VERIFIED** | "cookies are generally stripped from incoming requests… Only the specially-named `__session` cookie is permitted to pass through" ([Firebase: Manage cache behavior](https://firebase.google.com/docs/hosting/manage-cache)) |
| IAP requires an external HTTPS load balancer (ADR-0004 L37–38) | **REFUTED** | "Recommended: directly on a Cloud Run service: … you don't have to provision load balancer resources… avoids additional load balancer costs" ([Enable IAP for Cloud Run](https://docs.cloud.google.com/iap/docs/enabling-cloud-run); [Configure IAP for Cloud Run](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)) |
| …and its standing cost exceeds $5/month | **VERIFIED, for the load-balancer setup only** | Global forwarding rules, first 5: $0.025/hour, about $18/month ([Cloud Load Balancing pricing](https://cloud.google.com/load-balancing/pricing)) |
| Hosting caches Cloud Run rewrite responses unless Cache-Control forbids it (ADR-0004 L72–74) | **REFUTED** | "By default, Firebase Hosting sets Cache-Control to private for dynamic content"; Hosting adds `Cookie` and `Authorization` to `Vary` (same Firebase page) |
| A Hosting deploy is rejected when a rewrite names a Cloud Run service that does not exist (K2; roadmap O2) | **VERIFIED** (rejection). The **HTTP 400** code is corroborated only by a secondary source. | "If the Cloud Run service does not exist when setting or updating your Firebase Hosting configuration, then the request fails" ([Hosting REST v1beta1 `CloudRunRewrite`](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions)). The code 400 comes from the [firebase-talk thread](https://groups.google.com/g/firebase-talk/c/T57aJLhVkOg). firebase-tools #1444 is a different error. |
| (Added) A token that can fire `repository_dispatch` needs Contents: write; `GITHUB_TOKEN` cannot call another repository (A3) | **VERIFIED** | ["Contents" repository permissions (write)](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28); ["The token's permissions are limited to the repository that contains your workflow"](https://docs.github.com/en/actions/concepts/security/github_token) |

### K1–K8 (raised by the CPO): are they real and correctly attributed?

| K | Real? | Attribution | Evidence |
|---|---|---|---|
| K1 | Yes | Correct | Brief §3 L112 and §4 L169–171 vs design doc §11 L302–303. Artifact Registry appears only in §8 L204. |
| K2 | Yes | Correct; now **VERIFIED** (see the table above) | Brief §4 L188–190. As briefed, Checkpoint 2's deploy fails while `hub-gate` does not exist. |
| K3 | Yes | Correct | Brief §4 L231–232 vs §11 L304 and §10 Q3 L291. |
| K4 | Yes | Correct | No bucket IAM test in the brief (grep); §12.1 L310–311; ADR-0005 Decision 3. |
| K5 | Yes | Correct | Brief §4 L212–213 vs design doc §4 L126. |
| K6 | Yes | **Mislabelled.** It is a conflict inside the brief (§1 L72–73 vs §4 L193–194). Design doc §10 Q2 L290 sides with brief §1. | — |
| K7 | Yes | **Mislabelled.** It is a conflict inside the brief (§2 L84 vs §4 L156). | — |
| K8 | Yes | **Mislabelled.** It is a conflict inside the design doc. | §6 L177–179 vs §11 L304; §11 "list" has no §6 route (L170–173); §11 L306; header L6–7. The redirect/retire item is an ambiguity rather than a strict contradiction, since a redirect stub could stay on Pages. Missing from K8: L9–11 misstates the hierarchy (A21). |
| Missing | — | — | Dispatch stub, Phase 3 ordering, leak-check semantics, check-command path, ADR-0002 dispatch contradiction (A9, A2, A3). |

---

## Part E: Verdict

- **PR #9: Request Changes.** Four must-fix findings (A1–A4). A1 is outside the diff but is ratified by this PR's STATE.md, and it needs the owner's action now, not at the checkpoint.
- **Phase 0 Governance Audit: COMPLIANT, with should-fix findings under checks 4, 8 and 11.**
  - Every mechanical check passes.
  - Every platform fact in the delta matches the live API field by field.
  - The labels, allowlist, steward status and routing blocks match canon exactly.
  - The findings concern the level declaration and how current the memory bank is, not false records. If they are still open at the next audit, rate the repo DRIFTING.

**Open question (a): is PR #9 ready to be marked ready for the owner's review?**
No. It becomes ready when:
- the owner has been told about A1 and STATE.md records the fix path;
- ADR-0005 Decision 2 is aligned with design doc §5 (A2);
- ADR-0002's dispatch contradiction is recorded honestly (A3);
- the PR body is current (A4).

The should-fix items can be dispositioned during reconciliation.

**Open question (b): which decisions most deserve the owner's attention at Checkpoint 1?**
1. **A1: the private `phd-milestones` tarball on the public handoff branch.** Only the owner can decide the remediation (delete the branch, ask GitHub to purge, decide whether anyone needs to be notified), and every day of delay extends the exposure.
2. **A3: how satellites trigger a hub rebuild.** Design doc §3 and §4 as written require each satellite to hold a GitHub credential that can write to `website`, which contradicts principle 3. The owner should decide the constraint before Phase 2 is briefed. A related point about merge mechanics: merging PR #9 silently approves Q5's `site/` layout (A5).

---

## Part F: Handoff

### Summary
- **Artifacts:** PR #9's 31 files, CI runs, branch protection, labels, issue #7, the handoff branch, and `main`'s movement since the branch was cut.
- **Findings:** 22 total. 4 must-fix (A1–A4), 9 should-fix (A5–A13), 9 notes (A14–A22).
- **Mechanical governance:** clean.
- **Substantive problems:**
  - private content already public (A1);
  - an ADR that weakens the design authority's leak check (A2);
  - an accepted ADR whose dispatch design contradicts itself and principle 3 (A3);
  - two ADR rationales resting on refuted platform claims (A6, A7).
- **K1–K8:** all eight are real; three are mislabelled, and five more conflicts are missing.

### Assumptions
- The tarball holds the private material design doc §2 describes. I did not open it.
- "Rejected at deploy" rests on the Hosting REST reference. I ran no deploy.
- The CI evidence reflects `main` at `75fe634`; any later push to `main` needs a re-run.
- Escalating A8 upward is within my role under `governance-levels.md` §Escalation.
- This review's independence is temporal and artifactual only: the Lead Architect posts it under the shared owner token.

### Recommendations (ideas beyond Phase 0 scope; none of these are findings)
1. Tell the owner about A1 immediately, outside the checkpoint cadence.
2. Make the C1 dispatch-credential ADR an entry gate for Phase 2, with the constraint "no satellite holds a GitHub credential for `website`".
3. In Phase 1, ship `firebase.json` without the gate rewrites until `hub-gate` exists (K2); the owner decides.
4. After the first green run on `main`, add `governance-checks` as a required status check (the delta's hardening path).
5. Add a secret and large-binary scan to `ci.yml`, so a future tarball or key file fails CI rather than depending on review.
6. In Phase 3, add a test that no `/p/` or `/s/` response carries `public` or `s-maxage` (A7).

### Alternatives considered
- **Approve with comments and treat A1 as outside the diff.** Rejected: this PR's STATE.md records the decision to defer removal to Phase 3, so merging would ratify it.
- **Rate A3 should-fix because C1 is already flagged.** Rejected: merging accepts two decisions that contradict each other, and the Risk text steers Phase 2 toward an option that fails §12.3.
- **Audit verdict DRIFTING.** Rejected: every record checked is true; the gaps are in currency and classification.
- **Classify PR #9 as L1 because it is mostly documents.** Rejected: `ci.yml` and `.claude/settings.json` are L2, and the mixed-level rule takes the highest level.

### Risks
- The tarball has been exposed since 2026-09-10, and GitHub may keep cached objects after the branch is deleted.
- With `enforce_admins` off and one shared token, any agent session can push to `main`; the controls in this review are procedural.
- If A2 is not fixed before the Phase 3 contract, the leak check is built to the weaker brief wording.
- If K2 is not resolved in the Phase 1 contract, Checkpoint 2 fails at deploy.
- Line references in this report will drift as reconciliation commits land. Cite `08e69ba` when routing.

### Open questions (owner decisions this review requires; routed findings, not new §10 questions)
- A1: how and when to remove the tarball, and whether the exposure needs any notification.
- A3: whether satellites may hold any GitHub credential for `website`. This decides the §3/§4 dispatch mechanism.
- A8: L3, or an explicit owner statement that the PR is L2.
- A5: confirm that merging PR #9 is the intended way to approve Q5.

### Related docs
- `llm/governance/governance-delta.md`
- `llm/sprints/2026-09-hub/STATE.md`
- `llm/specs/2026-09-10-research-hub-design.md` (§2–§12)
- `llm/plans/2026-09-10-research-hub-orchestration-brief.md` (§0–§7)
- `llm/governance/adr/0001`–`0005` and `README.md`
- `llm/master-roadmap.md`
- `llm/sprints/2026-09-hub/contracts/chief-product-officer-phase-0.md`
- `llm/sprints/2026-09-hub/handoffs/chief-product-officer-phase-0.md`
- `.github/workflows/ci.yml`
- `.claude/settings.json`
- `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`
- canon (`agentic-governance`): `review-checklist.md`, `definition-of-done.md`, `governance-levels.md`, `branch-protection.md`, `labels.md`, `architecture-governance.md`, `project-operating-system.md`, `l0-fast-track.md`
- `<plugin root>/skills/audit/SKILL.md`
- `<plugin root>/skills/establish/SKILL.md` §Routing Rule Blocks

### ADR candidates (durable decisions in PR #9 with no ADR)
- **R1.** How a publish event reaches the hub, and which credential fires it, under the constraint that satellites hold no GitHub credential for `website`. Extends C1; see A3.
- **R2.** Branch protection and the identity model: 0 approvals, `enforce_admins` off, no required checks, one shared token. This is a security and governance-process decision recorded only as delta "facts".
- **R3.** Canon pin and update policy: the CI SHA as the binding pin, plugin auto-update, and who bumps the pin at which level (A13).
- **R4.** Leak-check semantics: search both contents and paths, and cover every derived output. Extends C2; see A2.
- **R5.** Keeping the governance CI gate out of `build.yml`, and carving `ci.yml` out of the Phase 1 infra scope (STATE A4).
- **R6.** Branch naming for this repo versus canon (already C3).
- **R7.** What public-build islands may call at runtime (A12).
- **R8.** Handling private content found in a public repository: the incident runbook that A1 shows is missing.

---

Sources:
- [Firebase Hosting: Manage cache behavior](https://firebase.google.com/docs/hosting/manage-cache)
- [Firebase Hosting REST v1beta1: sites.versions (CloudRunRewrite)](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions)
- [firebase-talk: "HTTP Error: 400, Cloud Run service X does not exist in region Y"](https://groups.google.com/g/firebase-talk/c/T57aJLhVkOg)
- [firebase-tools issue #1444](https://github.com/firebase/firebase-tools/issues/1444)
- [Enable IAP for Cloud Run](https://docs.cloud.google.com/iap/docs/enabling-cloud-run)
- [Configure IAP for Cloud Run](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)
- [Cloud Load Balancing pricing](https://cloud.google.com/load-balancing/pricing)
- [GitHub REST: Create a repository dispatch event](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28)
- [GitHub Docs: GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)
- [GitHub Docs: Permissions required for fine-grained personal access tokens](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [Dev.to: Firebase hosting does not support custom cookies](https://dev.to/engineeringexpert/firebase-hosting-does-not-support-custom-cookies-2h8g)
- [peter-evans/repository-dispatch](https://github.com/peter-evans/repository-dispatch)
