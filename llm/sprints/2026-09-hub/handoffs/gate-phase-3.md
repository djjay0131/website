# Handoff: Gate Implementation Engineer — Phase 3

Status: Delivered
Last updated: 2026-09-17
Owner: Gate Implementation Engineer (Specialist 1)
Contract: `llm/sprints/2026-09-hub/contracts/gate-phase-3.md`
Branch: `feat/private-area` · Issue #24

---

## Summary

The gate is built, tested and packaged. It implements design doc §6
responsibilities **1–3 only**: `POST /session`, the Firestore allowlist, and
`GET /p/{path}`. Share links (§6 responsibility 4, `/s/**`, `/share/**`) are
Phase 4 and are **absent rather than stubbed** — `tests/test_scope.py` asserts
the application declares exactly three routes and fails if a share route
appears, because a half-built share route that answers at all is a way to reach
private bytes without a session.

Files delivered (nothing outside the contract's scope was touched):

| Path | What it is |
|---|---|
| `gate/app/main.py` | Routes, header middleware, error handlers |
| `gate/app/config.py` | Env settings; the `__session` constant |
| `gate/app/auth.py` | `TokenVerifier` protocol + Firebase Admin implementation |
| `gate/app/members.py` | `MemberDirectory` protocol + Firestore implementation |
| `gate/app/serve.py` | Path allowlist + `ObjectStore` protocol + GCS implementation |
| `gate/app/pages.py` | The only bodies the gate returns; all static |
| `gate/tests/` | 204 tests (conftest + 5 modules) |
| `gate/pyproject.toml` | Pins, ruff and pytest configuration |
| `gate/requirements.txt`, `gate/requirements-dev.txt` | Hash-pinned closures |
| `gate/Dockerfile`, `gate/.dockerignore` | 3.12, non-root, digest-pinned base |
| `gate/README.md`, `gate/.gitignore` | Documentation; Python artefact exclusions |
| `.github/workflows/gate.yml` | Test, build, push, deploy (WIF only) |

**The two ADR-0004 constraints, and how each is held rather than assumed.**

*The cookie is `__session`.* It is a module constant in `app/config.py` and is
deliberately **not** configurable by environment variable, because an env var is
precisely the mechanism by which a correct repository could produce a wrong
deployment. More usefully, `tests/conftest.py` `request_headers()` sends every
authorisation test through two transports: `hosting`, which **strips every
cookie except `__session`** exactly as Firebase Hosting does, and `direct`. A
gate that named its cookie anything else would pass all 102 `direct` cases and
fail all 102 `hosting` ones — the ADR's failure mode turned into a red CI run
instead of a Checkpoint 4 surprise.

*The invoker is `allUsers`.* Nothing in the request path reads a header,
hostname or path shape that only Hosting adds. The session cookie is the only
accepted credential — no `Authorization` header, no query parameter, and
`--proxy-headers` is deliberately **off** in the Dockerfile so `X-Forwarded-*`
(which anyone can set on a direct request) is trusted for nothing. Every
authorisation test runs identically under both transports, so a check that held
only behind Hosting could not pass here.

**Decisions taken in scope.** Refusals return **404 with a static body**, never
302 (open question (b) below). Authentication and authorisation are decided
**before** the path is validated and before any bucket lookup, so an anonymous
caller never causes a fetch and the refusal cannot be used as an existence
oracle — asserted by `store.fetches == []` and by byte-comparing the refusal for
a real path against an imaginary one. Path safety is an **allowlist**
(`[A-Za-z0-9._-]+` per segment), not a blocklist of traversal spellings.
`email_verified` is required before membership is considered. Membership is
re-read on every request, so removal takes effect without waiting for a session
to expire. Object paths are kept **out of logs** by default.

---

## Validation

Run on this workstation. **No cloud command was run and no credential exists or
was created.** `python3` here is 3.8; the gate targets 3.12, so everything below
ran under the uv-managed CPython 3.12.11.

### pytest — 204 passed, 0 skipped, 0 failed

```
........................................................................ [ 35%]
........................................................................ [ 70%]
............................................................             [100%]
204 passed, 2 warnings in 1.65s
```

No skips. The two warnings are third-party deprecations (`starlette.testclient`
recommending `httpx2`; an `anyio.abc.BlockingPortal` alias), neither from gate
code.

### Lint — ruff (chosen; added in `pyproject.toml`)

Rule set `E, F, W, I, B, UP, S, C4, SIM, RUF` — `S` (flake8-bandit) included
deliberately because this is a security-critical service.

```
### ruff check ###
All checks passed!
### ruff format --check ###
14 files already formatted
```

### actionlint + YAML parse on `.github/workflows/gate.yml`

```
### actionlint ###
actionlint: no findings (exit 0)
```

```
YAML parse: OK
jobs: ['test', 'build-and-deploy']
workflow permissions: {}
  test permissions= {'contents': 'read'} if= None
  build-and-deploy permissions= {'contents': 'read', 'id-token': 'write'} if= github.event_name != 'pull_request' && vars.GCP_PROJECT_ID != ''
```

### Docker — built locally, pushed nowhere

```
#13 writing image sha256:e01b9796b9c72d347055b84547e7eb2018cae0d316acf61c336d0fff17d0f1f7 done
#13 naming to docker.io/library/hub-gate:local done
=== BUILD EXIT: 0 ===
```

Runtime checks against the built image:

```
=== runs as uid ===
uid=10001(gate) gid=10001(gate) groups=10001(gate)
=== image size ===
230.0 MB
fail-fast exit code = 1
ValueError: GATE_PRIVATE_BUCKET is required: the gate has nothing to serve without it.
```

And over real HTTP, not the test client — a configured container, anonymous
requests, no Hosting in front of it (i.e. the `allUsers` case):

```
HTTP/1.1 200 OK
content-type: application/json
cache-control: private, no-store
vary: Cookie
x-content-type-options: nosniff
referrer-policy: no-referrer
x-frame-options: DENY

{"status":"ok"}
--- signed-out /p/ ---
status=404
HTTP/1.1 404 Not Found
cache-control: private, no-store
```

### Fakes, not emulators — and why

The suite runs against **in-memory fakes** implementing the same Protocols as
the production classes (`TokenVerifier`, `MemberDirectory`, `ObjectStore`).
Emulators were not used: the Firestore emulator is a Java program and **no JVM
is installed on this workstation** (`java: MISSING`), and the Auth emulator
would not exercise the real Identity Toolkit session-cookie path in any case.
Firestore and the private bucket do not exist yet. The real Firebase, Firestore
and GCS code paths are therefore **unexercised** and are first exercised at
Checkpoint 4 — stated plainly as the main residual risk.

### File modes

No `*.sh` was added, so the `budget-guard` shebang rule is vacuous here — but
the check was run rather than assumed. `git config core.fileMode` is `false` on
this checkout and git records new files `100644` (verified against existing
tracked files), so nothing in `gate/` will be committed spuriously executable.

```
=== tracked .sh modes (must all be 100755) ===
100755 site/scripts/fetch-data.sh
100755 site/scripts/sync-content.sh
100755 site/scripts/sync-local-data.sh
=== any .sh in my scope? ===
0
```

### Required reading not completed

**Issue #24 could not be read.** `gh` is not installed on this machine
(`/usr/bin`, `/usr/local/bin`, `/snap/bin`, `~/.local/bin` and a filesystem
search all came back empty). I worked from `llm/master-roadmap.md`
§phase-3-private-area, `phase-3-seams.md` and the design doc, which the contract
names as carrying the same criteria. **If issue #24 contains any requirement not
in those documents, it has not been implemented.**

---

## Minimum IAM the gate needs

Stated as the minimum, for the infra stream to implement. Two identities are
involved and conflating them is the easiest way to over-grant.

### A. The gate's RUNTIME service account (attached to `hub-gate`)

| # | Grant | Scope | Why |
|---|---|---|---|
| 1 | Custom role with exactly **`storage.objects.get`** | The **private bucket only** | The gate calls `get_blob()` and reads the object. That is all. |
| 2 | Custom role with **`datastore.entities.get`** (add `datastore.databases.get` if the client requires it to connect — infra to verify) | Project (see caveat) | One document read per request: `members/{email}`. |
| 3 | Firebase Auth: **`firebaseauth.users.get`** (for `check_revoked`) and the permission backing Identity Toolkit `createSessionCookie` | Project | Minting and verifying session cookies. |

**On grant 1 — do not use `roles/storage.objectViewer`.** It is the obvious
choice and it is too wide: it includes **`storage.objects.list`**, which would
let the gate enumerate every private object name. Enumeration is exactly the
capability ADR-0007 decision 4 spent a phase bounding, and this is the phase
where the names being enumerated are private. A custom role is also the house
precedent (`infra/satellite-role.tf`). Note the gate needs **no
`storage.buckets.get`**: `client.bucket()` constructs a reference without a
metadata read (commented in `app/serve.py`).

**On grant 2 — Firestore IAM cannot be scoped to a collection.** It is
database-level. There is no way to grant "read `members/` only" through IAM;
Security Rules do that, and they govern client SDKs, not the Admin SDK. So the
honest minimum is database-wide read, and the containment argument is that the
database holds only the allowlist (and, from Phase 4, shares). Worth stating
explicitly rather than implying a tighter boundary than exists.
**Phase 3 needs read only.** The infra contract's D2 says "read and write
Firestore"; the gate does not write in Phase 3 — there is no member management
and no share minting. Write becomes necessary in Phase 4 for `shares/{token}`.
Grant read now. **Infra's delivered `gate.tf` grants `roles/datastore.user`**,
which is read *and* write over the whole database — see SD-3.

**On grant 3 — the one I could not pin down alone, now resolved by cross-check.**
The predefined fallback is `roles/firebaseauth.admin`, which works but is
**considerably broader than needed: it can create and delete users.** I could not
verify the granular permission string without cloud access. The infra stream
reached the same question independently and names the permission
**`firebaseauth.users.createSession`**, alongside `firebaseauth.users.get` for
the `check_revoked` lookup. Infra's delivered `gate.tf` grants
`roles/firebaseauth.admin` today and records the intended tightening as a
Checkpoint 4 item: confirm with `gcloud iam list-testable-permissions` that
`firebaseauth.users.createSession` is custom-role eligible, and if so replace the
predefined role with a custom role holding exactly it — the same move Phase 2
made for the satellite role. **Both streams agree this is a known over-grant,
recorded rather than silent.** Verifying it is the single most valuable IAM
action at Checkpoint 4.

**Explicitly NOT granted** (the `deploy.tf` precedent of stating omissions):

- **No `storage.objects.list`** — the gate never enumerates.
- **No `storage.objects.create` / `.delete`** — the gate never writes to the
  private bucket. The hub's deploy identity performs the destructive sync
  (ADR-0010 decision 5); that is a different identity.
- **No `storage.buckets.get`**, and nothing at all on the **content** bucket.
- **No Firestore write** in Phase 3.
- **No `iam.serviceAccounts.signBlob`.** Worth stating because it is a common
  reflex for anything involving token minting: `createSessionCookie` is a
  server-side Identity Toolkit call and Google signs the cookie. The gate never
  calls `create_custom_token`, which is the operation that would need signing.
- **No `run.*`, no `artifactregistry.*`** — those belong to the deploy identity.

### B. The DEPLOY identity used by `gate.yml` (`vars.GCP_GATE_DEPLOY_SA`)

**Not the Phase 1 `GCP_DEPLOY_SA`.** I had expected to extend the hub deploy
identity; infra did something better and gave the gate its **own** deploy service
account (`gate-deploy`), so a gate deploy cannot touch Hosting and a site deploy
cannot touch the gate. `gate.yml` authenticates as it. Its grants, each on the
narrowest resource:

- **`roles/artifactregistry.writer`** on the gate's Artifact Registry repository
  only (push the image).
- **`roles/run.developer`** on the `hub-gate` service only (update the image;
  also covers the `services describe` the smoke test does). Deliberately **not**
  `roles/run.admin`, which includes `setIamPolicy` and could therefore change the
  invoker policy — the one control ADR-0004 rests on.
- **`roles/iam.serviceAccountUser` on the gate's RUNTIME service account only**,
  not at project level. I had flagged this as "try without it"; infra granted it,
  which is correct — Cloud Run requires `actAs` on the service identity to roll
  out a revision that runs as it.
- It holds **nothing** on the private bucket or Firestore: a deploy pipeline has
  no business reading private content or the allowlist.

### C. What the gate needs at runtime beyond IAM (open question (a))

- An **attached service account** on the Cloud Run service
  (`--service-account`). The gate calls
  `firebase_admin.initialize_app(credentials.ApplicationDefault())`, which reads
  tokens from the **metadata server**.
- **`GOOGLE_CLOUD_PROJECT` set explicitly on the service.** Cloud Run does *not*
  reliably set it (unlike App Engine and Functions), and the Admin SDK needs a
  project id to resolve. The gate also accepts `GATE_PROJECT_ID`. This is a
  small thing that produces a confusing startup failure if missed.
- **`GATE_PRIVATE_BUCKET`** — the service refuses to start without it
  (verified above, exit 1), rather than starting and 404-ing everything.
- **No key file, and none is possible.** Confirmed by construction: the only
  credential path is ADC, and the one operation that would require private key
  material (`create_custom_token`) is not used. Nothing in `gate/` or
  `gate.yml` reads a secret — `gate.yml` references `vars.*` only and
  `secrets.*` appears zero times in it.

---

## Assumptions

1. **`dist-private` syncs to the private bucket root** with no prefix (SEAM-1),
   so `GATE_PRIVATE_PREFIX` defaults to empty. A prefix is supported and tested
   if the site stream decides otherwise.
2. `/p/<path>` maps to `<path>` within `dist-private` — the gate serves the
   private build, not a rewritten namespace.
3. **Existence of `members/{email}` is membership.** The `role` field is not
   consulted in Phase 3; `role: owner` gates share management, which is Phase 4.
4. The site stream's sign-in page obtains the Firebase ID token and POSTs it;
   the gate owns only `/session` (SEAM-2).
5. Cloud Run terminates TLS and the gate is always reached over HTTPS, so a
   `Secure` cookie is always returned.
6. Directory-style requests should serve `index.html` (`/p/phd/milestones/` →
   `phd/milestones/index.html`), as a static build requires.

---

## Recommendations

1. **Verify `firebaseauth.users.createSession` is custom-role eligible at
   Checkpoint 4** and replace `roles/firebaseauth.admin` with a custom role if it
   is. Both streams flag this as the one known over-grant; today the gate's
   runtime identity can create and delete users.
2. **Grant the runtime SA Firestore read, not read/write**, in Phase 3 — SD-3,
   confirmed against `infra/gate.tf`.
3. **Decide the sign-out question** (SD-4). The gate deliberately has no
   `DELETE /session`; a 14-day HttpOnly cookie currently has no in-band way to
   be cleared.
4. **Tell the site stream the `/session` response contract** (SD-5) and the
   **filename constraint on `dist-private`** (SD-7). Both are cross-stream and
   neither is in the seams document.
5. **Revisit `GATE_CHECK_REVOKED` after Checkpoint 4** with real latency
   numbers. It is on by default and it is the right default; it may prove
   expensive per page (see Risks).
6. Keep `GATE_LOG_OBJECT_PATHS` **off**. An object path under `/p/**` is a
   private slug, and Cloud Logging has a wider audience than the allowlist.

---

## Alternatives considered

**302 to `/signin` instead of 404 for unauthenticated `/p/**`.** Rejected; see
open question (b). Better UX, and it leaks more.

**`roles/storage.objectViewer` for the gate.** Rejected: it carries
`storage.objects.list`. A custom role with one permission costs a few lines of
Terraform and removes the ability to enumerate private object names.

**Normalising paths (`os.path.normpath`) instead of an allowlist.** Rejected.
Normalisation answers "where does this resolve to", which is a filesystem
question; the bucket namespace is flat, so the real question is "is this a name
the build could have produced". An allowlist answers that one and needs no
blocked-spelling list kept complete.

**Pydantic model for the `/session` body.** Rejected: FastAPI's 422 body
includes the offending input, which here would be an **ID token** — echoed into
a response body and very likely a log. The body is parsed by hand and the
validation handler is replaced wholesale.

**Caching the allowlist lookup.** Rejected for Phase 3. A per-request Firestore
read costs latency, but it means removing someone takes effect immediately
rather than after a TTL. For a committee dossier that is the right trade;
`test_membership_is_rechecked_on_every_request` pins it.

**Minting a session for a verified non-member.** Rejected. It is defensible (a
cookie proves identity, not authorisation, and `/p/**` re-checks anyway), but
issuing a credential to someone the system will refuse is a needless artefact.
They get `{"status": "not_a_member"}` and no cookie.

**`gcloud run deploy` in the workflow.** Rejected for `gcloud run services
update --image`: `deploy` can create a service and touch its IAM, and the
invoker binding is `allUsers` **by design** and belongs to Terraform.
`services update` changes only the image and fails loudly if infra has not run
— which is SEAM-6's ordering made visible instead of implicit.

---

## Risks

1. **The real Firebase/Firestore/GCS paths are unexercised.** Every test uses a
   fake; no emulator was available (no JVM). The adapters are thin and their
   error-mapping is explicit, but Checkpoint 4 is their first real run. This is
   the largest residual risk in this stream.
2. **`check_revoked=True` costs an Identity Toolkit lookup per request**, and a
   private HTML page pulls CSS, JS, fonts and images that each hit `/p/**`. A
   page view is therefore N lookups, and an Identity Platform outage makes the
   private area unreadable rather than merely stale. On by default because
   revocation should actually revoke; flagged as an ADR candidate.
3. **A Firestore read per request** has the same amplification, with cost
   attached to a $5 budget.
4. **No rate limiting on `POST /session`.** Unauthenticated, and the service is
   reachable directly. `max-instances=3` (brief §4) bounds the spend; the body
   is capped at 8 KB and refused before being read. A determined caller can
   still force cold starts.
5. **The path allowlist could refuse legitimate output** if the private build
   emits a filename containing anything outside `[A-Za-z0-9._-]` — a space, a
   unicode slug, `(`, `@`, `+`. It would present as a 404 on one asset. See
   SD-7.
6. **Image is 230 MB**, which adds to the ~1s cold start ADR-0004 accepts.
   `grpcio`, `cryptography` and `protobuf` dominate. Not addressed; noted.
7. **The `firebaseauth` grant may end up broader than stated** if the granular
   permission does not exist (grant 3 above).

---

## Open questions — answered

### (a) What does the gate need at runtime for session cookies, and does it need a key file?

**It needs an attached service account, ADC from the metadata server, a
resolvable project id, and the three IAM grants in §A. It needs no key file, and
this is a property of the design rather than a convention.**

`create_session_cookie` is a **server-side Identity Toolkit call**: the gate
sends the ID token and Google returns a cookie it signed with a Google-managed
key. No private key material is involved, so **no `iam.serviceAccounts.signBlob`
and no JSON key**. (The operation that *would* need signing is
`create_custom_token`, which the gate never calls — worth naming, because it is
the reason people reach for a key file here.)

Verification is cheaper still: `verify_id_token` and `verify_session_cookie`
fetch **public** certificates from a public Google endpoint and need no IAM at
all. The only IAM-bearing verification step is `check_revoked=True`, which calls
`get_user` and therefore needs `firebaseauth.users.get`.

The two things easy to miss: **`GOOGLE_CLOUD_PROJECT` must be set explicitly on
the Cloud Run service** (Cloud Run does not set it), and the service account
must actually be attached — ADC on Cloud Run with no attached SA falls back to
the default compute identity, which would be both wrong and over-privileged.

### (b) Should an unauthenticated `/p/**` return 302 to sign-in, or 404?

**Recommendation: 404, with a body that offers sign-in. Implemented that way.**

*What 302 leaks.* It tells any caller that `/p/<path>` is a gated namespace.
That much is harmless — the sign-in page is public by design. The real problem
is that the natural implementation leaks far more: look the object up, redirect
if it exists, 404 if it does not, and the redirect becomes an **existence
oracle** for private slugs. Avoiding that requires deciding before any bucket
lookup, uniformly for every path — which is not what a reader of the code would
assume the redirect was for. A redirect also implies `?next=<private path>`, and
that private path **is** the private slug: it lands in browser history, in
`Referer` headers on the sign-in page, and in any logging that page does. And a
`next` parameter is an open-redirect surface that then needs its own validation.

*What 404 leaks.* Nothing — not whether an item exists, not whether the
namespace is gated. Its cost is UX: a member whose 14-day session expired gets a
bare 404 on a bookmark with no hint about what to do.

*The resolution.* Return **404 for every refusal**, so the status code carries
no information and is identical across signed-out, non-member, rejected-path and
missing-object, and identical for a real path and an imaginary one — asserted by
byte-comparison in `test_serve.py`. Put the guidance in the **body**: a
signed-out caller gets a "Sign in" page with a link; a verified non-member gets
"Not shared with you", which SEAM-3 requires and which they need in order to
know their sign-in worked. Differentiating the body is safe because by that
point the caller has proved an identity, and the body still does not vary by
path, so it is no oracle. This is GitHub's behaviour for a private repository
(404, not 403) and for the same reason.

It also satisfies SEAM-3's "not a 403 with a body, not a redirect loop"
literally: no 403, no redirect.

---

## ADR candidates

1. **The unauthenticated-response shape under `/p/**`.** 404-uniform with a
   differentiated body, decided above. Worth an ADR because the alternative
   (302) is the more obvious choice, and because the property that makes 404
   safe — deciding before any bucket lookup — is invisible in the route
   signature and easy to undo in a later refactor.
2. **Session lifetime and revocation.** 14 days (Firebase's maximum, and §6's
   figure) with `check_revoked=True` on every request. The trade is a
   per-request Identity Toolkit lookup amplified by every sub-asset of a page,
   and a hard dependency on Identity Platform availability for reading the
   private area. Someone should decide that deliberately rather than inherit my
   default.
3. **Whether the gate logs member access at all.** Implemented default: log the
   decision and the member's email; **never** the object path unless
   `GATE_LOG_OBJECT_PATHS` is set. Given that the material is a dossier naming
   and assessing real people, whether even "who read the private area, and when"
   belongs in Cloud Logging — where the audience is project log readers, not the
   allowlist — is the owner's call, not mine.

---

## Seam defects and defects in files I do not own

Reported, not fixed, per the contract and SEAM-8 — except SD-6, which was a
defect in **my own** file and is fixed.

**These were cross-checked against the infra stream's delivered Terraform**
(`infra/gate.tf`, `infra/private-bucket.tf`, `infra/private-roles.tf`,
`infra/outputs.tf`) after it landed on the branch, rather than being left as
predictions. Two predicted defects turned out to be already solved, one is
confirmed against their code, and one was a real mismatch on my side.

The convergence is worth recording: infra's `privateObjectReader` custom role
grants **exactly `storage.objects.get`** on the private bucket and explicitly
refuses `storage.objects.list` for the same enumeration reason I gave — two
streams reaching the identical minimum independently. Infra also independently
rejected `logging.logWriter`, `run.invoker`, `artifactregistry.reader` and
`iam.serviceAccountTokenCreator`, and states the same conclusion I reached for
open question (a): session cookies are minted by the Identity Toolkit service,
not signed locally, so no signing grant and no key are needed.

**SD-1 — Terraform and `gate.yml` both own the Cloud Run image. RESOLVED; no
action needed.** I predicted that the next `terraform apply` after a gate deploy
would silently roll the gate back to the Terraform-declared image. Infra had
already handled it: `infra/gate.tf` carries
`lifecycle { ignore_changes = [template[0].containers[0].image] }`, creates the
service with a placeholder image for the SEAM-6 bootstrap, and states the same
division of ownership from its side — "Terraform owns the service's identity,
scaling, ingress, env vars and IAM; gate.yml owns the image, and nothing else."
My workflow respects it: it passes neither `--set-env-vars` nor
`--service-account`, which infra's comment correctly calls a defect rather than
a workaround. Recorded because the failure mode is a **green apply with no
error**, so a future change removing `ignore_changes` would be invisible.

**SD-2 — `gate.yml` cannot run before infra has applied.** `gcloud run services
update` fails if `hub-gate` does not exist. This is deliberate (SEAM-6's
ordering, made loud rather than implicit), but it means the first gate deploy is
blocked on the infra apply, and the workflow will show a red run if merged
first. Sequencing note for Checkpoint 4, not a defect to fix.

**SD-3 — the gate's Firestore grant is wider than Phase 3 needs. CONFIRMED
against delivered code; still open.** The infra contract's D2 says the runtime SA
needs to "read and write Firestore", and `infra/gate.tf` implements that as
`roles/datastore.user` at **project level** — read *and* write over the whole
database. In Phase 3 the gate only ever reads one document per request: there is
no member management and no share minting, and nothing in `gate/` calls a
Firestore write. Write becomes necessary in Phase 4 for `shares/{token}`.

The practical consequence: a flaw in the gate today could **modify or delete the
allowlist**, not merely read it. Recommend a read-only custom role
(`datastore.entities.get`, plus `datastore.databases.get` if the client needs it
to connect) for Phase 3, widened to `roles/datastore.user` when Phase 4 actually
needs writes. Caveat that limits how much this buys: **Firestore IAM cannot be
scoped to a collection** — it is database-level, and Security Rules (which govern
client SDKs, not the Admin SDK) are the only per-collection control. So this
narrows the *verbs*, not the *reach*. Infra's call, since it is their file.

**SD-4 — there is no way to sign out, and nothing in the phase notices.** §6
responsibility 1 specifies minting only, and the roadmap lists no sign-out, so I
did not build `DELETE /session` (scope discipline: "do not build, do not stub").
The consequence is that a 14-day `HttpOnly` cookie has **no in-band way to be
cleared** — a member on a shared machine cannot sign out, and clearing a session
requires the owner to revoke refresh tokens out of band. I believe this is a
genuine gap rather than a deliberate omission, and it is the Lead Architect's
call whether it lands as a Phase 3 follow-up or a Phase 4 item.

**SD-5 — the `/session` response contract is not written down anywhere, and the
site stream needs it.** SEAM-2 specifies only `{"idToken": "<jwt>"}` in,
`Set-Cookie: __session=...` out, "and a JSON error body otherwise". I fixed the
shapes as below; the sign-in page must match them and cannot infer them:

| Case | Status | Body | Cookie |
|---|---|---|---|
| Member | 200 | `{"status":"ok"}` | `__session` set |
| Verified non-member, or unverified email | 200 | `{"status":"not_a_member"}` | none |
| Expired / invalid / malformed token | 401 | `{"status":"invalid_token"}` | none |
| Bad JSON, missing `idToken` | 400 | `{"status":"invalid_request"}` | none |
| Body over 8 KB | 413 | `{"status":"invalid_request"}` | none |

**SD-6 — a real variable mismatch between `gate.yml` and infra's outputs. FOUND
AND FIXED in `gate.yml` (my file).** I first wrote the workflow against invented
variable names, before infra's Phase 3 outputs existed. When they landed they
disagreed in two ways that would each have failed the first deploy:

| I had | Infra exports | Resolution |
|---|---|---|
| `GCP_ARTIFACT_REPO` (bare repo name; workflow built the host) | `GCP_ARTIFACT_REGISTRY` (full path, no tag) | Workflow now consumes the full path and derives the Docker host from its first segment |
| `GCP_DEPLOY_SA` (the Phase 1 **hub** deploy SA) | `GCP_GATE_DEPLOY_SA` (a dedicated gate deploy SA) | Workflow now authenticates as the gate's own identity |

The second was the more serious: the hub deploy SA has no
`artifactregistry.writer` on the gate repository and no `run.developer` on the
service, so the deploy would have failed on permissions — and "fix it by granting
hub-deploy more" is exactly the wrong repair, since the two identities are
separate on purpose. `GCP_GATE_SERVICE` and `GCP_GATE_REGION` are now consumed
too, defaulting to `hub-gate` / `us-east1` so an unconfigured repository still
behaves. Verified: the set of `vars.*` the workflow reads is now a subset of what
infra exports. The gate needs no `GCP_PRIVATE_BUCKET` workflow variable — the
bucket reaches the service through its Terraform-managed env block.

Worth noting as process, not blame: both sides invented names in parallel and the
mismatch was only caught because the seam was re-checked against delivered code
rather than against the seams document, which names none of these variables.

**SD-7 — an undocumented constraint on `dist-private` filenames, owned by the
site stream.** The gate's path allowlist accepts `[A-Za-z0-9._-]+` per segment.
Any private build output containing a space, a unicode character, `(`, `@`, `+`
or `~` in a path will 404 — presenting as one broken asset on an otherwise
working page, which is an annoying thing to debug. Astro's default output
satisfies this; a hand-named PDF such as `Jason CV (2026).pdf` would not. Either
the site stream guarantees the character set, or I widen the allowlist — but it
should be a decision, not a discovery.

**SD-8 — one roadmap acceptance criterion cannot be fully met this phase.**
"A gate test asserts that no `/p/**` **or `/s/**`** response carries `public` or
`s-maxage`" — the `/s/**` half is unsatisfiable because `/s/**` does not exist
until Phase 4. The `/p/**` half is met. Flagging so it is recorded as
*deferred* rather than silently ticked.

---

## Acceptance criteria

Roadmap §phase-3-private-area, criteria naming the gate.

| Criterion | Status |
|---|---|
| Seeded member signs in and sees tracker + dossier | **Checkpoint 4** — needs cloud and the site's sign-in page. Gate half covered by `test_member_reads_the_tracker` / `_the_dossier`. |
| Signed out, `/p/` returns no private content | **Met.** `test_signed_out_gets_no_private_content` (both transports); also observed on the real container (404). |
| Signed-in non-member gets "not shared with you", no content | **Met.** `test_non_member_gets_not_shared_with_you`. |
| Same requests direct to `*.run.app` refused the same way | **Met locally** via the `direct` transport on every authorisation test; `gate.yml` re-asserts it against the live URL on every deploy. Live proof at Checkpoint 4. |
| Session persists across page loads through Hosting (`__session`) | **Checkpoint 4** for the live half. Locally the `hosting` transport strips every other cookie and the member is still served. |
| Every `/p/` response carries `Cache-Control: private, no-store` | **Met.** `test_every_private_response_is_private_no_store` over 7 outcome classes × 2 transports; observed on the real container. |
| A test asserts no `/p/**` or `/s/**` response carries `public` / `s-maxage` | **Met for `/p/**`**; `/s/**` **deferred to Phase 4** (does not exist) — SD-8. |
| Gate pytest suite passes in CI, covering mint/verify, non-member, traversal | **Met locally** (204 passed). CI wiring delivered in `gate.yml`; first green CI run at Checkpoint 4. |
| Gate SA can read only the private bucket and Firestore | **Infra implements**; the minimum grant is stated above. Verified at Checkpoint 4. |
| Gate deploy authenticates through WIF only, no JSON key | **Met by construction.** `gate.yml` uses `google-github-actions/auth` with WIF; `secrets.` appears zero times in it. |

Definition of Done (canon §Implementation Work): approved issue (#24) ✔;
relevant ADRs exist (0004, 0010) ✔; tests and validation included ✔;
documentation updated (`gate/README.md`) ✔; security/privacy impacts documented
(this handoff) ✔. **Code reviewed through PR** and **memory bank** remain with
the Lead Architect.

---

## Related documents

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, 2, 3, 6, 8, 9
- `llm/sprints/2026-09-hub/contracts/gate-phase-3.md`
- `llm/specs/2026-09-10-research-hub-design.md` §6, §7, §8, §9, §12
- `llm/master-roadmap.md` §phase-3-private-area
- `gate/README.md`
