# PASS — 0 regressions

Regression Tester, Wave 0, sprint 2026-09-hub. Issue #44 (hub-007).
Run: 2026-09-19 ~03:50–04:00Z. Contract: `llm/sprints/2026-09-hub/contracts/regression-tester-wave-0.md`.

## What state was tested

**Everything probed against production is `main`.** None of #47, #48 or #53 has merged or
deployed, so the live site serves `main` and the results below are the pre-merge baseline.

| Surface | Identity |
|---|---|
| Site (`jason.cusati.us`) | `built_from_sha` = `f98a928a1b92b2248b130822ba5098fb926b8898` — this is `origin/main` HEAD ("fix(signin): stop claiming 'wrong email'…", #43). `run_id` 35397897183. |
| Gate (Cloud Run `hub-gate`, us-east1) | Serving revision **`hub-gate-00005-n4g`**, 100% traffic, created 2026-09-18T15:48:04Z, image digest `sha256:98c3428c…39cb37`, runtime SA `hub-gate@cusati-hub.iam.gserviceaccount.com`. |

Branch-state items (IAM narrowing, the added route, the build guards) were read with
`git diff main...<branch>` / `git show <branch>:<path>`. No branch was checked out.

## Results

| # | Item | Command | Expected | Actual | Verdict | Revision / SHA |
|---|---|---|---|---|---|---|
| 1 | Phase 1–3 smoke routes | `curl -s -o /dev/null -w '%{http_code} %{size_download}' -L <url>` over every `<loc>` in `sitemap-0.xml` (34 routes) plus `/pdfs/academic.pdf`, `/signin/`, `/phd/`, `/robots.txt`, `/build-info.json` | all 200 | **all 200.** Incl. all 10 `/research/**` pages, `/email/` 2032b, `/privacy/` 2539b, `/pdfs/academic.pdf` 185897b | PASS | f98a928 |
| 1b | 500-byte check | `curl -s -L <url> \| wc -c` | ≥500 bytes | `/cv/academic/` **23486**, `/papers/` **6231**. No-slash forms 301 → same 200 bodies | PASS | f98a928 |
| 2 | `build-info.json` publishing contract | `curl -s -L https://jason.cusati.us/build-info.json` | `content_source: "bucket"`, `built_from_sha` = probed merge | `"content_source": "bucket"`; `built_from_sha` `f98a928…` = `origin/main` HEAD exactly. Not the release fallback | PASS | f98a928 |
| 3 | Apex redirect, paths preserved | `curl -sI https://research.cusati.us/cv/academic/` | 301 → `jason.cusati.us/cv/academic/` | `HTTP/2 301`, `location: https://jason.cusati.us/cv/academic/`. Followed: 1 redirect, final `…/cv/academic/` **200**. Root 301s to `/` | PASS | f98a928 |
| 4 | Legacy Astro redirects | `curl -sL https://jason.cusati.us/research/agentic-harnesses{,/synthesis,/sources,/consensus}/` | forward; targets 200 | All 4 return 200 with Astro's meta-refresh page: `content="0;url=/research/soa-agentic-se/agentic-harnesses/…"` + matching `<link rel="canonical">`. All 4 targets 200 | PASS | f98a928 |
| 5 | Gate log lines reach Cloud Logging | `gcloud logging read '…service_name="hub-gate" AND textPayload:"event="' --freshness=24h` | classes `boot`, `deny`, `client_signin_failed` present | **boot 1** (`event=boot logging=StreamHandler(stdout)`, at revision start 15:48:18Z), **deny 77**, **client_signin_failed 9**, **reject 1**, in 24h. All tagged `hub-gate-00005-n4g` | PASS | hub-gate-00005-n4g |
| 6 | Sign-in | see four sub-checks below | — | **end-to-end NOT VERIFIABLE BY ME**; all four sub-checks pass | PARTIAL — see below | both |
| 7 | Public surface otherwise unchanged | `git diff main...origin/<branch>` over `site/`, plus local `build:public` vs deployed | only the Projects `<h1>` | Only `site/src/pages/projects/index.astro` changes a public page, and only `title="Selected Projects & Research"` → `"Projects"`. #47 and #53 touch **no** `site/` file and no `gate/app/pages.py` | PASS | f98a928 |
| 8 | Suites | see below | all green | site vitest **199 passed, 1 skipped (16 files)**; gate pytest **223 passed**; contract `node --test` **57 pass, 0 fail**; `build:public` **26 pages**; `build:private` **3 pages, 82 paths checked**; gate `ruff check` clean | PASS | worktree 623912b |

### Item 6 in detail

| Sub-check | Result | Verdict |
|---|---|---|
| `/signin/` returns 200 and renders **configured**, not "not configured yet" | 200, 4701b. Inline bootstrap emits `const configured = true;` with a populated `firebaseConfig` (`authDomain: cusati-hub.firebaseapp.com`, `projectId: cusati-hub`). Both sign-in affordances render: "Continue with Google" and the email-link form. The `.empty-state` / "not configured" branch is **not** taken | PASS (deployed) |
| Identity Platform: email enabled, `jason.cusati.us` in `authorizedDomains` | `GET https://identitytoolkit.googleapis.com/admin/v2/projects/cusati-hub/config` → HTTP 200. `signIn.email: {"enabled": true}`; `authorizedDomains: ['localhost', 'cusati-hub.firebaseapp.com', 'cusati-hub.web.app', 'jason.cusati.us']` | PASS (deployed) |
| Gate SA holds a role granting `firebaseauth.users.createSession` | **Deployed:** SA holds `roles/datastore.viewer` + `roles/firebaseauth.admin`; admin carries `createSession`. **Branch #53:** narrowed to custom role `gateSessionMinter` holding exactly `firebaseauth.users.createSession` and `firebaseauth.users.get`, bound via renamed `google_project_iam_member.hub_gate_session_minter` | PASS (both states) |
| Deliberate sign-in failure, classified and logged, using a **non-member** | Three read-only-safe POSTs, none able to mint a session. All three landed in Cloud Logging within ~30s, on `hub-gate-00005-n4g`: `event=deny scope=session reason=invalid_id_token` (unverifiable token), `event=reject reason=missing_id_token` (absent field), and `event=client_signin_failed trace=regtest-… reason=regression_probe_non_member` — the exact string `infra/monitoring.tf` filters on | PASS (deployed) |

**End-to-end sign-in: NOT VERIFIABLE BY ME.** I hold no member credential and the allowlist
matches the exact email in the token, so I cannot reach the mint step. The page rendering its
configured state proves the config is present — it does **not** prove sign-in works, and I do
not infer that it does. What would settle it: one live email-link sign-in by an allowlisted
member after #53 applies, confirmed by `event=allow scope=session member=…` in Cloud Logging
and a `__session` cookie being set. `infra/outputs.tf` on #53 adds
`gate_auth_role_check_command` for the post-apply half and states the same limitation.

### Wave-0 change review for collateral (branch state)

Each Wave 0 change was checked against the thing it could plausibly break. None regressed.

- **IAM narrowing (#53).** The narrowed role keeps `users.get`, not just `createSession`. That
  matters: both verify paths run `check_revoked=True` (`GATE_CHECK_REVOKED` defaults True), which
  is an accounts lookup, not an offline JWT check. A `createSession`-only role — what `gate.tf`'s
  old comment proposed — would mint cookies and then fail every subsequent verification. The
  branch corrects that comment explicitly.
- **Log-string contract (#47/#53).** The set of `event=` strings emitted by `gate/app/main.py` is
  **identical** on `main` and #47 (`allow, boot, deny, error, miss, reject`); #47 only adds
  `scope=signout` variants under existing classes. `infra/monitoring.tf` filters
  (`textPayload:"event=deny"`, `textPayload:"event=client_signin_failed"`) are **unchanged** by
  #53 — its diff touches only comments and the new SMS channel. The two log-based metrics stay fed.
- **Build guards (#53).** `build.yml` widens the private-bucket check from one file to both
  buckets and adds satellite-binding assertions. It adds no new path that can silently flip
  `content_source` away from `bucket`.
- **Added route (#47).** `POST /session/end`, plus the matching `/session/end` Hosting rewrite on
  **#48**. See Risks — these are on two different branches.

## Summary

Nothing that worked yesterday has stopped working. All 34 sitemap routes plus the extras return
200; both byte-checked pages are far above the 500-byte floor; the publishing contract still
reports `content_source: "bucket"` against the exact `main` SHA, so the issue #19 silent-fallback
state has not recurred; the apex redirect preserves paths; the four legacy Astro redirects still
forward to live targets; and the gate's structured logging — dead for 48 hours across four
revisions until 2026-09-18 — is confirmed alive on the serving revision for all three required
classes, including a `client_signin_failed` line I triggered myself.

All four suites pass on the worktree: 199 vitest, 223 pytest, 57 node --test, both Astro builds,
and ruff. The only public-content change in the wave is the Projects `<h1>`; #47 and #53 touch no
site file at all.

The one thing I could not do is the one that matters most, and I am not dressing it up: I cannot
complete a sign-in. Everything around it is healthy, and the narrowed role is correctly specified
including the `users.get` permission that a naive narrowing would have dropped — but "the page
renders" is not "sign-in works," and only a live member sign-in after apply will settle it.

## Assumptions

- The byte-comparison of my local `build:public` against deployed pages is valid **only** for
  content-independent pages: my local build used fixture data (no bucket sync), so `/papers/`,
  `/resumes/`, `/projects/`, `/cv/academic/` differ by fixture-vs-real content, not by regression.
  `/research/`, `/privacy/` and `/email/` came out **byte-identical**, which is what establishes
  that the chrome/template layer matches `main`.
- `/website/research/**` entries in `site/redirects/github-pages.json` are GitHub-Pages-base
  paths. They 404 on `jason.cusati.us` and that is correct, not a finding — the custom domain's
  base is `/`, so the live legacy routes are `/research/agentic-harnesses*`. I probed the wrong
  set first and corrected it.
- 24h was used as the log window for class coverage; `event=boot` fires only at cold start, so a
  20m window would have shown zero boots on a warm revision and read as a false regression.
- `roles/firebaseauth.admin` is taken to include `firebaseauth.users.createSession` from Google's
  role definition; I did not enumerate the predefined role's permissions.

## Recommendations

1. **Merge #48 before or with #47.** The `/session/end` Hosting rewrite lives in #48's
   `firebase.json`; the route handler lives in #47. See Risks.
2. **Re-run this list after each Wave 0 deploy**, not once. Items 2, 5 and 6 are the ones that
   fail silently — a green site tells you nothing about any of them.
3. **Add `pytest` provisioning to the gate's documented dev setup.** `gate/.venv` shipped without
   it (`No module named pytest`) despite `.pytest_cache` being present; I installed from
   `requirements-dev.txt` to run the suite. A contributor following the README would conclude the
   suite cannot run.
4. **After #53 applies, immediately run the `gate_auth_role_check_command` output** and then have
   a member perform one live sign-in. The role change is the highest-consequence item in the wave
   and the only one with no automated end-to-end proof.

## Alternatives considered

- **Comparing deployed bytes against a CI artifact** instead of a local fixture build would have
  made item 7 a true byte-for-byte check. Rejected: it needs the bucket content sync, which is a
  credentialed operation outside my read-only remit. The diff-plus-identical-chrome evidence
  answers the question the item actually asks.
- **Minting a session with a self-signed token** to exercise the full sign-in path. Rejected
  outright: it would be forging a credential, and the contract confines me to a failure that
  *cannot* mint.
- **`gcloud identity-platform config describe`** — the command group does not exist in this SDK
  install. Used the Admin v2 REST GET instead, with `x-goog-user-project` to satisfy the ADC
  quota-project requirement.

## Risks

- **`/session/end` is split across two branches (highest).** #47 adds the handler; #48 adds the
  Hosting rewrite. Merging #47 alone leaves `POST /session/end` unmatched by any rewrite, so
  Hosting serves the static 404 and sign-out fails **through the CDN only** — direct `*.run.app`
  tests would still pass. This is precisely the class of bug `main.py`'s own header warns about
  for the `__session` cookie name. Not a regression today; a near-certain one on the wrong merge order.
- **The narrowed role cannot be proven before it is applied.** Terraform inspection confirms the
  permission list is right; only a live member sign-in confirms it is sufficient. If it is wrong,
  the failure mode is total sign-in loss for both members.
- **`event=boot` appears once per revision.** Any future check of it against a short freshness
  window will read as a regression on a warm revision. Query it at ≥24h or key it to revision age.
- **The custom role carries `deletion_policy = "PREVENT"`** and a 7–37 day name-reuse lockout.
  A destroy would break sign-in for up to 37 days with no apply-out. Revocation must be done by
  removing the *binding*, not the role.

## Open questions

1. What is the intended merge order for #47 and #48, and is the `/session/end` coupling tracked
   anywhere? I found no issue naming it.
2. Should `/phd/` and `/signin/` be in the regression smoke list? Both are live and 200 (3189b,
   4701b) but deliberately excluded from the sitemap via `NOINDEX_SECTIONS`, so neither is covered
   by the sitemap-driven sweep that item 1 describes.
3. `event=reject` and `event=miss` feed no log-based metric. Intentional, or a gap?
4. Was `gate/.venv` meant to ship test-ready? If CI builds its own env, the committed venv is a
   trap for local contributors.

## Related docs

- `llm/sprints/2026-09-hub/contracts/regression-tester-wave-0.md` — this contract
- `llm/sprints/2026-09-hub/STATE.md` — §The gate's structured logging never worked in production;
  §Post-merge defect (issue #19); §Sign-in: what works at Checkpoint 4
- `llm/master-roadmap.md` — §phase-1-foundation, source of the smoke routes and the 500-byte check
- `infra/gate-auth-role.tf` (#53) — the narrowed role and its permission-by-permission rationale
- `infra/monitoring.tf` — the two log-based metric filters item 5 protects
- `site/scripts/site-routes.mjs` — `LEGACY_REDIRECTS`, `SMOKE_ROUTES`, `NOINDEX_SECTIONS`
- `gate/app/main.py` `_configure_logging()` — why item 5 exists

## ADR candidates

1. **Route handlers and their Hosting rewrites must land in the same change.** A Cloud Run route
   behind Firebase Hosting is only reachable if `firebase.json` rewrites to it; splitting the two
   produces a defect invisible to direct-service tests. Generalises ADR-0004's `__session` warning
   from cookies to routing.
2. **Log-line grammar is a published interface between the gate and `monitoring.tf`.** The
   `event=` strings are matched by log-based metric filters; renaming one silently empties a
   metric. #47 adds `gate/tests/test_monitoring_contract.py` — worth promoting that from a test to
   a recorded decision.
3. **Custom roles over predefined roles for any runtime identity, with each permission traced to a
   call site.** Wave 0 applies this for the third time (satellite publisher, private sync, now the
   gate); it is a standing pattern, not a one-off.
