# Handoff: Chief Product Officer — Phase 0 Roadmap

Status: Review
Last updated: 2026-09-14
Owner: Chief Product Officer
Contract: `llm/sprints/2026-09-hub/contracts/chief-product-officer-phase-0.md`
Sprint / issue: 2026-09-hub, Phase 0, #7

## Summary

- I wrote `llm/master-roadmap.md`. It has one section per milestone label, `phase-0-establish` through `phase-6-polish`. Each phase has a Ships line, Scope and Acceptance-criteria checkboxes, a Not-in-this-phase boundary, Blocked on, and its closing checkpoint. All 136 checkboxes are unchecked.
- Phase boundaries follow design doc §11, since the delta says the design doc beats the brief. Brief details are recorded only where they refine a phase without contradicting it, and each is attributed to "brief §4".
- Each §12 non-negotiable is an acceptance criterion in the first phase that exercises it. Phase 1 carries §12.2, §12.4, §12.5 and §12.6, Phase 2 carries §12.3, and Phase 3 carries §12.1 (leak check plus bucket IAM test). A Standing Non-Negotiables table keeps the reviewer duty on later phases.
- STATE.md Risk #1 is carried in two places. Phase 1 must keep route parity at base path `/`, leave no `/website/` references, keep Pages live, repoint the cv fingerprint, and commit a redirect map. Phase 6 must forward every old URL and retire Pages.
- I found seven places where the brief and §11 disagree, and three defects inside the design document. Four are scope creep, and one is a feasibility defect: a Hosting deploy with a rewrite to a service that does not exist yet.

### MVP classification

Users, from the delta's mission:
1. The owner, as publisher.
2. Allowlisted members, for example committee members (§10 Q4 default: Chris Brown).
3. Public visitors reading research and the CV.

| Phase | Class | Reason |
|---|---|---|
| 0 Establish | MVP-critical (enabler) | Nothing ships under L2 without it. No user value on its own. |
| 1 Foundation | MVP-critical | Ownership of the domain and cloud is the mission ("owned outright"). Visitor value is parity only, so the bar is "no regression", not new features. |
| 2 Contract | MVP-critical | Private content must never enter git (§3), so the MVP's private items need the contract. `cv` is the low-risk proof before private data flows. |
| 3 Private area | **MVP-critical: this is the MVP line** | The first new user value: a committee member reads the dossier and the owner's tracker without a file handoff. It is also the last phase the design doc approves. |
| 4 Sharing | Version 1 (contingent on §10 Q3) | Members cover "shared with specific people" for anyone who can sign in. Links add reach for people without an account, but add attack surface. |
| 5 Satellites | Version 1 | Hand-maintained project pages already exist. Self-updating pages reduce owner effort; they don't unlock a new audience. |
| 6 Polish | Split: redirects and Pages retirement are **Version 1, time-sensitive**; Pagefind, RSS and OG images are Future | Once Checkpoint 2 passes, two hosts serve the site (see Risks). Search, RSS and OG images are nice-to-have for a site this size. |

### Scope creep in the brief relative to the design doc

1. **Share routes in Phase 3** (brief §4 gate agent: `POST /share`, `DELETE /share/{token}`, `GET /s/{token}/{path}`). §11 puts shares in Phase 4, and §10 Q3 says they may be cut. This builds and tests an attack surface before the owner has confirmed the feature is wanted.
2. **Buckets and Artifact Registry in Phase 1** (brief §3 "project, WIF, budget, buckets, AR"; brief §4 "content + private GCS buckets"). §11 puts the content bucket in Phase 2 and the private bucket in Phase 3.
3. **All four gate rewrites in Phase 1 `firebase.json`** (brief §4). §11 puts the `/p/**` rewrite in Phase 3. The share paths belong to Phase 4.
4. **Dispatch trigger stub in Phase 1 `build.yml`** (brief §4). §11 puts "dispatch rebuild" in Phase 2.
5. Minor, unrecorded operational choices with no product scope: `GET /healthz`, Cloud Run max 3 instances, and 30-day noncurrent-version lifecycle on buckets. The contract agent's "visibility docs" in Phase 3 (brief §3) is documentation, not creep.

The reverse, an under-scope: **the brief never assigns the §12.1 bucket IAM test** to any agent in any phase. ADR-0005 decision 3 and §12.1 require it on every deploy. The roadmap records it in Phase 3.

## Answers to the contract's open questions

### (a) Can someone who did not do the work verify each phase's acceptance criteria at its checkpoint?

Mostly yes, with these conditions:

