# Contract — Boundary Tester, Wave 4 (Phase 5 satellite)

Status: Issued · Date: 2026-10-03 · Branch: `feat/construction-ai`
Handoff: `llm/sprints/2026-09-hub/handoffs/boundary-tester-wave-4.md`.
This is the roadmap's recorded prefix-boundary test for the new satellite. It runs
**after** the Lead Architect applies the roster (the identity must exist).

Under a temporary `serviceAccountTokenCreator` grant, authorised and **removed
immediately afterwards and verified removed**, impersonate `publish-construction-ai`
and record HTTP status for:

| Id | Action | Expected |
|---|---|---|
| CTRL | read own-prefix absent object (token valid) | 404 |
| forward | create / overwrite / read / delete inside `sources/construction-ai/` | 200/200/200/204 |
| refuse | create `sources/cv/`, `sources/kgis/`, `sources/agentic-kg-research/`, `sources/construction-ai-evil/`, bucket root | 403 |
| list | list the bucket, list its own prefix | 403/403 |
| reverse | `cv` read and write `sources/construction-ai/` | 403/403 |

Use the Storage JSON API form (not `gcloud storage cp`, which needs `list`). After
the run, verify the only remaining binding is the WIF `workloadIdentityUser`
principalSet. Provide the transcript and the removal proof.
