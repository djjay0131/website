# Gate — Wave 0 fixes (the three §8 blockers)

Stream: `gate` (fixes only — not the stream that wrote this code)
Date: 2026-09-19
Contract: `llm/sprints/2026-09-hub/contracts/gate-wave-0-fixes.md`
Issue: #44 (hub-007); fixes #54, #57, Security Tester check 3 / S-2, Chief Reviewer B-2 and B-3
Files changed: `gate/**` only — `app/config.py`, `app/main.py`, `README.md`,
`tests/conftest.py`, `tests/test_signout.py`, `tests/test_client_events.py`,
`tests/test_monitoring_contract.py`

---

## Summary

Four items fixed, each shown failing before it is shown passing. Suite: **269 before, 295 after**,
`ruff check` and `ruff format --check` clean.

| Item | Was | Is |
|---|---|---|
| 1 — CSRF | accepted-origin set built from `Host` + `X-Forwarded-Host`, i.e. from the request | set comes from `GATE_ALLOWED_ORIGINS`; unset refuses everything, loudly |
| 2 — the test defending the bug | asserted a forged `x-forwarded-host` returns **200 + cleared cookie** | asserts an unaccepted `Origin` is refused **however it spells its Host headers**, all three demonstrated spellings as explicit cases |
| 3 — alert-channel guard (#57) | `tf.count("notification_channels = [")` — a spelling | every `google_monitoring_alert_policy` block has a non-empty `notification_channels` value: inline list, `local.*` or variable alike |
| 4 — metric forgery (#54) | a client value could carry `event=`, so an anonymous caller could make either metric count | client strings may not carry the gate's `event=` grammar; such reports are **counted, reclassified and kept**, never dropped |

**The one thing I need routed, because `infra/**` is not mine:** a new environment variable
`GATE_ALLOWED_ORIGINS`. Exact name, value shape and the Terraform expression are in the next
section. **Until it is set, `POST /session/end` refuses every request** — deliberately, and that is
the direction the contract chose. Item 1 is not finished until infra renders it.

### What changed, by item

**Item 1.** `_same_origin(request, settings)` now compares the request's `Origin` — parsed by
`config.parse_origin()` — against `settings.allowed_origins`, a frozenset built at startup from
`GATE_ALLOWED_ORIGINS`. Nothing in that set comes from the request. `Host` and `X-Forwarded-Host`
are no longer read anywhere in the gate. The same `parse_origin()` parses both the configured set
and the incoming header, so the two ends of the comparison cannot disagree about case, a trailing
slash, or what an origin is. Everything the contract said to keep is kept and still tested: missing
`Origin` refused, `null` refused, non-`https` refused, `Origin` with path/query/fragment refused;
`userinfo` (`https://evil.example@real.example`) is refused too.

Unset fails closed **and loudly**, in three places: `create_app()` logs
`event=misconfigured setting=GATE_ALLOWED_ORIGINS effect=signout_refuses_every_request` at ERROR;
the boot line reads `allowed_origins=none` instead of naming the set; and every refusal logs
`event=deny scope=signout reason=no_allowed_origins_configured` rather than the ordinary
`reason=cross_origin`. There is no fallback to header comparison — a fallback is the same defect
returning under a better name.

**Item 2.** `test_the_site_domain_is_recognised_when_it_arrives_in_x_forwarded_host` is gone,
replaced by `test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers`, parametrised
over the three spellings demonstrated over real HTTP plus an honest-Host control. Its docstring says
what it replaced and why, and says plainly that the Hosting-header question **stays open**, that a
unit test cannot settle it, and that a live probe does — the probe is below. I added a second test in
the other direction, `test_an_accepted_origin_is_accepted_whatever_the_host_headers_say`: a test that
only shows forged headers being refused is equally satisfied by a route that refuses everything.

**Item 3.** The guard is now a pure function, `policies_without_a_channel(tf)`, plus a thin test over
the real file. Making it a pure function is what lets it be shown failing on a policy that delivers
nowhere **without editing `infra/monitoring.tf`**, which is not mine. The "not commented out"
assertion is kept verbatim. I also added an assertion the old guard lacked: the parser must see as
many policies as the file declares, so a parser that silently found one policy in a three-policy file
cannot report "nothing missing" for ever.

**Item 4.** No authentication added — `/client-events` stays anonymous by design (ADR-0013 decision
1). `_clean_client_value()` is **unchanged**: it was not at fault. A new `_neutralise_grammar()`
rewrites `event=` to `event-` (case-insensitively) in every client-supplied string — trace id, event
name, field names, field values — and returns a count. If anything was neutralised the report is
emitted under its own class:

```
INFO gate event=client_grammar_rejected trace=t-1 smuggled=1 reported=probe note=event-deny
```

**What an operator sees.** A distinct event class that matches **neither** metric filter;
`smuggled=` is how many times the grammar appeared in that report; `reported=` is what the caller
called the event; the neutralised field values are still there, so the report is still diagnostic.
A stray one is browser noise. A sustained stream of `event=client_grammar_rejected` is someone
working on the metrics, and it is visible as itself rather than as the metric they were aiming at.
Reclassification matters as much as neutralisation: a report that smuggles the grammar does not get
to land in the sign-in-failure metric by naming itself `signin_failed`.

---

## The environment variable `infra` must route

```
name  : GATE_ALLOWED_ORIGINS
shape : comma-separated serialized https origins — "https://host[:port]", no path,
        no trailing slash, no query, no fragment. Whitespace around entries is
        trimmed; malformed entries are dropped, not guessed.
where : infra/gate.tf, the env block of google_cloud_run_v2_service.gate, beside
        GATE_PRIVATE_BUCKET and GOOGLE_CLOUD_PROJECT.
```

It **must name both origins the gate answers on**, because ADR-0004 puts the invoker at `allUsers`:
the site domain *and* the service's own `*.run.app` URL. One without the other gives a gate that
passes one transport's tests and refuses every real sign-out on the other.

```hcl
env {
  name = "GATE_ALLOWED_ORIGINS"
  value = join(",", [
    "https://${var.domain}",
    "https://${local.gate_service_name}-${data.google_project.hub.number}.${var.region}.run.app",
  ])
}
```

Every identifier there exists today: `var.domain`, `var.region`, `local.gate_service_name`
(`gate.tf`), and `data.google_project.hub` (`main.tf`, already surfaced as the `project_number`
output).

**Do not use `google_cloud_run_v2_service.gate.uri` for this.** It is the obvious choice and it is a
self-reference — the service's own env block cannot read the service's own computed URL, and
Terraform will refuse the configuration. The string above is constructed from the project number and
region instead, which is the same URL Cloud Run's current scheme produces and costs no cycle.

Three notes on the value:

1. **Verify it against the deployed URL after the first apply.** If the service predates the current
   URL scheme its host may be the older `<service>-<hash>-<regioncode>.a.run.app` form instead. The
   boot log prints the accepted set verbatim (`allowed_origins=https://…,https://…`), so one look at
   the revision's first log line confirms it rather than inferring it. Adding both spellings is
   harmless if there is any doubt.
2. **`var.redirect_domains` is deliberately excluded.** Those hosts answer a 301 to `var.domain`, so
   a browser never has one as its origin when it POSTs. If that ever changes they must be added.
3. **No secret is involved.** Both values are public hostnames, which is why the gate prints them at
   boot.

---

## Validation

Python 3.12.11, `gate/.venv`. Every transcript below is as produced. Where I elided anything it is
only pytest's two standing deprecation warnings, and it is marked.

### Baseline, before any change

```
$ .venv/bin/python -m pytest
........................................................................ [ 26%]
........................................................................ [ 53%]
........................................................................ [ 80%]
.....................................................                    [100%]
269 passed, 2 warnings in 3.00s
```

### Item 1 and item 2 — break 1

Break: put the header-derived fallback back into `_same_origin` — accept the configured set, then
fall back to the union of `Host` and the comma-split `X-Forwarded-Host`, exactly as shipped.

```
--- RED (broken) ---
FFF.                                                                     [100%]
=================================== FAILURES ===================================
E   assert 200 == 403
     +  where 200 = <Response [200 OK]>.status_code
----------------------------- Captured stdout call -----------------------------
INFO gate event=allow scope=signout
/mnt/c/code/website/gate/tests/test_signout.py:233: assert 200 == 403
   [two further failures, identical assertion and line]
=========================== short test summary info ============================
FAILED tests/test_signout.py::test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[forged-x-forwarded-host]
FAILED tests/test_signout.py::test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[x-forwarded-host-comma-list]
FAILED tests/test_signout.py::test_an_unaccepted_origin_is_refused_however_it_spells_its_host_headers[forged-host]

--- GREEN (restored) ---
....                                                                     [100%]
```

`FFF.` is the result worth reading: **three** of the four cases fail and the fourth passes. The
fourth is the honest-Host control, which the shipped code also refused — so the parametrisation
discriminates between the bypass and the case that always worked, rather than failing wholesale.
The three that fail are the three spellings the Security Tester and Red Team demonstrated over real
HTTP, by name. The captured `event=allow scope=signout` line is the bypass itself: the broken gate
clearing a cookie for `Origin: https://cross-site.invalid`.

### Item 1, the loud half — break 2

Break: delete the `logger.error(...)` from the unset-origins branch, leaving the `403` intact — a
gate that still fails closed but tells nobody why.

```
--- RED (broken) ---
..FF                                                                     [100%]
=================================== FAILURES ===================================
E   AssertionError: assert 'event=deny scope=signout reason=no_allowed_origins_configured' in ''
----------------------------- Captured stdout call -----------------------------
INFO gate event=boot logging=already-configured allowed_origins=none
ERROR gate event=misconfigured setting=GATE_ALLOWED_ORIGINS effect=signout_refuses_every_request
/mnt/c/code/website/gate/tests/test_signout.py:295: AssertionError
   [second failure identical, the other transport]
=========================== short test summary info ============================
FAILED tests/test_signout.py::test_an_unconfigured_origin_set_says_so_in_the_log_rather_than_failing_quietly[hosting]
FAILED tests/test_signout.py::test_an_unconfigured_origin_set_says_so_in_the_log_rather_than_failing_quietly[direct]

--- GREEN (restored) ---
....                                                                     [100%]
```

`..FF` is the point of this one: the two `403` assertions stay green and only the log assertions go
red. Failing closed and *saying so* are pinned separately, so a future change cannot keep the
refusal and lose the explanation. Both transports fail, which is what `allUsers` requires.

### Item 3 — the #57 evidence, old guard against new, both trees

Run against `main`'s `infra/monitoring.tf` and `feat/infra-wave-0`'s (PR #53), neither modified:

```
main (3 inline literals)
   declared policies          : 3
   parser saw                 : 3
   OLD guard: count('notification_channels = [') = 3  -> assert 3 >= 3  : PASS
   NEW guard: policies_without_a_channel() = []  : PASS
feat/infra-wave-0 / PR #53 (local.*)
   declared policies          : 3
   parser saw                 : 3
   OLD guard: count('notification_channels = [') = 0  -> assert 0 >= 3  : FAIL
   NEW guard: policies_without_a_channel() = []  : PASS
```

That is B-2 reproduced and closed: the old guard goes red at the moment the code improves — #53's
policies get email **and** SMS — and the new one passes on both trees. The merge collision between
#47 and #53 is gone in either order.

### Item 3 — break 3, the guard against a real file that delivers nowhere

Break: point `MONITORING` at a copy of `infra/monitoring.tf` with `signin_failing`'s channel list
emptied to `[]` — **not** commented out, so the pre-existing "not commented out" assertion cannot be
what catches it, and the new property assertion is the only thing that can.

```
--- RED (broken) ---
F                                                                        [100%]
=================================== FAILURES ===================================
E   AssertionError: alert policies that would deliver nowhere: ['signin_failing']. Every policy must attach a channel -- inline list, local.* or variable alike.
    assert ['signin_failing'] == []
      Left contains one more item: 'signin_failing'
/mnt/c/code/website/gate/tests/test_monitoring_contract.py:244: AssertionError
=========================== short test summary info ============================
FAILED tests/test_monitoring_contract.py::test_every_alert_policy_has_a_notification_channel

--- GREEN (restored) ---
.                                                                        [100%]
```

The failure **names the policy**, which the old counting guard could not do.

The anchor was proven unique before the break, in both directions: `MONITORING = REPO / "infra" /
"monitoring.tf"` occurs once in the test file, and within the broken copy the channel line was
replaced only inside the `signin_failing` block, asserted unique there (the same literal appears
three times in the file — patching the wrong one is exactly the error this sprint made three times).

### Item 3 — break 4, the guard's own emptiness test

Break: make `_delivers_somewhere()` return `True` unconditionally.

```
--- RED (broken) ---
.....F.F.                                                                [100%]
=========================== short test summary info ============================
FAILED tests/test_monitoring_contract.py::test_the_channel_guard_catches_a_policy_that_delivers_nowhere[an empty list]
FAILED tests/test_monitoring_contract.py::test_the_channel_guard_catches_a_policy_that_delivers_nowhere[an empty multi-line list]

--- GREEN (restored) ---
.........                                                                [100%]
```

**Recorded honestly: two of the four "delivers nowhere" cases went red, not four.** The other two —
"no assignment at all" and "commented out" — are caught earlier, on the `value is None` path, which
this break does not touch. So the transcript is correct and the guard has two independent halves;
I am not claiming a cleaner red than I got.

### Item 4 — break 5

Break: change `CLIENT_EVENT_GRAMMAR` from `"event="` to `"zzzz="`, so the gate's own grammar passes
through a client value again.

```
--- RED (broken) ---
.......FFFFFFF..                                                         [100%]
=================================== FAILURES ===================================
E   AssertionError: an anonymous caller just forged a denial
    assert 'event=deny' not in 'INFO gate e...event=deny\n'
      'event=deny' is contained here:
        orge note=event=deny
------------------------------ Captured log call -------------------------------
INFO     gate:main.py:563 event=client_probe trace=t-forge note=event=deny

E   AssertionError: assert 'event=client_signin_failed' not in 'INFO gate e...nin_failed\n'
INFO     gate:main.py:563 event=client_probe trace=t-forge failure_class=event=client_signin_failed

E   AssertionError: assert 'event=deny' not in 'INFO gate e...vent=deny \n'
INFO     gate:main.py:563 event=client_probe trace=event=deny

E   AssertionError: assert 'event=deny' not in 'INFO gate e...e=t-forge \n'
INFO     gate:main.py:563 event=client_x_event=deny trace=t-forge

E   AssertionError: assert 'EVENT=deny' not in 'INFO gate e...EVENT=deny\n'
INFO     gate:main.py:563 event=client_probe trace=t-forge note=EVENT=deny

E   AssertionError: assert 'smuggled=2' in 'INFO gate event=client_probe trace=t-forge note=event=deny why=event=allow\n'

E   AssertionError: assert 'event=client_signin_failed' not in 'INFO gate e...event=deny\n'
INFO     gate:main.py:563 event=client_signin_failed trace=t-forge note=event=deny
=========================== short test summary info ============================
FAILED tests/test_client_events.py::test_a_field_value_cannot_smuggle_the_denials_metric_trigger
FAILED tests/test_client_events.py::test_a_field_value_cannot_smuggle_the_signin_failure_metric_trigger
FAILED tests/test_client_events.py::test_the_trace_id_cannot_smuggle_it_either
FAILED tests/test_client_events.py::test_the_event_name_cannot_smuggle_it_either
FAILED tests/test_client_events.py::test_case_does_not_get_it_past
FAILED tests/test_client_events.py::test_a_rejected_report_is_counted_and_kept_not_dropped
FAILED tests/test_client_events.py::test_a_smuggled_signin_failure_is_not_counted_as_a_signin_failure

--- GREEN (restored) ---
................                                                         [100%]
```

The captured lines are the Red Team's attack 1 reproduced in the harness — `note=event=deny` and a
`failure_class` carrying the sign-in-failure trigger, both landing in a line the metric filters
match. The last nine dots in the red run are the existing tests, including redaction, the newline
scrubber and the metric-token test, all still green while the forgery tests fail: the break is
narrow and the guard is specific to it.

`.......FFFFFFF..` also shows `test_an_honest_report_is_untouched_and_still_reaches_the_metric`
passing under the break — the regression guard that stops a future "fix" from neutralising ordinary
reports.

### No `caplog` in anything new

Every log assertion I added goes through the gate's own handler, via
`conftest.through_the_gates_own_handler()`. I moved that helper out of `test_signout.py` into
`conftest.py` rather than writing a third copy of it, and `test_signout.py` imports it. The four
pre-existing `caplog` assertions in `test_client_events.py` (G-4) are untouched and still blind; I
added no fifth. Two new tests cover the same ground as two of them, through the handler.

### Final state

```
$ .venv/bin/ruff check .
All checks passed!
$ .venv/bin/ruff format --check .
18 files already formatted
$ .venv/bin/python -m pytest
295 passed, 2 warnings in 3.38s
```

Restoration verified rather than assumed: no `BROKEN`, `zzzz=` or scratchpad path remains anywhere
in `gate/`, `MONITORING` points at `REPO / "infra" / "monitoring.tf"`, and `CLIENT_EVENT_GRAMMAR` is
`"event="`.

### Two near-misses, recorded because this sprint keeps finding them

**1. The anchor rule caught me, on a restore rather than a break.** Break 2 removed the
`logger.error(...)` block, leaving the replacement text
`return JSONResponse({"status": "forbidden"}, status_code=403)` — which then occurred **twice** in
`main.py`, in the misconfiguration branch and in the cross-origin branch. The restore refused:

```
AssertionError: ANCHOR NOT UNIQUE in main.py: 2 occurrences of '            return JSONResponse({"status": "forbidden"}, sta'
```

Without the assertion it would have patched the first match and I would have read the resulting
green as proof, with the cross-origin branch silently rewritten. The repair re-anchored on the
unique comment line above the branch. I have since made the harness assert uniqueness in **both**
directions — that the anchor occurs once before the edit, and that the replacement text occurs zero
times — because a break that is unique is not necessarily a restore that is.

**2. A selector bug ran zero tests and printed a clean-looking transcript.** My first break-2 run
passed `"tests/test_signout.py -k a or b"` as one string and split it on whitespace, so pytest
received `or` and the rest as file arguments and collected nothing. The output had no `F`, no `.`
and no count — and would have read as "restored, green" to a careless eye. This is the same shape as
the verifier who patched the mint path and read `43 passed` as proof. Every transcript above shows
its progress characters for that reason; a run with no dots is not a passing run.

---

## Assumptions

1. **The worktree did not contain the code under review.** It sits on `admin/wave-0-preconditions`,
   where `gate/**` matches `main` and predates #47 — no `test_signout.py`, no `/session/end`. I was
   told never to check out a branch, so I materialised `feat/gate-signout`'s `gate/**` into the
   worktree file by file (`git show feat/gate-signout:<path> > <path>`), touched no git ref, and
   confirmed the baseline was the contract's stated 269. **My changes are therefore a diff on top of
   #47's tree and are applied to the worktree, not committed to the branch.** `gate/tests/test_scope.py`
   shows as modified for that reason alone — it is #47's version, unedited by me.
2. **`site/**` changes in this worktree are not mine.** The concurrent `site` stream is writing
   there. I modified nothing outside `gate/**` and did not touch `.github/workflows/gate.yml`.
3. `GATE_ALLOWED_ORIGINS` is the right mechanism because every other gate setting is a `GATE_*`
   environment variable rendered by Terraform, and that prefix is already load-bearing
   (`gate.tf`'s own comment on the `PRIVATE_BUCKET`/`GATE_PRIVATE_BUCKET` defect).
4. The gate's log grammar is `event=` and only `event=`. If a future metric filters on something
   else a client can write, this fix does not cover it — the allowlist and this constant are the
   two places to look.
5. Cloud Run's URL for this service follows the `<service>-<project-number>.<region>.run.app`
   scheme, which is what the Red Team's live probe of production shows. Assumption 1 of the routing
   note above says how to confirm it cheaply rather than trust it.

---

## Recommendations

1. **Route `GATE_ALLOWED_ORIGINS` before #47 merges or deploys.** Sign-out refuses everything until
   it exists. This is the one cross-stream dependency the fix creates, and it is deliberate.
2. **Run the P6 probe once `/session/end` is deployed behind the Hosting rewrite (#48).** The
   question — which header carries the site domain on a rewrite — is now *decoupled from security*:
   the gate reads neither header, so neither answer can reopen the bypass. It is still worth
   answering, because Phase 4 and anything else reasoning about Hosting's behaviour needs it. It is
   no longer urgent, and it is no longer settleable by a unit test. Suggested, against the deployed
   service:

   ```
   curl -sS -D - -o /dev/null -X POST -H "Origin: https://<site-domain>" https://<site-domain>/session/end
   curl -sS -D - -o /dev/null -X POST -H "Origin: https://<run-app-host>" https://<run-app-host>/session/end
   ```

   Both must return 200 with a `Set-Cookie` clearing `__session`. If the first returns 403, the
   site domain is missing from the variable — not a code defect.
3. **Add a log-based alert on `event=misconfigured`.** Infra's, and cheap. See the first risk below
   for why I do not want to lean on the deploy smoke test alone.
4. **Consider narrowing `hub-gate-denials` to `event=deny scope=` anyway** (the Red Team's
   recommendation). My fix stops a client *value* carrying the grammar, which closes the
   demonstrated attack. Anchoring the filter on a grammar client lines structurally cannot produce —
   they are `event=client_*` and carry no `scope=` — is defence in depth on the metric side, and it
   is `infra/**`, not mine. The two fixes are independent and both are worth having.
5. **`_clean_client_value()` should stay as it is.** It was correct; the Red Team said so
   explicitly. It is worth writing down because it is the obvious thing for a future reader to
   "harden" after reading #54, and doing so would cost the diagnostic detail the endpoint exists for.

---

## Alternatives considered

- **Raise at startup when `GATE_ALLOWED_ORIGINS` is unset,** the way `GATE_PRIVATE_BUCKET` does.
  Rejected, and this was the closest call in the whole task. It is the loudest possible failure —
  the revision never becomes healthy. But an unset origin list means *one route* is unusable, while
  refusing to boot takes down `/p/**` and the entire private area with it. That trades a
  nuisance-grade POST for the service's primary job. The chosen design keeps the blast radius
  proportional to the fault and is still loud in three places. The reasoning is written into
  `config.py` beside the code, so the next person sees the trade rather than re-deciding it blind.
- **Derive the accepted origins from `Host` alone**, dropping only the `X-Forwarded-Host` branch —
  the Security Tester's and Red Team's stated "smallest fix". Rejected. It closes two of the three
  demonstrated spellings and leaves the third: forged `Host` on the direct `*.run.app` transport,
  where `allUsers` means the caller controls every header. A check an attacker satisfies with their
  own headers is not a weaker check.
- **Compare against a single canonical host.** Rejected as incompatible with ADR-0004: the gate has
  two legitimate origins, and a single host refuses every sign-out on one transport.
- **Derive the `*.run.app` origin at runtime from the metadata server.** Rejected: more moving
  parts, a network call on a security decision, and it still cannot supply the site domain.
- **Reject the whole report when a client value carries `event=`.** Rejected by the contract and on
  the merits — it is the same blindness in a different costume, and the caller would learn which
  payloads vanish. Counted, reclassified and kept instead.
- **Strip `event=` inside `_clean_client_value()`.** Rejected. It is the wrong seam: that function's
  job is flattening an untrusted value to one printable line, and it does it correctly. Folding a
  second, log-grammar-specific rule into it would have made the count unavailable to the caller —
  and the count is what the operator needs.
- **Keep the old alert guard and ask `infra` to preserve an inline-literal spelling.** Rejected:
  that makes a test dictate formatting to another stream and blocks a genuine improvement (email
  **and** SMS). It is the disposition B-2 called the problem.

---

## Risks

1. **My "the deploy fails loudly" claim leans on `.github/workflows/gate.yml`, which U-2 records as
   un-failable-by-construction.** `gate.yml`'s smoke test asserts a same-origin `/session/end`
   returns 200, so an unset variable *should* fail the deploy — but I was told not to touch that
   file this time precisely because those three assertions are recorded as unable to fail, and I did
   not verify them. **Do not count that as the safety net until U-2 is resolved.** What I can stand
   behind independently: the ERROR line at boot, the `allowed_origins=none` boot line, and the fact
   that every refusal logs `event=deny …`, which the existing `hub-gate-denials` metric already
   matches — so a misconfigured deploy shows up as a denial spike without any new wiring. That
   metric's channel delivers nothing today (D6.5), which is why recommendation 3 exists.
2. **A stale variable fails closed on the real domain** — exactly the cost the original design was
   trying to avoid, and it is now accepted deliberately. A member cannot sign out until it is fixed.
   They can clear cookies; the session is unchanged and nothing is exposed.
3. **A forged `event=signin_failed` is still possible, by design.** The endpoint exists to receive
   exactly that report from an anonymous browser, so anyone can still inflate the sign-in-failure
   metric through the *intended* field. That is ADR-0013's accepted consequence, not a regression;
   #54 was about a value smuggling a trigger, and that is closed. Any alerting built on
   `hub-signin-failures` must treat it as untrusted client input.
4. **The alert-channel guard parses HCL with regular expressions.** It relies on top-level blocks
   starting in column 1, which brace counting cannot do safely here because the policies carry
   heredocs containing `${…}` and `%{…}`. If `monitoring.tf` is ever reformatted so a policy's body
   reaches column 1, the parser truncates a block and reports a false missing channel — loud and
   wrong, not silent and wrong, and the policy-count assertion catches the related failure where the
   parser sees fewer policies than the file declares.
5. **Phase 4's mint and revoke will reuse `_same_origin`,** which is the reason this mattered at all.
   It now takes `Settings` explicitly, so adding it to `POST /session` is a one-line change at the
   call site with no new configuration.

---

## Open questions

1. **Which header carries the site's domain on a Hosting → Cloud Run rewrite?** Still open, by
   design. No longer a security question — the gate reads neither header — and settleable only by
   the live probe in recommendation 2, after #48 deploys. Recorded in the replacement test's
   docstring so nobody re-resolves it by widening.
2. **Does `gate.yml`'s sign-out smoke test actually fail when sign-out is broken (U-2)?** Owner of
   that decision is not me. It determines whether risk 1 is real.
3. **Should `POST /session` get the Origin check now** rather than in Phase 4? G-6 deferred it to
   avoid touching the only working sign-in flow before Checkpoint 5. That reasoning is unchanged,
   but the helper is now cheap and correct to reuse.
4. **Is `event=client_grammar_rejected` worth a metric of its own?** It is the signal that someone is
   probing the telemetry endpoint. `infra/**`, and it needs no gate change.
5. **Should the `*.run.app` origin be in the accepted set at all in the long run?** Keeping it is
   required today by ADR-0004. If the invoker ever stops being `allUsers`, dropping it narrows the
   check to one origin — a one-entry change to the variable, no code change.

---

## Related docs

- `llm/sprints/2026-09-hub/contracts/gate-wave-0-fixes.md` — this contract
- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` — check 3 / S-2, the three spellings
- `llm/sprints/2026-09-hub/handoffs/red-team-wave-0.md` — attack 1 (metric forgery, live),
  attack 2 (`X-Forwarded-Host` bypass)
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md` — B-2, B-3
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `allUsers`, `__session`
- `llm/governance/adr/0013-unauthenticated-client-telemetry-endpoint.md` — decisions 1, 4 and 5 are
  what item 4 implements; the ADR and the code now agree
- `llm/sprints/2026-09-hub/STATE.md` — §Wave 0 dispositions G-6, G-7, RT-9, I-6
- `gate/README.md` — updated: the CSRF section, the new variable, and a new section on client
  telemetry and why its values are scrubbed twice

---

## ADR candidates

1. **`Origin` verification for state-changing routes.** What is compared against what; that no
   forwarded header is ever trusted; that the accepted set is configuration and never derived from
   the request; and how the rule survives two legitimate origins under `allUsers`. Phase 4's mint and
   revoke depend on the answer. This supersedes G-7's "accept both headers so it cannot fail closed"
   with the opposite rule, and the reversal is the part worth recording.
2. **Failing closed is a design choice with a blast radius, and the radius is part of the choice.**
   Why an unset `GATE_ALLOWED_ORIGINS` refuses one route loudly instead of refusing to boot, while an
   unset `GATE_PRIVATE_BUCKET` refuses to boot. Both are "fail closed"; they are not the same
   decision.
3. **A guard asserts a property, never a spelling** (from B-2). With the corollary this task adds:
   a guard whose subject lives in another stream's files should be a pure function over text, so it
   can be shown failing without editing what it guards.
4. **Client telemetry is untrusted input to alerting** (Red Team). Log-based metrics must match a
   grammar the unauthenticated endpoint cannot produce; a client-reported failure is a signal, not
   server truth. ADR-0013 covers the endpoint; this is about what may be built on top of it.