- **Phase 0: yes.** Everything is in the PR, CI and the GitHub API.
- **Phase 1: yes, with read access.** The budget, the WIF configuration and the Actions secrets list need Viewer on the GCP project and billing account, plus repo admin. The HTTPS, route-parity and `/website/` checks need only `curl` and the built artifact. §12.5 "rebuild from the repo" can only be checked by proxy (`terraform plan` shows no drift, and the manual steps are written down). Only a rebuild drill in a fresh project fully proves it, and that drill is not in §11.
- **Phase 2: yes, if the prefix-isolation test leaves an artifact.** A reviewer cannot re-run a write as the `cv` identity without impersonation rights. The criteria therefore say "a recorded test".
- **Phase 3: mostly yes.** A reviewer who is not a member can test signed-out, non-member and direct `*.run.app` refusal with their own Google account. The positive "member sees the dossier" check needs a member account. The leak check needs a deliberately failing run on record.
- **Phases 4–6: verifiable, but there is no checkpoint to verify them at.** The brief defines none, so verification falls to phase PR review. Phase 4 can be checked anonymously with a share link. Phase 5 needs a satellite push. Phase 6's "Pages no longer serves the site" cannot be verified until O6 defines "retire".
- **The structural limit:** the delta's identity model means every agent and reviewer acts on the owner's token. Independence is procedural and artifact-based, not an identity boundary. Owner-run steps (`terraform apply`, DNS, seeding) appear in no merged diff. An L0 checkbox flip for them needs evidence recorded in `STATE.md` at the checkpoint, and the roadmap says so.

### (b) Do brief §3 dependencies and design doc §11 phase scopes agree? Every disagreement

Brief vs design doc:

1. **Buckets:** brief Phase 1 provisions content and private buckets; §11 puts them in Phases 2 and 3.
2. **Artifact Registry:** brief Phase 1. §11 does not name it; its first consumer is the Phase 3 gate.
3. **`firebase.json` rewrites:** brief Phase 1 has all four; §11 puts `/p/**` in Phase 3 and the share paths in Phase 4.
4. **Dispatch trigger:** brief Phase 1 has a stub, and brief §3 lists "dispatch trigger" again under Phase 2 infra. §11 has Phase 2 only.
5. **Share routes:** brief Phase 3; §11 Phase 4.
6. **Bucket IAM test (§12.1):** no phase in the brief; ADR-0005 and §12.1 require it on every deploy, first needed in Phase 3.
7. **Satellite prefix:** brief §4 Phase 2 scopes identities to `cv/` and `phd-milestones/`. §4 uploads to `sources/<source>/`. IAM conditions match literal object-name prefixes, so these are not interchangeable.

Inside the brief:

8. §2 gives the CPO a "Phase 0–3 roadmap", but §4 step 6 asks for Phases 0–6.
9. §3's Phase 3 graph runs gate before infra in series, but §4 says "Launch `gate`, `infra`, `site` in parallel".
10. §1 requires "Q2 GCP project id + Blaze confirmed" before Phase 1, but §4 has the owner enabling Blaze at Checkpoint 2.
11. §4 assigns "dispatch permission" to satellite GCP service accounts. A GCP identity cannot hold a GitHub permission (ADR-0002 risk; STATE.md C1).

Brief vs platform behavior:

12. §4 says Hosting tolerates rewrites to a Cloud Run service that does not exist. The Firebase Hosting REST v1beta1 `CloudRunRewrite` reference says the request fails if the Cloud Run service does not exist when the Hosting configuration is set or updated. Checkpoint 2 therefore fails as briefed.

Inside the design doc (defects in a file I do not own; reported, not fixed):

13. §6 lists share-link tests as required gate tests, while §11 defers shares to Phase 4.
14. §11 Phase 4 says share "mint/list/revoke", but §6 defines no list route.
15. §11 Phase 6 has "redirects from `djjay0131.github.io/website`; retire Pages". The redirects need a host on GitHub Pages, the very thing being retired.
16. The header says "Governance: agentic-governance v0.5", but the delta pins v0.8 (v0.8.3). The "Path in repo" line still names the handoff branch.

## Assumptions

