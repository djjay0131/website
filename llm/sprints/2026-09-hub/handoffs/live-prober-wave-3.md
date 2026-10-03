# Handoff — `Live Prober`, Wave 3 (Phase 4 sharing)

Status: Complete
Date: 2026-10-03
Stream: `Live Prober` (read; wrote only this handoff)
Issue: `hub-004`
Contract: `llm/sprints/2026-09-hub/contracts/live-prober-wave-3.md`
Merged revision: **`921741e6602ddb351210ad2e5d6a856c6bbf0869`** (PR #93)

**Deployed serving revision `hub-gate-00009-snk`** (created `2026-10-03T07:06:04Z`,
100% of traffic, image `sha256:f4793ca1…`) · **deployed site SHA
`921741e6602ddb351210ad2e5d6a856c6bbf0869`** (`build-info.json`, `last-modified`
`2026-10-03T07:06:40Z`, `run_id` 37105156423) · **probes run
`2026-10-03T07:09:45Z`–`07:13:13Z`**. Revision and `build-info.json` re-read at the
end of the window and were unchanged, so every result describes one target version.

Origins: `H` = `https://jason.cusati.us` (Hosting),
`R` = `https://hub-gate-ywkmredngq-ue.a.run.app` (Cloud Run, canonical `status.url`).
All probes were GET only; traversal probes used `curl --path-as-is`. Log lines were
read with `gcloud logging read` against `resource.labels.service_name="hub-gate"`,
filtered by trace id where a trace header was returned.

---

## Headline

1. **Probes 1, 2, 4, 5, 6 pass.** `/share` and `/s/**` are behind the gate, return
   `private, no-store`, and are attributable to `hub-gate` by a matching container log
   line / trace. `build-info.json` reports the merged SHA and `content_source: bucket`.
2. **Probe 3 fails its literal contract statement (404 on both transports).** The
   gate refuses every traversal form it actually receives with a `329`-byte uniform
   `404`; but the platforms in front of it return **`302`/`307` path-normalisation
   redirects, and on Hosting a `500`, before the gate is reached.** No traversal
   escaped and no private content was served (followed redirects terminate in `404`),
   but the contract's "404 on both transports" does not hold as written.
3. **New confirmation of `#61`/S-5 on the `/s/**` half:** a NUL byte in the path
   returns Hosting's `500 Internal Error`, where the gate (reached on `run.app`)
   returns `404`. This is now confirmed on `/s/**` as well as `/p/**`.
4. **SEAM-S7 is PENDING** — owner-only, and agents must not mint/grant/revoke. Not run.
5. **Signed-in `/p/` is NOT TESTED** — no member session is available to an agent.

---

## Probe 1 — `/share` signed-out GET (gate refusal, not the static 404)

| Probe | Origin | Status | Key headers | Attributing log line | Verdict |
|---|---|---|---|---|---|
| `GET /share` | `H` | **403** | `cache-control: private, no-store`, `content-type: application/json`, body `{"status":"forbidden"}` (22 b), trace `b55f24c0…` | `INFO gate event=deny scope=share action=list reason=no_session_cookie` (`07:09:55.828181Z`) | **PASS** |
| `GET /share` | `R` | **403** | `cache-control: private, no-store`, same body | `INFO gate event=deny scope=share action=list reason=no_session_cookie` (`07:09:55.906594Z`) | **PASS** |

Contrast (proves it is *not* the static site): `GET /definitely-not-a-real-path-xyz/`
on `H` → `404` with **`cache-control: max-age=3600`**, `content-length: 21376`. The
`/share` refusal is `403`/`private, no-store`, i.e. the gate.

## Probe 2 — `/s/unknown-token/` uniform 404

| Probe | Origin | Status | Key headers | Attributing log line | Verdict |
|---|---|---|---|---|---|
| `GET /s/unknown-token/` | `H` | **404** | `cache-control: private, no-store`, 329 b, trace `baf9d891…`, **no `Set-Cookie`** | `INFO gate event=deny scope=share stage=token reason=unknown` (`07:09:57.459627Z`) | **PASS** |
| `GET /s/unknown-token/` | `R` | **404** | `cache-control: private, no-store`, 329 b, trace `32f301e7…`, **no `Set-Cookie`** | `INFO gate event=deny scope=share stage=token reason=unknown` (`07:09:57.545490Z`) | **PASS** |

Uniform body confirmed across three distinct unknown tokens — `unknown-token`,
`other-unknown-token`, `zzz` all return the identical body
`sha256 0ddd881d3b0e70762e25e0a3f5688b6fb5d5bc95318d1ecda51ac6da3d5e1abc`.

## Probe 3 — traversal under `/s/unknown-token/` (`--path-as-is`)

`H` = Hosting, `R` = run.app. "First hop" = status of the `--path-as-is` request
itself; "followed" = terminal status after `-L`.

| Form | `H` first hop | `R` first hop | Followed (both) | Gate received it? | Attributing log line | Verdict |
|---|---|---|---|---|---|---|
| `../` | **302** (`location: …/s/`) | **302** (`location: R/s/`) | 404 | **No** (platform-normalised first) | — | **FAIL literal** |
| `%2e%2e/` | **302** (`…/s/`) | **302** (`R/s/`) | 404 | **No** | — | **FAIL literal** |
| `../../build-info.json` | **302** (`…/build-info.json`) | **302** (`R/build-info.json`) | 404 | **No** | — | **FAIL literal** |
| `..%2f` | **302** | 404 (329) | 404 | `H`: no / `R`: yes | `event=deny scope=share stage=token reason=unknown` (`R`) | **FAIL literal (H)** |
| `%2e%2e%2f` | **302** | 404 (329) | 404 | `H`: no / `R`: yes | same | **FAIL literal (H)** |
| `%2e%2e%2f%2e%2e%2fbuild-info.json` | **302** | 404 (329) | 404 | `H`: no / `R`: yes | same | **FAIL literal (H)** |
| `%2fetc%2fpasswd` (absolute) | 404 (329) | 404 (329) | 404 | **Yes, both** | `event=deny scope=share stage=token reason=unknown` | **PASS** |
| `//etc/passwd` (absolute) | **307** (`location: /s/unknown-token/etc/passwd`) | 404 (329) | 404 | `H`: no / `R`: yes | same (`R`) | **FAIL literal (H)** |
| `..%5c` (backslash) | 404 (329) | 404 (329) | 404 | **Yes, both** | `event=deny scope=share stage=token reason=unknown` | **PASS** |
| `%5c` (backslash) | 404 (329) | 404 (329) | 404 | **Yes, both** | `event=deny scope=share stage=token reason=unknown` | **PASS** |
| `%00` (NUL) | **500** `Internal Error` (14 b, `fastly-restarts: 1`) | 404 (329) | — | `H`: no / `R`: yes | same (`R`) | **FAIL literal (H)** |
| `index.html%00.txt` (NUL) | **500** `Internal Error` | 404 (329) | — | `H`: no / `R`: yes | same (`R`) | **FAIL literal (H)** |

**Containment verdict: PASS — no traversal escaped.** Every form the gate actually
received was a uniform `329`-byte `404` (`event=deny scope=share stage=token
reason=unknown`); every form the platform normalised first resolved to `404` when the
redirect was followed (Hosting to `content-*-firebasehosting-origin.googleapis.com`
→ "Site Not Found" `404`/`21265`; run.app to `R/s/` → gate `404`/`329`). No private
object, and no `build-info.json` other than the already-public one, was returned.

**Literal verdict: FAIL on `H` (and on `R` for the bare-dot forms).** The contract
says "404 on both transports"; the front ends return `302`/`307`, and Hosting returns
`500` for NUL, before the gate. The `302` is **not** client-side `curl` normalisation —
`--path-as-is` was used and the `Location` is server-issued. Gate request logs contain
no entry for the raw `../` or `%2e%2e/` forms, which is the proof the gate was never
reached. This reproduces and extends `roadmap-truth` `RT-6` (the two transports refuse
encoded traversal differently).

**NUL is `#61`/S-5:** the same Hosting `500` previously recorded for `/p/%00` is now
confirmed for `/s/unknown-token/%00` and `/s/unknown-token/index.html%00.txt`
(`fastly-restarts: 1`, 14-byte `Internal Error`). `run.app` returns the gate's `404`.

## Probe 4 — signed-out routes

| Probe | Origin | Status | Key headers | Attributing log line | Verdict |
|---|---|---|---|---|---|
| `GET /p/` | `H` | **404** (426 b) | `cache-control: private, no-store`, trace `6e3bb4c7…` | `INFO gate event=deny scope=private stage=session reason=no_session_cookie` (`07:10:09.931795Z`) | **PASS** |
| `GET /p/` | `R` | **404** (426 b) | `cache-control: private, no-store`, trace `2a4d0ca4…` | same (`07:10:09.867395Z`) | **PASS** |
| `GET /` | `H` | **200** (18441 b) | `cache-control: max-age=3600` (static) | n/a (static site, no gate route) | **PASS** |
| `GET /projects/kgis/kgis-docs/` | `H` | **200** (12082 b) | `cache-control: max-age=3600` (static) | n/a (static site) | **PASS** |
| `GET /` | `R` | **404** (329 b) | `cache-control: private, no-store` | gate `Not found` | **PASS** (gate has no `/` route; static routes are Hosting-only) |
| `GET /projects/kgis/kgis-docs/` | `R` | **404** (329 b) | `cache-control: private, no-store` | gate `Not found` | **PASS** (as above) |
| `GET /p/` signed-in | — | — | — | — | **NOT TESTED** — no member credential |

Note: `/` and `/projects/kgis/kgis-docs/` are static Hosting routes; on the raw
`run.app` service they are not expected to exist and correctly `404`.

## Probe 5 — rewrites live (`/share`, `/share/**`, `/s/**` reach `hub-gate`)

Attribution was proved by taking `x-cloud-trace-context` from the Hosting response and
matching a `run.googleapis.com/requests` entry for `hub-gate`.

| Probe | Origin | Status | Trace → gate request entry | Verdict |
|---|---|---|---|---|
| `GET /share` | `H` | 403 | `b55f24c0…` → `…run.app/share` 403 `07:09:55.824977Z` | **PASS** |
| `GET /share/foo` | `H` | **405** (329 b, `private, no-store`) | `3d4dd8d9…` → `…run.app/share/foo` 405 `07:11:56.179896Z` | **PASS** |
| `GET /share/` | `H` | **307** (0 b, `private, no-store`) | `59c47a3f…` → `…run.app/share/` 307 `07:11:56.259279Z` (FastAPI `/share/`→`/share` redirect) | **PASS** |
| `GET /s/unknown-token/` | `H` | 404 | `baf9d891…` → `…run.app/s/unknown-token/` 404 `07:09:57.400444Z` | **PASS** |
| `GET /s/unknown-token/deep/path.txt` | `H` | 404 | `1a4856d2…` → `…run.app/s/unknown-token/deep/path.txt` 404 `07:11:56.346826Z` | **PASS** |
| `GET /share/foo` | `R` | 405 | `47d388a9…` → gate 405 | **PASS** |
| `GET /share/` | `R` | 307 | `11fecdc7…` → gate 307 | **PASS** |
| `GET /s/unknown-token/deep/path.txt` | `R` | 404 | `b7c25a1c…` → gate 404 | **PASS** |

All three rewrite families are live and reach `hub-gate` on both transports.

## Probe 6 — `build-info.json`

| Probe | Origin | Status | Value | Verdict |
|---|---|---|---|---|
| `GET /build-info.json` | `H` | **200** | `built_from_sha: 921741e6602ddb351210ad2e5d6a856c6bbf0869` (= merged `921741e`), `content_source: "bucket"`, `run_id: "37105156423"`, `last-modified: 2026-10-03T07:06:40Z` | **PASS** |
| `GET /build-info.json` | `R` | 404 (329 b) | gate `Not found` — the gate does not serve the static artifact | **PASS / N/A** |

The full SHA equals this run's merge commit `921741e…` (or later, here exactly equal),
and `content_source` is `bucket`.

## Probe 7 — SEAM-S7 owner mint/open/revoke

**PENDING.** Mint (`POST /share`), list (`GET /share`), and revoke
(`DELETE /share/{token}`) are **owner-only** and explicitly **not mine to run**; agents
must not mint, grant, or revoke. The signed-out half is covered by probes 1 and 2; the
owner half remains for the owner's Checkpoint 5 step. No credential was created or used.

---

## Probes that could not run

| Probe | Why |
|---|---|
| Signed-in `/p/` (contract §4 second half) | No member session available to an agent; the allowlist matches the exact Firebase ID-token email and this machine's identity is deliberately not a member. **NOT TESTED.** |
| SEAM-S7 owner mint / open / revoke (contract §7) | Owner-only; agents must not mint/grant/revoke. Recorded **PENDING**. |
| Any write, grant, or token operation | Out of scope by contract; GET only. |

## Findings (recorded, not fixed)

- **F1 — traversal first-hop is not 404 on Hosting.** `..`, `%2e%2e`, `%2e%2e%2f`,
  `..%2f`, `//`-absolute and `../../build-info.json` return Hosting `302`/`307`
  path-normalisation redirects before the gate; the gate never logs them. run.app also
  `302`s the bare `../` and `%2e%2e/` forms. **Containment holds** (followed redirects
  end in `404`; the gate `404`s every encoded form it does receive), but the contract's
  "404 on both transports" is not literally met. Extends `RT-6`.
- **F2 — NUL in path → Hosting `500`.** Confirmed on `/s/**` (`/s/unknown-token/%00`,
  `/s/unknown-token/index.html%00.txt`), matching the existing `#61`/S-5 finding on
  `/p/**`. `run.app` returns the gate's `404`. No data exposed; the response is a
  14-byte `Internal Error`.
- **F3 — `/share/` returns `307`.** The gate (FastAPI) redirects `/share/` → `/share`;
  both hops are `private, no-store` and gate-attributed. Not a defect, recorded for
  completeness.

## Verdict summary

| Contract check | Verdict |
|---|---|
| 1. `/share` signed-out gate refusal | **PASS** |
| 2. `/s/unknown-token/` uniform 404, no cookie | **PASS** |
| 3. Traversal 404 on both transports | **FAIL (literal) / PASS (containment)** — platform `302`/`307`, Hosting `500` on NUL; gate never bypassed |
| 4. `/p/` 404, `/` 200, `/projects/kgis/kgis-docs/` 200 | **PASS** (signed-in half NOT TESTED) |
| 5. Rewrites reach `hub-gate` | **PASS** |
| 6. `build-info.json` SHA + `content_source: bucket` | **PASS** |
| 7. SEAM-S7 owner-only | **PENDING** (not run) |

## Related docs

- `llm/sprints/2026-09-hub/contracts/live-prober-wave-3.md` (this contract)
- `llm/sprints/2026-09-hub/handoffs/gate-wave-3.md`, `site-wave-3.md`, `infra-wave-3.md`
- `llm/sprints/2026-09-hub/handoffs/live-prober-wave-0.md` (the 404 discrimination guide)
- `llm/sprints/2026-09-hub/STATE.md` (`#61`/S-5, `RT-6`)
- `firebase.json` (the `/share`, `/share/**`, `/s/**` rewrites)
