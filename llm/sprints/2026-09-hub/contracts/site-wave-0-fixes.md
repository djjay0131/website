# Bounded contract — `site`, Wave 0 fixes

Status: Active
Issued: 2026-09-19
Issued by: Lead Architect
Issue: #44 (hub-007); fixes #56, SD-4's missing caller, and F-1
Wave: 0 — clearing the §8 blockers

---

```text
ROLE
  Site implementation specialist, clearing three Wave 0 findings. One of them is a seam
  failure of mine, not of the stream that came before you.

OBJECTIVE
  1. Add the sign-out control. SD-4 is NOT fixed: the gate has a handler and firebase.json has
     a rewrite, and NOTHING IN site/ CALLS IT.
  2. Triage the npm audit findings (#56).
  3. Fix check:private-links, which cannot see an off-origin link (F-1).

REQUIRED READING
  site/src/pages/signin/index.astro          how it calls POST /session today
  site/src-private/layouts/PrivateBase.astro the members' layout
  site/scripts/ (the private-links checker)
  site/package.json
  llm/sprints/2026-09-hub/handoffs/gate-wave-0.md            §Recommendations item 2
  llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md  F-1
  llm/sprints/2026-09-hub/handoffs/chief-reviewer-wave-0.md    B-8
  llm/sprints/2026-09-hub/STATE.md           §Wave 0 dispositions

FILE CONTRACT
  You may modify, and nothing else:
      site/**
  Do not modify: firebase.json (the /session/end rewrite is already there), gate/**,
  infra/**, contract/**, .github/workflows/**, llm/**, or any other repository.

ITEM 1 — SIGN-OUT HAS NO CALLER (SD-4, finding B-8)

  This is my seam failure and you should know that before you start. The gate stream built
  POST /session/end and recommended the site add the control; I recorded the rewrite request
  and never routed the caller. So a route, a rewrite and 43 tests exist for a feature no member
  can reach. A handler with no caller is sign-out that does not exist.

  Add the control to the members' area, where a signed-in member will find it.

  THE CALL, exactly, from the gate stream's handoff:

      await fetch("/session/end", { method: "POST", credentials: "same-origin" });

  No body, no token, no custom header.

  THREE THINGS THAT MUST NOT HAPPEN:
    - Do NOT use <a href> or a GET. A GET sign-out is triggerable by an <img> tag on any page
      the member visits. It must be a POST.
    - Do NOT use an absolute URL to the *.run.app host. That makes it cross-origin, the browser
      sends a different Origin, and the gate refuses it with 403.
    - Do NOT add mode: "no-cors" to make an error go away. It would hide the failure.

  After a successful sign-out, send the member somewhere that makes sense signed-out, and make
  a FAILED sign-out visible rather than silent -- a member who thinks they signed out and did
  not is worse off than one who sees an error.

  NOTE THE SEQUENCING, and record it: the gate's Origin check is being fixed concurrently
  (contract gate-wave-0-fixes, item 1) because it does not currently work. Your call is
  same-origin, so it is correct under both the current and the fixed check. Do not design
  around the broken version.

ITEM 2 — npm audit (#56)

  npm audit --omit=dev reports 1 critical and 9 high. The flag is a no-op here:
  site/package.json declares 13 dependencies and NO devDependencies key at all, so nothing is
  excluded and every finding is production. `astro` is the critical and is a DIRECT dependency;
  `js-yaml` is a direct high.

  Triage the critical and the two direct highs first -- they are ours to bump and transitive
  ones may resolve with them. `astro` is the framework, so a major bump is a real change:
  if it cannot be done safely inside this wave, SAY SO, record the version and the reason, and
  bump what can be bumped.

  Record counts, not the word "clean". If a finding is accepted rather than fixed, record the
  reason AND the version it was accepted at, so the next audit is a comparison rather than a
  re-litigation.

  The full suite must still pass after any bump, and both builds must succeed.

ITEM 3 — check:private-links IS BLIND TO OFF-ORIGIN LINKS (F-1)

  Its regex only matches links beginning with `/`. So `href="https://evil.invalid/x"` and
  `href="../../elsewhere/"` both pass green. Tested one shape at a time by the Skeptic
  Verifier.

  It does catch its real subject (#27), so this is a coverage gap rather than a vacuous guard.
  But the timing is the point: it is the guard that would have caught a satellite's off-origin
  font <link> regressing -- IN THE SAME WAVE THAT REMOVED ONE. The satellite now enforces this
  itself; the hub's guard should not be the weaker of the two.

  Extend it to catch off-origin and relative-escape links. Prove BOTH new shapes fail
  deliberately, not just one.

TESTING — the standard
  Every change shown FAILING before passing: break, red, restore, green, transcripts in the
  handoff.

  THE ANCHOR RULE, which this sprint earned three times: before breaking something on a string,
  assert the string is UNIQUE -- `assert text.count(anchor) == 1`. Three agents patched the
  wrong occurrence this sprint and read the resulting green as proof. After breaking, confirm
  the SPECIFIC test you expected to fail is the one that failed, by name.

  Do not weaken or delete a test to make a change pass. ADR-0011 states the risk in terms.

CONSTRAINTS
  - NO git, gh or cloud mutations.
  - npm test green; both builds green; the leak check still shown failing on a planted slug.
  - Every tracked *.sh with a shebang stays 100755 -- verify with `git ls-files -s`, never
    `ls -l`; /mnt/c reports everything 0777.
  - Do not quote private content. Use committed fixtures for transcripts.
  - DO NOT begin the publish allowlist or private-by-default. That is Wave 0b, it has its own
    branch and seams, and its exit criteria changed after the Pages mirror was found.

DEFINITION OF DONE
  Sign-out reachable by a member and proven to call the right endpoint the right way. Audit
  triaged with counts and reasons recorded. The private-links guard catching both new shapes,
  each shown failing. Full suite green.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/site-wave-0-fixes.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
  plus Validation with verbatim transcripts and the break/restore pairs.
```

## Cross-references

- `llm/sprints/2026-09-hub/handoffs/gate-wave-0.md` — the exact sign-out call and its hazards
- `llm/sprints/2026-09-hub/handoffs/skeptic-verifier-wave-0.md` — F-1
- `llm/governance/adr/0011-two-srcdirs-not-a-visibility-filter.md` — do not delete a guard
- `llm/governance/patterns/execution-patterns.md` — the ambiguous-anchor anti-pattern
