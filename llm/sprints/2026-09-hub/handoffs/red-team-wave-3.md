# Handoff — `Red Team`, Wave 3 (Phase 4 sharing)

Agent: Red Team (independent; authored nothing in this wave — report only, no fixes)
Contract: `llm/sprints/2026-09-hub/contracts/red-team-wave-3.md`
Seam: `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` SEAM-S8
Wave: 3 · Issue: `hub-004`
Repo: `/home/djjay/code/website` · branch `feat/sharing` · HEAD `c605c72`
Working tree at start and end: I changed **no tracked file**. At start the untracked set was the
two peer handoffs (`dissenter-wave-3.md`, `regression-tester-wave-3.md`); at end it is those two,
a `security-tester-wave-3.md` that peer stream added mid-session, and this file. (I did briefly
create a stray transcript in the repo root; deleted before finishing — `git status --porcelain` is
clean apart from those untracked peer handoffs and this file.)

## Summary

I ran **18 attacks / test groups** against the share surface. **16 are clean refusals.** I found
**one integration bypass** (the `firebase.json` rewrite does not bind bare `POST/GET /share`),
**one seam deviation** (`POST /share` returns 200 for a nonexistent item where SEAM-S2 says 404),
and **one design observation** (nested multi-segment slugs over-share descendants). **No
data-exposure or authorisation bypass exists in the gate's share code**: every traversal spelling,
every prefix/sibling confusion, and every non-owner/anonymous/cross-origin case is refused, and all
`/s/**` + `/share/**` responses carry `private, no-store`.

> **Live note (the branch is pushed, not deployed).** HEAD `c605c72` is **not** an ancestor of
> `origin/main`, and the live site confirms it: `GET https://jason.cusati.us/share` and
> `GET /s/notatoken/index.html` are served by **Firebase Hosting's static 404** (21 376 bytes,
> `cache-control: max-age=3600`), not the gate. `GET /p/` **does** reach the gate (426-byte gate
> 404, `private, no-store`), so the gate is live and only the new rewrites are missing. I therefore
> proved every route-level result against the real `create_app()` with the in-memory doubles
> (`StaticShareStore`, `StaticMemberDirectory`, `FakeStore`, `FakeVerifier`) served by uvicorn on
> `127.0.0.1:8123`, and used `curl --path-as-is` so the server sees the dots.

Baseline before and after: `gate/` suite **419 passed** (`./.venv/bin/python -m pytest`). No tracked
file was modified; all unit work used a harness in `/tmp/opencode/redteam/harness_app.py`.

### Attack table

