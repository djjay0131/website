# Chief Reviewer: Phase 1 Delta Review 2 (ADR-0006 domain amendment), PR #12

**Reviewed:** `7afe938..8c14ce8` on `feat/foundation` (6 commits, 20 files). The working tree was clean at `8c14ce8` before and after the review. The contract of record is `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-1-delta-2.md`. I authored none of the amendment.

**Launch condition: met.**
- **CI on `8c14ce8`:**
  - `ci` run 34993830849: `governance-checks` success, 4/4 PASS against canon `5689b69`.
  - `build-and-deploy` run 34993830840: `budget-guard`, `deploy-tools`, `check`, `build` and `build-firebase` all success. The deploy, smoke and notify jobs were skipped, as expected on a PR.
  - Every intermediate head (`46136e5`, `132389c`, `235f11c`, `1229d31`) is green.
- **CI on `20e9f41`:** `ci` run 34992910006 failed with `FAIL adr-index — 0006-hub-on-jason-cusati-us-subdomain.md: no row in the ... README.md index`. Expected, and fixed by `46136e5`.
- **The launch message is wrong on one point.** It says STATE records the 20e9f41 correction. It does not: `grep -n "correction|aborted|incomplete|20e9f41" STATE.md` finds nothing. Only the `46136e5` commit message records it (see B3).

---

## Part A — ADR-0006 conformance

### A1. The canonical host is `jason.cusati.us` everywhere current-facing — CONFORMS

| Artifact | Evidence |
|---|---|
| Terraform default | `infra/variables.tf:23` `default = "jason.cusati.us"`. Validation at `:25` rejects the apex and `www`. `infra/firebase.tf:60` binds `custom_domain = var.domain` (unchanged). |
| Site default `SITE_URL` | `site/scripts/site-env.mjs:10` `DEFAULT_SITE_URL = "https://jason.cusati.us"`. Pinned by the test at `site/scripts/site-env.test.ts:7-9`. |
| Default build: sitemap, robots, canonical links | My local `npm run build`: 33 pages, exit 0, and it was the last build run.<br>• `dist-public/robots.txt`: `Sitemap: https://jason.cusati.us/sitemap-index.xml`.<br>• `sitemap-0.xml`: first `<loc>` is `https://jason.cusati.us/`.<br>• Canonical links: `rel="canonical" href="https://jason.cusati.us/"` on `/` and `/cv/academic/`.<br>• Counts: `https://jason.cusati.us` 178; bare `https?://(www.)?cusati.us` 0; `research.cusati` 0; `/website/` 0. |
| READMEs | `infra/README.md`: 26 (module table), 43-44 (variables), 105-114 (Domains guardrail). `site/README.md`: 5 (intro), 37 (defaults table). |
| Seams | `contracts/phase-1-seams.md:28` SEAM-1 default `https://jason.cusati.us`, with the earlier value noted. |
| Infra contract | `contracts/infra-phase-1.md:13-16`: an amendment note that tells readers to take `cusati.us` as `jason.cusati.us`. Lines 62 and 125 keep the old text under that note, which is acceptable under A18. |
| Handoffs (current-facing) | Infra handoff: summary 25-28, apply table 128 and 142-143, steps 7-10 (532-662), acceptance rows 687-696. Site handoff: summary line 13 and the acceptance rows at ~535-538. The historical round sections are left as written, as A18 allows. |
| Roadmap | `llm/master-roadmap.md`: 132, 143-149, 175, 210, 263, 267, 358-359, 393, 398-401, 433. The family page is out of scope (169). Checkboxes: 138 unchecked, 0 checked, against 137 unchecked at `7afe938`. The one new box is the research 301 criterion at line 144, and no existing box changed state. |
| CI comment | `.github/workflows/build.yml:311`. |
| Design authority | `llm/specs/2026-09-10-research-hub-design.md` names no host. §10 Q1 reads "Domain name to bind" (line 289), so there is no design-authority conflict. |

Two current-facing places still name the apex as the hub host: STATE and the memory bank. See B4 and B5.

### A2. `research.cusati.us` is a redirect custom domain targeting the canonical host — CONFORMS

- `infra/firebase.tf:70-80` declares `google_firebase_hosting_custom_domain.redirect`:
  - `for_each = toset(var.redirect_domains)`, on the same project and site;
  - `redirect_target = google_firebase_hosting_custom_domain.primary.custom_domain` (line 77);
  - `wait_dns_verification = false`.
