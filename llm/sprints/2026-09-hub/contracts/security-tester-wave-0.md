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
     (CORRECTED 2026-09-18: that size is PATH-DEPENDENT — ~426 bytes on `/p/`, 329 bytes on
     `/healthz/`. Attribute by the container log line, not by size. A 404 with no log line
     never reached the service; that is how /healthz was diagnosed after four revisions.)
     with <html lang="en"> quoted. Google's frontend 404 is ~1568 bytes with <html lang=en>
     unquoted, and /healthz genuinely is intercepted that way.

  4. IDENTITY
     No JSON key anywhere: grep git log -p for "type": "service_account"; list Actions
     secrets in every repo; grep Terraform state.
     Every WIF binding pins numeric repository_id, owner_id AND the default-branch ref.

     CORRECTED 2026-09-18, mid-run, by the Lead Architect. The line above is WRONG about
     WHERE the ref is pinned, and the agent was sent this correction directly.
       - NO attributeCondition on any provider mentions `ref` at all. Providers pin
         assertion.repository_id, assertion.repository_owner_id, assertion.repository, and
         refuse pull_request_target.
       - The ref pin lives on each service account's workloadIdentityUser BINDING:
           publish-cv              <- .../attribute.repository_id_ref/1211056144/refs/heads/master
           publish-phd-milestones  <- .../1373915518/refs/heads/main
           hub-deploy, gate-deploy <- .../1212933399/refs/heads/main
     The invariant holds; it is enforced by the binding, not the provider. Check the
     binding. Do NOT record a PASS for "the provider pins the ref" -- it does not -- and do
     not raise a FAIL from the provider's silence, which under §8 would block the wave on my
     error. Note the branches genuinely differ (`cv` is master, `phd-milestones` is main),
     which is why the field is per satellite and why a copy-paste error would be invisible.
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

     SCOPE CORRECTED 2026-09-21 by the Lead Architect, then CORRECTED AGAIN the same
     day. Do not read the four repo names above as the roster; they are wrong in both
     directions and a hardcoded list is the defect.

     THE AUTHORITATIVE ROSTER IS `var.satellites` IN infra/variables.tf, keyed by
     source name. Today it holds exactly TWO entries:
         cv              djjay0131/cv              default_branch = master
         phd-milestones  djjay0131/phd-milestones  default_branch = main
     Each entry carries the immutable repository_id and repository_owner_id that the
     WIF provider condition matches, and default_branch is the ONLY branch whose runs
     may publish -- which is also the ref an audit must measure against. Read the map;
     do not transcribe it.

     `cv` was missing from the list above and IS a satellite. `agentic-kgis` is gated
     and unprovisioned, and `construction-ai-proposal` is not a satellite at all --
     both were audited anyway, which is harmless, but neither is in the roster.

     MEASURE AGAINST default_branch, NOT against whatever branch happens to be checked
     out. My first correction gave a `cv` count taken from a checked-out feature branch
     that was behind master and predated the contract/publish step entirely; acting on
     it would have left the highest-value ref unpinned while reporting a clean result.

     ALSO IN SCOPE, and missed by every run so far because it is not a `uses:` line:
     executable content fetched from a MUTABLE REF at run time. agentic-kgis's
     docs-publish.yml curls contract/validate-manifest.mjs from
     raw.githubusercontent.com/.../website/main/... into /tmp and then runs it with
     node, on every push, ungated -- while the contract/publish@main action beside it
     is gated behind workflow_dispatch and is currently unprovisioned. An audit that
     greps `uses:` reports the DORMANT risk and misses the LIVE one. Grep for curl,
     wget and raw.githubusercontent against a branch ref, not just `uses:`.
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
