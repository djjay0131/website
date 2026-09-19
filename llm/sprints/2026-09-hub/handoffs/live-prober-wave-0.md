# Handoff — `Live Prober`, Wave 0

**Serving revision `hub-gate-00005-n4g`** (100% of traffic, created `2026-09-18T15:48:04Z`,
image `sha256:98c3428c…`) · **deployed site SHA `f98a928a1b92b2248b130822ba5098fb926b8898`**
(= `origin/main` tip; `build-info.json` `run_id` 35397897183) · **probes run
2026-09-19T03:49Z–03:58Z**. Revision and deployed SHA re-read at the end of the window and
were unchanged, so every result below describes one single target version.

Status: Complete
Agent: `Live Prober`
Contract: `llm/sprints/2026-09-hub/contracts/live-prober-wave-0.md`
Issue: #44 (hub-007), Wave 0

---

## Headline

1. **Every signed-out refusal is identical on all five transports I could reach.** Not two —
   five: `jason.cusati.us`, `hub-gate-ywkmredngq-ue.a.run.app`, the project-number alias
   `hub-gate-410552878319.us-east1.run.app`, `cusati-hub.web.app`, and
   `cusati-hub.firebaseapp.com`. Same 404, same 426 bytes, same `cache-control: private,
   no-store`, no existence oracle.
2. **Three transport asymmetries exist, all in the *shape* of the refusal, none leaking
   anything.** One reproduces `roadmap-truth` D6.2; **two are new** (`/p//` collapse, and HEAD).
3. **New platform finding: the `/healthz` interception is exact-path only.** `/healthz/` with a
   trailing slash *does* reach the container; `/healthz` without one has never reached it in
   24h of logs. The rule recorded in my contract and in STATE is narrower than stated.
4. **`cv/anthropic-fellow` is reachable by at least 13 distinct public paths across 4 origins**,
   including a GitHub Pages mirror with its **own sitemap** that does **not** redirect to
   `jason.cusati.us`. `roadmap-truth` D6.6 and STATE record 3 of them. This materially widens
   what a D8 fix has to cover.
5. **Wave 0's sign-out is not deployed.** `/session/end` has no Hosting rewrite and no gate
   route. Re-probe required after the Wave 0 deploy.
6. The public surface is **unchanged**: 34/34 sitemap routes 200, 10/10 `/research/**` 200, all
   Phase 1 smoke routes 200, size floors met, `content_source: "bucket"`, `research.cusati.us`
   301 preserves paths.
7. **A1, A3, A5 and the non-member half of A4 are NOT VERIFIABLE BY ME.** I hold no member
   credential and substituted nothing.

---

## A note on the 404 discrimination guide — it needs a third entry

My contract names two signatures. There are **three**, and the missing one caused me to look
twice:

| Body | Size | Signature | Who serves it |
|---|---|---|---|
| "Sign in" page | **426** | `<html lang="en">` *quoted* | **the gate**, for `/p/**` refusals |
| "Not found" page | **329** | `<html lang="en">` *quoted* | **the gate**, for every non-`/p/` route it does not have |
| "Error 404 (Not Found)" | **1568** | `<html lang=en>` *unquoted* | **Google's frontend**, request never reached the container |
| "Page Not Found" | **21376** | Firebase Hosting 404 | **the static site**, path has no Hosting rewrite |
| "Site Not Found" | **21265** | Firebase Hosting origin | `*-firebasehosting-origin.googleapis.com` |

The 329-byte page is the gate's own and is *not* a Google page despite being short. I verified
every 329 against a matching container log line.

---

## D1 — The two-transport rule: `/p/**` refusals

`H` = `https://jason.cusati.us`, `R` = `https://hub-gate-ywkmredngq-ue.a.run.app`.

```
$ for p in ...; do curl -s -o /dev/null -w "%{http_code}/%{size_download}" "$H$p"; \
                   curl -s -o /dev/null -w "%{http_code}/%{size_download}" "$R$p"; done
```

| Criterion | Path | Hosting | run.app | Verdict |
|---|---|---|---|---|
| A2 / A4 | `/p/` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/index.html` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/committee.html` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/phd/phd-milestones/milestones/index.html` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/phd/phd-milestones/committee-dossier/index.html` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/build-info.json` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/cv/anthropic-fellow/index.html` | `404/426` | `404/426` | **TRUE** |
| A2 / A4 | `/p/pdfs/anthropic-fellow.pdf` | `404/426` | `404/426` | **TRUE** |

**Not an existence oracle.** A real private object, a plausible-but-absent one, and a nonsense
path are indistinguishable:

```
/p/phd/phd-milestones/milestones/index.html      H=404/426   R=404/426   (object exists)
/p/phd/phd-milestones/DOES-NOT-EXIST/index.html  H=404/426   R=404/426   (does not)
/p/zzz/nothing.html                              H=404/426   R=404/426   (nonsense)
```

Per C29 this uniform 404 is intended; recorded, not reported as a defect.

**Three further transports, same answers.** ADR-0004's `allUsers` invoker means the canonical
`*.run.app` URL is not the only non-Hosting route in:

```
hub-gate-410552878319.us-east1.run.app/p/index.html                          404/426
hub-gate-410552878319.us-east1.run.app/p/phd/phd-milestones/committee-dossier/index.html  404/426
cusati-hub.web.app/p/index.html                                              404/426
cusati-hub.firebaseapp.com/p/index.html                                      404/426
```