- The default is `["research.cusati.us"]` (`variables.tf:34`).
- **Validations at `variables.tf:36`, `:41` and `:46`.** I re-ran them in `hashicorp/terraform:1.14.0` `console`, with `variables.tf` mounted read-only:

  | Input | Result |
  |---|---|
  | defaults | OK |
  | `domain=Cusati.US.` | rejected |
  | `redirect_domains=["WWW.cusati.us."]` | rejected |
  | `redirect_domains=["JASON.cusati.us"]` | rejected (redirects to itself) |
  | `domain=research.cusati.us` with the default redirects | rejected |
  | `redirect_domains=[]` | OK |
  | `["research.cusati.us","Research.cusati.us."]` | **accepted** (see B6) |

- **Terraform checks:**
  - `terraform validate` on Windows `terraform.exe` 1.14.0 with google and google-beta 8.2.0: `Success! The configuration is valid.`
  - `fmt -check -recursive`: exit 0.

### A3. Outputs usable at the DNS step for both hostnames — CONFORMS

- `infra/outputs.tf:40-45` merges `primary` (keyed by `var.domain`) with the `redirect` instances.
- `custom_domain_dns_records` (47-64) is one flat list. Each entry carries `custom_domain` (line 56), `domain_name`, `type`, `rdata` and `required_action`. The description says never to touch the apex, `www`, MX or existing TXT records.
- `custom_domain_state` (66-76) is a map per hostname, with `redirect_target` (line 70) and the ownership, host and certificate states.
- `validate` accepts both outputs. Their values cannot be exercised without an apply, which is out of scope.

### A4. Manual DNS and verification steps touch only the two hub hostnames — CONFORMS

Infra handoff step 7 (lines 532-572):
- It forbids touching the apex, `www`, MX and existing TXT records.
- Before any change, it saves the apex MX, TXT and A records and the `www` CNAME.
- It applies output entries exactly as listed.
- It has a hard **Stop, and change nothing** rule (line 551) for any entry that would:
  - set or remove a record on `cusati.us` or `www`;
  - remove or replace an MX record;
  - remove or replace an existing TXT record.
- It treats apex CAA as out of scope.
- It checks both hub hostnames with `dig`, and checks the apex is unchanged.

The rest of the handoff follows the same rule:
- Step 9 re-checks the apex MX and TXT records.
- Step 10's rollback removes only the two hostnames' records.
- Risk R13 and `infra/README.md:105-114` state the rule again.

Current DNS, checked with `dig` on 2026-09-15 (VERIFIED by command output):

| Name | Records |
|---|---|
| `cusati.us` MX | 5 Google records (`aspmx.l.google.com` and alternates) |
| `cusati.us` TXT | one `google-site-verification=...` |
| `cusati.us` A | `15.197.148.33`, `3.33.130.190` |
| `cusati.us` CAA | none |
| `www.cusati.us` | CNAME to `cusati.us.` |
| `jason.cusati.us`, `research.cusati.us` | no records |

What this means for the DNS step:
- **No conflicting records.** The two hub hostnames have no A or CNAME records pointing elsewhere, so Firebase's instruction to "remove any A records or CNAME records that point to other providers" needs no deletion.
- **CAA is moot today.** There are no apex CAA records, so step 7's CAA branch does not apply.

### A5. `SITE_URL` ordering, and the 301 check in first-deploy verification — CONFORMS

- **Step 8 (`infra-phase-1.md:581-585`):** do not set `SITE_URL` until step 7 shows `CERT_ACTIVE` for `jason.cusati.us`. Then set it to `https://jason.cusati.us`, and never to `research.`. The fallback to `hosting_default_url` is kept.
- **Step 9 (`:589-612`):**
  - `curl -sI https://jason.cusati.us/` must return 200, with its certificate subject and issuer checked.
  - `curl -sI https://research.cusati.us/` must return `301` with `Location: https://jason.cusati.us/`, with its certificate checked (line 601).
  - `build-info.json` is read on the canonical host.
  - The apex MX and TXT records are re-checked.
- The matching acceptance row is in the handoff at 687-696 and in the roadmap at 144.

---

## Part B — Regressions and new findings

**No functional regression found.**

