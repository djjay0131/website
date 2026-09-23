# Bounded contract — `gate`, Wave 0 fixes

Status: Active
Issued: 2026-09-19
Issued by: Lead Architect
Issue: #44 (hub-007); fixes #54, #57, and Security Tester check 3
Wave: 0 — clearing the §8 blockers

> You are **not** the stream that wrote this code. Three independent reviewers found these
> defects after it shipped. Read their evidence before changing anything.

---

```text
ROLE
  Gate implementation specialist, clearing three §8 blockers. Until these land, nothing in
  Wave 0 merges.

OBJECTIVE
  1. Fix the /session/end CSRF check. It does not work.
  2. Fix the test that currently ASSERTS the vulnerable behaviour.
  3. Fix the alert-channel guard, which asserts a string shape rather than its own stated
     property (#57).
  4. Stop an anonymous caller forging log-based metrics through /client-events (#54).

REQUIRED READING
  gate/app/main.py                       _same_origin(), the /session/end route,
                                         _clean_client_value(), the /client-events route
  gate/tests/test_signout.py             especially lines ~185-215
  gate/tests/test_monitoring_contract.py test_every_alert_policy_has_a_notification_channel
  llm/sprints/2026-09-hub/handoffs/security-wave-0.md     check 3
  llm/sprints/2026-09-hub/handoffs/red-team-wave-0.md     targets #1 and #4
  llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md   B-2, B-3
  llm/sprints/2026-09-hub/STATE.md       §Wave 0 dispositions (A-1, A-5, B-2, B-3)

FILE CONTRACT
  You may modify, and nothing else:
      gate/**
  Do not modify: infra/**, site/**, contract/**, firebase.json, .github/workflows/**,
  llm/**, docs/**, or any other repository. Report anything you need outside that set.

  NOTE you may NOT touch .github/workflows/gate.yml this time. Its three sign-out smoke
  assertions are already recorded as un-failable-by-construction (U-2); changing them is a
  separate decision.

ITEM 1 — THE CSRF CHECK DOES NOT WORK

  Current implementation, in full:

      origin = request.headers.get("origin", "").strip()
      ... scheme/netloc/path validation ...
      addressed_to = {request.headers.get("host", "").strip().lower()}
      forwarded = request.headers.get("x-forwarded-host", "")
      addressed_to.update(c.strip().lower() for c in forwarded.split(","))
      addressed_to.discard("")
      return parsed.netloc.lower() in addressed_to

  EVERY value in `addressed_to` comes from the request. Comparing an attacker-supplied
  Origin against attacker-supplied Host / X-Forwarded-Host proves nothing. Three working
  spellings were demonstrated over real HTTP:
      Origin: https://evil.example + X-Forwarded-Host: evil.example
      Origin: https://evil.example + X-Forwarded-Host: real.example, evil.example
      Origin: https://evil.example + Host: evil.example

  The original reasoning was that a configured allowlist is "a fourth place that must be kept
  in step, and the first one to go stale fails closed on the real domain." THAT TRADE IS
  BACKWARDS. Failing closed on sign-out is a nuisance, visible immediately, and costs a member
  nothing they cannot work around by clearing cookies. Failing OPEN is silent, and is the
  vulnerability. A check that an attacker can satisfy entirely with their own headers is not a
  weaker check -- it is not a check.

  REQUIREMENT, not implementation: the set of acceptable origins must come from a source the
  REQUEST CANNOT SET. You decide how and record why. The obvious candidate is an environment
  variable rendered by Terraform, following every other GATE_* setting -- but infra/** is not
  yours, so if you choose that, SPECIFY the exact variable name and value shape for me to
  route, and make the code fail CLOSED and LOUDLY when it is unset rather than falling back to
  header comparison.

  It must still be correct on BOTH transports (ADR-0004: the invoker is allUsers), so the
  accepted set has to include the service's own *.run.app origin as well as the site domain.

  Keep what is already right: a missing Origin is refused; `null` is refused; non-https is
  refused; an Origin carrying a path, query or fragment is refused.

ITEM 2 — THE TEST THAT DEFENDS THE BUG

  tests/test_signout.py lines ~199-210 post a forged x-forwarded-host and assert 200 plus a
  cleared cookie. Its docstring is honest that the Hosting header question is unsettled -- but
  the EFFECT is that merging installs a regression test against its own fix. Whoever fixes
  item 1 sees that test go red and may "fix" the fix.

  Replace it with a test that pins the REAL requirement: a request whose Origin is not an
  accepted origin is refused, however it spells its Host headers. Include all three
  demonstrated spellings as explicit cases.

  The unsettled question the old test was gesturing at is real and stays open: which header
  carries the site's domain on a Hosting rewrite. It is settled by a live probe, not by a
  unit test. Say so in the new test's docstring and leave the probe to the handoff.

ITEM 3 — THE ALERT-CHANNEL GUARD (#57)

  Current:
      attached = tf.count("notification_channels = [")
      assert attached >= policies

  PR #53 replaces all three inline list literals with `local.alert_notification_channels`, so
  `attached` becomes 0 while `policies` stays 3 -- the test fails AT THE MOMENT THE CODE
  IMPROVES, because the policies now get email AND SMS instead of email alone. Verified: main
  3/3 pass, the infra branch 3 policies / 0 matches.

  Its own docstring states the real requirement: "an alert with no channel fires into the
  void." That requirement is EVERY POLICY HAS A CHANNEL ATTACHED. What it checks is every
  policy has a channel attached WRITTEN AS AN INLINE LIST LITERAL. The second is a formatting
  convention.

  Assert the property: every `google_monitoring_alert_policy` block contains a
  `notification_channels` assignment whose value is non-empty -- inline list, `local.*` or
  variable alike. Keep the existing "not commented out" assertion; that one is exactly right
  and is how the channel was lost in the project this was carried from.

ITEM 4 — METRIC FORGERY (#54)

  POST /client-events is unauthenticated BY DESIGN and must stay that way: its purpose is to
  receive reports from a browser that has FAILED to sign in. Do not add authentication.

  The defect: both log-based metrics match a SUBSTRING of textPayload anywhere in the line, so
  an anonymous caller can put a metric's trigger inside an ordinary field value and make it
  count. Demonstrated in production: a failure_class carrying the signin-failures trigger, and
  a space-free note carrying the denials trigger.

  _clean_client_value() is NOT at fault -- newline injection was correctly scrubbed, so no
  separate line can be forged. Fix the narrower thing: a client-supplied value must not be
  able to contain the gate's own event grammar. Reject or neutralise `event=` in client
  values.

  DO NOT silently drop such events. A report discarded because it looks suspicious is the same
  blindness in a different costume. Count them, emit a distinct event class for them, and say
  in the handoff what an operator would see.

TESTING — the standard, and it is not optional
  Every change is shown FAILING before it is shown passing: break it, red, restore, green,
  both transcripts verbatim in the handoff.

  AND THE ANCHOR RULE, which this sprint earned three times over. Before you break something
  on a string, assert that string is UNIQUE -- `assert text.count(anchor) == 1`. Three agents
  this sprint patched the wrong occurrence and read the resulting green as proof: an infra
  `sed` hit a comment while the real line stayed true; a verifier patched the mint path
  instead of sign-out, got `43 passed`, and was one step from declaring the gate's most
  important assertion un-failable. After breaking, confirm the SPECIFIC test you expected to
  fail is the one that failed, BY NAME.

  Do NOT use caplog for any assertion about a log line. Exactly four assertions in
  tests/test_client_events.py are already blind to a missing handler; do not add a fifth.
  tests/test_logging_config.py shows the pattern that works.

CONSTRAINTS
  - Python 3.12: /home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
  - NO git, gh or cloud mutations. You write files and report.
  - ruff check and ruff format --check clean.
  - The full gate suite green. It was 269 before these fixes.
  - Do not quote private content. No secret, token or key in any file you write.

DEFINITION OF DONE
  Four items fixed. Every new or changed guard shown failing and then passing, with the anchor
  proven unique. The exact environment variable (name and value shape) that item 1 needs from
  infra, written down for me to route. The full suite green.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/gate-wave-0-fixes.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
  plus Validation with verbatim transcripts and the break/restore pairs.
```

## Cross-references

- `llm/sprints/2026-09-hub/handoffs/security-wave-0.md` — check 3, the three spellings
- `llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md` — B-2, B-3
- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md` — `allUsers`
- `llm/governance/patterns/execution-patterns.md` — the ambiguous-anchor anti-pattern