The project-number hostname appears in Cloud Logging and is a fully functional second
`run.app` alias. **Any future both-transports assertion should cover it**, or it tests four
fifths of the surface.

**Headers are identical in substance on both transports:**

```
$ curl -s -o /dev/null -D- $H/p/index.html          $ ... $R/p/index.html
cache-control: private, no-store                    cache-control: private, no-store
referrer-policy: no-referrer                        vary: Cookie
x-content-type-options: nosniff                     x-content-type-options: nosniff
x-frame-options: DENY                               referrer-policy: no-referrer
vary: Cookie, x-fh-requested-host, accept-encoding  x-frame-options: DENY
content-length: 426                                 content-length: 426
```

No response carried `public` or `s-maxage` (**A6 — TRUE for every response I can elicit**;
the member-200 case remains unelicitable by me, same qualification `roadmap-truth` recorded).

**A bogus cookie is rejected on its merits, identically:**

```
$ curl -H "Cookie: __session=bogus" ... /p/index.html
hosting 404/426    runapp 404/426
# gate log: event=deny scope=private stage=session reason=invalid_session   (not no_session_cookie)
```

**Log attribution.** Every probe above produced a matching container line. Paired lines (one
for the Hosting leg, one for the direct leg) at my probe timestamps:

```
2026-09-19T03:50:29.559962Z  404  .../p/build-info.json
2026-09-19T03:50:29.445357Z  404  .../p/build-info.json
2026-09-19T03:50:29.319698Z  404  .../p/phd/phd-milestones/committee-dossier/index.html
2026-09-19T03:50:29.204385Z  404  .../p/phd/phd-milestones/committee-dossier/index.html
...
2026-09-19T03:50:28.945527Z  INFO gate event=deny scope=private stage=session reason=no_session_cookie
```

Two lines per path, at the second, for every path in the table.

---

## D2 — The three transport asymmetries

All three **refuse**, none discloses private material. They differ in *how*, which roadmap
criterion 4 ("refused the same way") makes load-bearing. Probes used `--path-as-is` throughout.

### D2.1 — Encoded traversal (reproduces `roadmap-truth` D6.2, unchanged)

```
$ curl -s --path-as-is -D- -o /dev/null <path>
                                  Hosting                                          run.app
/p/..%2fbuild-info.json           302 → hub-gate-ywkmredngq-ue.a.run.app/build-info.json   404/426
/p/%2e%2e%2fbuild-info.json       302 → hub-gate-ywkmredngq-ue.a.run.app/build-info.json   404/426
/p/..%2f..%2fetc%2fpasswd         302 → hub-gate-ywkmredngq-ue.a.run.app/etc/passwd        404/426
```

Followed to completion, Hosting's redirect lands on the gate's **329-byte "Not found"** — a
public path, no private bytes:

```
$ curl -s --path-as-is -L ... $H/p/..%2fbuild-info.json
final=https://hub-gate-ywkmredngq-ue.a.run.app/build-info.json http=404 size=329
```

**Verdict: both refuse; answers DIFFER (302 vs 404).** Unchanged from D6.2.

### D2.2 — Empty path segment `/p//` — **NEW, not in D6.2**

```
/p//build-info.json     Hosting 307 → /p/build-info.json  (final 404/426)     run.app 404/426
```

Hosting collapses the double slash and re-issues; the gate answers the collapsed path directly.
Both end at the gate's 426 refusal, but Hosting takes an extra hop the gate does not.
Related, and also new:

```
/p/....//build-info.json  Hosting 307 → /p/..../build-info.json (final 404/426)  run.app 404/426
```

**Verdict: both refuse; the answers DIFFER by one redirect.** Same class as D2.1, a form D6.2
did not test.

### D2.3 — **HEAD is answered differently, on every route — NEW**

```
$ curl -sI -o /dev/null -D- $H/p/index.html    → HTTP/2 404, content-length: 426
$ curl -sI -o /dev/null -D- $R/p/index.html    → HTTP/2 405, content-length: 329
$ curl -sI -o /dev/null -w "%{http_code}" $R/_health  → 405
```

The container log explains it exactly — Hosting converts HEAD to **GET** upstream, so the gate
never sees the Hosting HEAD; the direct HEAD reaches it and is refused as an unsupported method:

```
2026-09-19T03:53:26.994049Z  HEAD  405  .../p/index.html      ← my direct probe
2026-09-19T03:53:26.864174Z  GET   404  .../p/index.html      ← my Hosting probe, arriving as GET
2026-09-19T03:53:54.759525Z  HEAD  405  .../_health           ← the gate 405s HEAD even on health
```

**Verdict: both refuse `/p/**`; the answers DIFFER (404 vs 405).** This one is worth more than
the other two: the gate declares **no HEAD handler anywhere**, so any monitor, uptime check or
CI step that switches from GET to HEAD on `/_health` will read 405 as "the gate is down". The
current uptime check uses GET and is unaffected.

### Forms where the two transports already agree

```
/p/%2fbuild-info.json                            H=404/426  R=404/426  MATCH
/p/%2e%2e/build-info.json                        H=302/0    R=302/0    MATCH
/p/..;/build-info.json                           H=302/0    R=302/0    MATCH
/p/.%2e/build-info.json                          H=302/0    R=302/0    MATCH
/p/phd/phd-milestones/../../../build-info.json   H=302/0    R=302/0    MATCH
/p/../build-info.json                            H=302/0    R=302/0    MATCH*
```