| # | Target | Exact setup | Observed | Verdict | Code path |
|---|--------|-------------|----------|---------|-----------|
| 1 | Token entropy | 200 000× `mint_token()`; mint same item twice | 43 chars, full URL-safe alphabet, **200 000/200 000 distinct**, 0 collisions; two consecutive mints differ; list exposes only 12-char prefix | **REFUSED** | `shares.py:34-39` (`secrets.token_urlsafe(32)`); `main.py:944` `_short_share_id` |
| 2 | Raw `..` escape | `curl --path-as-is /s/ACTIVE/../secrets` | 404, no bucket fetch (`stage=path reason=dot_segment`) | **REFUSED** | `serve.py:42-74`, `main.py:634` |
| 3 | Encoded `..` | `/s/ACTIVE/%2e%2e%2fsecrets`, `..%2fsecrets`, `%2e%2e`, `a/../../b`, deep `%2e%2e%2f%2e%2e%2f` | all 404, all `dot_segment`, no fetch | **REFUSED** | `serve.py:42-74` |
| 4 | Double-encoding | `/s/ACTIVE/%252e%252e%252fsecrets` | 404, `stage=path reason=illegal_character` (literal `%`) | **REFUSED** | `serve.py:23,71` |
| 5 | Absolute / backslash / NUL / control | `%2fetc%2fpasswd`, `//etc/passwd`, `%5csecrets`, `%00` | 404: `absolute_path`, `absolute_path`, `backslash`, `nul_byte`; no fetch | **REFUSED** | `serve.py:53-63` |
| 6 | Second item | token for `cv/cv/academic` → `/s/T/../cv/cv/academic`, and `phd…/committee-dossier` | 404; sibling bytes absent (`b"Academic CV"` not served) | **REFUSED** | `main.py:633-642` |
| 7 | Sibling slug `-evil` | `/s/ACTIVE/../committee-dossier-evil/index.html` | 404, no fetch; canary `Evil sibling` never served | **REFUSED** | `serve.py:68-71`, `main.py:934` |
| 8 | Sibling section / source | `/s/ACTIVE/../../projects/phd-milestones/internal-notes/index.html`; `../../phd-milestones-evil/…`; direct in-prefix `phd-milestones-evil/…` | traversal → 404 no fetch; direct path → in-prefix miss (fetch `…/committee-dossier/phd-milestones-evil/…`, 404) | **REFUSED** | `main.py:925-935` |
| 9 | Multi-segment slug confinement | token slug `milestones/2026`; serve `report.html` (200) then `../index.html`, `%2e%2e%2findex.html`, 3× `..` to `committee-dossier` | 200 for own file; every traversal 404 no fetch | **REFUSED** | `main.py:916-935`; `serve.py` |
| 10 | Non-owner / anonymous mint·list·revoke | member cookie `session-for-other-token`, no cookie, owner-cross-origin | 403 on all (mint/list/revoke), body `{"status":"forbidden"}`; refused grant left active | **REFUSED** | `main.py:519,567,599` `_is_owner` |
| 11 | Cross-origin mint/revoke | `Origin: https://evil.example`, `null`, `http://…`, `https://jason.cusati.us@evil.example`, `https://jason.cusati.us.evil.example`, comma-list, **no Origin** | 403 all; run.app origin → 200; uppercase host → 200 (host case-insensitive, correct) | **REFUSED** | `main.py:845-863`, `:773-825`, `config.py:37-62` |
| 12 | Expired / revoked / unknown serving | tokens expired (−1 d), revoked, random, traversal, missing file, corrupt stored row (`section="a/b"`) | **identical** 404 body (sha256 `0ddd881d…`, 329 B) for every case; no fetch for corrupt/traversal | **REFUSED** | `shares.py:63-70`, `main.py:617-629` |
| 13 | Caching | every `/s/**` and `/share/**` response incl. 404, traversal, missing, 400 bad-JSON, 405 PUT/OPTIONS, HEAD, mint/list/revoke refused | every one `cache-control: private, no-store`; **0** occurrences of `public`/`s-maxage`; no `Set-Cookie` on `/s/**` | **REFUSED** | `main.py:101,285-293` |
| 14 | Web SDK read of `shares/` | released ruleset + client-code scan | `match /{document=**}{allow read, write: if false;}` released to `cloud.firestore`; no `getFirestore`/`collection()` in `site/src*` | **REFUSED** | `infra/firestore.tf:97-171` |
| 15 | Section smuggling | mint with multi-seg/illegal/dot/absolute/empty/null/int/non-string/unicode `section`, `source`, `slug`; over-long; >24 segments | 400 `{"status":"invalid_request"}` for all illegal; nothing stored (list unchanged); 24-seg slug and legal multi-seg slug accepted by design | **REFUSED** | `main.py:527-534,916-935`; `serve.py:105-118` |
| 16 | Client-injected stored fields | mint body also carrying `"revoked":true, "exp":"2999-…"` | 200, but server rebuilds `Share` from explicit fields; injected `revoked`/`exp` ignored | **REFUSED** | `main.py:537-547` |
| A | Nonexistent item at mint | `POST /share {section:"nope",source:"nope",slug:"nope"}` → 200 + token | **200**, not the SEAM-S2 404 | **SEAM DEVIATION** (low) | `main.py:503-562` |
| B | Hosting rewrite binds bare `/share`? | live `GET /p` vs `/p/anything`; live `/share` | `/p` → Hosting static 404 (21 376 B, `max-age=3600`); `/p/anything` → gate (426 B, `private,no-store`). Same `/**` shape as the new `/share/**`, so bare `POST/GET /share` never reaches the gate | **BYPASS (route-binding / availability, fail-closed)** | `firebase.json` rewrites; SEAM-S4 |

