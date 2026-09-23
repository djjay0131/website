# Red Team — Wave 0 (sprint 2026-09-hub)

**Did anything succeed? YES.**

- Five of eight attacks landed. None reached **phd-milestones** private content — every path to it
  refused. The one piece of private-*designated* material reachable from the public internet is
  **`cv/anthropic-fellow`**, which is the already-recorded **D6.6 / RT-10**, *not* a new Incident A1
  (it is the owner's own CV variant, public by design until D8 designated it private 2026-09-18).
  I did **not** quote any private bytes anywhere.
- **New this round on D6.6:** anthropic-fellow is reachable on **three more origins than the record lists** —
  `cusati-hub.web.app`, `cusati-hub.firebaseapp.com`, and the **GitHub Pages mirror**
  `djjay0131.github.io/website/…` (an independent build path the hub's allowlist fix may not gate).
  See attack #7 — read it before closing D6.6, because the designed fix targets one of five surfaces.

## Immediate attention (read first)

1. **#7 — `cv/anthropic-fellow` has five reachable origins, not two.** The Wave 0b fix (hub publish
   allowlist) governs the Firebase `dist-public` build. It does **not** obviously govern the GitHub
   Pages mirror, which is `public: true`, built from `main` by its own workflow, and currently serves
   the same PDF and HTML. Fixing the Firebase build alone leaves `djjay0131.github.io/website/pdfs/anthropic-fellow.pdf`
   live. The `.web.app`/`.firebaseapp.com` Firebase default domains are a second uncovered class.
2. **#1 — an anonymous caller can forge Cloud Monitoring metrics** via the live, unauthenticated
   `POST /client-events`. Both log-based metrics (`hub-gate-denials`, `hub-signin-failures`) match
   attacker-controlled text. This is live in production now.
3. **#6 — the private bucket has more readers than the two ADR-0010 claims.** The default compute SA
   `410552878319-compute@` holds `roles/editor` → `projectEditor:cusati-hub` → `legacyObjectOwner`
   (read+write) on `gs://cusati-hub-private`. Distinct from A12/#49 (which is about the *gate* SA).

---

## Results table

| # | Position | Attack | Verdict | Evidence |
|---|----------|--------|---------|----------|
| 1 | Public internet, unauth | Forge log-based metric counts via `POST /client-events` | **succeeded** | Both metric filters matched my injected lines in Cloud Logging |
| 2 | Non-browser caller on `*.run.app` (public / compromised) | Bypass `/session/end` Origin/CSRF check with forged `X-Forwarded-Host` | **succeeded** (mechanism; nuisance today, load-bearing in Phase 4) | Local run of PR #47 route: cases 4 & 5 return 200 + Set-Cookie |
| 3 | Public internet | Two-transport `..` divergence on `/p/**`; internal-origin hostname leak | **succeeded** (info leak) / inconclusive (bypass, inert today) | Hosting 302 `Location` leaks `content-*-firebasehosting-origin.googleapis.com` and strips `/p/` |
| 4 | Public internet | Build a `/p/` existence oracle (timing / size / headers, real vs fake slug) | **refused** | Identical `404 / 426b`, timing within noise, with and without a garbage cookie |
| 5 | Compromised satellite (`cv`) | Reverse leg: READ / LIST / overwrite `sources/phd-milestones/` | **refused** (IAM analysis; live run is boundary-tester #50) | `satellitePublisher` = get/create/delete, **no list**, bound with `startsWith(.../sources/cv/)` condition |
| 6 | Mistake in build / compromised identity | Enumerate real readers of the private bucket | **succeeded** | Default compute SA has `roles/editor`; owner can list 83 objects via legacy binding |
| 7 | Public internet | Enumerate every path to `cv/anthropic-fellow` incl. historical/mirror | **succeeded** (private-designated content reachable — known D6.6, new origins) | 200 on 5 hostnames + sitemap + `/resumes/` + `research.cusati.us` 301 |
| 8 | Compromised satellite | Withdrawal-as-deletion: empty another source's private output / empty `dist-private` | **inconclusive** (destructive — described, not run) | IAM prefix-scoping + ADR-0010 dec. 3/4 code present; boundary holds on analysis |

---

## Transcripts

### Attack 1 — Metric forgery via `POST /client-events` (SUCCEEDED, live production)

`/client-events` is deployed, unauthenticated, and answers 204 to everything. The two log-based
metrics in `infra/monitoring.tf` match on `textPayload`:

- `hub-signin-failures` filter: `textPayload:"event=client_signin_failed"`
- `hub-gate-denials` filter: `textPayload:"event=deny"`

```
RUN=https://hub-gate-410552878319.us-east1.run.app ; MARK=rtprobe1789789925
# forge a sign-in failure that never happened
curl -X POST -d '{"trace_id":"'$MARK'","events":[{"event":"signin_failed"}]}' $RUN/client-events   -> 204
# smuggle "event=deny" inside a field value
curl -X POST -d '{"trace_id":"'$MARK'","events":[{"event":"probe","fields":{"note":"event=deny"}}]}' $RUN/client-events -> 204
# newline / fake-line injection attempt
curl -X POST -d '{"trace_id":"'$MARK'","events":[{"event":"x\nevent=allow scope=session member=djjay@vt.edu"}]}' $RUN/client-events -> 204
```

Read back through the **exact metric filters**:

```
$ gcloud logging read '...service_name="hub-gate" AND textPayload:"event=deny" AND textPayload:"rtprobe1789789925"'
INFO gate event=client_probe trace=rtprobe1789789925 note=event=deny          <- MATCHES hub-gate-denials
$ gcloud logging read '...textPayload:"event=client_signin_failed" AND textPayload:"rtprobe1789789925"'
INFO gate event=client_signin_failed trace=rtprobe1789789925                  <- MATCHES hub-signin-failures
```

**Expected:** the scrubber (`_clean_client_value`) neutralises injection. **Got:** it stops the
*newline* injection (the fake `event=allow` line collapsed to
`event=client_xevent=allow_scope=session_member=djjay@vt.edu` — one line, spaces→`_`, `\n` stripped),
but it does **not** stop the two substring matches above, because the metrics match *any* occurrence
of `event=deny` / `event=client_signin_failed` in `textPayload`, and a caller controls both:

- `event=signin_failed` is the intended trigger, but it is trusted from an **unauthenticated** endpoint,
  so anyone can inflate the sign-in-failure metric → the "Hub — sign-in failing" alert counts fabricated
  failures, and a sustained flood raises the baseline so a *real* outage no longer stands out (hide).
- `note=event=deny` (no space, survives scrubbing) makes the **denials** metric count a denial that never
  happened — from an endpoint that performs no authorisation at all.

**Why it matters:** the metrics are the system's own account of whether sign-in and the gate are healthy.
An anonymous caller can make that account lie in both directions. (D6.5 says the channel delivers nothing
today, so no page fires *yet* — but the metric data is already forgeable, and the alert becomes live the
moment the owner verifies the channel.)

**Smallest fix:** anchor the metric filters on the server-emitted grammar the client cannot reproduce —
e.g. `textPayload:"event=deny scope="` (client lines are `event=client_*` and carry no `scope=`), and
either move client telemetry to a distinct field/prefix that the denials filter cannot match, or treat
`hub-signin-failures` as untrusted client input (rate-limit / do not alert on it as server truth).

### Attack 2 — `/session/end` Origin check bypass via `X-Forwarded-Host` (SUCCEEDED, mechanism)

The route is not deployed yet (live `POST /session/end` → uniform 404), so I ran PR #47's actual
`gate/app/main.py` through Starlette's TestClient. `_same_origin` compares the `Origin` netloc against
the union of `Host` and every comma-split `X-Forwarded-Host`, **with nothing configured**.

```
1 no Origin                                             -> 403  (fails closed — good)
2 Origin=host  (legit browser same-origin)             -> 200 + Set-Cookie
3 Origin=evil, host=real, no XFH (real cross-site POST) -> 403  (CSRF check works for a browser)
4 Origin=https://evil.example + X-Forwarded-Host: evil.example  -> 200 + Set-Cookie   <-- BYPASS
5 Origin=evil + X-Forwarded-Host: "jason.cusati.us, evil.example" -> 200 + Set-Cookie <-- BYPASS
6 Origin=http://... (downgrade)                          -> 403  (good)
```

**Expected:** a cross-origin POST is refused. **Got:** any caller who sets `Origin` **and**
`X-Forwarded-Host` to the same value passes. On the direct `*.run.app` transport (invoker `allUsers`,
ADR-0004) the caller controls every header, so the CSRF check provides **zero** protection there — which
is exactly the property ADR-0004 says must hold as strongly as through Hosting.

**Why it matters (and its limit):** for sign-out *today* the impact is a nuisance only — a non-browser
attacker has no victim cookie to clear and a real browser cannot set `X-Forwarded-Host` cross-site
(the code's own argument, and it holds). But the code comment states Phase 4's **mint and revoke** POSTs
go "behind the same helper." A CSRF defence that is void on the `*.run.app` transport is the wrong
template to carry into routes that change authenticated state. This is the same forgeable branch G-7
already flagged.

**Smallest fix:** delete the `X-Forwarded-Host` branch and compare `Origin` against a single configured
canonical host (or `Host` alone once P6 confirms which header Hosting sets). G-7 estimates three lines.

### Attack 3 — Two-transport `..` divergence + internal-hostname leak (SUCCEEDED info-leak)

Encoded traversal on `/p/**`, `--path-as-is`, no follow, comparing Hosting vs direct `*.run.app`:

```
[302] https://jason.cusati.us/p/..%2f..%2fsecret
      -> location: https://hub-gate-ywkmredngq-ue.a.run.app/secret
[302] https://jason.cusati.us/p/%2e%2e/%2e%2e/x
      -> location: https://content-prod01-firebasehosting-origin.googleapis.com/x
[302] https://jason.cusati.us/p/foo/%2e%2e/bar
      -> location: https://content-firebasehosting-origin.googleapis.com/p/bar
[404] https://hub-gate-410552878319.../p/..%2f..%2fsecret        (gate's uniform 404, 426b)
[302] https://hub-gate-410552878319.../p/%2e%2e/%2e%2e/x  -> .../x
```

**Expected:** the two transports treat a crafted `/p/` path identically. **Got:** they diverge, and the
Hosting-layer redirect **leaks internal origin hostnames** (`content-prod01-firebasehosting-origin.googleapis.com`,
`content-firebasehosting-origin.googleapis.com`) and re-writes the path — collapsing `..` and stripping
`/p/`, sometimes pointing the request at the **static hosting origin** rather than the gate rewrite.

**Why it matters:** today it is inert for privacy — the normalisation moves *away* from the gate
(`/p/…/../…` resolves to a shorter path outside `/p/**`), and following it lands on a 404. The private
bucket is never reached. But (a) the internal-hostname disclosure is a real minor infoleak, and (b) this
is the D6.2/RT-6 divergence the record already flags as "load-bearing in Phase 4": routing/gate decisions
are being made on a path the gate never validates. Verdict is **succeeded** for the leak,
**inconclusive** for a bypass (no servable target exists behind it today).

**Smallest fix:** the leak is Firebase Hosting's default 302-on-normalise behaviour; suppress the
redirect for `/p/**` (serve the gate's uniform 404 instead of a normalising redirect), or accept it and
record D6.2 as the standing Phase-4 gate.

### Attack 4 — `/p/` existence oracle (REFUSED)

```
run.app /p/phd-milestones/tracker/index.html          -> 404 426b t=0.152
run.app /p/phd-milestones/committee-dossier/index.html-> 404 426b t=0.112
run.app /p/nonexistent-source/nope/index.html         -> 404 426b t=0.106
run.app /p/cv/anthropic-fellow/index.html             -> 404 426b t=0.128
# with a garbage __session cookie: identical 404 / 426b
```

**Expected:** maybe a real private slug behaves differently from a fake one. **Got:** byte-identical
status and body, timing within noise, for real-private vs nonexistent vs garbage-cookie. The gate refuses
at the *session* stage before it ever consults the path validator or the bucket (confirmed by reading
`serve_private` order in `main.py`), so there is nothing downstream to time or size. C29 holds for an
unauthenticated caller; no oracle. *(A member-authenticated oracle — real-object vs missing-object timing
behind a valid cookie — is not testable here: no member credential exists, by design.)*

### Attack 5 — Reverse satellite leg, `cv` → `phd-milestones` (REFUSED, IAM analysis)

I hold no `cv` credential and may not impersonate (RoE), so this is a policy proof, not a live run
(live run is boundary-tester #50 under the temporary grant). From the live IAM:

```
role satellitePublisher = storage.objects.create, storage.objects.delete, storage.objects.get   (NO list)
gs://cusati-hub-content:
  publish-cv@  satellitePublisher  COND: resource.name.startsWith('.../objects/sources/cv/')
  publish-phd-milestones@ satellitePublisher COND: startsWith('.../objects/sources/phd-milestones/')
```

- **READ** `sources/phd-milestones/*`: needs `objects.get`; `publish-cv@` has it only where
  `resource.name` starts with `sources/cv/` → a get on a `phd-milestones` object fails the condition → denied.
- **LIST**: `satellitePublisher` carries no `storage.objects.list` at all → denied (and `list` cannot be
  prefix-scoped anyway — ADR-0007 dec. 4, the reason it is withheld).
- **Overwrite** `sources/phd-milestones/manifest.json`: `objects.create` under the same `sources/cv/`
  condition → denied.

The boundary holds on policy. **What would settle it live:** boundary-tester #50 executing get/list/create
against `sources/phd-milestones/` as `publish-cv@` and observing 403 — the IAM-condition evaluation at
request time is the one thing static analysis cannot fully guarantee.

### Attack 6 — Private-bucket reader set is wider than "two principals" (SUCCEEDED)

ADR-0010 (amending design §6 req. 3) says the private bucket "carries exactly two principals." Live IAM:

```
gs://cusati-hub-private:
  hub-gate@              -> privateObjectReader (objects.get)          [intended reader]
  hub-deploy@            -> privateSyncWriter (get/create/delete/list) [intended writer]
  projectOwner:cusati-hub  -> legacyObjectOwner   (read+write)
  projectEditor:cusati-hub -> legacyObjectOwner   (read+write)
  projectViewer:cusati-hub -> legacyObjectReader  (read)
project IAM: roles/editor -> serviceAccount:410552878319-compute@developer.gserviceaccount.com
             roles/owner  -> user:djjay0131@gmail.com
```

Effective readers/writers of the private bucket today: `hub-gate` (intended), `hub-deploy` (intended),
the **owner** (acceptable), and the **default compute SA `410552878319-compute@` which holds
`roles/editor`** → is a `projectEditor` → has `legacyObjectOwner` (read *and* write) on every private
object. Proof the legacy bindings are live and grant real read:

```
$ gcloud storage ls --recursive gs://cusati-hub-private/**   # as djjay0131 (roles/owner)
   -> 83 objects reachable   (names withheld — private slugs)
$ curl https://storage.googleapis.com/storage/v1/b/cusati-hub-private/o?... (anonymous) -> HTTP 401  (not public — good)
```

**Why it matters:** the default compute SA is the identity any Cloud Run/Function/build step silently
runs as if none is specified. It is a standing, broad, un-scoped reader **and writer** of the private
bucket — larger blast radius than A12/#49 (which narrows the *gate* SA). Not anonymously reachable today,
so no live leak; the exposure is the unintended principal.

**Smallest fix:** strip `roles/editor` from the default compute SA (or bind a minimal runtime SA to every
workload and remove the default), and set `publicAccessPrevention=enforced` + `uniformBucketLevelAccess`
on `gs://cusati-hub-private` to retire the `legacy*` ACL bindings entirely.

### Attack 7 — `cv/anthropic-fellow`: every reachable path (SUCCEEDED — private-designated, public)

This is the recorded **D6.6 / RT-10** (owner's own CV variant, designated private 2026-09-18; not A1).
My job was to find *every* surface. It is reachable on **five distinct origins** plus derived outputs:

```
200 57915b application/pdf   https://jason.cusati.us/pdfs/anthropic-fellow.pdf
200 21032b text/html         https://jason.cusati.us/cv/anthropic-fellow/  (and /index.html)
200                          named + linked on https://jason.cusati.us/resumes/
200                          present in https://jason.cusati.us/sitemap-0.xml (1 hit)  [crawlable]
301 -> jason.cusati.us/...   https://research.cusati.us/cv/anthropic-fellow/ , /pdfs/anthropic-fellow.pdf
200                          https://cusati-hub.web.app/pdfs/anthropic-fellow.pdf , /cv/anthropic-fellow/
200                          https://cusati-hub.firebaseapp.com/pdfs/anthropic-fellow.pdf
200                          https://djjay0131.github.io/website/pdfs/anthropic-fellow.pdf , /cv/anthropic-fellow/
# not present: /rss.xml, /index.json, /search.json (404)
```

(I fetched only status/size/content-type — the PDF and HTML bodies went to `/dev/null`; I did not read
the content.)

**New beyond the record:** the record lists only `jason.cusati.us`. The **GitHub Pages mirror**
(`gh api repos/djjay0131/website/pages` → `public: true`, `build_type: workflow`, `source.branch: main`,
`html_url: https://djjay0131.github.io/website/`) is an **independent build path**, and the two Firebase
default domains (`.web.app`, `.firebaseapp.com`) are a second class. The Wave 0b designed fix — the hub
publish allowlist — governs the Firebase `dist-public` build. It does **not** obviously govern the Pages
workflow build, and cannot govern the Firebase default domains except by disabling them.

**Smallest fix:** (1) apply the allowlist/leak-check to the **GitHub Pages** workflow too (or retire the
Pages mirror early — Phase 6 already plans to); (2) the owner's stopgap (flip the item to
`visibility: private` in the `cv` satellite) fixes the Firebase builds on the next poll but still leaves
the Pages mirror unless (1) is done; (3) note that `.web.app`/`.firebaseapp.com` cannot be removed —
only the object can, via the allowlist filtering the payload.

### Attack 8 — Withdrawal as deletion (INCONCLUSIVE — destructive, described not run)

The private sync (`hub-deploy@` = `privateSyncWriter`, has `objects.delete`+`list`) deletes destination
objects the current build did not produce (ADR-0010 dec. 5). I did **not** run this: proving it requires
causing a deletion against production, which RoE forbids.

**Attack A — compromised `cv` deletes `phd-milestones`' private output.** Expectation: **refused.**
`publish-cv@` can write only under `sources/cv/` (attack #5), each source's private output derives from
*its own* manifest, and the sync deletes only within `dist-private`. `cv` cannot author `phd`'s manifest
and cannot place bytes under `phd`'s prefix, so it cannot make the build omit `phd`'s objects.

**Attack B — compromised satellite forces an empty `dist-private`.** Expectation: **refused for a fault,
allowed for a legitimate self-withdrawal.** ADR-0010 dec. 3 (missing manifest = build fault) and dec. 4
(`required: true` source with an entirely-absent prefix = build fault) are **present in the code**:
`site/src/lib/hub-content.mjs` carries `phd-milestones … required: true` (flipped 2026-09-18, the D6.1
fix) and a fail-closed provenance-marker check (`sync-content.sh` writes `complete:` on every run into a
from-scratch-rebuilt tree; an absent/unrecognised marker *enforces*). So a partial/failed sync fails
loudly rather than silently emptying the private area. A satellite emptying **its own** items via an
empty `items[]` array is a *legitimate* withdrawal by design (dec. 2), not an attack.

**What would settle it:** boundary-tester #50 (or a staging bucket) running the five withdrawal
signatures ADR-0010/SP-3 enumerate — in particular the empty-`items` vs missing-manifest pair — and
confirming the build fails before the destructive sync on the fault cases. On analysis the claim in
target #3 holds; I cannot mark it `succeeded`/`refused` without a non-destructive live run.

---

## Summary

Eight attacks from all six named positions; five landed. **No path reached `phd-milestones` private
content** — the gate's session-first ordering, the strict allowlist path validator, and the prefix-scoped
satellite IAM all held. The genuine wins are: (1) an unauthenticated caller can forge both monitoring
metrics against live production; (2) the `/session/end` CSRF check is void on the `*.run.app` transport
and is the template for Phase 4's state-changing POSTs; (3) the private bucket has an unintended broad
principal (default compute SA with Editor); and (4) the private-designated `cv/anthropic-fellow` is
reachable on three origins beyond what D6.6 records, including an independent GitHub Pages build the
designed fix may not cover. The refusals (existence oracle, reverse satellite leg) are real and worth
recording as *held*, not gaps.

## Assumptions

- Live system is pre-Wave-0: PR #47/#48/#53 are unmerged. `/session/end` is **not** deployed (404), so
  attack #2 was run against PR #47's actual code via TestClient, not the live URL. `/client-events` and
  `/p/**` **are** live (Phase 3), so #1, #3, #4, #7 are against production.
- My gcloud identity `djjay0131@gmail.com` holds `roles/owner` — used only to *read* IAM/logs/bucket
  listings for analysis. I minted nothing, granted nothing, wrote to no bucket/Firestore, deleted
  nothing. The only production side effect is three `/client-events` log lines (the endpoint's designed
  behaviour), tagged `trace=rtprobe1789789925`.
- Reverse-satellite and withdrawal verdicts are IAM+code analysis, not live execution, because I hold no
  `cv`/satellite credential and may not impersonate.

## Recommendations

1. **Metrics (attack #1):** anchor `hub-gate-denials` on `event=deny scope=` and separate the
   client-telemetry namespace from the server-decision grammar; treat `hub-signin-failures` as
   untrusted-client input (rate-limit; do not page on raw counts). *Before the channel is verified.*
2. **CSRF (attack #2):** drop the `X-Forwarded-Host` branch in `_same_origin`; compare against one
   configured canonical host. Do this **before** Phase 4 puts mint/revoke behind the same helper.
3. **Private bucket (attack #6):** remove `roles/editor` from the default compute SA; set
   `publicAccessPrevention=enforced` and `uniformBucketLevelAccess` on `gs://cusati-hub-private` to
   retire the `legacy*`/`projectViewer`/`projectEditor` read paths.
4. **anthropic-fellow (attack #7):** extend the allowlist/leak-check to the GitHub Pages workflow (or
   retire the Pages mirror now); apply the owner's `visibility: private` stopgap for the Firebase
   default domains. Verify all five origins after the fix, not just `jason.cusati.us`.
5. **Transport divergence (attack #3):** record D6.2 as the standing Phase-4 gate and suppress the
   normalising 302 for `/p/**`.

## Alternatives considered

- **Session-cookie forgery / cross-project token** (starting point #4): the gate accepts only a
  Firebase-Admin-verified `__session`; a forged/garbage cookie fails `verify_session_cookie` and lands
  in the same session-stage 404 (confirmed in attack #4). Not separately transcripted — it collapses
  into #4's oracle result. Full exercise needs a valid member session (none exists here).
- **Sign-in casing / homoglyph / plus-address / look-alike domain** (starting point #10): requires
  minting Firebase ID tokens (credential creation — forbidden by RoE). Describable only: the allowlist
  lowercases and exact-matches the token email, and `email_verified` is required, which defeats casing
  and unverified-signup; a homoglyph or look-alike-domain token is a token-issuance question, not a gate
  question. Left for a test that can mint tokens.

## Risks

- Attack #1 is live and self-service: anyone can keep the forged metric data flowing; the mitigation is
  cheap but the metrics are untrustworthy until it ships.
- Attack #7's Pages mirror means a partial fix will *look* fixed on `jason.cusati.us` while the content
  stays live elsewhere — the most likely way this gets mis-closed.
- The private bucket's missing `publicAccessPrevention=enforced` + fine-grained ACLs (attack #6) mean a
  single mistaken object ACL could make a private object public with no bucket-level backstop; currently
  latent (anon → 401).

## Open questions

- Does the GitHub Pages workflow build run the leak-check and honour `site/publish-allowlist.json`? If
  not, D6.6 cannot be closed by the allowlist alone. **(Owner / site stream.)**
- `gs://cusati-hub-private` describe returns null for `publicAccessPrevention`, `uniformBucketLevelAccess`
  and `versioning` (soft-delete = 7d is set). Is versioning actually on? ADR-0010's recovery path assumes
  it. **(Infra — confirm in console.)**
- Live confirmation of attacks #5 and #8 depends on boundary-tester #50 / a staging bucket. Are those
  runs going to happen this wave, or do these boundaries stay analysis-only?

## Related docs

- `llm/governance/adr/0004-...` (allUsers, `__session`, direct-transport parity — attacks #2, #3)
- `llm/governance/adr/0007-...` (no-`list`; prefix condition — attack #5)
- `llm/governance/adr/0010-withdrawal-semantics.md` (destructive sync, dec. 3/4/5, "exactly two
  principals" — attacks #6, #8)
- `llm/sprints/2026-09-hub/STATE.md` — C29, D6.1/D6.5/D6.6, RT-2/RT-6/RT-10, G-7, A12/#49, A13/#50
- PRs: #47 `feat/gate-signout` (#2), #48 `feat/site-wave-0` (#8), #53 `feat/infra-wave-0` (#1, #6)

## ADR candidates

- **Client telemetry is untrusted input to alerting.** Log-based metrics must match a grammar the
  unauthenticated `/client-events` endpoint cannot forge; client-reported failures are signals, not
  server truth. (From attack #1.)
- **The CSRF/Origin check must hold on the `*.run.app` transport.** No state-changing POST may rely on a
  request-supplied host header (`X-Forwarded-Host`) as its origin authority. (From attack #2; extends G-7.)
- **Private-bucket principal minimisation.** No `basic` role (`editor`/`owner`) and no default compute SA
  may retain standing access to `gs://cusati-hub-private`; `publicAccessPrevention=enforced` + UBLA are
  required. (From attack #6; adjacent to A12/#49.)
- **Public reachability is per-origin, not per-domain.** The private/publish decision must be enforced on
  every build path that serves `dist-public` — Firebase Hosting, the Firebase default domains, and the
  GitHub Pages mirror. (From attack #7; extends D6.6.)