- **CPO-A1.** "Design doc wins" (delta) decides every phase boundary. Brief items that conflict with §11 appear in "Not in this phase" with a pointer to Open Questions O1–O7. They are not recorded as scope.
- **CPO-A2.** Consistent brief refinements are recorded as scope or criteria with attribution: layouts, `phd` hidden from public nav, `/signin`, `docs/satellites.md`, the seed script, and the Phase 3 Governance Audit. They add no product scope beyond §11's intent.
- **CPO-A3.** Artifact Registry is recorded in Phase 3. §11 is silent on it, so the classification is uncertain and flagged for human review.
- **CPO-A4.** STATE.md Risk #2, the hourly `cv` fingerprint reading the Pages URL, is a Phase 1 no-regression criterion because ADR-0001 says it must be repointed in Phase 1.
- **CPO-A5.** "14-day link" in §11 Phase 4 is taken as the Ships demonstration: the acceptance test mints a 14-day link. It is not taken as a fixed product rule (see ADR candidate P3).
- **CPO-A6.** Phases 4–6 get a "PRs merged by the owner" checkbox instead of a checkpoint, because the brief defines none. This records the normal L2 merge rule and adds no gate.
- **CPO-A7.** I did not update the memory bank; it is outside my file contract. `llm/memory_bank/progress.md` should point at the roadmap once it merges, and that belongs to the Lead Architect.

## Recommendations

For the Lead Architect and the owner at Checkpoint 1. These are recommendations, not roadmap changes.

1. **Keep the share routes out of Phase 3** (disagreements 5 and 13). Until §10 Q3 is answered, building and testing token-based anonymous access is effort and attack surface the MVP does not need. If the owner answers Q3 at Checkpoint 1, the question disappears either way.
2. **Settle Phase 1 provisioning before the Phase 1 contracts are written** (disagreements 1–4), not during Phase 1 PR review. My product view: an empty content bucket and Artifact Registry created early cost nothing and expose nothing. The private bucket and the gate rewrites, though, are §12.1 surface with no guard until Phase 3. Either the brief follows §11, or the owner amends §11 and adds the bucket IAM test at the moment the private bucket is created. Also verify the Hosting rewrite behavior (item 12) before Phase 1 depends on it.
3. **Assign the bucket IAM test to a named agent in the Phase 3 contracts** (item 6).
4. **Decide what visitors see on the old URL between Checkpoint 2 and Phase 6.** Once Firebase deploys from `main`, GitHub Pages either keeps deploying or freezes. A frozen Pages copy shows visitors a stale CV for as long as Phases 4–5 take. Those phases are unbriefed and could run for months. The Phase 1 contract should state whether Pages keeps deploying in parallel. A redirect or canonical-link step earlier than Phase 6 would be a scope change for the owner to decide.
5. **Treat Checkpoint 4 as the MVP line and add usage evidence to it.** The brief's check is the owner signing in. Stronger evidence: a real member other than the owner (the Q4 invitee) signs in unaided and reads the dossier. Owner-only signing-in cannot reveal the Firebase email-link flow's first-time-user friction.
6. **Before any Phase 4–6 work starts**, write a brief that defines Checkpoints 5–7 and records the owner's go. The design doc approves execution only through Phase 3.
7. **Empty sections.** No satellite in any phase publishes to `writing`, so Phase 1's shell stays empty indefinitely. Decide whether empty sections are hidden from navigation (ADR candidate P5).
8. Fix the header drift in the design doc (item 16) in whichever L1 PR next touches it.

## Alternatives considered

- **A Phase 0–3 roadmap only** (brief §2). Rejected: brief §4 and the contract require 0–6, and without Phase 4's boundary a reviewer cannot see that the brief's Phase 3 share routes are out of scope.
- **Following the brief's sequencing where it is more specific.** Rejected: the delta ranks the design doc higher. The disagreements are surfaced for reconciliation instead of absorbed.
- **A per-phase status field** ("Status: In progress"). Rejected: under the `checkbox-only` shape, the checker requires every changed line to be a checkbox whose pair differs only by the toggle, so a text status field could never be updated in the L0 lane.
- **Recording §10 answers as checkboxes** ("Q3 answered"). Rejected: an answer is a decision (L1), and a checkbox flip would record that a decision happened without recording what it was.
- **One "phase done" checkbox per phase with no per-criterion boxes.** Rejected: a reviewer could not tell which criterion was unmet, and an L0 auditor could not match evidence to items.

## Risks

