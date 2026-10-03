# Handoff — Boundary Tester, Wave 4 (`construction-ai` prefix proof, SEAM-C6)

Status: Delivered
Date: 2026-10-03
Issue: `hub-005`
Repos: `djjay0131/website`, `djjay0131/construction-ai-proposal`
Method: Storage JSON API, under a temporary `roles/iam.serviceAccountTokenCreator`
grant to `user:djjay0131@gmail.com` on `publish-construction-ai@` and
`publish-cv@`, **removed immediately afterwards and verified removed**.

## Forward — `publish-construction-ai`

| Id | Action | HTTP | Expected |
|---|---|---|---|
| CTRL | read own-prefix absent object (token valid) | **404** | 404 |
| forward | create in `sources/construction-ai/` | **200** | 200 |
| forward | read its own object | **200** | 200 |
| forward | overwrite its own object | **200** | 200 |
| forward | delete its own object | **204** | 204 |
| refuse | create `sources/cv/` | **403** | 403 |
| refuse | create `sources/kgis/` | **403** | 403 |
| refuse | create `sources/agentic-kg-research/` | **403** | 403 |
| refuse | create `sources/construction-ai-evil/` (trailing-slash probe) | **403** | 403 |
| refuse | create at bucket root | **403** | 403 |
| list | list the bucket | **403** | 403 |
| list | list its own prefix | **403** | 403 |

The `construction-ai-evil` refusal proves the condition ends in a slash: a source
whose name merely starts with `construction-ai` is refused. `list` is refused even
on the identity's own prefix — intended, since `storage.objects.list` cannot be
prefix-restricted, so the only safe grant is none.

## Reverse — `cv` against `sources/construction-ai/`

| Action | HTTP | Expected |
|---|---|---|
| `cv` read `sources/construction-ai/manifest.json` | **403** | 403 |
| `cv` write `sources/construction-ai/` | **403** | 403 |

## Grant removal proof

After the run, the only binding on `publish-construction-ai@` is:

```
roles/iam.workloadIdentityUser ->
  principalSet://…/workloadIdentityPools/satellites/attribute.repository_id_ref/1134376420/refs/heads/master
```

The `serviceAccountTokenCreator` binding is gone on both service accounts.

## Verdict

**SEAM-C6 PASSES.** Forward access is confined to `sources/construction-ai/`;
every sibling prefix, the `-evil` neighbour, the bucket root and `list` are
refused; the reverse leg is refused. Roadmap `phase-5-satellites` criterion 4 is
satisfied for the new identity.