| Check | Result |
|---|---|
| `terraform fmt -check -recursive` | exit 0 |
| `terraform init -backend=false` and `validate` | valid |
| actionlint 1.7.12 (`rhysd/actionlint`, repository mounted read-only) | "Found 0 errors in 2 files" |
| Governance checks, local plugin 0.8.3 | 4 of 4 PASS |
| Governance checks, CI at canon `5689b69` | 4 of 4 PASS |
| `npm test` | 7 files; 54 passed, 1 skipped |
| Default build | 33 pages; hosts as in A1 |
| Route inventory, redirect map, smoke-route check, `firebase.json` | Not in the delta: `git diff --name-only 7afe938..8c14ce8 -- site firebase.json` lists only `README.md`, `astro.config.mjs`, `site-env.mjs` and `site-env.test.ts`. `site/redirects/github-pages.json` contains 0 `http(s)://` URLs, and `site-routes.mjs`, `check-smoke-routes.mjs` and `firebase.json` contain no host. |
| Smoke routes, CI `build-firebase` on `8c14ce8` | "all 7 smoke routes present in dist-public" |
| Smoke routes, locally | Only `/pdfs/academic.pdf` is missing. This is the known local gap (no fetched CV PDFs), recorded as H7/H9 in the site handoff. It is not a regression. |
| Budget guard | `infra/budget.tf` is untouched by the delta, and `budget-guard` passed on `8c14ce8`. |

| # | Severity | Artifact and line | Defect | Failure scenario | Owner | Fix |
|---|---|---|---|---|---|---|
| B1 | **should-fix (before ready)** | PR #12 body (as of `8c14ce8`) | The body is stale throughout:<br>• Problem says Firebase Hosting "on `cusati.us`".<br>• Summary says "the `cusati.us` custom domain" and "18 resources"; it is now 19.<br>• Verification cites `7afe938` as the final head.<br>• Related ADRs ticks "No ADR needed in this PR", yet ADR-0006 is included.<br>• It still says "Ready for owner review" and "Confirmed L2 by the Chief Reviewer". | At Checkpoint 2 the owner reviews from the PR body. It describes a different domain binding and resource count than `terraform plan` will show (19), and it hides that this PR carries a new ADR and roadmap requirement changes. | Lead Architect | Rewrite the body for `8c14ce8`:<br>• ADR-0006 and both hostnames;<br>• 19 resources;<br>• tick "ADR included";<br>• the level from Part D;<br>• this review's result;<br>• current CI. |
| B2 | **should-fix (before ready)** | PR #12: L2 ticked and label `gov-L2`. `STATE.md:7` "**Level:** L2 (all work streams)". | The declared level is below what the diff touches (Part D). STATE:177 already anticipates L3, but nothing declares it. | The level recorded on the PR, its label and STATE disagree with canon's highest-level rule. A later audit or Steward reading the label files the change as implementation-only. | Lead Architect | Tick L3, swap the label to `gov-L3`, and update STATE:7 (for example "L3 for PR #12 (roadmap requirements)"). |
| B3 | note | `STATE.md` (no entry); launch message; contract required-reading item 3 | The correction for `20e9f41` is not recorded in STATE, contrary to both the contract and the launch message. It exists only in the `46136e5` commit message. `20e9f41`'s own message describes the index row, ADR-0001 note, seams and STATE edits that it does not contain, and its `ci` run is red. | Someone tracing the control plane from STATE finds a commit whose message overstates its content, and a failed required check, with no explanation. The process lesson (the edit chain committed and pushed despite a failing governance check) is also lost from the durable record. | Lead Architect | Add a Done or Incident-style line to STATE recording what `20e9f41` lacked, the adr-index failure (run 34992910006), the fix in `46136e5`, and the new "refuse to commit on failing checks" rule. |
| B4 | note | `STATE.md:248` (Decisions on the record: "Q1 \| Domain `cusati.us`"); `:439` (risk 1: "to `/` on `cusati.us`"); `:139-146` (In flight) and `:174-177` (Next item 1) | These live STATE sections are stale. Q1 does not show the ADR-0006 amendment. Infra, site and CPO work is listed as in flight after it has been committed. Minor: infra handoff line 30-31 still says "the custom domain's DNS records and state" in the singular. | A new session resuming from STATE (its stated purpose) reads the apex as the decided domain, or re-does committed work. | Lead Architect (STATE); infra (handoff nit) | Q1 row: add "amended by ADR-0006 → `jason.cusati.us`". Update the risk 1 host. Clear In flight and advance Next. |
| B5 | note | `llm/memory_bank/activeContext.md:20` ("Q1 — domain `cusati.us`"), `:24` ("ADRs 0001–0005"); issue #10 checklist, F9 sync item | The memory bank still states the superseded domain. Canon `architecture-governance.md` §Memory Bank Rules: recording a *new* decision in the memory bank "travels with the PR that makes that decision". The accepted F9 deferral predates ADR-0006, and the F9 item on issue #10 does not name it. Issue #10's body does name it, at line 21. | After merge, an AI session reads the memory bank first, as canon requires, and works to `cusati.us`. That could include DNS work on the apex that carries mail. | Lead Architect | Preferred: update `activeContext.md` Q1 and the ADR range in this PR. Otherwise, add ADR-0006 explicitly to the F9 sync item on issue #10 and do it in the Checkpoint 2 bookkeeping. |
| B6 | note | `infra/variables.tf:46-49` (duplicate check); `infra/firebase.tf:72,76` | The duplicate validation compares raw strings, while the other two validations normalise with `lower(trimsuffix(...,"."))`. My 1.14.0 console run accepted `["research.cusati.us","Research.cusati.us."]`. `toset` then creates two `redirect` instances for one hostname. The README claim "Validation rejects ... duplicates" (`infra/README.md:44`) holds only for exact duplicates. | A hand-edited `terraform.tfvars` with a case or trailing-dot variant plans 20 resources, not the 19 the handoff expects. The second create would likely conflict at the API (UNVERIFIED). It fails loudly and is caught at plan review. There is no mail or apex risk. | infra | Use `length(distinct([for d in var.redirect_domains : lower(trimsuffix(d, "."))])) == length(var.redirect_domains)`, or accept it and narrow the README wording. |
| B7 | note | ADR-0006 §Related Documents (lines 103-107) | Decision 4 and the cookie-collision risk rest on ADR-0004's `__session` constraint (ADR-0004:69-71), but ADR-0004 is not cross-referenced. | A Phase 3 author editing the gate's cookie handling from ADR-0004 does not find the host-only rule. | Lead Architect | Add ADR-0004 to Related Documents. |