Counts: **18 attack groups, 16 REFUSED, 1 seam deviation, 1 integration bypass**, plus **1 design
observation**. No security (data-exposure / authz / cache) bypass found.

---

## Bypass B — `/**` rewrite does not bind the bare `/share` (SEAM-S4 claim is false)

**Hypothesis.** SEAM-S4 says `"source": "/share/**"` "covers POST/GET/DELETE under the Hosting
rewrite". A `/**` glob that does not match its bare prefix leaves `POST /share` (mint) and
`GET /share` (list) served by Hosting's static 404, while `DELETE /share/{token}` (which has a
segment) still works.

**Minimal reproduction (live, GET-only, control is an already-deployed `/**` rewrite).**

```
$ for p in /p /p/anything /p/anything/; do curl -sS -o /dev/null -D - -w "HTTP %{http_code} len=%{size_download}\n" https://jason.cusati.us$p; done
GET /p             HTTP 404 len=21376   cache-control: max-age=3600     # Hosting static 404
GET /p/anything    HTTP 404 len=426     cache-control: private, no-store # gate: rewrite matched
GET /p/anything/   HTTP 404 len=426     cache-control: private, no-store # gate: rewrite matched
```

`/p/**` and `/share/**` are the same pattern shape, so the bare-path miss transfers:

```
$ curl -sS -o /dev/null -w "%{http_code} %{size_download} %header{cache-control}\n" https://jason.cusati.us/share
404 21376 max-age=3600        # Hosting static 404, NOT the gate
```

The site's own island calls the bare endpoint — `site/src-private/lib/shares.mjs:28`
`export const SHARE_ENDPOINT = "/share";`, used by `SharesIsland.tsx` for both list and mint. So
through `jason.cusati.us` the owner UI's list **and** mint are DoA; revoke works (it has a token
segment). The direct `*.run.app` transport still works (origin is in the allowlist), but the site is
the intended entry point.

**Impact.** Availability/route-binding only. It fails **closed** (no data is exposed and the token
surface is not widened); it is the opposite of a leak. But it defeats the feature through Hosting
and is exactly the "passes unit tests, fails only through Hosting" class ADR-0004 warns about — the
test suite drives `TestClient` directly and so cannot see it.

**What would fix it (report only, not applied).** Add an exact rewrite for `/share` (and `/s`) in
addition to `/share/**`, e.g. `"source": "/share{,/**}"`, and add a deploy smoke test that a bare
`GET /share` reaches the gate. Confirm at SEAM-S7 (owner acceptance) on a deployed revision.

---

## Seam deviation A — mint does not 404 a nonexistent item (SEAM-S2)

SEAM-S2 (`phase-4-seams.md:49`) says `POST /share` is "404 if the item does not exist". The
implementation performs **no existence check** — it validates shape, stores the row, and returns a
token; the item only matters at serve time.

```
$ curl -sS -X POST http://127.0.0.1:8123/share -H 'Cookie: __session=session-for-member-token' \
    -H 'Origin: https://jason.cusati.us' -H 'content-type: application/json' \
    -d '{"section":"nope","source":"nope","slug":"nope","expires_in_days":14}'
HTTP 200 {"token":"bQfugLjuCY-MiG6qzUPb_KM52Hy8lVIUdG-QmFFIEd4","expires_at":"…","url":"/s/bQf…/"}
$ curl /s/bQf…/index.html   → 404
```

**Why it is not a security bypass.** The owner is the only minter; the token still cannot leave
`<section>/<source>/<slug>/`; and because mint answers 200 whether or not the item exists, it is
**not** an existence oracle. The gate holds `storage.objects.get` only (no `list`), so implementing
the seam's 404 literally would require a bucket probe per mint — the same probe that the rest of
the design avoids to prevent path inference. Flagging as a seam-vs-implementation discrepancy for
the Lead Architect, not a bypass. (An owner can also pre-mint a token for a path that does not
exist yet; it becomes live the moment bytes land there.)

## Design observation — multi-segment slugs and descendant over-share