\* Same status, **different destination**: Hosting → `content-prod0N-firebasehosting-origin.
googleapis.com/build-info.json` (final `404/21265`, "Site Not Found"), run.app → the gate
(final `404/329`). Unencoded `..` is normalised by whichever frontend sees it first. Nothing
private on either leg.

---

## D3 — Health paths, and a correction to the recorded `/healthz` rule

| Path | Hosting | run.app | alias | Reaches the container? |
|---|---|---|---|---|
| `/_health` | `404/21376` (static site 404) | **`200/15`** `{"status":"ok"}` | `200/15` | yes, direct only |
| `/_health/` | `404/21376` | `307/0` | `307/0` | **yes** |
| `/healthz` | `404/1568` | `404/1568` | `404/1568` | **never** |
| `/healthz/` | `404/21376` | **`404/329`** | `404/329` | **yes** |

Both known-correct results in my brief are confirmed exactly: `/_health` is 200 on `run.app`
and the static site's 404 through Hosting (it has no rewrite and should not have one), and
`/healthz` is Google's 1568-byte page on both transports.

**The correction.** The recorded rule is "`/healthz` is intercepted at the edge". It is
narrower than that: **the interception is exact-path.** Add a trailing slash and the request
reaches the container:

```
$ gcloud logging read '... AND httpRequest.requestUrl:"health"' --freshness=6m
2026-09-19T03:56:27.539497Z  GET  404  https://hub-gate-ywkmredngq-ue.a.run.app/healthz/
2026-09-19T03:56:27.409131Z  GET  404  https://hub-gate-ywkmredngq-ue.a.run.app/healthz/
2026-09-19T03:56:26.597155Z  GET  404  https://hub-gate-410552878319.us-east1.run.app/healthz/
2026-09-19T03:56:26.483548Z  GET  404  https://hub-gate-ywkmredngq-ue.a.run.app/healthz/

$ gcloud logging read '... httpRequest.requestUrl="https://hub-gate-ywkmredngq-ue.a.run.app/healthz"' \
    --freshness=24h
(no rows)
```

`/healthz/` returns the gate's own 329-byte page with `<html lang="en">` quoted, and it logs.
`/healthz` without the slash has produced **zero** container lines in 24 hours. So the platform
behaviour is "Google's frontend claims the exact path `/healthz`", not "anything starting
`/healthz`". This matters for the ADR candidate `roadmap-truth` proposed: the ADR should state
the exact-path scope, or a later reader will test `/healthz/`, see it reach the gate, and
conclude the interception was fixed.

---

## D4 — Wave 0 re-probe items: sign-out is not deployed

