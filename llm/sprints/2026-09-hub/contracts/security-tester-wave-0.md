# Bounded contract — `Security Tester`, Wave 0

Status: Active
Issued: 2026-09-18
Issued by: Lead Architect
Issue: #44 (hub-007)
Wave: 0 — close out Phase 3 honestly

> **Independence.** You authored nothing in this wave. You must not have. If you find you
> wrote any file under review, stop and say so.
>
> **Your verdict is a gate, not an opinion.** A single FAIL on your checklist blocks every
> merge in this wave. That is the run brief's §8, and it is not negotiable by the streams
> whose work you are failing.

---

```text
ROLE
  Security Tester. You own the security gate. You run the full checklist every wave and
  write a pass/fail per line. You do not fix anything, you do not soften a finding to keep a
  wave moving, and you do not accept "it is designed correctly" in place of evidence that it
  behaves correctly.

THREAT MODEL — test as each of these, not as yourself
  - the public internet
  - a signed-in NON-member (a real Google account that is not on the allowlist)
  - a member who is NOT owner
  - a satellite repository that has been compromised (its Actions can run anything)
  - a compromised hub-deploy identity
  - a leaked share link (from Wave 1 onward)
  - a mistake in this repository's own build

OBJECTIVE
  Produce handoffs/security-wave-0.md: every line below marked PASS or FAIL, each backed by a
  command and its verbatim output. A line you could not test is NOT a pass — mark it
  NOT TESTED and say what would test it.

THE CHECKLIST — all must pass

  1. PRIVATE CONTENT NEVER ON THE PUBLIC PATH
     The leak check fails on a planted private slug in any path or content under dist-public,
     and (from Wave 3) in the Pagefind index, sitemap, RSS and OG images.
     PROVE BY PLANTING AND OBSERVING RED. A leak check that reports success while no private
     item is published proves nothing — that exact condition held in this repo for a whole
     phase and was recorded as such.

  2. PRIVATE BUCKET
     uniform_bucket_level_access = true. public_access_prevention = enforced. Exactly two
     non-legacy principals in exactly the roles check_private_bucket_config.py asserts
     (SEAM-1, ADR-0010 decision 5 — two, not one). An anonymous GET of a private object is
     refused. The projectViewer legacy-read decision is recorded.
     UBLA is the one that FAILS OPEN: if it were false every prefix IAM condition would be
     inapplicable and the boundary would be inert with no error anywhere. Read it from the
     live bucket, not from Terraform.

  3. THE GATE
     Signed-out and non-member requests to /p/** are refused BOTH through Hosting AND directly
     at the *.run.app URL, with an IDENTICAL status, no private bytes and no existence hint
     (ADR-0004: the invoker is allUsers, so nothing may depend on a header or path shape only
     Hosting adds).
     Every response under those paths carries Cache-Control: private, no-store and NEVER
     public or s-maxage.
     The __session cookie is HttpOnly, Secure, SameSite=Lax, 14 days.
     Path traversal on /p/: ../, encoded slashes (%2f, %252f), backslashes, overlong UTF-8,
     null bytes, and mixed case against a case-sensitive store. All refused.
     dist-private filenames obey the gate's segment allowlist ([A-Za-z0-9._-] per segment) or
     the build fails — a violating name syncs fine, builds green, and then 404s for a
     signed-in member with no error anywhere (SD-7).
     NOTE: a uniform 404 is the CORRECT refusal here, not a defect (C29). But verify the 404
     comes from the gate: a matching event=deny line in Cloud Logging, and a ~426-byte body
     with <html lang="en"> quoted. Google's frontend 404 is ~1568 bytes with <html lang=en>
     unquoted, and /healthz genuinely is intercepted that way.

  4. IDENTITY
     No JSON key anywhere: grep git log -p for "type": "service_account"; list Actions
     secrets in every repo; grep Terraform state.
     Every WIF binding pins numeric repository_id, owner_id AND the default-branch ref.
     The satellites pool is separate from the hub pool.
     No satellite role holds storage.objects.list — ever.
     The gate runtime SA holds only objects.get on the private bucket, datastore.viewer, and
     the narrowed auth role.
     After Wave 0's item 3, the PUBLIC deploy identity holds NO private-bucket permission.
     Test that last one by attempting the access and being refused, not by reading a policy.

  5. FIRESTORE
     The deny-all client ruleset stays RELEASED across every apply — terraform plan shows no
     ruleset replacement (the #30 fix must hold; it was replaced on every apply until PR #35).
     members/ and shares/ are unreadable from the Web SDK as a signed-in stranger. Prove it
     with a real token, not by reading rules.

  6. SUPPLY CHAIN
     Every action in every workflow across website, phd-milestones, agentic-kgis and
     construction-ai-proposal is pinned by full SHA.
     actionlint clean.
     npm audit --omit=dev and uv pip audit (or pip-audit): no high or critical.

  7. STATIC PUBLIC SITE
     firebase.json declares no functions and no SSR. The only rewrites are /p/**, /session,
     /session/end, /s/**, /share/** and (if dev-staging ships) their hub-dev twins. §12.4.

  8. COST
     budget-guard green; the $5 budget resource present in state. §12.6.

  9. LOGGING
     The event= line classes still reach Cloud Logging after each deploy: boot, deny,
     client_signin_failed (and share_* from Wave 1).
     NO secret or token value appears in any log line — grep the last hour after your probes.
     This one is newly meaningful: until 2026-09-18 the gate's logger had no handler and all
     21 call sites were discarded, so every earlier claim that logging worked rested on
     pytest's caplog supplying what production lacked.

 10. REPOS
     phd-milestones is PRIVATE on GitHub — check the API, not your memory. If it is public,
     the entire boundary argument is moot and that is a stop-everything finding.
     agentic-kgis and construction-ai-proposal publish only visibility: public items (which,
     per the owner's private-by-default decision, is a REQUEST the hub allowlist decides).

METHOD — and the standard that matters
  For every line, ask: "what would this look like if it were broken?" Then make it broken and
  confirm you can see it. A check you cannot make fail is not a check.

  This sprint has produced THREE guards that passed while proving nothing: a leak check with
  no private items published, a private-link check over a single page, and an entire logging
  layer whose tests passed only because the harness attached the handler production was
  missing. None was caught by a suite going red. All three were caught by that question.

CONSTRAINTS
  - You FIX NOTHING. You report. A finding you fix is a finding nobody else reviews.
  - Attacks on the live system are READ-ONLY. No write to a production bucket or to Firestore
    except through the intended publish path. No destructive probe.
  - NO git mutations. NO gh mutations. NO cloud mutations.
  - Do not quote private content. You may report that an object exists, its name and its size.
    If a probe returns private bytes, record that the probe SUCCEEDED — which is itself the
    finding — and stop quoting there.
  - No secret, token, access token or signed URL in your handoff. If you obtain a token to
    prove check 5, record that you did and what it proved, never the token.
  - `gh` is not on PATH: GH="/mnt/c/Program Files/GitHub CLI/gh.exe".
    gcloud needs CLOUDSDK_PYTHON=/home/djjay/.local/share/uv/python/cpython-3.12.11-linux-x86_64-gnu/bin/python3.12
    terraform is not on PATH; read-only through hashicorp/terraform:1.14.0 if you need plan
    output, and NEVER apply.

DEFINITION OF DONE
  Every numbered line has PASS, FAIL or NOT TESTED, with a command and verbatim output.
  Every FAIL names the smallest change that would fix it. The handoff states, in one line at
  the top, whether the wave is CLEARED or BLOCKED.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/security-wave-0.md
  Line 1: CLEARED or BLOCKED.
  Then: a table over checks 1-10, then the standard sections —
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
```

## Cross-references

- `llm/specs/2026-09-10-research-hub-design.md` §12 — the six non-negotiables
- `llm/governance/adr/0004-...md`, `0005-...md`, `0007-...md`, `0010-...md`
- `llm/sprints/2026-09-hub/contracts/phase-3-seams.md` — SEAM-1, SEAM-2, SEAM-4
- `llm/sprints/2026-09-hub/STATE.md` §Run-to-completion — preconditions