SEAM-S1 says "one token addresses one item" and confines the served path to
`<section>/<source>/<slug>/`. Because `slug` may be multi-segment (`main.py:920-925`) and the
prefix is a directory, a token for `<section>/<source>/<slug>` reaches **every descendant** of that
prefix, not only the item's own files. This is intended (the tests assert
`test_a_share_serves_a_subpath`), but it means: if the hub ever admits an item whose slug is a
path-prefix of another item's slug in the same `(section, source)`, sharing the shorter slug exposes
the longer one's subtree.

I checked the hub's content model: **satellite** slugs must match
`^[a-z0-9]+(?:-[a-z0-9]+)*$` (no slash), so nested satellite items are impossible;
only **hub** routes use multi-segment slugs (`hub-content.mjs:355-358`). Whether two hub routes such
as `research/soa-agentic-se` and `research/soa-agentic-se/agentic-memory` can both be private and
shared is a content-model question, not a gate bug. The gate's containment is exactly what SEAM-S1
specifies. Recorded as an open question, not a BYPASS.

---

## Transcripts (highlights)

**Path battery** (`/tmp/opencode/redteam/path-battery.txt`; token item
`phd/phd-milestones/committee-dossier`). `event=deny scope=share stage=path` reasons in
`uvicorn.log` confirm the reject happened **before** the bucket: `event=miss scope=share` count was
`0` across the whole battery, and only the two legitimate requests logged `event=allow scope=share`.

```
A baseline index            HTTP 200 cc=[private, no-store] len=26   <h1>Committee dossier</h1>
B raw ../secrets            HTTP 404 cc=[private, no-store]
C enc %2e%2e%2fsecrets      HTTP 404
D double-enc %252e…secrets  HTTP 404
E ..%2fsecrets              HTTP 404
F %2e%2e                    HTTP 404
G1 %2fetc%2fpasswd          HTTP 404
G2 //etc/passwd             HTTP 404
H ../cv/cv/academic/index   HTTP 404
I ../committee-dossier-evil HTTP 404
J ../../projects/…internal  HTTP 404
K ../../phd-milestones-evil HTTP 404
L %5csecrets                HTTP 404
M %00                       HTTP 404
N a/../../b                 HTTP 404
O %2e%2e%2f%2e%2e%2fsecrets HTTP 404
```

```
$ grep -E "scope=share" uvicorn.log | tail -16
WARNING event=deny scope=share stage=path reason=dot_segment      ×many
WARNING event=deny scope=share stage=path reason=illegal_character  (double-encoded %)
WARNING event=deny scope=share stage=path reason=absolute_path      ×2
WARNING event=deny scope=share stage=path reason=backslash
WARNING event=deny scope=share stage=path reason=nul_byte
$ grep -c "event=miss scope=share" uvicorn.log   → 0
```

**The `--path-as-is` false-200 trap, demonstrated** (contract called it out):

```
$ curl -sS -o /dev/null -w "HTTP %{http_code} url=%{url_effective}\n"  "…/s/$T/../$T/index.html"
HTTP 200 url=…/s/$T/index.html          # plain curl collapsed the ..
$ curl -sS --path-as-is -o /dev/null -w "HTTP %{http_code}\n" "…/s/$T/../$T/index.html"
HTTP 404                                 # server saw the dots and refused
```

**Authz battery** (`authz-battery.txt`, `revoke-battery.txt`):

```
M1 owner mint (same-origin)   HTTP 200 {"token":"Gs2zz…","expires_at":"2026-10-17T…","url":"/s/Gs2zz…/"}
M2 non-owner mint             HTTP 403 {"status":"forbidden"}
M3 anonymous mint             HTTP 403
M4 owner mint cross-origin    HTTP 403
M5 Origin=null                HTTP 403
M6 http:// downgrade          HTTP 403
M7 userinfo trick             HTTP 403
M8 suffix origin              HTTP 403
M9 comma-list origin          HTTP 403
M10 uppercase host            HTTP 200   (host case-insensitive = same host)
M11 no Origin                 HTTP 403
M12 run.app origin            HTTP 200
L1 owner list                 HTTP 200 {"shares":[{"id":"ACTIVEtokenX", …}]}   # 12-char id, no full token
L2 non-owner list             HTTP 403
L3 anonymous list             HTTP 403
R1 non-owner revoke           HTTP 403
R2 anonymous revoke           HTTP 403
R3 owner revoke cross-origin  HTTP 403
R4 owner revoke no Origin     HTTP 403
R5/R6 owner revoke (×2)       HTTP 200 {"status":"ok"}   # idempotent
R7 revoke never-existed       HTTP 200
```

