# Handoff — `gate`, Wave 0

Stream: `gate` implementation
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-0.md`
Issue: #44 (hub-007)
Date: 2026-09-18

---

## Summary

Two items were assigned. **One of them was already done before this stream started**, and
that is the first thing the Lead Architect needs to know.

### Item 1 — the health path: ALREADY LANDED, with one real gap now closed

The route is **not** on `/healthz` and has not been since Checkpoint 4. It is `/_health`, and
all three ends of the contract already agree:

| End | State on `main` | Where |
|---|---|---|
| The app's route | `@app.get("/_health")` | `gate/app/main.py` |
| The deploy smoke test | `curl "${URL}/_health"` | `.github/workflows/gate.yml` |
| The uptime check | `path = "/_health"` | `infra/monitoring.tf` (not mine) |
| The docs | a table row plus a "Why `/_health` and not `/healthz`" section | `gate/README.md`, `infra/README.md` |

`git log -S"_health"` names the commits: `f155fe4` ("hub-003: Checkpoint 4 — Hosting
rewrites, **reachable health path**, LF normalisation", #29) moved it, `a28f8b7` touched it
again. Nothing in `gate/**` or `gate.yml` references `/healthz` except comments explaining
why it is not used. `STATE.md` §Checkpoint 4 still ends at "The health route needs a
different path, or the smoke test does", which is why the contract was written as if the work
were outstanding — **the STATE record is stale, not the code**.

**I did not rename it to the suggested `/_gate/health`.** The contract invited a reasoned
alternative and this is it: `infra/monitoring.tf` pins `path = "/_health"` for the uptime
check that feeds the "gate is not answering" alert, and `infra/**` is explicitly not mine.
Renaming would break a live alert across a stream boundary, force an infra change, and buy
nothing — `/_health` is no more likely to be claimed by Google's frontend than
`/_gate/health` is, and it has already survived a deploy cycle. Changing it would also spend
a second live-verification cycle to re-earn evidence we can get by probing what is deployed.

**What I did find and fix.** The health path is a *three-way* cross-stream contract — app
route, uptime check, smoke test — and **nothing compared the three**. That is precisely the
shape `gate/tests/test_monitoring_contract.py` exists to guard (it already guards
`event=client_signin_failed` against `monitoring.tf` for the same reason), and the health path
was not in it. Three tests now are:

- `test_the_app_serves_the_health_path_and_not_the_intercepted_one` — asserts the declared
  route set contains `/_health` and **does not** contain `/healthz`;
- `test_the_uptime_check_probes_the_path_the_app_actually_serves` — reads
  `infra/monitoring.tf`;
- `test_the_deploy_smoke_test_probes_the_path_the_app_actually_serves` — reads `gate.yml`.

Both file-reading tests are `skipif`-guarded on the file existing, matching the idiom already
in that module.

Item 1's acceptance evidence is still a **live probe**, because the defect is a property of
Google's edge and not of the application. A passing local test proves nothing here. The exact
commands are in §Validation → Live probes, including the `/healthz` *control* probe: if the
control does not still show Google's 1568-byte page, the probe itself is not discriminating
and its result means nothing.

### Item 2 — sign-out (SD-4): implemented

`POST /session/end` clears `__session`. Every requirement in the contract is a test, and every
test has been shown to fail when the thing it tests is broken (§Validation → Break-it /
restore-it).

- **Clears with full attribute parity.** `app/main.py` now defines the cookie's attributes
  once, in `SESSION_COOKIE_ATTRS`, and both the mint path and the clear path use it, so the
  two headers are identical by construction. The test parses both `Set-Cookie` headers and
  compares them attribute by attribute anyway — a shared constant is a reason to believe, not
  a proof. The emitted header is
  `__session=""; HttpOnly; Max-Age=0; Path=/; SameSite=lax; Secure`.
- **CSRF-safe.** `_same_origin()` compares `Origin` against the host the request was
  addressed to (`Host`, or `X-Forwarded-Host`), requires `https`, and refuses a POST with no
  `Origin` at all. Nothing is configured, so the same code is correct on the site's domain
  and on the service's own `*.run.app` URL — which is what ADR-0004's `allUsers` invoker
  demands. Written as a standalone helper so Phase 4's mint and revoke can use it unchanged.
  It is applied **only** to `/session/end` this wave; see Open question 3.
- **No existence oracle.** The route never reads the cookie — no verification, no lookup,
  nothing to time. The test compares the full response shape across four cases (no cookie,
  live session, expired session, garbage cookie) and additionally asserts the verifier was
  never called, which is the assertion that catches a constant-looking answer that is still
  timeable.
- **`Cache-Control: private, no-store`** on both outcomes, from the existing middleware.
- **`event=` line in the existing grammar**: `event=allow scope=signout` and
  `event=deny scope=signout reason=cross_origin`. No `member=` field, deliberately — naming
  the member would mean verifying the cookie, which is the oracle the route avoids. **The
  assertions do not use `caplog`**; they push a buffer through the gate's own handler, and
  B7 below demonstrates the difference concretely.
- **Holds on a direct `*.run.app` request.** Every test runs twice through the existing
  `transport` fixture, and `gate.yml`'s smoke test now asserts both halves of the behaviour
  against the direct URL on every deploy.

**No server-side revocation.** Clearing the cookie ends the session in that browser. "Sign
out everywhere" needs the uid, which needs the cookie verified — work done on behalf of an
anonymous caller, and an oracle. That belongs with Phase 4's session work, where
`GATE_CHECK_REVOKED=true` already makes revocation bite on every request once something calls
it. Recorded as an ADR candidate.

### Files changed

| File | Change |
|---|---|
| `gate/app/main.py` | `SESSION_COOKIE_ATTRS`; mint path uses it; `POST /session/end`; `_same_origin()` |
| `gate/tests/test_signout.py` | **new** — 43 cases |
| `gate/tests/test_monitoring_contract.py` | 3 health-path contract tests |
| `gate/tests/test_scope.py` | route set now `{/session, /session/end, /p/{path:path}, /_health, /client-events}` |
| `gate/tests/conftest.py` | `origin_header()`; `FakeVerifier.verified` records every cookie it was asked about |
| `gate/README.md` | `/session/end` table row; a "Signing out" section |
| `.github/workflows/gate.yml` | smoke test also asserts sign-out clears, and that a cross-origin POST is refused |

Nothing outside `gate/**` and `.github/workflows/gate.yml` was modified. No `*.sh` was added
or changed (`find gate -name "*.sh"` is empty), so the `100755` constraint has nothing to bite
on this wave. **Note for staging:** this working tree also carries uncommitted `site/**`
changes from the concurrent `site` stream. They are not mine; stage by explicit path.

**223 tests before, 269 after. All green, `ruff check` and `ruff format --check` clean, under
Python 3.12.11.**

---

## Assumptions

1. **Firebase Hosting forwards the site's domain in `Host` or `X-Forwarded-Host`** on a Cloud
   Run rewrite. `tests/conftest.py` has modelled it as `Host` since Phase 3, but nothing in
   the gate read `Host` until now, so that model was never load-bearing and has never been
   checked against the real thing. The gate accepts either, so it cannot fail closed on the
   site's domain whichever it is. Open question 1 settles which, and Risk 1 says what to do
   then.
2. **Both real transports are HTTPS**, so a genuine same-origin `Origin` is always
   `https://…`. `_same_origin()` requires it. Plain-HTTP local development would be refused;
   there is no HTTP deployment of this service.
3. **`/_health` actually reaches the container.** `gate/app/main.py`'s comment records this as
   verified at Checkpoint 4 ("`/_health` and `/nope` both reach the app, `/healthz` alone does
   not"). I could not re-verify it — no cloud access, by contract — and `STATE.md` does not
   carry the post-rename confirmation. The probes below are the evidence.
4. **`trailingSlash: true` in `firebase.json` does not add a slash to a rewritten POST.** The
   existing `/session` rewrite works in production, which is the evidence. Risk 4 says what it
   would look like if that stopped being true for `/session/end`.

---

## Recommendations

1. **Add the `firebase.json` rewrite** (exact entry in §Validation). Without it
   `https://jason.cusati.us/session/end` is served by Hosting's static site, not the gate, and
   sign-out works only on the `*.run.app` URL. `firebase.json` is not mine.
2. **`site` stream: add the sign-out control.** The call must be same-origin so the browser
   sends `Origin`:

   ```js
   await fetch("/session/end", { method: "POST", credentials: "same-origin" });
   ```

   No body, no token, no header. Anything that makes it cross-origin (an absolute URL to the
   `run.app` host, `mode: "no-cors"` from another origin) will be refused with 403. A `<a
   href>` or a GET will not work and must not be added — a GET sign-out is triggerable by an
   `<img>` tag.
3. **Update `STATE.md` §Checkpoint 4 / §Follow-ups**: the `/healthz` finding is closed (the
   route moved in `f155fe4`), and SD-4 is closed by this wave pending the rewrite and the live
   probe. The stale record is what caused this contract to be written for work already done.
4. **Phase 4: reuse `_same_origin()` on mint and revoke**, which is why it was written as a
   free function rather than inlined.
5. Consider whether `POST /session` should get the same check — see Open question 3. I
   deliberately did not change it.

---

## Alternatives considered

- **Renaming the health route to `/_gate/health`**, as the contract suggested. Rejected:
  `infra/monitoring.tf` pins `/_health` and infra is not mine, so the rename would break a
  live uptime check and its alert across a stream boundary for no gain. See §Summary.
- **A configured allowlist of permitted origins** (`GATE_ALLOWED_ORIGINS`). Rejected: the env
  block belongs to infra, so this would add a fourth place (Terraform, Hosting, the app, the
  variable) that must be kept in step, and the first one to go stale fails closed on the real
  domain. The Origin-vs-Host comparison needs no configuration and is right on both hosts by
  construction.
- **A double-submit CSRF token or a required custom header.** Both work; both need client
  state or a preflight contract, and the site stream would have to implement a matching half.
  `Origin` is sufficient for a same-origin POST and costs the client nothing.
- **Accepting a POST with no `Origin` header.** Rejected. Every current browser sends `Origin`
  on a cross-site POST, so treating absence as trustworthy would admit exactly the request the
  check exists to refuse. Non-browser callers send their own; `gate.yml`'s smoke test does.
- **`response.delete_cookie()`** instead of `set_cookie(value="", max_age=0)`. Equivalent
  output, but it takes the attributes as separate arguments, which is how the two paths drift
  apart. The shared `SESSION_COOKIE_ATTRS` makes parity structural.
- **Revoking the Firebase session server-side on sign-out.** Deferred to Phase 4; it requires
  verifying the cookie, which is anonymous work and an oracle. See §ADR candidates.
- **Returning 204 rather than 200 + `{"status":"ok"}`.** Rejected: `/session` already answers
  a JSON status body and the site's sign-in code branches on the body rather than the status
  (deliberately — see `site/src/pages/signin/index.astro`). One grammar.

---

## Risks

1. **The `X-Forwarded-Host` branch is technically forgeable.** A caller that sets
   `X-Forwarded-Host: cross-site.invalid` alongside `Origin: https://cross-site.invalid` would
   be treated as same-origin. It is not reachable from a browser: a cross-site form POST
   cannot set that header, and setting it from `fetch()` makes the request preflighted — the
   gate answers no preflight and sends no `Access-Control-Allow-*`, so the browser never sends
   it. A non-browser attacker gains nothing, because CSRF is an attack on the *victim's*
   cookie, which such a caller does not have. **If Open question 1 shows Hosting forwards the
   site's domain in `Host`, delete the branch** — it is three lines and a comment.
2. **A browser that suppresses `Origin` cannot sign out** (403). Fail-closed, visible
   immediately, and no security is lost; the member can still clear cookies. No current
   browser does this on a POST.
3. **The deploy can now fail on sign-out.** `gate.yml`'s smoke test asserts both halves, so a
   regression in `/session/end` blocks the deploy rather than shipping silently. That is the
   intent, but it is a new way for a green pipeline to go red.
4. **`trailingSlash: true` + Starlette's `redirect_slashes`.** If Hosting ever redirects
   `/session/end` to `/session/end/`, the gate would 307 it back (a 307 preserves POST) and
   the browser would loop. The existing `/session` rewrite is the evidence this does not
   happen. The Hosting probe below detects it immediately — a 301/307 instead of a 200.
5. **Sign-out does not invalidate a stolen cookie.** It ends the session in that browser only.
   A cookie already exfiltrated stays valid for the remainder of its 14 days. This is SD-4's
   scope as written ("a member on a shared machine"), not a regression, but it should not be
   described to the owner as "sign out everywhere".
6. **The health path's correctness rests on a code comment.** `STATE.md` records the problem
   and not the fix. Until the probes below run, "the gate's health route is reachable" is a
   belief, and this sprint has already produced three guards that were beliefs.

---

## Open questions

1. **Which header carries `jason.cusati.us` on a Firebase Hosting → Cloud Run rewrite?**
   *Evidence that settles it:* the Hosting sign-out probe below, plus one Cloud Logging line.
   A gate log line for a request through Hosting does not print the headers, so add
   `--format json` to the log read and inspect `httpRequest`, or probe
   `https://jason.cusati.us/session/end` with `Origin: https://jason.cusati.us` — a 200 with
   the `Host` branch alone (after deleting the `X-Forwarded-Host` branch in a scratch build)
   is the direct test. *What it unblocks:* deleting Risk 1 entirely.
2. **Has `/_health` been confirmed live since the rename?** `STATE.md` says only that the
   route needed to move. *Evidence:* the health probes below, including the `/healthz`
   control and the empty log query for `/healthz`.
3. **Should `POST /session` (mint) also carry the Origin check?** A forged mint is a weaker
   attack than a forged revoke — the attacker must supply a valid ID token, which means
   signing the victim in as *someone else's* account (session fixation), not stealing
   anything. I did not add it: sign-in is the one flow that currently works end to end, email-
   link sign-in is the only working route, and changing its acceptance conditions immediately
   before Checkpoint 5 is a risk taken for a smaller benefit than this wave is buying.
   *Evidence that would settle it:* a decision on whether Phase 4's mint/revoke routes make
   session fixation reachable. My recommendation is to add it in Phase 4 together with revoke,
   behind the same helper, and verify all three in one live pass.
4. **Should `/_health` get a Hosting rewrite?** It has none today, so
   `https://jason.cusati.us/_health` is answered by the static site, not the gate. I believe
   that is correct — health is a deploy-and-uptime concern on the service's own URL, and a
   health endpoint on the public domain is surface for nothing — but the contract asked for a
   probe "through `https://jason.cusati.us`", so the Lead Architect should know that probe is
   expected to return the *static site's* 404 and that this is not the defect. Supporting
   evidence: `infra/monitoring.tf`'s uptime check already targets the Cloud Run service URI
   directly (`monitored_resource.labels.host` is derived from
   `google_cloud_run_v2_service.gate.uri`), not the site's domain, so nothing currently
   depends on `/_health` being reachable through Hosting.

---

## Related docs

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `__session`,
  `allUsers`, cache behaviour
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-2 (the cookie name), SEAM-9
  (Python 3.12, the `100755` rule)
- `llm/sprints/2026-09-hub/STATE.md` — §Checkpoint 4 (the `/healthz` finding, now stale),
  §The gate's structured logging never worked in production (why no `caplog`), §Follow-ups
  (SD-4), §Standing constraints
- `llm/specs/2026-09-10-research-hub-design.md` §6 (responsibility 1), §12
- `gate/README.md` — the "Signing out" section added by this wave
- `infra/monitoring.tf`, `infra/README.md` §"Why `/_health` and not `/healthz`" — the other
  two ends of the health-path contract

---

## ADR candidates

1. **"The gate's health path is `/_health`, because Google's frontend answers `/healthz`."**
   Durable, load-bearing across three streams (app route, uptime check, smoke test), and
   currently written down only in source comments and two READMEs. It survived four revisions
   precisely because nobody had written it as a decision. Should also record *why not*
   `/_gate/health`.
2. **"State-changing gate routes are CSRF-protected by comparing `Origin` against the host the
   request was addressed to, with no configured origin list."** This constrains Phase 4's mint
   and revoke and constrains the site stream's client code, and the "no configured list"
   half is the part a future contributor would otherwise undo as an apparent oversight.
3. **"Sign-out clears the cookie and does not revoke the session server-side."** An amendment
   to ADR-0004 decision 2, which describes minting only. The consequence — a stolen cookie
   outlives sign-out — should be recorded before Phase 4 adds "sign out everywhere" on top.

---

## Validation

Python: `/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12`
(3.12.11), via `gate/.venv`. Dev dependencies installed with
`uv pip install --require-hashes --no-deps -r requirements-dev.txt`.

### Baseline, before any change

```
$ ./.venv/bin/python -m pytest
223 passed, 2 warnings in 2.88s
$ ./.venv/bin/python -m ruff check .
All checks passed!
$ ./.venv/bin/python -m ruff format --check .
17 files already formatted
```

### After the change

```
$ ./.venv/bin/python -m ruff check .
All checks passed!
$ ./.venv/bin/python -m ruff format --check .
18 files already formatted
$ ./.venv/bin/python -m pytest
269 passed, 2 warnings in 3.50s
```

`.github/workflows/gate.yml` parses as YAML and both jobs are intact:

```
$ ./gate/.venv/bin/python -c "import yaml; d=yaml.safe_load(open('.github/workflows/gate.yml')); print(list(d['jobs']))"
parsed ok. jobs: ['test', 'build-and-deploy']
```

`actionlint` is not installed on this machine, so the workflow was validated by YAML parse and
by reading the rendered `run` block, not by a linter.

### Break-it / restore-it

Each guard was broken in `gate/app/main.py`, run red, restored from the original bytes, and
run green. The driver is scratch-only and is not in the repository. Verbatim, trimmed only of
pytest's two standing deprecation warnings.

**B1 — cookie parity: clear the cookie at a different `Path`.** The silent failure this route
is most likely to have.

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py::test_the_clear_carries_every_attribute_the_mint_path_sets
FAILED tests/test_signout.py::test_the_clear_carries_every_attribute_the_mint_path_sets[hosting]
FAILED tests/test_signout.py::test_the_clear_carries_every_attribute_the_mint_path_sets[direct]
2 failed, 2 warnings in 0.53s

--- RESTORED
2 passed, 2 warnings in 0.40s
```

**B2 — CSRF: remove the `Origin` check from the route** (`if not _same_origin(request):` →
`if False:`).

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py -k "cross_origin or no_origin_header"
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[hosting-empty]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-other-site]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-plain-http]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-null]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-suffix]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-prefix]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-other-port]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-path]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-empty]
FAILED tests/test_signout.py::test_a_post_with_no_origin_header_at_all_is_refused[hosting]
FAILED tests/test_signout.py::test_a_post_with_no_origin_header_at_all_is_refused[direct]
18 failed, 25 deselected, 2 warnings in 1.10s

--- RESTORED
18 passed, 25 deselected, 2 warnings in 0.51s
```

**B3 — CSRF, the subtle half: treat a MISSING `Origin` as same-origin** (`if not origin:
return False` → `return True`). This is the version of the bug that would survive a code
review, because the route still refuses every *named* cross-site origin.

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py -k "no_origin_header or empty"
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[hosting-empty]
FAILED tests/test_signout.py::test_a_cross_origin_post_is_refused_and_clears_nothing[direct-empty]
FAILED tests/test_signout.py::test_a_post_with_no_origin_header_at_all_is_refused[hosting]
FAILED tests/test_signout.py::test_a_post_with_no_origin_header_at_all_is_refused[direct]
4 failed, 39 deselected, 2 warnings in 0.62s

--- RESTORED
4 passed, 39 deselected, 2 warnings in 0.54s
```

**B4 — existence oracle: let the answer depend on whether a session existed.**

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py::test_the_answer_is_identical_whether_or_not_a_session_existed
FAILED tests/test_signout.py::test_the_answer_is_identical_whether_or_not_a_session_existed[hosting]
FAILED tests/test_signout.py::test_the_answer_is_identical_whether_or_not_a_session_existed[direct]
2 failed, 2 warnings in 1.40s

--- RESTORED
2 passed, 2 warnings in 1.12s
```

**B5 — caching: exempt `/session/end` from the `Cache-Control` middleware.**

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py::test_both_outcomes_are_private_no_store
FAILED tests/test_signout.py::test_both_outcomes_are_private_no_store[hosting]
FAILED tests/test_signout.py::test_both_outcomes_are_private_no_store[direct]
2 failed, 2 warnings in 0.65s

--- RESTORED
2 passed, 2 warnings in 0.46s
```

**B6a — delete the sign-out `event=` line.**

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py -k visible_in_the_log
FAILED tests/test_signout.py::test_a_sign_out_is_visible_in_the_log[hosting]
FAILED tests/test_signout.py::test_a_sign_out_is_visible_in_the_log[direct]
2 failed, 2 passed, 39 deselected, 2 warnings in 0.66s

--- RESTORED
4 passed, 39 deselected, 2 warnings in 0.44s
```

**B6b — write the refusal in a second, invented grammar** (`event=deny scope=signout
reason=cross_origin` → `sign-out refused (cross-origin)`). The contract forbids a second
grammar; this is the test that enforces it.

```
--- BROKEN
$ pytest --tb=line tests/test_signout.py -k visible_in_the_log
FAILED tests/test_signout.py::test_a_refused_sign_out_is_visible_in_the_log[hosting]
FAILED tests/test_signout.py::test_a_refused_sign_out_is_visible_in_the_log[direct]
2 failed, 2 passed, 39 deselected, 2 warnings in 0.56s

--- RESTORED
4 passed, 39 deselected, 2 warnings in 0.50s
```

**B7 — THE SPRINT'S OWN FAILURE MODE: give the gate logger no handler again.** This is the
defect that survived four revisions and 48 hours. `logger.addHandler(handler)` was removed
from `_configure_logging()`, and two suites were run side by side: my `event=` guards, which
assert through the gate's own handler, and the neighbouring `caplog`-based guard on
`/client-events`.

```
--- BROKEN -> my event= guards
$ pytest --tb=line tests/test_signout.py -k visible_in_the_log
FAILED tests/test_signout.py::test_a_sign_out_is_visible_in_the_log[hosting]
FAILED tests/test_signout.py::test_a_sign_out_is_visible_in_the_log[direct]
FAILED tests/test_signout.py::test_a_refused_sign_out_is_visible_in_the_log[hosting]
FAILED tests/test_signout.py::test_a_refused_sign_out_is_visible_in_the_log[direct]
4 failed, 39 deselected, 2 warnings in 0.61s

--- BROKEN -> the caplog-based guard next door
$ pytest --tb=line tests/test_client_events.py::test_emits_the_string_the_metric_filters_on
.                                                                        [100%]
1 passed, 2 warnings in 0.51s

--- RESTORED -> my event= guards
4 passed, 39 deselected, 2 warnings in 0.46s
--- RESTORED -> the caplog-based guard
1 passed, 2 warnings in 0.45s
```

Production could not log a single line, and the `caplog` test reported success. That is the
whole lesson of §The gate's structured logging never worked in production, reproduced on
demand. **The remaining `caplog` tests in `tests/test_client_events.py` are still blind to
this**; they are not mine to rewrite this wave, but they are a live example of a guard that
proves less than it appears to.

**B8 — health path: move the route back onto the intercepted `/healthz`.**

```
--- BROKEN
$ pytest --tb=line tests/test_monitoring_contract.py tests/test_scope.py -k "health or route"
FAILED tests/test_monitoring_contract.py::test_the_app_serves_the_health_path_and_not_the_intercepted_one
FAILED tests/test_scope.py::test_no_share_routes_are_declared - AssertionErro...
FAILED tests/test_scope.py::test_healthz_reveals_nothing[hosting] - assert 40...
FAILED tests/test_scope.py::test_healthz_reveals_nothing[direct] - assert 404...
4 failed, 31 deselected, 2 warnings in 0.60s

--- RESTORED
4 passed, 31 deselected, 2 warnings in 0.50s
```

Full suite after every restore: `269 passed, 2 warnings in 2.89s`.

**What these transcripts do not prove.** B8 shows the *local* contract holds. It says nothing
about whether `/_health` reaches the container on Cloud Run, because no local test can — that
is a property of Google's edge. Only the live probes below are evidence for that.

### The `firebase.json` rewrite entry — REQUESTED, NOT APPLIED

`firebase.json` is not mine. Add this object to `hosting.rewrites`. Placement among the
existing entries does not matter (the sources are disjoint literals); after the `/session`
entry reads most naturally.

```json
      {
        "source": "/session/end",
        "run": {
          "serviceId": "hub-gate",
          "region": "us-east1"
        }
      }
```

A separate entry is required: Hosting's `"source": "/session"` is a literal and does **not**
match `/session/end`. Widening the existing entry to `"/session{,/**}"` would work but adds
surface for no benefit, and would silently route any future `/session/*` path to the gate.

Until this lands, `POST https://jason.cusati.us/session/end` is answered by the static site
and sign-out works only on the `*.run.app` URL.

### Live probes — for the Lead Architect to run after merge and deploy

No cloud mutation was performed by this stream. Set `GCP_PROJECT_ID` to `vars.GCP_PROJECT_ID`
first. `gcloud` needs `CLOUDSDK_PYTHON` pointed at uv's CPython 3.12 on this machine (STATE,
Checkpoint 4).

```sh
URL="$(gcloud run services describe hub-gate \
  --project "$GCP_PROJECT_ID" --region us-east1 --format 'value(status.url)')"
echo "$URL"
```

**P1 — health, on the direct `*.run.app` URL. This is the decisive one.**

```sh
curl -sS -i --max-time 30 "$URL/_health"
```
Expect `200`, `cache-control: private, no-store`, body `{"status":"ok"}`.

**P2 — the control. Without this, P1's result means nothing.**

```sh
curl -sS -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\n' --max-time 30 "$URL/healthz"
curl -sS --max-time 30 "$URL/healthz" | head -c 200
```
Expect `status=404 bytes=1568` and `<html lang=en>` **unquoted** — Google's page. The gate's
own 404 is ~426 bytes with `<html lang="en">` quoted (`curl "$URL/nope"` shows it). If
`/healthz` now returns the gate's own 404 instead, the frontend's behaviour has changed and
the whole finding should be re-opened rather than assumed.

**P3 — the container log. The half that cannot be faked.**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="hub-gate"
   AND httpRequest.requestUrl:"/_health"' \
  --project "$GCP_PROJECT_ID" --limit 5 --freshness 10m \
  --format 'value(timestamp, httpRequest.requestUrl, httpRequest.status)'

gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="hub-gate"
   AND httpRequest.requestUrl:"/healthz"' \
  --project "$GCP_PROJECT_ID" --limit 5 --freshness 10m \
  --format 'value(timestamp, httpRequest.requestUrl, httpRequest.status)'
```
Expect rows for `/_health` and **zero rows** for `/healthz`. The empty result is the evidence
that the request never reached the container.

**P4 — health through `https://jason.cusati.us`. Read the expectation before running it.**

```sh
curl -sS -o /dev/null -w 'status=%{http_code} bytes=%{size_download}\n' --max-time 30 \
  https://jason.cusati.us/_health
```
`/_health` has **no Hosting rewrite**, so this is expected to return the static site's 404.
That is not the defect — see Open question 4. It is worth recording so nobody reads it as one.

**P5 — sign-out on the direct URL. Both halves.**

```sh
curl -sS -i --max-time 30 -X POST -H "Origin: $URL" "$URL/session/end"
```
Expect `200`, `{"status":"ok"}`, `cache-control: private, no-store`, and exactly:
`set-cookie: __session=""; HttpOnly; Max-Age=0; Path=/; SameSite=lax; Secure`

```sh
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 30 \
  -X POST -H "Origin: https://cross-site.invalid" "$URL/session/end"   # expect 403
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 30 \
  -X POST "$URL/session/end"                                          # expect 403 (no Origin)
```
These three are also asserted by `gate.yml`'s smoke test on every deploy, so a green deploy is
itself evidence; run them by hand once to see the header.

**P6 — sign-out through Hosting, after the rewrite lands. This settles Open question 1.**

```sh
curl -sS -i --max-time 30 -X POST \
  -H "Origin: https://jason.cusati.us" https://jason.cusati.us/session/end
```
Expect `200` and the same `Set-Cookie`. A `403` means Hosting put neither the site's domain in
`Host` nor in `X-Forwarded-Host` — report it; do not widen the check to compensate. A `301` or
`308` to `/session/end/` means `trailingSlash` is rewriting the POST path (Risk 4).

**P7 — the `event=` lines, which is what makes sign-out visible in Cloud Logging.**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="hub-gate"
   AND textPayload:"event=allow scope=signout"' \
  --project "$GCP_PROJECT_ID" --limit 5 --freshness 10m --format 'value(timestamp, textPayload)'

gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="hub-gate"
   AND textPayload:"event=deny scope=signout reason=cross_origin"' \
  --project "$GCP_PROJECT_ID" --limit 5 --freshness 10m --format 'value(timestamp, textPayload)'
```
Expect one row per P5 probe. `textPayload`, not `jsonPayload` — the handler is a plain
`StreamHandler` on stdout for exactly that reason. **Zero rows here while P5 returned 200
means the logging regression is back**, and it would be invisible everywhere else.
