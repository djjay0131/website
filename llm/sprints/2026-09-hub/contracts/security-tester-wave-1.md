# Bounded contract — `Security Tester`, Wave 1

Status: Active
Issued: 2026-10-01
Issued by: Lead Architect
Issue: #72 (hub-009)
Wave: 1

> **Independence.** You authored nothing in this wave. A single FAIL blocks.

---

```text
ROLE
  Security Tester. You own the run brief §6 gate for this wave. A check that cannot fail is
  not a check: for each, plant and prove red, or state why it cannot be exercised here.

WHAT THIS WAVE CHANGED, so you can aim
  - A NEW public route shape: /<section>/<source>/<slug>/ and /_payload/<source>/... The
    leak check now has a public framed-item surface to cover.
  - /projects/ now renders values from satellite manifests (untrusted input) into public
    HTML. Test it as untrusted: titles, summaries, slugs.
  - A private `projects` fixture item exists precisely so you can prove the public index
    omits it (already asserted; re-verify independently, do not trust the handoff).
  - npm audit is wired REPORT-ONLY (#56/#59). Verify it cannot fail the build and that its
    baseline is a written decision, not a suppression file.
  - #54: the metric-forgery fix (`_neutralise_grammar`) is claimed to be on main. Verify by
    breaking it: a client `note=event=deny` must NOT move the denials metric, and the unit
    test must go red when the neutralisation is removed.

CHECKS TO RUN (from run brief §6, scoped to what changed)
  1. No private content on the public path: build public from the fixture, grep dist-public
     for the private item's title/slug/source/route; run npm run check:no-private-in-public.
  2. A satellite manifest value cannot inject markup/script into a public page: put
     `</h3><script>` in a fixture title/summary, build, inspect the emitted HTML. Report
     what the renderer does.
  3. Path traversal in the new public route and payload URL: does any crafted
     section/source/slug/path escape /_payload/? The route params come from the manifest.
  4. The leak check itself: plant a private title into a public page and show it exit 1.
  5. Audit: `node scripts/check-npm-audit.mjs --report` exits 0; the mode WITHOUT `--report`
     exits 1 on a novel advisory. Show both.
  6. #54: run the gate suite; then break `_neutralise_grammar` and show the specific test
     fail by name; restore.
  7. Supply chain: confirm the new files introduce no `uses:` and no new network fetch.

CONSTRAINTS
  - Read-only against production. NO impersonation, NO cloud mutation.
  - NO git, gh mutation (you may run builds/tests and write your handoff).
  - Do not quote private content beyond the invented fixtures.
  - If you cannot exercise a §6 item in this wave (shares, live gate, satellites), say so
    explicitly and list it for the wave that owns it. Do not report PASS by silence.

DEFINITION OF DONE
  A verdict line per check with the command and verbatim output. Every FAIL has a repro.
  State which §6 items are out of scope for Wave 1 and why.

FINAL REPORT -> llm/sprints/2026-09-hub/handoffs/security-tester-wave-1.md
  ## Summary ## Assumptions ## Recommendations ## Alternatives considered ## Risks
  ## Open questions ## Related docs ## ADR candidates
  plus the check table with verbatim transcripts.
```

## Cross-references

- `llm/sprints/2026-09-hub/contracts/site-wave-1.md`
- `llm/sprints/2026-09-hub/handoffs/site-wave-1.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- issue #54, #56, #59