| Path | Hosting | run.app | Meaning |
|---|---|---|---|
| `/session/end` | `404/21376` (static site 404) | `404/329` (gate's own) | **No Hosting rewrite, no gate route** |

```
$ curl -s $R/session/end | head -c 120
<!doctype html>
<html lang="en">
  ... <title>Not found</title>
```

Confirmed from the container log (`404 .../session/end`, GET and POST alike — the POSTs are
another agent's, not mine).

The deployed SHA `f98a928a` is `origin/main`'s tip; `origin/feat/gate-signout` exists and is
unmerged. **Sign-out at `/session/end` is therefore NOT LIVE**, and the Wave 0 re-probe of it
is outstanding until a deploy lands. `/p/**`, `/session` and `/client-events` all route to the
gate today; `/session/end` does not.

---

## D5 — Public surface unchanged by this wave

**Phase 1 smoke routes** (roadmap line 149) — all 200:

```
$ curl -s -o /dev/null -w "HTTP=%{http_code} SIZE=%{size_download}\n" <route>
/                            HTTP=200 SIZE=4634
/resumes/                    HTTP=200 SIZE=4936
/cv/academic/                HTTP=200 SIZE=23486
/cv/research-professional/   HTTP=200 SIZE=24090
/papers/                     HTTP=200 SIZE=6231
/pdfs/academic.pdf           HTTP=200 SIZE=185897  (application/pdf)
/projects/                   HTTP=200 SIZE=9391
/email/                      HTTP=200 SIZE=2032
/privacy/                    HTTP=200 SIZE=2539
```

**Size floors** (roadmap line 150, "at least 500 bytes") — the check that exists to catch a
200 with an empty body:

```
/cv/academic   HTTP=200 SIZE=23486   ✓ ≥500
/cv/academic/  HTTP=200 SIZE=23486   ✓ ≥500
/papers/       HTTP=200 SIZE=6231    ✓ ≥500
```

**Every `/research/**` page** — 10 routes, all 200, none empty:

```
/research/                                                    200   4183
/research/soa-agentic-se/                                     200   6227
/research/soa-agentic-se/agentic-harnesses/                   200   8761
/research/soa-agentic-se/agentic-harnesses/consensus/         200  40005
/research/soa-agentic-se/agentic-harnesses/sources/           200 416915
/research/soa-agentic-se/agentic-harnesses/synthesis/         200  79033
/research/soa-agentic-se/agentic-memory/                      200   9509
/research/soa-agentic-se/agentic-memory/consensus/            200  52721
/research/soa-agentic-se/agentic-memory/sources/              200 526208
/research/soa-agentic-se/agentic-memory/synthesis/            200  93221
```

**All 34 sitemap routes returned 200.** Zero non-200 across the full crawl.

**`build-info.json` — `content_source: "bucket"`, verified at both ends of the window:**

```
$ curl -s https://jason.cusati.us/build-info.json
{ "content_fingerprint": "ad65f68ecc54dee3add533f569303292cfa6a67b1a85205af6d20aa2023dc529",
  "cv_fingerprint": "",
  "content_source": "bucket",
  "built_from_sha": "f98a928a1b92b2248b130822ba5098fb926b8898",
  "run_id": "35397897183" }
```

**Verdict: TRUE.** Byte-identical on `cusati-hub.web.app`, `cusati-hub.firebaseapp.com` and the
GitHub Pages mirror.

**`research.cusati.us` 301 — paths preserved, tested with paths and not only the root:**

```
$ curl -s -o /dev/null -D- <url> | grep -iE "^HTTP|^location"
https://research.cusati.us/                        → 301  location: https://jason.cusati.us/
https://research.cusati.us/research/soa-agentic-se/ → 301  location: https://jason.cusati.us/research/soa-agentic-se/
https://research.cusati.us/cv/academic/            → 301  location: https://jason.cusati.us/cv/academic/
https://research.cusati.us/pdfs/academic.pdf       → 301  location: https://jason.cusati.us/pdfs/academic.pdf

$ curl -sL -o /dev/null -w "%{url_effective} %{http_code}" https://research.cusati.us/research/soa-agentic-se/
https://jason.cusati.us/research/soa-agentic-se/ 200
```

**Verdict: TRUE**, path component preserved exactly in all four cases, and the followed
redirect lands on a live 200.

**Minor, recorded so the next prober does not lose time:** `/sitemap.xml` returns
`404/21376`. The sitemap is at `/sitemap-index.xml` (186 bytes) → `/sitemap-0.xml` (34 URLs),
which is what `robots.txt` advertises. Not a defect; a naming trap.

---

## D6 — Phase 3 acceptance criteria, live-transport verdicts

Numbered as `roadmap-truth` numbered them, so the two reports can be read side by side.
"Live-probeable" means a verdict can be reached from transport evidence alone.

| # | Criterion (abbreviated) | Transport evidence | My verdict | `roadmap-truth` | Agree? |
|---|---|---|---|---|---|
| A1 | A seeded member signs in and sees tracker + dossier | none possible | **NOT VERIFIABLE BY ME** | NOT VERIFIABLE | ✓ |
| A2 | Signed out, `/p/` returns no private content | D1, both transports + 3 aliases, log-attributed | **TRUE** | TRUE | ✓ |
| A3 | Signed-in non-member gets "not shared with you" | none possible | **NOT VERIFIABLE BY ME** | NOT VERIFIABLE | ✓ |
| A4 | Same signed-out **and non-member** requests direct to `*.run.app`, refused the same way | signed-out half D1/D2 | **NOT VERIFIABLE BY ME** (signed-out half TRUE, with 3 shape asymmetries) | NOT VERIFIABLE (same) | ✓ |
| A5 | A session persists across page loads | none possible | **NOT VERIFIABLE BY ME** | NOT VERIFIABLE | ✓ |
| A6 | Every `/p/` response carries `private, no-store` | D1 headers, both transports | **TRUE** *(qualified: refusals only)* | TRUE (qualified) | ✓ |
| A7 | Gate test asserts no `/p/**` or `/s/**` carries `public`/`s-maxage` | not live-probeable (source) | **out of my scope** — no live transport bears on it | FALSE, deferred | n/a |
| A8 | Gate pytest passes in CI | not live-probeable | **out of my scope** | TRUE | n/a |
| A9 | Leak check on every deploy + deliberate failing run | not live-probeable | **out of my scope** | TRUE | n/a |
| A10 | Bucket IAM test; anonymous read refused | anonymous half probed live (D7) | **anonymous half TRUE**; the IAM-equality half is not live-probeable | TRUE (qualified) | ✓ |
| A11 | No public page lists/links/names a private item | 1,435,043 bytes scanned (D7) | **TRUE** | TRUE | ✓ |
| A12 | Gate SA reads only the private bucket and Firestore | not live-probeable | **out of my scope** | FALSE | n/a |
| A13 | `phd-milestones` private + recorded prefix test | not live-probeable | **out of my scope** | FALSE | n/a |
| A14 | Gate deploy uses WIF only | not live-probeable | **out of my scope** | TRUE | n/a |
| A15 | Governance Audit recorded on the PR | not live-probeable | **out of my scope** | TRUE | n/a |

**I found no disagreement with the `roadmap-truth` stream on any criterion.** On every
criterion where live transport evidence exists, I reached the same verdict independently. The
differences between our reports are *additions* (D2.2, D2.3, D3, D8) and one refinement
(D8.3), not contradictions. I say this explicitly because my contract asks me to state
disagreement loudly, and the honest answer this wave is that there is none.

### A1 / A3 / A5 / A4-non-member — NOT VERIFIABLE BY ME, and what would settle them

I hold no member credential. The allowlist matches the exact email inside a Firebase ID token;
the members are `djjay@vt.edu` and `cbrown@vt.edu`; this machine's identity is
`djjay0131@gmail.com`, deliberately not a member. **I did not substitute a signed-out probe for
any of these, and I did not infer the positive case from a 404.**

What would settle each — all four require a human holding a real credential:

- **A1** — sign in at `/signin/` as `djjay@vt.edu`, then GET
  `/p/phd/phd-milestones/milestones/index.html` and `/p/phd/phd-milestones/committee-dossier/index.html`.
  Record HTTP 200, the body sizes, **and that the page's assets load** (a 200 on the HTML hides
  the issue-#27 class of failure entirely), plus the matching allow-class log lines.
- **A3** — sign in with any account the provider will actually mint a token for that is not on
  the allowlist, request the same two paths, and record the status, body size and a
  `event=deny … stage=` line showing the **member-lookup** stage rather than the session stage.
- **A4 non-member half** — repeat A3 against **all four** non-Hosting transports:
  `hub-gate-ywkmredngq-ue.a.run.app`, `hub-gate-410552878319.us-east1.run.app`,
  `cusati-hub.web.app`, `cusati-hub.firebaseapp.com`. My contract named one; there are four.
- **A5** — after A1, load a second `/p/` page in the same browser session with no
  re-authentication, and confirm the cookie is named exactly `__session`. I can confirm the
  *negative* half live — a bogus `__session` is rejected at the verify stage
  (`reason=invalid_session`), proving Hosting forwards the cookie — but that a *valid* session
  survives is exactly what I cannot show.

---

## D7 — The two criteria I re-verified live rather than take on trust

I re-ran these myself because both are genuinely live-probeable and my contract makes me the
independent transport evidence, not a relay of the document audit.

### A11 — no public page names a private item

```
$ while read -r u; do curl -s "$u" >> scan.txt; done < locs.txt      # all 34 sitemap routes
$ for e in /phd/ /signin/ /cv/ /writing/; do curl -s "https://jason.cusati.us$e" >> scan.txt; done
bytes scanned: 1435043

committee-dossier    hits=0
phd-milestones       hits=0
dossier              hits=0
Twelve vetted        hits=0
milestones           hits=1
committee            hits=1
```

The two non-zero hits are ordinary academic prose in the research digests, checked in context
rather than assumed:

```
"...tech-tree milestones up to 15.3x faster than prior SOTA..."
"...stewarded by the Linux Foundation under a Technical Steering Committee..."
```

`/signin/` and `/phd/` both carry `<meta name="robots" content="noindex">` and **neither is in
the sitemap** (0 of 34). **Verdict: TRUE**, independently reproduced.

### A10 — anonymous access to the private bucket

```
$ curl -s -o /dev/null -w "HTTP=%{http_code}" <url>
storage.googleapis.com/cusati-hub-private/index.html                                     403
storage.googleapis.com/cusati-hub-private/phd/phd-milestones/committee-dossier/index.html 403
storage.googleapis.com/cusati-hub-private/pdfs/anthropic-fellow.pdf                      403
storage.googleapis.com/storage/v1/b/cusati-hub-private/o          (anonymous list)        401
cusati-hub-private.storage.googleapis.com/index.html              (vhost form)            403
```

Refused on the path form, the virtual-host form, and the JSON list API. **Verdict: the
anonymous-refusal half of A10 is TRUE.** I did not download any private object.

---

## D8 — `cv/anthropic-fellow`: every public path it is currently reachable by

Owner decision D8 (STATE line 441): "**`cv/anthropic-fellow` is private.** It must not appear
on `/resumes/`, `/cv/`, in `/pdfs/`, in the sitemap, the search index, RSS, OG images, or any
`dist-public` byte."

Live state contradicts that. `roadmap-truth` D6.6 and STATE record **3** surfaces. I enumerated
**13, across 4 origins.**

### D8.1 — On `jason.cusati.us`

| # | Path | Result |
|---|---|---|
| 1 | `/cv/anthropic-fellow/` | `200` / 21032 bytes, `text/html` |
| 2 | `/cv/anthropic-fellow` | `301` → `/cv/anthropic-fellow/` |
| 3 | `/cv/anthropic-fellow/index.html` | `200` / 21032 bytes |
| 4 | `/pdfs/anthropic-fellow.pdf` | `200` / 57915 bytes, `application/pdf`, `cache-control: max-age=3600` |
| 5 | `/sitemap-0.xml` | contains `<loc>https://jason.cusati.us/cv/anthropic-fellow/</loc>` |
| 6 | `/resumes/` | links `href="/cv/anthropic-fellow"` **and** `href="/pdfs/anthropic-fellow.pdf"` |
| 7 | `/cv/` | links `href="/cv/anthropic-fellow"` (×2) **and** `href="/pdfs/anthropic-fellow.pdf"` |

`robots.txt` is `User-agent: * / Allow: /` and advertises the sitemap, so the page is
explicitly crawlable. The home page `/` does **not** link it (0 hits).

**The page's own metadata is part of the exposure, and D8 names OG images specifically:**

```
<link rel="canonical" href="https://jason.cusati.us/cv/anthropic-fellow/">
<meta property="og:title" content="Jason Cusati — CV (anthropic-fellow)">
<meta property="og:url" content="https://jason.cusati.us/cv/anthropic-fellow/">
<meta property="og:image" content="https://jason.cusati.us/photo_jason_1.jpeg">
<meta property="og:description" content="PhD candidate in Computer Science ...">
```

The page carries **no `noindex`** — unlike `/signin/` and `/phd/`, which do. The `og:description`
is a substantive CV summary, so the item is exposed to any link unfurler even without a click.

### D8.2 — On the Hosting alias domains (both authorized domains for Identity Platform)

| # | Origin | `/cv/anthropic-fellow/` | `/pdfs/anthropic-fellow.pdf` |
|---|---|---|---|
| 8, 9 | `cusati-hub.web.app` | `200` / 21032 | `200` / 57915 |
| 10, 11 | `cusati-hub.firebaseapp.com` | `200` / 21032 | `200` / 57915 |

Both serve the identical bytes and their own copies of `sitemap-0.xml`. Any fix applied only to
`jason.cusati.us` leaves these serving.

### D8.3 — On the GitHub Pages mirror — the surface nobody has recorded

```
$ P=https://djjay0131.github.io/website
$ curl -s -o /dev/null -w "%{http_code} %{size_download}" $P/cv/anthropic-fellow/     → 200 21200
$ curl -s -o /dev/null -w "%{http_code} %{size_download}" $P/pdfs/anthropic-fellow.pdf → 200 57915
$ curl -s $P/sitemap-0.xml | grep -o '<loc>[^<]*</loc>' | grep -i anthropic
<loc>https://djjay0131.github.io/website/cv/anthropic-fellow/</loc>
$ curl -s $P/resumes/ | grep -o 'href="[^"]*"' | grep -i anthropic
href="/website/cv/anthropic-fellow"
href="/website/pdfs/anthropic-fellow.pdf"
$ curl -s -o /dev/null -D- $P/cv/anthropic-fellow/ | grep -iE "^HTTP|^location"
HTTP/2 200                                    # no redirect to jason.cusati.us
canonical" href="https://djjay0131.github.io/website/cv/anthropic-fellow/"
```

Items 12 and 13, plus its own sitemap and its own `/resumes/` links. **This origin does not
redirect to `jason.cusati.us` and its canonical points at itself**, so it is an independently
indexable copy of the same document, built from the same SHA (`build-info.json` on the mirror
is byte-identical, `built_from_sha: f98a928a`). Roadmap Phase 6 line 435 plans redirects from
this host; until then, a D8 fix in `dist-public` has to reach the Pages variant of the build as
well, and `build.yml` still runs that variant on every deploy.

### D8.4 — A refinement to `roadmap-truth` D6.6, not a contradiction

D6.6 notes that `pdfs/anthropic-fellow.pdf` (57915 bytes) "sits in the **private** bucket — the
same bytes on both sides of the boundary", which reads as though the duplication were specific
to this item. It is not:

```
$ gcloud storage ls -l "gs://cusati-hub-private/pdfs/**"
    185897  gs://cusati-hub-private/pdfs/academic.pdf
     57915  gs://cusati-hub-private/pdfs/anthropic-fellow.pdf
     60957  gs://cusati-hub-private/pdfs/research-professional.pdf
    183492  gs://cusati-hub-private/pdfs/sde-long.pdf
```

**All four CV PDFs** are in the private bucket, because the private build is a superset that
re-renders the public site behind the gate. So the observation is "the private build mirrors
the public one", which is by design — not an anthropic-fellow-specific boundary smell. The
genuine finding stands undiminished: the item is **public** when D8 says it must not be.

Searching the whole private bucket for the slug confirms there is no private *route wrapper*
for it yet — only the mirrored PDF:

```
$ gcloud storage ls "gs://cusati-hub-private/**" | grep -i anthropic
gs://cusati-hub-private/pdfs/anthropic-fellow.pdf
```

So implementing D8 is not "move it" — the private side has no `/p/cv/anthropic-fellow/` route
to move it to. Confirmed live: `/p/cv/anthropic-fellow/index.html` → `404/426` on both
transports (the uniform refusal, which tells a signed-out caller nothing either way).

**Verdict: owner decision D8 is contradicted by live state on 13 paths across 4 origins.**
I did not quote the item's content beyond the metadata that is itself part of the exposure.

---

## Summary

The gate's signed-out behaviour is **sound on every transport I could reach**, and I could
reach three more than my contract named. Refusals are byte-identical, carry `private,
no-store`, leak nothing, and provide no existence oracle; every one is attributable to the gate
by a matching container log line rather than by body size alone. The public surface is
untouched by this wave — 34/34 routes 200, size floors met, `content_source: "bucket"`,
`research.cusati.us` preserving paths.

Three things are worth a reader's attention beyond that. First, **the `/healthz` interception
is exact-path**, not prefix — `/healthz/` reaches the container — which makes the
currently-recorded rule wrong in a way that will mislead the next person who tests it. Second,
**the gate has no HEAD handler on any route**, including `/_health`, and Hosting hides this by
converting HEAD to GET; a monitor that switches verb will read 405 as an outage. Third,
**`cv/anthropic-fellow` is reachable by 13 paths across 4 origins**, not the 3 currently
recorded, and one of those origins — the GitHub Pages mirror — has its own sitemap and does
not redirect, so it will keep serving the item after any fix aimed at `jason.cusati.us` alone.

The four member-session criteria remain unverifiable by me, and I substituted nothing for them.
Wave 0's sign-out is not deployed, so its re-probe is still outstanding.

## Assumptions

1. **`--path-as-is` on every traversal probe**, per my contract and `roadmap-truth`'s RT-12
   caution. I did not reproduce the false 200; the flag was present on every probe in D2.
2. **"Refused the same way" (criterion 4) covers status, body and cache headers.** Where the two
   transports differ only in how a *frontend* normalises a path before any application sees it
   (D2.1, D2.2) or in verb handling (D2.3), I reported the difference and did **not** decide
   whether it violates the criterion. That is the Lead Architect's call and is already logged as
   `roadmap-truth`'s open question 2.
3. **I treated the brief's known-correct results as such** — `/_health` 200 on `run.app`, the
   static 404 through Hosting, `/healthz` as Google's page, and the uniform `/p/**` 404 (C29) —
   and reported none of them as defects.
4. **Log attribution by timestamp and path.** Other Wave 0 agents were probing concurrently
   (see Risks), so I claim only lines whose path and second match a probe I ran.
5. **I read no private bucket object and quoted no private content.** Object names and sizes
   only. For `cv/anthropic-fellow` I quoted the page's public `<meta>` tags because that
   metadata is itself the exposure D8 names.
6. **One target version throughout.** Revision `hub-gate-00005-n4g` and SHA `f98a928a` were
   re-read at 03:58Z and unchanged from 03:49Z.
7. **`f98a928a` is `origin/main`'s tip.** The 14 commits ahead of it in this worktree are on
   `admin/wave-0-preconditions`, not on `main`, so nothing in them is deployed. I never checked
   out a branch; all git commands were read-only (`log`, `branch -r --contains`, `rev-parse`).

## Recommendations

1. **Fix `cv/anthropic-fellow` against the full 13-path surface** (D8), not the 3 recorded ones.
   Any fix must cover the two Hosting alias domains and **the GitHub Pages variant**, which has
   its own sitemap and self-referential canonical. STATE already ranks this highest in Wave 0b;
   this report widens its definition of done.
2. **Correct the recorded `/healthz` rule to say exact-path** (D3), in whichever artifact
   carries it — including the ADR `roadmap-truth` proposed. As written, it predicts that
   `/healthz/` is intercepted too, and it is not.
3. **Decide whether the gate should answer HEAD** (D2.3). Either add HEAD handlers or record
   405-on-HEAD as intended, and pin whichever is chosen with a test — plus a note on the uptime
   check that it must stay on GET.
4. **Extend every both-transports assertion to four non-Hosting origins**, not one: the
   project-number `run.app` alias and the two `*.web.app`/`*.firebaseapp.com` domains are all
   live and all answer. A check that probes only `hub-gate-ywkmredngq-ue.a.run.app` tests a
   fraction of the reachable surface.
5. **Add D2.2's forms (`/p//`, `/p/....//`) to the live traversal corpus** `roadmap-truth`
   recommended in D6.2. They are a distinct normalisation class from `..%2f` and were not
   previously tested.
6. **Re-probe `/session/end` on both transports after the Wave 0 deploy** (D4). It is currently
   a static 404 through Hosting and a gate 404 direct; neither is the post-deploy expectation.
7. **Record that `/sitemap.xml` 404s and the sitemap is `/sitemap-index.xml`** wherever the
   smoke routes are listed, so the next prober does not read it as a regression.

## Alternatives considered

- **Reporting the three asymmetries (D2) as vulnerabilities.** Rejected. All three refuse, none
  returns private bytes, and every redirect target is a public path. Calling them
  vulnerabilities would spend the word on something that is a criterion-wording question.
- **Reporting `/healthz` 404 or the Hosting `/_health` 404 as defects.** Rejected — my brief
  names both as known-correct, and the logs confirm the mechanism rather than a gate fault.
- **Treating `roadmap-truth`'s results as already-established and probing only the gaps.**
  Rejected for A10 and A11, which are live-probeable and are exactly what I exist to supply
  independently. I re-ran both and reproduced them.
- **Inferring A5 from the `reason=invalid_session` log line.** Rejected. It proves Hosting
  forwards `__session` and the gate reads it — necessary, not sufficient. A valid session
  surviving is unproven.
- **POSTing to `/session` to re-confirm `invalid_token`.** Rejected: my instruction for this
  wave is GET and HEAD, `roadmap-truth` already recorded it on both transports, and the finding
  did not need a second mutation-adjacent probe.
- **Reading one private object to prove the bucket refuses anonymous callers.** Never
  considered seriously; the 403/401 responses establish it without any object being fetched.
- **Counting the GitHub Pages mirror as out of scope because Phase 6 will retire it.** Rejected.
  It is serving the D8-designated-private item today, from the same SHA, to anyone.

## Risks

1. **The four member-session criteria have still never been demonstrated by anyone.** A1 is the
   phase's headline deliverable. Everything I verified is the refusal path; the success path is
   entirely unevidenced, and the only configured sign-in route depends on email delivery that
   the owner reports as not working.
2. **`cv/anthropic-fellow` is indexable right now** — `robots.txt` allows it, it is in two live
   sitemaps, it carries no `noindex`, and its `og:description` exposes a CV summary to
   unfurlers. Search-engine and social caches may outlive the fix.
3. **A D8 fix scoped to `jason.cusati.us` will look complete and not be.** Three other origins
   serve the same bytes, and the Pages mirror will not even redirect.
4. **The gate's 405-on-HEAD is a latent false outage.** Any monitor or CI step that switches to
   HEAD on `/_health` reads 405. Nothing does today, which is why it is invisible.
5. **The project-number `run.app` alias is an untested transport.** It was reachable and
   correct in every probe I ran, but no assertion anywhere names it, so nothing would catch it
   diverging.
6. **Concurrent probing pollutes the log evidence.** During my window other Wave 0 agents
   probed paths I never requested (`/p/phd-milestones/tracker/index.html`, `%C0%AE%C0%AE` and
   `a%00.html` forms, `POST /session/end`, and the `410552878319` host). I filtered by my own
   paths and timestamps, but anyone re-reading these logs later should not assume every line is
   mine — and a future wave should consider serialising live probes.
7. **Phase 4's `/s/{token}/{path}` will inherit D2.** It accepts an attacker-supplied path
   component, and the transports demonstrably normalise paths differently before the
   application sees them.

## Open questions

1. **Do the three D2 asymmetries violate criterion 4?** Extends `roadmap-truth`'s open question
   2 with two forms it did not test, one of which (HEAD) is a *verb* difference rather than a
   path-normalisation one and may deserve a different answer. *Settled by:* a Lead Architect
   ruling on whether "refused the same way" governs the status code or the security outcome.
2. **Should the gate answer HEAD at all?** *Settled by:* a decision plus a test pinning it, and
   a note fixing the uptime check to GET.
3. **Does the D8 fix have to cover the GitHub Pages variant, or is Pages retired first?** These
   interact: if Phase 6 retires Pages soon, the fix could be scoped to Firebase; if not, the
   `dist-public` allowlist must reach the Pages build too. Related to open question O6, which is
   still unanswered. *Settled by:* the owner's answer on what "retire Pages" means, or an
   explicit decision to fix both builds now.
4. **Should the two Hosting alias domains serve the site at all?** They are Identity Platform
   authorized domains, which is why they exist, but they also serve the entire public site under
   two extra hostnames with their own sitemaps — duplicate-content and duplicate-exposure
   surface that no document I read accounts for. *Settled by:* a decision on whether to add a
   redirect to the canonical host.
5. **Is the `/healthz` exact-path interception stable?** It is Google frontend behaviour, not
   ours, and nothing pins it. *Settled by:* nothing we control — which is itself the argument
   for the ADR recording why the health route is `/_health`.

## Related docs

- `llm/sprints/2026-09-hub/contracts/live-prober-wave-0.md` — this contract
- `llm/sprints/2026-09-hub/handoffs/roadmap-truth-wave-0.md` — the document/log audit this
  report supplies live transport evidence for; D6.2, D6.4 and D6.6 are extended here
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `allUsers`, the
  `__session` constraint, CDN caching
- `llm/sprints/2026-09-hub/STATE.md` — §Owner decisions 2026-09-18 (D8, line 441), D6.6
  disposition RT-10 (line 565), §Checkpoint 4 execution record
- `llm/master-roadmap.md` — §phase-3-private-area acceptance criteria (lines 25–39), Phase 1
  smoke routes and the 500-byte floor (lines 149–150), Phase 6 Pages redirects (line 435)
- `llm/governance/adr/0010-withdrawal-semantics.md` — decision 5, the destructive private sync
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — the A11 structural guarantee

## ADR candidates

1. **The gate's health route is `/_health`, and Google's frontend claims the exact path
   `/healthz` — but not `/healthz/`.** I second `roadmap-truth`'s candidate 1 and add the
   correction that makes it accurate. An ADR stating only "`/healthz` is intercepted" will be
   falsified by the first person who tests the trailing-slash form, and a falsified ADR is worse
   than none. Include the log-based test (`requestUrl=` exact match over 24h) as the way to tell
   interception from a gate 404.
2. **Authorisation must be verified on every reachable origin, and there are five.** I second
   `roadmap-truth`'s candidate 3 and widen it: ADR-0004 states the `allUsers` principle for
   *the* `run.app` URL, but the service is equally reachable via the project-number hostname,
   and the site via two Firebase alias domains. The decision worth recording is the
   *enumeration rule* — how you establish the full set of origins before asserting parity — not
   just the pair currently named.
3. **Refusal parity across transports is about the security outcome, not the status code — or
   it is not.** Whichever the Lead Architect decides in open question 1, it should be written
   down, because D2 shows at least three mechanisms (frontend path normalisation, empty-segment
   collapse, verb translation) that make byte-identical answers across transports something the
   application cannot guarantee on its own.

---

## Appendix — probe environment notes

Additions to `roadmap-truth`'s appendix, all confirmed today.

- **There are three short 404 bodies, not two.** The gate serves **426** (the "Sign in" page,
  `/p/**` refusals) *and* **329** (its generic "Not found", every other route it lacks). Both
  have `<html lang="en">` **quoted**. Only **1568** unquoted is Google's. Judging by "short and
  404" alone will misattribute the 329.
- **Hosting converts HEAD to GET upstream.** A Hosting HEAD appears in the container log as
  `GET`. So `curl -I` through Hosting and `curl -I` direct are not the same experiment.
- **`hub-gate-410552878319.us-east1.run.app` is a second, fully functional `run.app` hostname**
  for the same service and appears in Cloud Logging.
- **`/sitemap.xml` 404s.** Use `/sitemap-index.xml` → `/sitemap-0.xml` (34 URLs).
- **`cusati-hub.web.app` and `cusati-hub.firebaseapp.com` serve the whole public site**,
  including `/p/**` routed to the gate.
- **Filter logs by exact `httpRequest.requestUrl=` when proving a *negative*.** The substring
  form `requestUrl:"/healthz"` also matches `/healthz/` and will make an intercepted path look
  as though it reached the container.
- Other agents probe the same production surface concurrently; expect log lines that are not
  yours.
