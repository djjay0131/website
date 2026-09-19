# Handoff — `roadmap-truth`, Wave 0

Status: Complete
Date: 2026-09-19 (probes run 03:06Z–03:25Z)
Agent: `roadmap-truth` (general-purpose; steward charter, one-file write scope)
Contract: `llm/sprints/2026-09-hub/contracts/roadmap-truth-wave-0.md`
Issue: #44 (hub-007), Wave 0

---

## Summary

Every Phase 3 checkbox in `llm/master-roadmap.md` was walked against live evidence: the
public host `https://jason.cusati.us`, the Cloud Run URL
`https://hub-gate-ywkmredngq-ue.a.run.app`, Cloud Logging, live GCP IAM, a read-only
`terraform plan`, read-only `gh`, and the committed tree. All 32 Phase 3 boxes are
**currently unchecked**; this report says which may be flipped.

**Headline: Checkpoint 4 is NOT passed.** Two acceptance criteria are **FALSE**, one is
**deferred and must not be ticked**, and four are **NOT VERIFIABLE BY ME** because I hold no
member credential.

Scorecard:

| | Scope (15) | Acceptance (16) | Checkpoint box (1) |
|---|---|---|---|
| TRUE | 14 | 9 (2 qualified) | 0 |
| FALSE | 1 | 3 (incl. 1 deferred) | 1 |
| NOT VERIFIABLE BY ME | 0 | 4 | 0 |

What is genuinely, verifiably true: the gate refuses signed-out callers **identically on both
transports** with a uniform 404 that Cloud Logging proves came from the gate and not Google's
frontend; the private bucket carries **exactly two** non-legacy principals with exactly the
two permission sets ADR-0010 decision 5 requires; anonymous reads and lists of the private
bucket are refused; no public page names a private item; no service account anywhere holds a
user-managed key; Terraform reports **no drift**; and the gate suite is **269 passed**.