- **Two hosts, one stale.** From Checkpoint 2 until Phase 6, the old URL may serve a frozen site while `cusati.us` updates. Search engines see duplicate content, and visitors on inbound links see old CV data (Recommendation 4).
- **Phase 1 deploy fails as briefed.** A Hosting rewrite to the Cloud Run service `hub-gate`, which does not yet exist, is rejected at deploy (item 12). Source: Firebase Hosting REST v1beta1 `CloudRunRewrite` reference (https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions): "If the Cloud Run service does not exist when setting or updating your Firebase Hosting configuration, then the request fails."
- **The roadmap may be read as approval for Phases 4–6.** Assumption R-A3 states otherwise, but a reader skimming checkboxes may miss it.
- **Evidence gaps for L0 flips.** Owner-run steps leave no diff. If `STATE.md` does not record evidence per criterion at each checkpoint, the auditor cannot confirm a flip "verifiably complete via merged work".
- **Overtrust in the leak check.** It matches slugs and paths (ADR-0005). The Phase 3 and Phase 6 criteria extend it to titles and derived outputs, but "check passes" can still be misread as "no leak".
- **Roadmap drift.** Any scope change needs an L1 PR. If the brief is amended at Checkpoint 1 and the roadmap is not, phase PRs will be judged against stale boundaries.
- **Single human, shared token.** Independent verification is procedural only (delta §Platform Enforcement Reality).

## Open questions

For the owner, restricted to design doc §10. The CPO does not answer them.

- **Q2 (partial):** Blaze enablement is not on the record. The brief treats it both as a precondition for Phase 1 (§1) and as a Checkpoint 2 step (§4).
- **Q3:** Are share links wanted? This decides whether Phase 4 exists, and whether the brief's Phase 3 share routes are waste. Product consideration: members already cover named people who can sign in, so links matter only for people who cannot or will not create a sign-in.
- **Q4:** Which members to seed (default: Jason and Chris Brown). This blocks Phase 3 and the MVP evidence in Recommendation 5.
- **Q5:** Approve or reject ADR-0001's `site/` layout at Checkpoint 1.
- **Q6:** The order of `agentic-kg` and `construction-ai-proposal` (Phase 5).

Non-§10 items for the Lead Architect, not the owner: O1–O7 in the roadmap, and the disagreements above.

## Related docs

- `llm/master-roadmap.md` (deliverable)
- `llm/specs/2026-09-10-research-hub-design.md` §2, §4, §6, §8–§12
- `llm/plans/2026-09-10-research-hub-orchestration-brief.md` §1–§5
- `llm/governance/governance-delta.md` (§Design-Authority Document, §L0 Path Allowlist, §Milestone Labels, §Platform Enforcement Reality)
- `llm/governance/adr/0001`–`0005`
- `llm/sprints/2026-09-hub/STATE.md` (Risks #1–#2, ADR candidates C1–C4)
- agentic-governance `llm/governance/definition-of-done.md` §Design Work
- agentic-governance `llm/governance/l0-fast-track.md` §L0 Path Allowlist
- agentic-governance `llm/governance/labels.md` §Milestone Labels

## ADR candidates

Product-level decisions implied by design doc §11 that ADRs 0001–0005 do not
cover. STATE.md C1–C4 are not repeated here.

- **P1. Old-URL forwarding and what "retire Pages" means (Phase 6; affects Phase 1).** It must cover which old URLs are guaranteed to forward, for how long, by what mechanism (GitHub Pages cannot send HTTP 301), and whether a redirect stub stays on Pages after "retirement".
- **P2. URL stability for migrated content (Phase 2).** §4 serves html at `/<section>/<source>/<slug>/`, while today's URLs are `/cv/academic`, `/papers/` and `/resumes/`. A site that "must outlive the PhD" needs a stated policy: keep existing URLs, or redirect them for good.
- **P3. Share-link expiry policy (Phase 4).** §11 says "14-day link", but §6 takes `expires_in_days` with no default or maximum. Is 14 the default, the maximum, or an example?
- **P4. Member management after seeding (Phase 3 onward).** §6 says owners "may manage members", but §11 schedules only a seed script. Does adding or removing a member stay an out-of-band script or console step, or get an owner interface? Removal also bears on members' 14-day session cookies.
- **P5. Section and navigation policy (Phase 1).** Covers which sections appear in public navigation, what happens to sections with no content (`writing` has no scheduled source), and how a section that holds only private items appears to the public.
- **P6. Unpublishing and retraction (Phase 2; affects Phase 4).** How a satellite removes an item, whether removal deletes it from the bucket and site on the next build, and what happens to live share links for a removed slug.
- **P7. What the project index is (Phase 5).** Covers what counts as a project, how entries are ordered, how the index relates to today's `/projects/` page, and whether the `agentic-governance` and `agentic-research` READMEs (§2, "later") qualify.
- **P8. Where the owner manages shares (Phase 4).** The Shares page is a React island. Whether it lives in the private build (under `/p/`) or the public build calling the gate is a product placement question. It also touches ADR-0003's island risk, so it is shared with the Chief Architect.