---

## Part C — Technical claims introduced by the amendment

1. **`google_firebase_hosting_custom_domain`'s `redirect_target` answers with a 301 to the target — VERIFIED.**
   - The provider docs say: "If specified, Hosting will respond to requests against this CustomDomain with an HTTP 301 code, and route traffic to the specified `redirect_target` instead."
   - The Hosting REST reference for `CustomDomain.redirectTarget` says the same, as does the live discovery document.
   - URLs:
     - https://raw.githubusercontent.com/hashicorp/terraform-provider-google-beta/main/website/docs/r/firebase_hosting_custom_domain.html.markdown
     - https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains
     - https://firebasehosting.googleapis.com/$discovery/rest?version=v1beta1
   - **Sub-claims still UNVERIFIED until Checkpoint 2:**
     - that the 301 preserves the request path (step 9 tests `/` only; the infra handoff flags this itself);
     - that Hosting accepts `redirectTarget` while the target domain is not yet ACTIVE. Creation order is guaranteed by the reference; acceptance is not documented.

2. **Hosting provisions a certificate for a redirect domain — VERIFIED.**
   - `cert` is an output of every `CustomDomain` resource, with no carve-out for `redirectTarget`: "The SSL certificate Hosting has for this custom domain's domain name."
   - Firebase's custom-domain guide: "Firebase Hosting provisions an SSL certificate for each of your domains". Its connect flow offers redirecting a connected domain to a second domain.
   - URLs:
     - https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains
     - https://firebase.google.com/docs/hosting/custom-domain
   - Live `CERT_ACTIVE` on `research.cusati.us` is checked at step 7 and step 9.

3. **An unconnected hostname merely CNAMEd to a connected one fails TLS — VERIFIED by inference.** No page states the negative verbatim. The chain is:
   - Firebase: "Your domain will be listed as one of the Subject Alternative Names (SAN) in the FirebaseApp SSL certificate", and "While the domain is provisioning, you might see an invalid certificate that does not include your domain name."
   - Certificates are therefore minted per connected domain.
   - RFC 9110 §4.3.4: a client "MUST verify that the service's identity is an acceptable match for the URI's origin server".
   - A CNAME changes resolution only, not the certificate presented, so a hostname outside the SAN list fails verification.
   - URLs:
     - https://firebase.google.com/docs/hosting/custom-domain
     - https://www.rfc-editor.org/rfc/rfc9110#section-4.3.4

4. **Cross-variable validation in `variables.tf` is supported by Terraform 1.14 — VERIFIED.**
   - The v1.9 changelog: "Input variable validation rules can refer to other objects ... can refer to other input variables". Also HashiCorp's 1.9 announcement.
   - Empirically, the `redirect_domains` rule at `:36` references `var.domain` and fired under `hashicorp/terraform:1.14.0` (A2). `validate` passes on Windows 1.14.0.
   - URLs:
     - https://github.com/hashicorp/terraform/blob/v1.9/CHANGELOG.md
     - https://www.hashicorp.com/en/blog/terraform-1-9-enhances-input-variable-validations