**Expired/revoked/unknown are byte-identical** (sha256, 329 B, status 404):

```
revoked      404 len=329 sha=0ddd881d3b0e7076
expired      404 len=329 sha=0ddd881d3b0e7076
unknown      404 len=329 sha=0ddd881d3b0e7076
traversal    404 len=329 sha=0ddd881d3b0e7076
missing file 404 len=329 sha=0ddd881d3b0e7076
corrupt row  404 len=329 sha=0ddd881d3b0e7076   (stored section "a/b")
```

**Caching matrix** (`cache-matrix.txt`) — every row `private, no-store`, zero
`public`/`s-maxage`, no `Set-Cookie` on `/s/**`:

```
GET  /s active          private, no-store
GET  /s unknown         private, no-store
GET  /s traversal       private, no-store
GET  /s missing file    private, no-store
GET  /share list owner  private, no-store
GET  /share list anon   private, no-store
POST /share mint        private, no-store
POST /share bad json    private, no-store
PUT  /share (405)       private, no-store
OPTIONS /share (405)    private, no-store
HEAD /s active          private, no-store
GET  /s no token route  private, no-store
grep -ic 'public|s-maxage' cache-matrix.txt → 0
```

**Section/expiry smuggling** (`smuggling-battery.txt`) — representative:

```
section a/b, .., %2e%2e, /abs, "", null, 5, missing, "a b", "a\b", "phd․"  → all 400
source  a/b, ../cv, phd-milestones/../evil, ""                              → all 400
slug    milestones/2026 (multi legal)                                       → 200
slug    a//b, a/.., /abs, .., a\b, %2e%2e                                   → all 400
days    0, 31, -1, "14", true, 1.5                                          → all 400
days    30 (cap), 1 (floor)                                                 → 200
600-char section/slug, 25-seg slug                                          → 400
24-seg slug, dict section, list slug                                        → 400 / 200(24-seg) / 400
```