What is not: Google sign-in is not configured (issue #31); the gate's service account holds
`roles/firebaseauth.admin`, which is much wider than "the private bucket and Firestore"; and
the recorded prefix-boundary test for `phd-milestones` was deferred at Checkpoint 4 and never
run.

The four unverifiable criteria are all of the form "a seeded member signs in and sees X". The
allowlist matches the exact email in a Firebase ID token; the only members are `djjay@vt.edu`
and `cbrown@vt.edu`, and this machine's identity is `djjay0131@gmail.com`, deliberately not a
member. I did not substitute a signed-out probe for any of them.

Three findings nobody asked for are in **D6**; the first is the one I would act on today.

---

## D1 — Phase 3 Scope checkboxes

Roadmap order. "Line" is the line within `## phase-3-private-area`.

| # | Scope item | Verdict | Evidence | Command |
|---|---|---|---|---|
| S1 | Gate service (FastAPI): sessions, allowlist, `/p/**` | **TRUE** | Serving revision `hub-gate-00005-n4g`; refuses, logs and answers `/session` live | see S1 below |
| S2 | Gate pytest for sessions, non-members, `/p/` traversal | **TRUE** | **269 passed**; `test_session.py`, `test_paths.py`, `test_headers.py`, `test_scope.py` | see S2 |
| S3 | Cloud Run `hub-gate`, `us-east1`, min 0 instances | **TRUE** | `minScale: '0'`, `maxScale: '3'`, region `us-east1` | see S3 |
| S4 | `gate.yml`; images in Artifact Registry keeping last 5 | **TRUE** | `keep-last-5-images` `keepCount: 5` + `delete-superseded-images`; 4 images | see S4 |
| S5 | Identity Platform with **Google and** email-link sign-in | **FALSE** | Email enabled; `defaultSupportedIdpConfigs` is `{}` — no Google provider | see S5 |
| S6 | Firestore in Native mode | **TRUE** | `FIRESTORE_NATIVE`, `us-east1` | see S6 |
| S7 | Private bucket, uniform access, no public access | **TRUE** | UBLA `True`, PAP `enforced`, no anonymous principal, anon GET 403 / list 401 | see S7 |
| S8 | Two-output build; `dist-private` synced to private bucket | **TRUE** | `build:private` = `HUB_OUTPUT=private SITE_BASE=/p/`; `private-sync` dry-run then apply; 83 objects live | see S8 |
| S9 | Post-build leak check | **TRUE** | `check:no-private-in-public` runs in **both** deploy variants | see S9 |
| S10 | Bucket IAM test on every deploy | **TRUE** *(qualified)* | Credential-free half runs in `budget-guard`, a required check. The **live** half runs nowhere automatically — D6.3 | see S10 |
| S11 | `/p/**` and `/session` rewrites routed to `hub-gate` | **TRUE** | Both in `firebase.json`; both reach the gate live (logs) | see S11 |
| S12 | Sign-in page exchanging a Firebase ID token for a session | **TRUE** | `/signin/` 200; its module carries `/session`, `idToken`, `sendSignInLinkToEmail`, `not_a_member` | see S12 |
| S13 | `phd-milestones` private repo, publish workflow, both items `private`/`phd` | **TRUE** | `private: true`; `publish.yml`; manifest both items `private`, `phd`; published | see S13 |
| S14 | Member seed script, run by owner, Q4 members, `role: owner` for Jason | **TRUE** | Exactly two documents; only `djjay@vt.edu` carries `role` | see S14 |
| S15 | Chief Reviewer Governance Audit across Phases 0–3 | **TRUE** | Report persisted and posted to PR #25 | see S15 |

### Transcripts

**S1 — the gate is the thing serving `/p/**`.** Probed both transports, then matched each
probe to the gate's own decision log. This is the discriminator the contract names: a 426-byte
body with `<html lang="en">` quoted, plus a matching `event=deny` line.

```
$ curl -s -i https://jason.cusati.us/p/index.html
HTTP/2 404
cache-control: private, no-store
content-type: text/html; charset=utf-8
referrer-policy: no-referrer
server: Google Frontend
x-content-type-options: nosniff
x-frame-options: DENY
vary: Cookie, x-fh-requested-host, accept-encoding
content-length: 426

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Sign in</title>
  </head>
  <body>
    <h1>Sign in</h1>
    <p>This page is available to signed-in members. If you have a link to it, sign in and try again.</p>
    <p><a href="/signin">Sign in</a></p>
  </body>
</html>
```

426 bytes, `<html lang="en">` quoted. Google's interception page is 1568 bytes with
`<html lang=en>` unquoted, so this is the gate. Confirmed from the gate's own log:

```
$ gcloud logging read 'resource.type="cloud_run_revision" AND
    resource.labels.service_name="hub-gate" AND textPayload:"event=deny"'
    --limit=20 --freshness=25m --format="value(timestamp,textPayload)"
2026-09-19T03:06:55.645387Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie
2026-09-19T03:06:55.516067Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie
2026-09-19T03:06:55.377730Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie
2026-09-19T03:06:51.203085Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie
2026-09-19T03:06:51.035033Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie
2026-09-19T03:06:50.878655Z	INFO gate event=deny scope=private stage=session reason=no_session_cookie

$ gcloud logging read '... AND httpRequest.requestUrl:"/p/"' --limit=20 --freshness=25m
2026-09-19T03:06:55.642529Z	404	https://hub-gate-ywkmredngq-ue.a.run.app/p/
2026-09-19T03:06:55.512954Z	404	https://hub-gate-ywkmredngq-ue.a.run.app/p/index.html
2026-09-19T03:06:51.200222Z	404	https://hub-gate-ywkmredngq-ue.a.run.app/p/committee.html
2026-09-19T03:06:50.875653Z	404	https://hub-gate-ywkmredngq-ue.a.run.app/p/index.html
```

Six deny lines for six probes (three through Hosting at :50–:51, three direct at :55). The
timestamps match my probes to the second. `POST /session` answers from the application on both
transports:

```
$ curl -s -i -X POST https://jason.cusati.us/session -H 'Content-Type: application/json' \
    -d '{"idToken":"not-a-real-token"}'
HTTP/2 401
cache-control: private, no-store
content-type: application/json
{"status":"invalid_token"}

$ curl -s -i -X POST https://hub-gate-ywkmredngq-ue.a.run.app/session ... (same body)
HTTP/2 401
{"status":"invalid_token"}
```

with the matching decision logged: `INFO gate event=deny scope=session reason=invalid_id_token`.

**S2 — the gate suite.**

```
$ cd gate && ./.venv/bin/python -m pytest --tb=no -p no:warnings
269 passed in 3.28s
```

Coverage by name (`grep -n "def test" gate/tests/*.py`): session mint, cookie named exactly
`__session`, cookie attributes, 14-day life, expired token, malformed token, **verified
non-member gets no cookie**, unverified email is never a member, case-insensitive allowlist
lookup, oversized body refused unread; path traversal (`test_safe_object_path_rejects`,
`test_gate_refuses_hostile_requests_and_never_touches_the_bucket`,
`test_nothing_escapes_a_configured_prefix`, overlong and deeply-nested paths); and
`test_no_share_routes_are_declared` pinning Phase 3's scope boundary.

**S3 — Cloud Run.**

```
$ gcloud run services describe hub-gate --region=us-east1 --format=yaml | grep -E ...
        autoscaling.knative.dev/maxScale: '3'
        autoscaling.knative.dev/minScale: '0'
      containerConcurrency: 80
        - name: GATE_PRIVATE_BUCKET
          value: cusati-hub-private
        image: us-east1-docker.pkg.dev/cusati-hub/hub-gate/hub-gate@sha256:98c3428cb545...
      serviceAccountName: hub-gate@cusati-hub.iam.gserviceaccount.com
  latestReadyRevisionName: hub-gate-00005-n4g
```

`min_instance_count = 0` as §6/§8 require. Note `GATE_PRIVATE_BUCKET` carries the `GATE_`
prefix — the integration defect the Lead Architect fixed pre-merge is confirmed fixed in the
running revision.

**S4 — Artifact Registry keeps the last 5.**

```
$ gcloud artifacts repositories describe hub-gate --location=us-east1
cleanupPolicies:
  delete-superseded-images:
    action: DELETE
    condition:
      tagState: ANY
    id: delete-superseded-images
  keep-last-5-images:
    action: KEEP
    id: keep-last-5-images
    mostRecentVersions:
      keepCount: 5
description: Container images for the hub-gate Cloud Run service. Keeps the 5 most
  recent versions (roadmap R-A4).

$ gcloud artifacts docker images list us-east1-docker.pkg.dev/cusati-hub/hub-gate --include-tags
sha256:54b3a60d...	1a1af92590c7fb6774af7215560b4a424465536f	2026-09-17T16:20:48
sha256:58e2d7ab...	a28f8b7f081a2e4e80f65fe952cd0c1eb58da74c	2026-09-18T11:34:02
sha256:7cdcd47f...	f155fe43982ae72254e11c3b4e648e4bbb0ac053	2026-09-17T16:53:08
sha256:98c3428c...	d339e2cb79aae0e21180a8386c5d2753eff7d251	2026-09-18T11:48:02
```

4 images, under the keep-5 ceiling, so the policy has not yet had to act. `gate.yml` runs
green: runs `35364498315`, `35364361194`, `35363098995` all `success`.

**S5 — FALSE. Google sign-in is not configured.**

```
$ curl -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: cusati-hub" \
    https://identitytoolkit.googleapis.com/admin/v2/projects/cusati-hub/config
signIn.email: {"enabled": true}
authorizedDomains: ['localhost', 'cusati-hub.firebaseapp.com', 'cusati-hub.web.app', 'jason.cusati.us']

$ curl ... /admin/v2/projects/cusati-hub/defaultSupportedIdpConfigs
{}
HTTP=200
```

Email-link sign-in is enabled and `jason.cusati.us` is an authorized domain. **No Google
provider exists** — the response is an empty object, not a list with a disabled entry. So
`signInWithPopup(GoogleAuthProvider)` will fail, exactly as STATE recorded on 2026-09-17. This
is **issue #31, still open**, and it is console work (an OAuth client and consent screen) that
cannot be done non-interactively. The scope item says "Google **and** email-link"; half of it
is not met.

**S6 / S7 — Firestore and the private bucket.**

```
$ gcloud firestore databases list
projects/cusati-hub/databases/(default)	FIRESTORE_NATIVE	us-east1	PESSIMISTIC

$ gcloud storage buckets describe gs://cusati-hub-private
ubla: True
pap: enforced
versioning: True
soft_delete: {'retentionDurationSeconds': '604800'}   # 7 days
lifecycle: 30-day noncurrent delete; keep 5 newer versions; abort incomplete MPU at 7 days

$ curl -s -o /dev/null -w "%{http_code}" https://storage.googleapis.com/cusati-hub-private/index.html
403      # Anonymous caller does not have storage.objects.get access
$ curl -s -o /dev/null -w "%{http_code}" https://storage.googleapis.com/storage/v1/b/cusati-hub-private/o
401      # anonymous list refused
```

**S8 — two outputs, and the private one is synced.** `site/package.json`:

```
build:private = HUB_OUTPUT=private SITE_BASE=/p/ astro build
check:no-private-in-public = node scripts/check-no-private-in-public.mjs
check:private-links = node scripts/check-private-links.mjs
```

`build.yml` `private-sync` job runs the dry run (`sync-private.mjs --bucket ...`) and only then
the destructive apply (`--apply`), which is ADR-0010 decision 5 with decision 3's guard in
front of it. The bucket holds the result — object names and sizes only, per my contract:

```
$ gcloud storage ls -l "gs://cusati-hub-private/**" | grep -v "_astro/"
      5096  gs://cusati-hub-private/_payload/phd-milestones/site/assets/style.css
     29869  gs://cusati-hub-private/_payload/phd-milestones/site/committee.html
     17329  gs://cusati-hub-private/_payload/phd-milestones/site/index.html
       241  gs://cusati-hub-private/build-info.json
      2394  gs://cusati-hub-private/index.html
      2258  gs://cusati-hub-private/phd/phd-milestones/committee-dossier/index.html
      2214  gs://cusati-hub-private/phd/phd-milestones/milestones/index.html
     ...
TOTAL: 83 objects, 1540054 bytes (1.47MiB)
```

I did not download any of these. The two item routes exist at the shape the gate resolves
(`/p/phd/phd-milestones/<slug>/index.html` → object `phd/phd-milestones/<slug>/index.html`),
which is issue #27's fix visible in the object names.

**S9 — the leak check runs on both deploy paths.** `build.yml`:

```
628:      - name: Check no private content reached the public build (GitHub Pages variant)
629:        run: npm run check:no-private-in-public
748:      - name: Check no private content reached the public build
749:        run: npm run check:no-private-in-public
```

`check-no-private-in-public.mjs` matches **paths and contents** (its section headers: "1.
PATHS… 2. CONTENTS. The half the brief's path-only form would have missed"), which is
ADR-0005 decision 2 over the brief's §4.

**S10 — qualified TRUE.** `build.yml` line 377, inside `budget-guard` (a required status check
on `main`):

```
377:      - name: Check the private bucket's declared IAM (design doc 12.1)
378:        run: python3 infra/scripts/check_private_bucket_config.py
```

The script's own header is candid about what it is: it "checks the half that CAN be checked
with no credentials at all: that the CONFIGURATION which produces that policy still says what
it must." The live half, `infra/scripts/check-private-bucket-iam.sh`, is referenced only by
`infra/outputs.tf`, `infra/README.md` and its own comments — **no workflow invokes it**. See
D6.3.

**S11 — rewrites.** `firebase.json` carries `/p/**`, `/session` and `/client-events`, all to
`serviceId: hub-gate`, `region: us-east1`. `/s/**` and `/share/**` are correctly absent —
Phase 4. Live proof they route: every probe above reached the gate through Hosting and was
logged by it.

**S12 — the sign-in page.** `/signin/` returns 200 (4701 bytes), `<meta name="robots"
content="noindex">`, and is absent from the sitemap. Its logic is in a module, not inline:

```
$ curl -s https://jason.cusati.us/_astro/index.astro_astro_type_script_index_0_lang.D_n8yzPx.js
HTTP=200 SIZE=4437
  /session                 1
  idToken                  1
  signInWithPopup          3
  sendSignInLinkToEmail    3
  isSignInWithEmailLink    3
  not_a_member             2
  GoogleAuthProvider       3
```

The ID-token → `/session` exchange is present and deployed, and the page branches on
`not_a_member` — the fix for review finding S-3 (the gate returns HTTP 200 with
`{"status":"not_a_member"}`, so branching on `response.ok` took the success path) is in the
shipped bundle.

**S13 — `phd-milestones`.**

```
$ gh api repos/djjay0131/phd-milestones
{"default_branch":"main","private":true,"visibility":"private","pushed_at":"2026-09-17T20:28:45Z"}

$ python3 -c "...json.load(open('/mnt/c/code/phd-milestones/dist/manifest.json'))..."
source: phd-milestones manifest_version: 1
milestones          phd private html site/index.html
committee-dossier   phd private html site/committee.html
```

Both items `visibility: private`, `section: phd`. `publish.yml` exists, holds no credential
(WIF only, no `repository_dispatch`, no PAT), and has published successfully: run
`35271039595` `publish success`. The bucket confirms the upload landed under its own prefix:

```
$ gcloud storage ls -l "gs://cusati-hub-content/sources/phd-milestones/**"
       565  .../manifest.json        5096  .../site/assets/style.css
     29869  .../site/committee.html 17329  .../site/index.html
TOTAL: 4 objects
```

**S14 — the allowlist is seeded, and is exactly the Q4 set.** Document ids and field *names*
only; I did not read field values.

```
$ curl -H "Authorization: Bearer $TOKEN" \
    "https://firestore.googleapis.com/v1/projects/cusati-hub/databases/(default)/documents/members"
members/cbrown@vt.edu | fields: ['added_at', 'added_by', 'note']
members/djjay@vt.edu  | fields: ['added_at', 'added_by', 'note', 'role']
```

Exactly two members; only `djjay@vt.edu` carries `role`, matching SEAM-3 and owner decision D3.
`infra/scripts/seed-members.sh` is committed `100755` (`git ls-files -s`, not `ls -l`).

**S15 — the Governance Audit is on the PR.**

```
$ gh api repos/djjay0131/website/issues/25/comments
--- djjay0131 2026-09-17T05:38:54Z
> **Chief Reviewer — Phase 3 review and Governance Audit.** Posted by the Lead Architect on
  the reviewer's behalf (sub-agents make no `gh` mutations; STATE A8)...
--- djjay0131 2026-09-17T05:45:34Z
## Review reconciliation — Lead Architect
```

Persisted at `handoffs/chief-reviewer-phase-3.md` and posted. PR #25 is merged
(`1a1af92590c7...`) with every check green.

---

## D2 — Phase 3 Acceptance criteria

Numbered in roadmap order, so boxes can be flipped without re-deriving which is which.

| # | Criterion (abbreviated) | Verdict |
|---|---|---|
| A1 | A seeded member signs in and sees the tracker and dossier | **NOT VERIFIABLE BY ME** |
| A2 | Signed out, `/p/` returns no private content | **TRUE** |
| A3 | A signed-in non-member gets "not shared with you" and no private content | **NOT VERIFIABLE BY ME** |
| A4 | The same signed-out **and non-member** requests, direct to `*.run.app`, refused the same way | **NOT VERIFIABLE BY ME** (signed-out half TRUE) |
| A5 | A session minted through `jason.cusati.us` persists across page loads | **NOT VERIFIABLE BY ME** |
| A6 | Every `/p/` response carries `Cache-Control: private, no-store` | **TRUE** *(qualified)* |
| A7 | A gate test asserts no `/p/**` **or `/s/**`** response carries `public`/`s-maxage` | **FALSE — deferred** |
| A8 | Gate pytest passes in CI; covers mint/verify, non-member, traversal | **TRUE** |
| A9 | Leak check on every deploy + a deliberate run shows it failing | **TRUE** |
| A10 | Bucket IAM test on every deploy; exactly two bindings; anonymous read refused | **TRUE** *(qualified)* |
| A11 | No public page lists/links/names a private item; private nav only in the private build | **TRUE** |
| A12 | The gate's service account can read **only** the private bucket and Firestore | **FALSE** |
| A13 | `phd-milestones` private on GitHub **and a recorded test** shows its publish identity cannot write outside its prefix | **FALSE** |
| A14 | The gate deploy authenticates through WIF only, no JSON key | **TRUE** |
| A15 | The Governance Audit result for Phases 0–3 is recorded on the PR | **TRUE** |
| — | *(closing checkpoint)* Checkpoint 4 passed and recorded in `STATE.md` | **FALSE** |

### A1, A3, A5 — NOT VERIFIABLE BY ME

All three have the same subject: what a *signed-in* person sees. The allowlist matches the
exact email in a Firebase ID token; the members are `djjay@vt.edu` and `cbrown@vt.edu`; this
machine's gcloud identity is `djjay0131@gmail.com`, deliberately not a member. I cannot mint a
member session, and **I did not substitute a signed-out probe for any of these.**

I also cannot verify A3 by signing in as a non-member: Google sign-in is not configured (S5),
and email-link sign-in would require receiving mail at an address I do not control. Note the
owner reports Firebase sign-in emails never arriving (STATE, 2026-09-18) — so even the owner
may not currently be able to complete A1.

**Evidence that would settle them**, and it must be produced by a human holding a member
credential:

- **A1** — sign in at `jason.cusati.us/signin/` as `djjay@vt.edu` via the email link, then
  `GET /p/phd/phd-milestones/milestones/index.html` and
  `/p/phd/phd-milestones/committee-dossier/index.html`. Record: HTTP 200, the rendered pages,
  and a matching `event=allow`-class line in Cloud Logging for each. Confirm the assets load
  (the issue #27 class of failure is invisible in a status code).
- **A3** — sign in with any non-allowlisted account that the provider will actually issue a
  token for, then request the same two paths. Record: the "Not shared with you" page, HTTP
  status, body size, and `event=deny … reason=` showing the member-lookup stage rather than
  the session stage. `gate/app/pages.py:45–47` is the page that should appear.
- **A5** — after A1, load a second `/p/` page in the same browser session and confirm no
  re-authentication, then confirm the cookie is named exactly `__session` (Hosting strips
  every other cookie on a Cloud Run rewrite — ADR-0004). The gate suite pins the name
  (`test_the_cookie_is_named_exactly___session`), but only live traffic proves Hosting
  forwards it.

I can confirm the *negative* half of A5's mechanism: every `/p/` response carries
`vary: Cookie` on both transports, and a request bearing a **bogus** `__session` is refused at
the verify stage rather than the no-cookie stage, which proves the gate reads the cookie
Hosting forwards:

```
$ curl -s -o /dev/null -w "%{http_code} %{size_download}" -H "Cookie: __session=bogus" \
    https://jason.cusati.us/p/phd/phd-milestones/committee-dossier/index.html
404 426
$ ... same against hub-gate-ywkmredngq-ue.a.run.app
404 426

# and the gate's log distinguishes the two refusal stages:
03:20:09.699458Z  INFO gate event=deny scope=private stage=session reason=invalid_session
03:06:55.645387Z  INFO gate event=deny scope=private stage=session reason=no_session_cookie
```

`reason=invalid_session` (not `no_session_cookie`) means the cookie **arrived** through
Hosting and was rejected on its merits. That is necessary for A5 but not sufficient: it does
not prove a *valid* session survives, so A5 stays unverifiable.

### A2 — TRUE

Signed out, every private path returns a uniform 404 carrying no private content, on both
transports, and Cloud Logging attributes each one to the gate (full transcript under S1).

```
$ curl -s -o /dev/null -w "HTTP=%{http_code} SIZE=%{size_download}\n" <path>
                                          hosting        run.app
/p/index.html                             404 / 426      404 / 426
/p/                                       404 / 426      404 / 426
/p/committee.html                         404 / 426      404 / 426
/p/phd/phd-milestones/committee-dossier/index.html  404 / 426   404 / 426
```

The 404 body is the generic "Sign in" page — it names no slug, no item and no count, so it is
not an existence oracle. Per C29 this uniform 404 is the intended behaviour and I do not report
it as a defect.

### A4 — NOT VERIFIABLE BY ME (signed-out half TRUE)

The criterion covers **both** signed-out and non-member requests. The non-member half depends
on A3 and is not verifiable by me, so the conjunction is not verifiable.

The signed-out half is TRUE and identical across transports for every real private path — same
status, same 426-byte body, same `cache-control: private, no-store` (table above).

One asymmetry exists and I record it rather than bury it, because "an identical answer is part
of the criterion". Percent-encoded traversal is answered differently by the two transports:

```
$ curl --path-as-is -D- -o /dev/null <path>
--- /p/..%2fbuild-info.json ---
[hosting] HTTP/2 302  location: https://hub-gate-ywkmredngq-ue.a.run.app/build-info.json
[runapp]  HTTP/2 404
--- /p/%2e%2e%2fbuild-info.json ---
[hosting] HTTP/2 302  location: https://hub-gate-ywkmredngq-ue.a.run.app/build-info.json
[runapp]  HTTP/2 404
--- /p/..%2f..%2fetc%2fpasswd ---
[hosting] HTTP/2 302  location: https://hub-gate-ywkmredngq-ue.a.run.app/etc/passwd
[runapp]  HTTP/2 404
```

Both **refuse**, and neither discloses private material — the redirect target is always a
*public* path, resolved by frontend path normalization before the gate is reached, and the
run.app leg proves the gate itself answers 404 with `event=deny`:

```
03:20:56.124919Z  INFO gate event=deny scope=private stage=session reason=no_session_cookie
03:20:56.119415Z  404  https://hub-gate-ywkmredngq-ue.a.run.app/p/..%2Fbuild-info.json
```

So this is not a private-content leak. It is a difference in *how* the two transports refuse,
which the criterion's wording cares about. Detail in **D6.2**.

*(Caution for whoever re-runs this: plain `curl` normalizes `..` client-side, so
`/p/../build-info.json` silently becomes `/build-info.json` and returns a misleading 200 from
the public site. `--path-as-is` is required, and my first probe without it produced exactly
that false positive.)*

### A6 — TRUE (qualified)

Every `/p/` response I could elicit carries it, on both transports:

```
hosting:  cache-control: private, no-store   (and vary: Cookie, x-fh-requested-host, accept-encoding)
run.app:  cache-control: private, no-store   (and vary: Cookie)
```

No response carried `public` or `s-maxage`. `/session` likewise returns
`cache-control: private, no-store`.

**Qualification:** I can only elicit refusal responses. The member **200** case is proven by
the gate suite (`test_headers.py` builds "one response per class of `/p/**` outcome" including
a member fetch, and asserts `private, no-store` on all of them) but not live. Flip this box on
the strength of the suite plus these live refusals, or hold it until A1 is run and the 200's
headers are recorded.

### A7 — FALSE (deferred; do not tick)

`test_headers.py` asserts the property for `/p/**` and for `/session`:

```
52:def test_no_private_response_is_cacheable_by_the_cdn(...)
60:        assert "public" not in cache_control, label
61:        assert "s-maxage" not in cache_control, label
85:def test_session_endpoint_is_also_uncacheable(...)
91:    assert "s-maxage" not in response.headers["cache-control"].lower()
```

There is **no `/s/**` assertion**, and there cannot be one: `/s/**` does not exist until Phase
4, and `test_scope.py::test_no_share_routes_are_declared` actively pins its absence. The
criterion is half-unsatisfiable in Phase 3.

This is already dispositioned: STATE §Phase 3 review dispositions records **N-11** — "roadmap
criterion 7 is half-unsatisfiable until Phase 4 and must be recorded **deferred**, not ticked."
I confirm that from the code and repeat it here so the box is not flipped by momentum. See D3.

### A8 — TRUE

`gate.yml` has a `test` job running `pytest` (line 62). It passed on PR #25's head
`3738029f`:

```
$ gh api repos/djjay0131/website/commits/3738029f.../check-runs
test	success
build	success        build-firebase	success     leak-check-self-test	success
budget-guard	success    check	success      contract-tests	success
governance-checks	success
```

and locally today, **269 passed**, covering session mint/verify, non-member rejection and `/p/`
path traversal (names listed under S2).

### A9 — TRUE

The check runs on both deploy variants (S9), **and** a deliberate failing demonstration runs on
every non-schedule CI run as its own job:

```yaml
466:  leak-check-self-test:
      - name: Publish the fixture content        # two PRIVATE fixture items
        run: npm run content:fixture
      - name: Build the public output
        run: npm run build
501:  - name: Prove the leak check catches a leak
502:    run: npm run demo:leak-check              # injects a slug; exits 0 only if the guard FAILED
516:  - name: Build the private output from the fixture
519:  - name: Prove every private link resolves under the gate's base
520:    run: npm run check:private-links
```

`leak-check-self-test` = `success` on PR #25. This job is the fix for the "guard that proved
nothing" — the leak check used to exit 0 while printing that it proved nothing, because no
private item was published. The job's own comment states the same reasoning for
`check:private-links`, which would otherwise inspect a single item-free page.

**Note for the Lead Architect:** `leak-check-self-test` is still **not a required status
check**. Required contexts on `main` are exactly `governance-checks` and `budget-guard`
(transcript under A14). Review item S-4 remains open; it is a branch-protection change, not a
repository edit.

### A10 — TRUE (qualified)

**The equality holds, live, exactly as ADR-0010 decision 5 and SEAM-1 require:**

```
$ gcloud storage buckets get-iam-policy gs://cusati-hub-private --format=json
{
  "bindings": [
    { "members": ["serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com"],
      "role": "projects/cusati-hub/roles/privateObjectReader" },
    { "members": ["serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com"],
      "role": "projects/cusati-hub/roles/privateSyncWriter" },
    { "members": ["projectEditor:cusati-hub","projectOwner:cusati-hub"],
      "role": "roles/storage.legacyBucketOwner" },
    { "members": ["projectViewer:cusati-hub"],  "role": "roles/storage.legacyBucketReader" },
    { "members": ["projectEditor:cusati-hub","projectOwner:cusati-hub"],
      "role": "roles/storage.legacyObjectOwner" },
    { "members": ["projectViewer:cusati-hub"],  "role": "roles/storage.legacyObjectReader" }
  ]
}

$ gcloud iam roles describe privateObjectReader --project=cusati-hub
projects/cusati-hub/roles/privateObjectReader	storage.objects.get	GA
$ gcloud iam roles describe privateSyncWriter --project=cusati-hub
projects/cusati-hub/roles/privateSyncWriter	storage.objects.create;storage.objects.delete;storage.objects.get;storage.objects.list	GA
```

**Exactly two** non-legacy principals: the gate's runtime SA with `storage.objects.get` and
nothing else (notably **not** `objects.list` — object names in this bucket are themselves
private material), and `hub-deploy` with the four permissions a destructive sync needs. No
`allUsers` or `allAuthenticatedUsers` anywhere.

The legacy `projectViewer`/`projectEditor`/`projectOwner` bindings are Cloud Storage defaults,
not declared by this module; I report their presence as fact, per my contract, and leave the
decision about them as the separate Wave 0 item it is.

Anonymous access is refused (S7): object GET 403, bucket list 401.

**Qualification — and it is the same shape as this sprint's three hollow guards.** What runs
"on every deploy" is `check_private_bucket_config.py`, which reads **the Terraform, not the
live policy**. It would catch a widening *edit* at review time; it would **not** catch drift, a
console click, or anything granted outside Terraform. The live half exists
(`check-private-bucket-iam.sh`) and is invoked by **no workflow**. Today the live policy is
correct because I just read it — but that is a human doing it once, not a test. See D6.3 and
the proposed issue in D3.

### A11 — TRUE

Crawled every route in the live sitemap (34 URLs), plus `/phd/` and `/`, and searched
**1,426,199 bytes** of delivered HTML for the private identifiers:

```
$ while read -r u; do curl -s "$u" >> scan.txt; done < locs.txt   # 34 sitemap routes
$ curl -s https://jason.cusati.us/phd/ >> scan.txt; curl -s https://jason.cusati.us/ >> scan.txt
bytes scanned: 1426199
milestones           hits=1
committee-dossier    hits=0
committee            hits=1
dossier              hits=0
phd-milestones       hits=0
Twelve vetted        hits=0
```

The two non-zero hits are **not** the private items — I checked the surrounding text rather
than assuming:

```
/research/soa-agentic-se/agentic-harnesses/sources/ :
  "...stewarded by the Linux Foundation under a Technical Steering Committee.","claims":..."
/research/soa-agentic-se/agentic-memory/sources/ :
  "...tech-tree milestones up to 15.3x faster than prior SOTA..."
```

Ordinary academic prose in the research digests. The private slug `committee-dossier`, the
summary string `Twelve vetted`, and the source name `phd-milestones` appear **zero** times
anywhere in the public output.

The `/phd/` section shell is reachable but empty of private references (`milestones`=0,
`committee`=0), carries `<meta name="robots" content="noindex">`, and is **absent from the
sitemap** (0 matches in the 34 URLs). `/signin/` is likewise `noindex` and out of the sitemap;
per the 2026-09-17 disclosure decision it names no item, slug or count, so it does not touch
this criterion's guarantee.

Structurally, private navigation exists only in the private build by construction, not
convention: ADR-0011's two-`srcDir` arrangement (`srcDir: isPrivate ? './src-private' : './src'`)
means the public router is never given the private pages, and
`site/scripts/private-structure.test.ts` pins both the arrangement and the module graph.

### A12 — FALSE

```
$ gcloud projects get-iam-policy cusati-hub --format=json | (filter to gate/deploy/public)
roles/datastore.viewer        ['serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com']
roles/firebaseauth.admin      ['serviceAccount:hub-gate@cusati-hub.iam.gserviceaccount.com']
roles/firebasehosting.admin   ['serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com']
roles/serviceusage.apiKeysViewer ['serviceAccount:hub-deploy@cusati-hub.iam.gserviceaccount.com']
```

What is right: the gate holds `roles/datastore.viewer` — **read-only** Firestore, narrowed from
`datastore.user` when the gate stream verified `gate/app/` contains no Firestore write (SD-3).
It holds `privateObjectReader` on the private bucket. And it is **absent** from the content
bucket's policy, which I checked specifically:

```
$ gcloud storage buckets get-iam-policy gs://cusati-hub-content
satellitePublisher  ['serviceAccount:publish-cv@...']                COND:only-sources-cv
satellitePublisher  ['serviceAccount:publish-phd-milestones@...']    COND:only-sources-phd-milestones
roles/storage.objectViewer ['serviceAccount:hub-deploy@...']
(+ legacy project bindings)
```

No `hub-gate` binding — good.

What makes it FALSE: **`roles/firebaseauth.admin`** is a project-level grant of full Firebase
Authentication administration. It is neither the private bucket nor Firestore, and it is far
wider than reading: it permits managing identities in the very system that decides who is a
member. The criterion says the gate's SA "can read **only** the private bucket and Firestore".

This is not a surprise — it is STATE's note **N-1**, which says this grant "must not survive
Checkpoint 4 quietly", and the infra stream recorded that session-cookie minting needs
`firebaseauth.users.createSession` with no narrower *predefined* role confirmable from a
primary source. The fix is a custom role. Proposed issue in D3.

### A13 — FALSE

First half **TRUE**: `phd-milestones` is private on GitHub (`"private": true`,
`"visibility": "private"` — transcript under S13). This closes the unknown the Chief Reviewer
marked UNVERIFIABLE and noted would moot the entire boundary argument if it went the other way.

Second half **FALSE**: there is **no recorded test** showing the publish identity cannot write
outside `sources/phd-milestones/`. The infra stream's own handoff says so:

```
llm/sprints/2026-09-hub/handoffs/infra-phase-3.md:374
| A recorded test shows `phd-milestones`' publish identity cannot write outside
  `sources/phd-milestones/` (§12.3) | **Deferred to Checkpoint 4** | Procedure, both
  directions, in §Checkpoint 4 test 2 |
```

and STATE records the prefix-boundary proofs as **run and passed for `cv` on 2026-09-16**
(line 870), with the `phd-milestones` leg still an outstanding follow-up (line 1472: "run the
prefix-boundary test's reverse leg **as `cv`**, the direction where a defect would let a public
satellite reach private source material"). The Checkpoint 4 execution record does not record it
being run.

The *configuration* is correct — the binding carries an IAM condition scoping it to the prefix,
and UBLA is on so the condition is genuinely in effect:

```
google_storage_bucket_iam_member.satellite_publish_prefix["phd-milestones"]:
  role=satellitePublisher  condition=only-sources-phd-milestones
  resource.name.startsWith('projects/_/buckets/cusati-hub-content/objects/sources/phd-milestones/')
```

But the criterion asks for a **recorded test**, and "the config looks right" is exactly the
inference my contract forbids. Proposed issue in D3.

### A14 — TRUE

No user-managed key exists on any service account in the project:

```
$ for sa in hub-gate gate-deploy hub-deploy publish-phd-milestones publish-cv; do
    gcloud iam service-accounts keys list --iam-account=$sa@cusati-hub.iam.gserviceaccount.com \
      --managed-by=user --format="value(name,validAfterTime)"; done
--- hub-gate ---
--- gate-deploy ---
--- hub-deploy ---
--- publish-phd-milestones ---
--- publish-cv ---
```

Five accounts, zero user-managed keys. `gate.yml` authenticates with
`workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}`; `grep` for `credentials_json`
across the workflows returns nothing. The deploy step is also correctly minimal:

```yaml
- name: Deploy the revision to Cloud Run
  run: |
    gcloud run services update "${GATE_SERVICE}" --image "${IMAGE_DIGEST}" --quiet
```

`services update`, not `run deploy` — it changes only the image, so Terraform keeps ownership
of identity, scaling, ingress, env and IAM, and no `--allow-unauthenticated` appears (the
invoker binding is infra's, per ADR-0004).

Branch protection, for the record:

```
$ gh api repos/djjay0131/website/branches/main/protection
{"contexts":["governance-checks","budget-guard"],"enforce_admins":false,"strict":false}
```

### A15 — TRUE

See S15.

### Closing checkpoint box — FALSE

`STATE.md` carries a **"Checkpoint 4 execution record (2026-09-17)"**, but no
"Checkpoint 4 — PASSED" record of the kind Checkpoint 3 has
(§"Checkpoint 3 — PASSED (2026-09-16/17)"). And on the evidence above it cannot be recorded as
passed: see D5.

---

## D3 — Proposed issues for every FALSE

I do not open these.

### Issue 1 — (S5) Google sign-in provider is not configured

**Already open as issue #31.** Do not duplicate. Confirming it still reproduces today:
`defaultSupportedIdpConfigs` returns `{}` (HTTP 200), so the Google button will fail.

**Smallest change that makes it true:** create an OAuth 2.0 client and consent screen in the
console, then add the Google provider to Identity Platform. This is console-only work
(Terraform was deliberately rejected for it — it would put an OAuth client secret in tfvars and
state, violating §12.2), so it is an **owner action**. Until then the working route is the
email-link form, which is the correct one anyway given the allowlist holds `djjay@vt.edu` while
the owner's Google identity is `djjay0131@gmail.com`.

### Issue 2 — (A7) Roadmap criterion 7 is half-unsatisfiable in Phase 3

**Title:** Record roadmap Phase 3 acceptance criterion 7 as deferred to Phase 4, not ticked

**Body:** The criterion asks for a gate test asserting that no `/p/**` **or `/s/**`** response
carries `public` or `s-maxage`. `test_headers.py` asserts it for `/p/**` and `/session`. There
is no `/s/**` assertion and there cannot be one: share routes are Phase 4, and
`test_scope.py::test_no_share_routes_are_declared` actively pins their absence. Chief Reviewer
note N-11 already reached this conclusion; this records it on the roadmap so the box is not
flipped by momentum, and so Phase 4 inherits the obligation.

**Smallest change that makes it true:** none available in Phase 3. Annotate the criterion in
`llm/master-roadmap.md` as deferred (the same dated-amendment shape criterion 10 already
carries), and add the `/s/**` leg to `test_headers.py` in Phase 4 when the routes exist.
*(Roadmap edit — Lead Architect, not me.)*

### Issue 3 — (A12) The gate's service account holds `roles/firebaseauth.admin`

**Title:** Narrow the gate's `roles/firebaseauth.admin` to a custom role (roadmap Phase 3 criterion 12)

**Body:** Roadmap criterion 12 requires the gate's service account to read only the private
bucket and Firestore. Live, `hub-gate@cusati-hub.iam.gserviceaccount.com` holds
`roles/datastore.viewer` (correct, read-only) and **`roles/firebaseauth.admin`** (project-level
full Firebase Auth administration). That is neither the private bucket nor Firestore, and it
grants management of identities in the system that decides who is a member — so a gate
compromise escalates from "can read one object by name" to "can manipulate the allowlist's
identity provider". STATE note N-1 flagged this at review time and said it must not survive
Checkpoint 4 quietly; it has.

The grant exists because session-cookie minting requires
`firebaseauth.users.createSession`, and the infra stream could not confirm a narrower
*predefined* role from a primary source.

**Smallest change that makes it true:** define a project custom role holding
`firebaseauth.users.createSession` (plus only whatever the mint path additionally proves to
need), grant it to `hub-gate` in `infra/`, and remove the `roles/firebaseauth.admin` binding.
Verify by re-running the gate's session mint end to end after the change — the failure mode of
over-narrowing is a sign-in that breaks only in production, so this needs A1 runnable first.
Add the role's permission set to an equality assertion alongside the existing private-bucket
check, so it cannot widen silently.

### Issue 4 — (A13) The `phd-milestones` prefix-boundary test was deferred and never run

**Title:** Run and record the `phd-milestones` prefix-boundary test (roadmap Phase 3 criterion 13)

**Body:** Criterion 13 asks for a **recorded** test showing `phd-milestones`' publish identity
cannot write outside `sources/phd-milestones/`. `handoffs/infra-phase-3.md:374` marks it
"Deferred to Checkpoint 4", the Checkpoint 4 execution record does not record it being run, and
STATE line 870 records the prefix-boundary proofs as run for **`cv`** only. The IAM condition
and UBLA are correctly configured, but the criterion asks for a test, and configuration review
is what this sprint has repeatedly shown to be insufficient on its own.

**Smallest change that makes it true:** run the procedure already written in
`handoffs/infra-phase-3.md` §Checkpoint 4 test 2, in both directions, and paste the commands
and verbatim output into `STATE.md`:
1. as `publish-phd-milestones`, attempt a write to `sources/cv/` → expect denied;
2. as `publish-phd-milestones`, attempt a bucket list → expect denied;
3. as `publish-phd-milestones`, overwrite an object under `sources/phd-milestones/` → expect
   allowed;
4. **the reverse leg as `cv`** — attempt a write and a read under `sources/phd-milestones/` →
   expect denied. This is the direction STATE line 1472 singles out, because a defect here lets
   a *public* satellite reach *private* source material.

Requires credentials able to impersonate the publish identities; it is an owner/Lead Architect
action, not a CI job. Consider promoting steps 1, 2 and 4 into the `satellite-role-guard` check
that STATE already recommends.

### Issue 5 — (closing box) Checkpoint 4 cannot be recorded as passed

Follows from Issues 1–4 and the four unverifiable criteria. No separate change; the box is
flipped when D5's blockers clear. See D5.

---

## D4 — Disposition of Open Questions O1–O7

Read against the roadmap's **current** text (as of `ad71b57`), not a remembered version. For
context, the §10 questions now stand as: Q1 answered (ADR-0001/0006), Q2 answered (Blaze
confirmation still not on the record), **Q3 answered 2026-09-18** (share links wanted), Q4
answered (the two seed members, reaffirmed 2026-09-18), Q5 approved by merging PR #9, and
**Q6 answered 2026-09-18** (`agentic-kgis` first, as `source: kgis`).

| # | Disposition | Reason and where recorded |
|---|---|---|
| **O1** | **CLOSED** | Brief §3–§4 provisioned the content bucket, private bucket and Artifact Registry in Phase 1; §11 placed the content bucket in Phase 2 and the private bucket in Phase 3. **§11 won, and execution followed it.** Live: `cusati-hub-content` created in Phase 2, `cusati-hub-private` and the `hub-gate` Artifact Registry repo both created `2026-09-17T20:11Z` in Phase 3. Recorded in STATE §Checkpoint 3 and §Checkpoint 4 execution records; the roadmap's R-A4 carries the Artifact Registry classification. No residual conflict. |
| **O2** | **CLOSED** | Brief §4 had Phase 1 ship `firebase.json` with all four gate rewrites; §11 placed `/p/**` in Phase 3 and the share rewrites in Phase 4. Settled by **SEAM-6**, on the verified platform fact that Hosting rejects a config naming a Cloud Run service that does not exist — so the brief's "Hosting tolerates this" was simply wrong. `firebase.json` gained `/p/**` and `/session` only at Checkpoint 4, after `hub-gate` existed, and today carries exactly `/p/**`, `/session` and `/client-events`. Recorded in SEAM-6, STATE §Checkpoint 4 execution record, and the Phase 3 notes on deliberate rewrite absence. |
| **O3** | **CLOSED** | Brief §4 put `POST /share`, `DELETE /share/{token}` and `GET /s/{token}/{path}` in Phase 3; §11 places them in Phase 4, and §10 Q3 might have cut them. **Owner decision D2 (2026-09-18): share links are wanted; Phase 4 executes as written.** §11 won on placement. Phase 3 enforced the boundary in code rather than by intention: `gate/tests/test_scope.py::test_no_share_routes_are_declared` and `test_share_mint_is_not_implemented` pin their absence. Recorded in the roadmap Q3 row and STATE §Owner decisions 2026-09-18. |
| **O4** | **CLOSED — and moot** | Brief §4 added a stubbed `repository_dispatch` trigger to `build.yml` in Phase 1; §11 placed the dispatch rebuild in Phase 2. **ADR-0007 removed the mechanism entirely**: the hub polls the content bucket, because any credential able to fire `repository_dispatch` at `website` could also write to it. No dispatch trigger exists in `build.yml`, and `phd-milestones`' `publish.yml` states the property explicitly ("no `repository_dispatch`: the hub polls the bucket instead"). The question no longer has a subject. |
| **O5** | **STILL OPEN** | §11 Phase 4 names share "list", but design doc §6 responsibility 4 defines only mint (`POST /share`), serve (`GET /s/{token}/{path}`) and revoke (`DELETE /share/{token}`) — no list route — and the brief's route list has none either. Owner decision D2 says "Phase 4 executes as written", which resolves *whether* shares happen but not *whether a list endpoint exists*. **Blocks:** Phase 4 scope definition and the Shares page (§11 Phase 4 ships "Shares page (React island)", which presumably needs to enumerate shares). Someone must decide whether §11's "list" adds a route to §6 or the Shares page reads Firestore directly. This should be settled **before** Phase 4 starts, since Checkpoint 5's criteria are defined from the phase's scope. |
| **O6** | **STILL OPEN** | §11 Phase 6 both redirects from `djjay0131.github.io/website` and retires Pages; the old URL *lives on* GitHub Pages, so the redirects need a host after retirement, and "retire" is undefined. Nothing in the 2026-09-18 owner decisions touches it. Still live today: `build.yml` continues to run the GitHub Pages variant (`build`, `deploy`, `smoke-test` jobs) alongside the Firebase one. **Blocks:** Phase 6 scope and Checkpoint 7's definition. Needs the owner to say what "retire" means — leave Pages serving redirect stubs indefinitely, or accept that inbound `/website/...` links break on a date. |
| **O7** | **CLOSED** | Closed by the **owner on 2026-09-18** (run-to-completion prompt, decision D6). It read: "No brief defines checkpoints or approval for Phases 4–6." Each of Phases 4–6 now closes with a checkpoint the Lead Architect defines in `STATE.md` **before** the phase starts, consisting of that phase's acceptance criteria verified live plus the run's security gate. Recorded in the roadmap's O7 entry (now prefixed "CLOSED"), in STATE §Owner decisions 2026-09-18 D6, and consequentially in the retirement of roadmap assumption R-A3 and the design doc's status line ("Approved for Phase 0–6 execution"). |

**Two of seven remain open (O5, O6).** Neither blocks Phase 3 or Checkpoint 4; O5 blocks Phase
4 and should be answered before it starts, O6 blocks Phase 6.

---

## D5 — Is Checkpoint 4 PASSED?

### **NO.**

Checkpoint 4 passes only if **every** Phase 3 acceptance criterion is TRUE. Seven are not.

**FALSE (3):**

- **A7** — the `/s/**` half of the cache-control test assertion is unsatisfiable in Phase 3.
  Must be recorded **deferred**, not ticked (N-11).
- **A12** — the gate's service account holds `roles/firebaseauth.admin`, far wider than "only
  the private bucket and Firestore".
- **A13** — `phd-milestones` is private (verified), but the **recorded** prefix-boundary test
  was deferred at Checkpoint 4 and never run.

**NOT VERIFIABLE BY ME (4):**

- **A1** — a seeded member signs in and sees the tracker and dossier.
- **A3** — a signed-in non-member gets the "not shared with you" page.
- **A4** — the non-member half of the both-transports refusal.
- **A5** — a session minted through `jason.cusati.us` persists across page loads.

All four require a member (or at least an authenticated non-member) credential, which I do not
hold and must not fake. **A1 is the phase's headline deliverable** — "Ships: The milestone
tracker and committee dossier sit behind sign-in" — and it is precisely the criterion nobody
has yet demonstrated. Note the compounding problem: A3 cannot be exercised at all until Google
sign-in is configured (S5/#31) or an email-link address is available for a non-member, and A1
depends on Firebase sign-in email actually being delivered, which the owner reports is not
happening.

**TRUE (9, two qualified):** A2, A6*, A8, A9, A10*, A11, A14, A15 — and the first half of A13
and A4.

**The closing box** — "Checkpoint 4 passed and recorded in `STATE.md`" — is therefore **FALSE**,
and `STATE.md` currently holds an *execution record* rather than a pass record, which is the
honest state of affairs.

**What would flip it.** In dependency order:

1. Configure Google sign-in, or confirm email-link delivery works (unblocks A1, A3, A5).
2. Run A1, A3, A4-non-member and A5 live as a member and as a non-member; record commands,
   statuses, body sizes and the matching Cloud Logging lines in `STATE.md`.
3. Narrow `roles/firebaseauth.admin` (A12) and re-run the mint path.
4. Run and record the `phd-milestones` prefix-boundary test, both directions (A13).
5. Annotate A7 as deferred to Phase 4 (A7 will never be TRUE in Phase 3).

Because A7 cannot become TRUE within Phase 3, **Checkpoint 4 can only pass if the Lead
Architect explicitly records criterion 7 as deferred** rather than satisfied. That is a
judgement call about the checkpoint's definition, and it belongs to the Lead Architect, not to
me. I flag it rather than assume it.

**Scope boxes that may be flipped now (14 of 15):** S1, S2, S3, S4, S6, S7, S8, S9, S10, S11,
S12, S13, S14, S15. **S5 stays unchecked** (issue #31).

**Acceptance boxes that may be flipped now (7 of 16):** A2, A8, A9, A11, A14, A15, and A10 —
with A6 flippable if the Lead Architect accepts the gate suite as evidence for the member-200
case. A10 and A6 should carry the qualifications recorded in D2.

---

## D6 — Things nobody asked about

Found between the things people were looking at, which is where this sprint's integration
defects have all lived.

### D6.1 — `required: true` for `phd-milestones` exists **only in the uncommitted working tree**

This is the one I would act on today. The Checkpoint 4 action "flip `phd-milestones` to
`required: true` in `EXPECTED_SOURCES` after its first successful publish" appears to be done —
the file on disk says so, with a confident note dated 2026-09-18. It is not committed.

```
$ git show f98a928a:site/src/lib/hub-content.mjs | grep -A8 '"phd-milestones"'   # DEPLOYED
    source: "phd-milestones",
    required: false,
    ...  "Flip to required: true once it has published (ADR-0010 decision 4)."

$ git show HEAD:site/src/lib/hub-content.mjs | grep -A8 '"phd-milestones"'       # HEAD ad71b57
    source: "phd-milestones",
    required: false,
    ...  (identical)

$ grep -A8 '"phd-milestones"' site/src/lib/hub-content.mjs                        # WORKING TREE
    source: "phd-milestones",
    required: true,
    ...  "HAS PUBLISHED: first successful publish at Checkpoint 4, 2026-09-17, and
          flipped to required: true on 2026-09-18."
```

`f98a928a` is the deployed build (`build-info.json` `built_from_sha`) and is an ancestor of
HEAD. So **every committed and every deployed artifact still has `required: false`.**

**Why it matters, in ADR-0010's own terms.** `required: false` means "known but not yet
expected", and it is the correct state only between declaring a satellite and its first
publish. `phd-milestones` published on 2026-09-17. Left at `false`, a vanished
`sources/phd-milestones/` prefix goes **undetected** — which is exactly C27, and the decision's
amendment says flipping it after the first publish "is a checkpoint action, not an optional
tidy-up". Combined with the destructive private sync (decision 5), the failure this guards
against is the private area silently emptying while the build reports success.

**Recommendation:** commit it. It is a one-line change already written; it just never landed.
Verify `npm test` still passes, since the pull-request build path depends on
`--partial`/`--provenance cv-release` handling for exactly this reason (the comment added to
`site/scripts/fetch-data.sh` in the same uncommitted set explains that a PR build sees only
`cv` and would otherwise fail on a "vanished prefix" that never existed there — so the two
changes are a pair and should land together).

*Context, not alarm:* other Wave 0 streams are committing while this audit runs, so the tree
is a moving target. HEAD advanced from `7720bd3` to `ad71b57` during the audit (`c97b897`
Governance Auditor contract, `334b3fb` Wave 0b seams, `ad71b57` gate stream handoff), and the
gate edits that were uncommitted at the start have since landed. **I re-checked this finding
against the new HEAD after that happened: `required: false` is still what is committed, and
the flip is still working-tree-only.** Also now uncommitted: a `/session/end` rewrite added to
`firebase.json` (Phase 4 sign-out, SD-4) — it does not disturb `/p/**` or `/session`, which are
both still present and still answering live. I changed none of these files and make no commits.
I raise D6.1 specifically because it is a *closed* Checkpoint 4 action that is not actually
closed.

### D6.2 — The two transports refuse encoded path traversal differently

Full transcript under **A4**. Summary: `/p/..%2fbuild-info.json` and friends get **302** from
Hosting (frontend path normalization, `location:` pointing at a *public* path) and **404** from
the gate on `*.run.app`.

Neither leaks private material, and both refuse — but ADR-0004's rule is that every check must
hold on both transports, and roadmap criterion 4 makes an *identical answer* part of the
criterion. This is the sort of difference that is harmless now and becomes load-bearing in
Phase 4, when `/s/{token}/{path}` accepts an attacker-supplied path component and the two
transports may normalize it differently before the gate's allowlist ever sees it.

**Recommendation:** add a both-transports parity assertion for a small corpus of encoded
traversal forms to the live probe set (not the pytest suite — the suite's `transport` fixture
simulates both, but this difference is created by Google's frontend and is invisible to
`TestClient`). Worth doing before Phase 4 adds a second path-bearing route.

### D6.3 — The live half of the bucket IAM test runs nowhere

`infra/scripts/check-private-bucket-iam.sh` is referenced by `infra/outputs.tf` (as a
paste-ready command string), `infra/README.md`, and its own comments. **No workflow invokes
it.** What runs on every push is the credential-free `check_private_bucket_config.py`, which
reads the Terraform.

Both scripts' headers are unusually honest about this split, so it is a known and deliberate
gap rather than a pretence. But the consequence is that **the criterion's live half is
currently verified by a human doing it once** — today, by me. Terraform cannot see a binding
granted outside Terraform; `plan` reports "No changes" whether or not someone added a reader in
the console.

This has the same shape as the sprint's three hollow guards: a check that reports success on
every run while being structurally unable to observe the failure it names. It differs in that
the authors said so in the file.

**Recommendation:** run the live script in the `private-sync` job, which already authenticates
to the right project through WIF and already touches this exact bucket. It needs
`storage.buckets.getIamPolicy` on the private bucket for `hub-deploy` — the script's own
closing note flags this as "a real gap, not an oversight". That is one narrow permission added
to `privateSyncWriter` (or a separate binding) in exchange for drift detection on the bucket
holding the committee dossier.

### D6.4 — `/healthz` is no longer a defect; the tracked finding is resolved in substance

STATE carries "`/healthz` is intercepted before it reaches the gate" as a real, tracked
finding. The gate has since moved its health route:

```
$ curl .../_health                          runapp: HTTP=200 SIZE=15   {"status":"ok"}
$ curl .../healthz                          runapp: HTTP=404 SIZE=1568  (Google's page)
$ grep -n "_health" .github/workflows/gate.yml
201:  STATUS="$(curl ... "${URL}/_health")"
206:  echo "OK: /_health returned 200"
$ grep -n "_health" gate/app/main.py
399:  # NOT /healthz. That path never reaches this container on Cloud Run: Google's ...
465:  @app.get("/_health")
```

`gate/tests/test_scope.py::test_healthz_reveals_nothing` asserts `/_health` returns exactly
`{"status": "ok"}`, and the uptime check is hitting it successfully every ~30s in the logs. So
the 1568-byte `/healthz` 404 is now *expected behaviour on a path nothing uses*, not a broken
health check. Worth closing the finding rather than carrying it forward as live.

### D6.5 — All three alert policies are enabled and deliver nothing

```
$ curl .../v3/projects/cusati-hub/notificationChannels
Hub ops email | type: email | enabled: True | verification: ABSENT
$ curl .../v3/projects/cusati-hub/alertPolicies
Hub — private gate down | enabled: True | channels: 1
Hub — public site down  | enabled: True | channels: 1
Hub — sign-in failing   | enabled: True | channels: 1
```

The channel has **no `verificationStatus` field at all**, which means unverified. STATE
recorded this on 2026-09-18 and it has not changed. All three policies accept events and
deliver nothing.

Worth connecting two facts that are recorded separately: the owner reports Firebase sign-in
emails never arriving, *and* the monitoring channel's verification email (sent to
`djjay@vt.edu` at 15:27:37Z on 2026-09-18) has not been actioned. If both are the same delivery
problem, then the email-link sign-in route — currently the **only** working sign-in route,
since Google is unconfigured — is also the route that cannot deliver. That would make **A1
unverifiable by anyone, including the owner**, not just by me. Confirming whether mail to
`djjay@vt.edu` arrives at all is cheap and is on the critical path to Checkpoint 4.

### D6.6 — `cv/anthropic-fellow` is publicly reachable, contradicting owner decision D8

Not a Phase 3 criterion — D8 was decided 2026-09-18 and belongs to Wave 0b — but it is live
exposure right now, so I record it rather than leave it between the two waves.

Owner decision D8 states plainly: "**`cv/anthropic-fellow` is private.** It must not appear on
`/resumes/`, `/cv/`, in `/pdfs/`, in the sitemap, the search index, RSS, OG images, or any
`dist-public` byte."

Live:

```
/cv/anthropic-fellow/          HTTP=200 SIZE=21032
/pdfs/anthropic-fellow.pdf     HTTP=200 SIZE=57915
sitemap-0.xml                  contains https://jason.cusati.us/cv/anthropic-fellow/
```

And simultaneously `pdfs/anthropic-fellow.pdf` (57915 bytes) sits in the **private** bucket —
the same bytes on both sides of the boundary.

This is expected in the sense that D8 has not been implemented yet. It is worth stating anyway
because the leak check will **not** catch it: the check derives private slugs from satellite
manifests, and `cv`'s manifest still declares this item `visibility: public`. D8 inverts the
authority (the hub's allowlist decides, the manifest merely requests), so until the allowlist
lands, the guard that would normally protect this item is structurally blind to it. Whoever
implements D8 should make the leak check read the allowlist, not just the manifests — otherwise
the item becomes private in policy and stays public in fact, with every check green.

### D6.7 — Minor observations, recorded without recommendation

- **Cloud Run scaling annotations disagree.** The service-level annotation says
  `run.googleapis.com/maxScale: '20'` while the revision template says
  `autoscaling.knative.dev/maxScale: '3'`. The template value is what binds the running
  revision, and `infra/variables.tf` validates `gate_max_instance_count` to 1–10 with a comment
  that "The design calls for 3". Probably a stale service-level annotation from an earlier
  `gcloud run deploy`; worth a glance since the `$5` budget is the reason the cap exists.
- **Hosting's 302 discloses the `*.run.app` URL** in its `location:` header. Harmless — the
  invoker is `allUsers` by design (ADR-0004) and the URL is public — but noted since it means
  Hosting is not an opaque front for the gate.
- **The private bucket's `_payload/phd-milestones/site/*` objects duplicate the satellite's
  source bytes** (29869 and 17329 bytes, matching `sources/phd-milestones/site/*` exactly). By
  design — the hub serves the `html` format verbatim — but it means a withdrawal must prune
  both the route wrapper and the payload, which the destructive sync does only because both are
  produced by the same build. Worth keeping in mind when ADR-0010 decision 5 is next tested.

---

## Assumptions

1. **I treated the roadmap's current text as authoritative**, reading it at `7720bd3` rather
   than relying on any remembered version — per my contract's warning about O7, Q3, Q4 and Q6.
2. **"Refused the same way" (criterion 4) means the same status, body and cache headers.** I
   verified those three. Where the two transports differ only in how the *frontend* normalizes
   a path before either reaches an application (D6.2), I reported the difference rather than
   deciding whether it violates the criterion — that is the Lead Architect's call.
3. **I accepted the gate pytest suite as evidence for behaviours I cannot elicit live** (the
   member-200 cache-control case, A6), and said so explicitly rather than folding it into a
   bare TRUE. Given this sprint's history with `caplog`, I note that `test_headers.py` runs
   against a `TestClient`, not a deployed container — its evidence is real but it is not live
   evidence.
4. **I treated the three known-correct behaviours as such** and did not report them as defects:
   the uniform `/p/**` 404 (C29), the two-principal private bucket (ADR-0010 d5), and the
   legacy bucket bindings.
5. **The deployed public site corresponds to `f98a928a`** (`build-info.json`
   `built_from_sha`), which is an ancestor of HEAD. My public-site findings describe that
   build, not the working tree.
6. **This is a point-in-time audit of a moving tree.** Probes ran 03:06Z–03:25Z; repository
   claims are anchored at HEAD `ad71b57`. HEAD advanced twice during the audit as other Wave 0
   streams committed (see D6.1), so a reader should re-check any repository-state claim — D6.1
   above all — against the HEAD they are looking at. Live cloud and public-host findings are
   unaffected by repository commits.
6. **I did not read any private bucket object.** Object names and sizes only, per my contract.
   For Firestore I report document ids and field *names*, not field values — the ids are the
   two member emails already on the record in the roadmap, STATE and SEAM-3.

## Recommendations

In the order I would do them:

1. **Commit the `required: true` flip** (D6.1). A closed Checkpoint 4 action that never landed,
   guarding the private area against silently emptying. Land it with the paired
   `fetch-data.sh --partial` change.
2. **Establish whether email to `djjay@vt.edu` is delivered at all** (D6.5). It gates A1, A3
   and A5, and therefore Checkpoint 4. If it is broken, the alerting design's dependence on
   email needs rethinking too, and that is a Phase 4 input.
3. **Run A1, A3, A4-non-member and A5 live**, recording commands, statuses, body sizes and the
   matching Cloud Logging lines in `STATE.md` — the same standard the signed-out probes in this
   report meet.
4. **Narrow `roles/firebaseauth.admin`** (Issue 3), then re-run the mint path.
5. **Run and record the `phd-milestones` prefix-boundary test, both directions** (Issue 4),
   including the reverse leg as `cv`.
6. **Annotate criterion 7 as deferred** (Issue 2), and decide explicitly whether Checkpoint 4
   may pass with a deferred criterion.
7. **Wire the live bucket IAM check into `private-sync`** (D6.3).
8. **Answer O5 before Phase 4 starts** — whether shares have a list route.
9. Promote `leak-check-self-test` and `contract-tests` to required status checks (review items
   S-4 and the consequence noted at Check 7). Both currently run without gating a merge.

## Alternatives considered

- **Reporting A1/A3/A5 as "effectively true, the code is correct."** Rejected — it is precisely
  the inference my contract forbids, and this sprint has three guards that passed while proving
  nothing. An unverifiable criterion reported honestly is worth more.
- **Marking A10 FALSE because the live half is unautomated.** Rejected: the criterion as worded
  is satisfied (a test runs on every deploy asserting exactly those invariants) and the live
  policy is verifiably correct today. Marking it FALSE would misstate the bucket's actual
  state. Instead I marked it TRUE with the automation gap recorded prominently as D6.3 — the
  risk is real but it is a *drift-detection* gap, not a present violation.
- **Marking A6 NOT VERIFIABLE because I cannot elicit a 200.** Rejected as over-strict: every
  response that exists on the live service carries the header, on both transports, and the 200
  case is pinned by a test. Recorded as TRUE with the qualification stated so the Lead Architect
  can disagree cheaply.
- **Marking A4 TRUE on the signed-out evidence alone.** Rejected — the criterion explicitly
  names non-member requests, and substituting the signed-out probe is the exact move my contract
  forbids.
- **Running the gate suite only in CI rather than locally.** I did both: CI proves it passes on
  the merged head, and the local run (269 passed) confirms the committed tree still does.
- **`terraform apply -refresh-only` to confirm no drift.** Rejected — `apply` in any form is
  forbidden by my contract. `plan -detailed-exitcode` returned exit 0 / "No changes", which
  answers the question read-only.

## Risks

1. **A1 has never been demonstrated by anyone.** The phase's headline deliverable — a member
   signing in and seeing the two documents — has no recorded evidence, and the only working
   sign-in route depends on email delivery that may be broken (D6.5). Everything else in Phase 3
   could be perfect and the feature still not work.
2. **`required: false` is deployed** (D6.1). Until the flip lands, a vanished
   `sources/phd-milestones/` prefix is undetected, and the private sync is destructive. This is
   the one combination ADR-0010 decision 3 exists to prevent.
3. **`roles/firebaseauth.admin` on the gate** (A12). A gate compromise reaches the identity
   system behind the allowlist, not just one private object.
4. **Bucket IAM drift is invisible** (D6.3). Terraform reports "No changes" whether or not a
   principal was added outside Terraform.
5. **Alerts are enabled and silent** (D6.5). The monitoring built to end interactive
   troubleshooting delivers nothing, so the next production defect is found the way the last
   three were — by someone looking.
6. **D8 is decided but unimplemented** (D6.6), and the leak check is structurally blind to the
   item it now covers. The window between the decision and its implementation is one where a
   green build means less than it appears to.
7. **Phase 4 inherits an undefined share-list surface** (O5) and a cache-control assertion it
   must remember to complete (A7).

## Open questions

Routed to the Lead Architect, not the owner. Each names the evidence that would settle it.

1. **May Checkpoint 4 pass with criterion 7 recorded as deferred?** It cannot become TRUE in
   Phase 3 (A7). If the checkpoint requires every criterion TRUE as written, Checkpoint 4 can
   never pass and the criterion must be amended. *Settled by:* a Lead Architect decision
   recorded in `STATE.md`, ideally with the same dated-amendment shape criterion 10 carries.
2. **Is the encoded-traversal transport asymmetry (D6.2) a criterion-4 violation?** Both
   transports refuse and nothing private leaks, but the answers differ. *Settled by:* a decision
   on whether "refused the same way" governs the status code or the security outcome.
3. **Should the legacy bucket bindings be removed from the private bucket?** `projectViewer`
   can read every private object; today the only project Viewer is the owner. My contract names
   this as a separate Wave 0 item, so I only confirm the bindings exist. *Settled by:* the owner
   decision the infra stream asked for.
4. **Is `roles/serviceusage.apiKeysViewer` on `hub-deploy` still needed?** It appeared while I
   was checking A12's neighbours and is not mentioned in any Phase 3 document I read. Probably
   from the Firebase web-app configuration work at Checkpoint 4. *Settled by:* checking whether
   any workflow step reads an API key, and removing it if not.
5. **Does the private sync prune `_payload/` correctly on withdrawal?** (D6.7.) The Chief
   Reviewer's Part C procedure — withdraw one item, confirm the dry run names exactly that
   item's objects — is still unrun, and it is cheap only while the bucket is nearly empty.
   *Settled by:* running that procedure and recording the dry-run output.

## Related docs

- `llm/master-roadmap.md` §phase-3-private-area — the 32 checkboxes under audit
- `llm/sprints/2026-09-hub/STATE.md` — §Run-to-completion preconditions, §Checkpoint 4
  execution record, §Phase 3 review dispositions, §Follow-ups, §Standing constraints
- `llm/specs/2026-09-10-research-hub-design.md` §5, §6 (req. 3 as amended), §7, §8, §12
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — allUsers invoker,
  `__session`, CDN caching
- `llm/governance/adr/0005-two-output-build-with-leak-check.md` — paths **and** contents
- `llm/governance/adr/0010-withdrawal-semantics.md` — decisions 3, 4 (and its amendment), 5
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — the A11 structural guarantee
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-3, SEAM-4, SEAM-6, SEAM-9
- `llm/sprints/2026-09-hub/handoffs/infra-phase-3.md` — line 374 (the deferred A13 test),
  §Checkpoint 4 test 2 (its procedure)
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-phase-3.md` — N-1, N-11, S-1, S-4
- Issue #31 (Google provider), #44 (this wave); PR #25 (merged `1a1af92`)

## ADR candidates

1. **The gate's health route is `/_health`, not `/healthz`, because Google's frontend
   intercepts `/healthz` on Cloud Run.** This is a durable, non-obvious platform constraint
   currently recorded only in a code comment (`gate/app/main.py:399–403`), a workflow line and
   a STATE narrative. A future contributor "fixing" the health path to the conventional
   `/healthz` would break the deploy smoke test and get a 404 that looks like the gate being
   down. Same shape as ADR-0011: the implementation is right and the reason lives nowhere
   durable. *(Small; could equally be a `gate/README.md` section if the Lead Architect judges
   an ADR too heavy.)*
2. **The bucket IAM test is deliberately two halves — a credential-free config assertion on
   every push and a credentialed live assertion on the deploy path — and neither replaces the
   other.** This reasoning is currently in two script headers. It is a genuine architectural
   decision about what CI can and cannot prove without credentials, it generalises beyond this
   bucket, and it is exactly the kind of thing a later contributor deletes as duplication.
3. **Authorisation checks must be verified on both transports, including differences created by
   Google's frontend rather than by the application.** ADR-0004 states the `allUsers` principle;
   D6.2 shows the principle has a layer the pytest `transport` fixture cannot reach. Worth
   recording before Phase 4 adds a second path-bearing route.

*(Not proposed as an ADR: D8's inversion of manifest authority is already slated for one in the
owner's decision D4/D8 text.)*

---

## Appendix — environment notes for the next agent

Every one of these cost time before it was written down. All four held today.

- `gh` is **not on PATH**. `GH="/mnt/c/Program Files/GitHub CLI/gh.exe"`. Never bare `gh`.
- `gcloud` needs
  `export CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12`.
  Also: piping `gcloud --format=json` into the *system* `python3` fails — it is 3.8 and some
  gcloud output is not JSON at all (`artifacts repositories describe` prints YAML-ish text).
  Parse with care or use `--format=yaml` and `grep`.
- `gcloud alpha monitoring` is **not installed** and offers to install components. Use the
  Monitoring REST API with `gcloud auth print-access-token` instead — never echo the token.
- The Identity Toolkit admin API needs a quota project: add
  `-H "x-goog-user-project: cusati-hub"` or it returns `PERMISSION_DENIED / SERVICE_DISABLED`,
  which is misleading — the service is enabled.
- `terraform` runs only through `hashicorp/terraform:1.14.0`; `init` first, then
  `plan -input=false -no-color -detailed-exitcode` (exit 0 = no changes).
- `/mnt/c` reports every file `0777`; use `git ls-files -s` for executable bits.
- **`curl` normalizes `..` in a path client-side.** Use `--path-as-is` for any traversal probe,
  or you will get a 200 from the public site and think you found a gate defect. I did, briefly.
- The gate's own 404 is **426 bytes**, `<html lang="en">` quoted. Google's interception page is
  **1568 bytes**, `<html lang=en>` unquoted. `/healthz` now legitimately returns the latter.