---

## Part D — Governance level

**Yes. PR #12 must be declared L3.**

- **Roadmap requirements changed.** `132389c` edits acceptance criteria, which are requirements, in Phases 1, 2, 3, 5 and 6, and adds a new Phase 1 criterion at `master-roadmap.md:144`. It also changes Phase 1 scope (the family page is excluded at line 169) and the recorded Q1 answer (line 433). The roadmap itself says "Recording an answer here is an L1 edit".
- **Canon puts that at L3.** `governance-levels.md` §L3 includes "requirements, MVP scope ... user-visible workflow behavior". The public URL a visitor uses is user-visible.
- **The rest of the PR is L1 and L2.** ADR-0006 and the ADR-0001 annotation are L1: "Creating or modifying ADR content is L1" (`architecture-governance.md` §ADR Process). Terraform and site code are L2.
- **The highest level wins.** §Mixed-Level Changes: a PR takes "the highest level it touches (L3 > L2 > L1 > L0)".
- **Changing an approved decision is never lower than semantic.** §Level-Aware Merge Authority says it is "always semantic ... never L0", and changing a roadmap requirement is L3 under the model.
- **My earlier L2 confirmation is withdrawn.** It was correct for the diff it reviewed. §Escalation lets any reviewer move a classification up.
- **Practical effect:**
  - Merge authority is unchanged: the human owner only.
  - Review applies the Documentation section of `review-checklist.md` to the roadmap changes, in addition to Implementation.
  - PR body, label and STATE:7 must say L3 (B1, B2).

---

## Part E — Verdict

**Comment.**

ADR-0006 is implemented correctly and completely:
- the hub binds `jason.cusati.us`;
- `research.cusati.us` is a connected 301 redirect domain;
- outputs and manual steps cover both hostnames;
- no artifact binds or instructs a change to the `cusati.us` apex, `www`, MX or existing TXT records, and Terraform rejects the apex and `www`.

The amendment broke nothing the earlier reviews verified (Part B checks, CI green on `8c14ce8`).

**PR #12 may return to ready for Checkpoint 2 once B1 and B2 are done:**
- rewrite the PR body;
- declare L3 on the PR, the label and STATE:7.

Both are control-plane edits. If they touch only the PR body and label, plus `STATE.md` and optionally `activeContext.md`, they need no further delta review. B3-B7 are notes: B3-B5 are best closed in the same pass, and B6-B7 may be tracked.

**The owner should know at Checkpoint 2:**
- Two Hosting behaviours stay UNVERIFIED until the live step 9: that the 301 preserves the path, and that `redirectTarget` is accepted before the target is ACTIVE.
- `terraform plan` should show exactly 19 resources to add.

**Files relevant to this review:**
- `llm/sprints/2026-09-hub/contracts/chief-reviewer-phase-1-delta-2.md`
- `llm/governance/adr/0006-hub-on-jason-cusati-us-subdomain.md`
- `llm/sprints/2026-09-hub/STATE.md`
- `llm/master-roadmap.md`
- `infra/variables.tf`, `infra/firebase.tf`, `infra/outputs.tf`
- `llm/sprints/2026-09-hub/handoffs/infra-phase-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-phase-1.md`
- `site/scripts/site-env.mjs`
- `llm/memory_bank/activeContext.md`

Sources:
- [terraform-provider-google-beta: firebase_hosting_custom_domain docs](https://raw.githubusercontent.com/hashicorp/terraform-provider-google-beta/main/website/docs/r/firebase_hosting_custom_domain.html.markdown)
- [Firebase Hosting REST v1beta1: projects.sites.customDomains](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains)
- [Firebase Hosting API discovery document v1beta1](https://firebasehosting.googleapis.com/$discovery/rest?version=v1beta1)
- [Firebase Hosting: Connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain)
- [RFC 9110 §4.3.4: https Certificate Verification](https://www.rfc-editor.org/rfc/rfc9110#section-4.3.4)
- [Terraform v1.9 CHANGELOG](https://github.com/hashicorp/terraform/blob/v1.9/CHANGELOG.md)
- [HashiCorp: Terraform 1.9 enhances input variable validations](https://www.hashicorp.com/en/blog/terraform-1-9-enhances-input-variable-validations)