**Token entropy** (200 000 mints via the app's own `mint_token`):

```
TOKEN_BYTES = 32  → 256 bits
distinct: 200000 of 200000     lengths: {43: 200000}
charset: -0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz
two consecutive equal? False    last-char distinct: 16  (4 surviving bits in the final base64 char)
```

A guess is 2^256; brute force is infeasible, and the only token material returned by the owner-only
list is a 12-char (72-bit) prefix, which cannot reconstruct the credential.

**Web SDK rules** (`infra/firestore.tf`): one ruleset, released to `cloud.firestore`, whose body is

```
match /{document=**} { allow read, write: if false; }
```

`{document=**}` covers `shares/{token}` exactly as it covers `members/{email}`; the Admin SDK the
gate uses bypasses rules, every browser SDK does not. A scan found **no** `getFirestore` /
`initializeFirestore` / `collection()` in `site/src` or `site/src-private`; the Shares island talks
HTTP to `/share`. The Firestore emulator was unavailable (no JVM, matching `gate/tests/conftest.py`),
so this is a rules-content + client-code check, not an emulator run.

---

## What I examined and dismissed

- **In-prefix direct path to a sibling** (`/s/ACTIVE/phd-milestones-evil/…`): resolves *inside* the
  token's prefix (`…/committee-dossier/phd-milestones-evil/…`), misses, 404. Correct — no fetch of
  a sibling object. Confirmed via the fetch trace.
- **Uppercase `Origin` host** (`https://JASON.CUSATI.US`) accepted. Correct: hostnames are
  case-insensitive; this is the same origin, not a bypass.
- **`Origin` with `:443`**, trailing dot, fragment/query, userinfo, comma list, `null`, `http://`:
  all refused by `parse_origin` (`config.py:37-62`). Conservative and correct.
- **`GET /share` without an origin check**: it is a read; there is no `Access-Control-Allow-Origin`,
  so cross-origin script cannot read the JSON, and `SameSite=Lax` withholds the cookie from
  cross-site XHR. Not a CSRF hole.
- **`HEAD`/`OPTIONS`/wrong-method on the share surface**: 405/404 with `private, no-store`. No leak.
- **Stored-field injection** (`revoked`, `exp` in the mint body): ignored; the route constructs the
  `Share` from named fields (`main.py:537-547`). Also `_share_from_document` refuses a row missing
  `section/source/slug/created_by/exp/created_at`.
- **Over-long path / >24 segments**: refused before any bucket call; fetch trace empty.
- **Referrer leakage of the token in the URL**: mitigated by the middleware's
  `Referrer-Policy: no-referrer` (`main.py:291`). The token still appears in Cloud Run/Hosting
  access logs by construction (credential-in-path), which is a design choice of token-in-URL and is
  outside SEAM-S8.
- **Non-owner with a removed membership / unverified email**: `_is_owner` re-checks
  `is_member` + `email_verified` + `is_owner` every request (`main.py:901-913`), matching `/p/**`.
- **Body-size guards on mint**: 4096-byte cap, checked before and after read. An unauthenticated
  same-origin caller can force at most 4 KiB of JSON parse; cross-origin is refused before the body
  is read. Accepted.
- **Firestore `list_active` filter**: applies `revoked == False` in the query and `exp` in Python;
  a corrupt row missing `revoked` would be served by `get` but omitted from `list_active`. That
  under-reports in owner UI; it never over-grants.
- **Nested-slug over-share**: see the design observation above — dismissed as a gate bug;
  satellite slugs are single-segment.

## Rules of engagement / side effects (disclosed)

- **Live probes were GET-only**: `GET https://jason.cusati.us/{_health,/p,/p/,/p/anything,/p/anything/,
  /share,/share/,/s/,/s/notatoken/index.html,/session,/session/end,/cv,/cv/,/research,/research/}`.
  No mint, no grant, no write, no revoke, no sign-in, no credential submitted. The `/share*` and
  `/s*` requests were answered by Hosting's static 404 and never reached the gate.
- **Side effects**: the live requests that reached the gate (`/p/`, `/p/anything`, `/session*`)
  may have produced at most ordinary `event=` log lines; the public pages produced Hosting access
  logs. Nothing was created or changed server-side.
- **Unit work**: a throwaway ASGI harness under `/tmp/opencode/redteam` (`harness_app.py`), run with
  the branch's own `gate/.venv`. In-memory doubles only; no cloud credential, no Firestore write,
  no bucket write. No tracked file modified. Transcripts live in
  `/tmp/opencode/redteam/{path-battery,authz-battery,revoke-battery,smuggling-battery,cache-matrix,prefix-battery}.txt`.

## Open questions

1. **SEAM-S4 / firebase.json**: should `/share` and `/s` (bare) get explicit exact rewrites
   alongside `/share/**` and `/s/**`? Finding B says the current shape leaves `POST/GET /share`
   unreachable through Hosting. Owner to confirm on a deployed revision at SEAM-S7.
2. **SEAM-S2 vs implementation**: is the nonexistent-item 404 intended, or is "no existence oracle"
   the real requirement? If the former, note the gate cannot honour it without a `list`/probe it
   does not hold.
3. **Descendant over-share**: can the hub admit two items whose slugs nest under one
   `(section, source)`? If yes, SEAM-S1's "one token, one item" needs a subtree/prefix rule stated
   for the share UI.

## Related docs

- `llm/sprints/2026-09-hub/contracts/red-team-wave-3.md`
- `llm/sprints/2026-09-hub/contracts/phase-4-seams.md` (SEAM-S1..S8)
- `gate/app/shares.py`, `gate/app/main.py`, `gate/app/serve.py`, `gate/app/config.py`
- `gate/tests/test_shares.py`, `gate/tests/conftest.py`
- `infra/firestore.tf`, `infra/gate.tf`, `firebase.json`
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
