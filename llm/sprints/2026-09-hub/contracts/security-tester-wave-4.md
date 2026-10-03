# Contract — Security Tester, Wave 4 (Phase 5 satellite)

Status: Issued · Date: 2026-10-03 · Branch: `feat/construction-ai`
Handoff: `llm/sprints/2026-09-hub/handoffs/security-tester-wave-4.md`. A single FAIL blocks the merge.

Run the run-brief §6 checks the wave can turn red, each PASS/FAIL/NOT TESTED with
evidence:
1. No private content on the public path: the new source's items are absent from
   `dist-public`; `check:no-private-in-public` red→green.
2. Identity: the new WIF provider pins repository id + owner id + name and
   `refs/heads/master`; the satellite SA holds only the `satellitePublisher`
   custom role with the `sources/construction-ai/` condition; no project-level
   role; no `list`; no key. The plan has 0 destroy/replace of stateful resources.
3. Static public site: `firebase.json` unchanged (Wave 3's 7 rewrites).
4. Supply chain: the satellite workflow's actions SHA-pinned; no new advisory.
5. Firestore deny-all released; ruleset/release not in the plan action set.
6. Budget green.
Record what is NOT TESTED (e.g. the live prefix proof, which is the Boundary
Tester's post-apply step).
