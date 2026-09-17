# Phase 3 seams — binding interfaces between the four streams

Status: Active
Last updated: 2026-09-17
Owner: Chief Architect (Lead Architect)

## Purpose

Phase 3 runs four implementation streams across two repositories, and it is the first phase
where **private material touches the system**. These seams fix the interfaces before any
stream starts, so each can be written and verified independently.

A seam is binding. A specialist that believes a seam is wrong **reports it and stops** at that
seam; it never renegotiates one unilaterally, and never edits a file outside its own scope to
make one fit. Phase 2 proved that discipline works: two streams reported seam defects that
turned out to be errors in my own seams, and both were amended rather than worked around.

## Scope

| Stream | Repository | Owns |
|---|---|---|
| `gate` | `website` | `gate/**` — the FastAPI service, its tests, Dockerfile |
| `infra` | `website` | `infra/**` — Cloud Run, Artifact Registry, Identity Platform, Firestore, private bucket, gate identity |
| `site` | `website` | `site/**`, `.github/workflows/build.yml`, `firebase.json` — two-output build, leak check, sign-in page |
| `satellite-phd` | `phd-milestones` | that repository's publish workflow and manifest |

## SEAM-1 — Where private bytes live, and who may read them

```
phd-milestones ──publish──▶ gs://<content-bucket>/sources/phd-milestones/   (private items)
                                        │ hub syncs (hub-deploy: objectViewer)
                                        ▼
                            HUB_OUTPUT=private  →  site/dist-private
                                        │ destructive sync
                                        ▼
                            gs://<private-bucket>/   ← gate SA is the ONLY reader
                                        │ streamed by the gate on /p/**
                                        ▼
                                    signed-in member
```

- The **private bucket is the only place private rendered output lives.** It is never public,
  never behind Hosting, and has exactly one reader: the gate's service account.
- `dist-public` **never contains a private item** — enforced by the leak check (SEAM-4), not
  by convention.
- The content bucket holds private *source* bytes under `sources/phd-milestones/`. That is
  expected: the hub's identity reads it, and no satellite can list it (ADR-0007 decision 4).

## SEAM-2 — The session, and the one name that must be right

- The session cookie **must be named `__session`**. Firebase Hosting strips every other cookie
  on a Cloud Run rewrite (ADR-0004). A gate that works when called directly and fails through
  Hosting is almost always this.
- It is a **Firebase session cookie** (Admin SDK), 14 days, `HttpOnly`, `Secure`,
  `SameSite=Lax` (§6 responsibility 1).
- `POST /session` takes a Firebase ID token in the request body, verifies it, and sets the
  cookie. The **site** stream owns the sign-in page that obtains the ID token; the **gate**
  stream owns `/session`. The interface between them is exactly: `{"idToken": "<jwt>"}` in,
  `Set-Cookie: __session=...` out, and a JSON error body otherwise.
- **The gate's invoker is `allUsers`** (ADR-0004). Every authorisation check must therefore
  hold on a direct `*.run.app` request, not only through Hosting. Tests must exercise both.

## SEAM-3 — The allowlist

- Firestore **Native** mode. Collection `members/{email}`, document fields
  `{added_by, added_at, note, role}` (§6 responsibility 2).
- The document **id is the email, lowercased**. The gate lowercases the token's email before
  lookup. Case-sensitive matching here is a silent "not shared with you".
- Seed set (§10 Q4, owner 2026-09-17): `djjay@vt.edu` with `role: owner`;
  `cbrown@vt.edu` with no role field. **Those two only.**
- **The matching trap:** the allowlist matches the exact email in the Firebase ID token. The
  owner's gcloud/GitHub identity is `djjay0131@gmail.com`; signing in with that account
  produces a token that will not match `djjay@vt.edu` and yields the "not shared with you"
  page — correct behaviour, indistinguishable from a bug. The seed script must say this in its
  output.
- A non-member who signs in successfully gets the "not shared with you" page and **no private
  content** — not a 403 with a body, not a redirect loop.

## SEAM-4 — The two-output build and the leak check

- One source tree, two builds, selected by `HUB_OUTPUT=public|private` (§5, ADR-0005).
  `HUB_OUTPUT=public` → `site/dist-public` (Hosting). `HUB_OUTPUT=private` →
  `site/dist-private` (private bucket).
- **The leak check greps both paths and file contents** for every private slug, and fails the
  build on a hit (ADR-0005; the brief's §4 path-only form is insufficient — K11 settled in
  ADR-0005's favour).
- **Location, settling the open constraint:** the leak check lives at
  `site/scripts/check-no-private-in-public.mjs` and is owned by the **site** stream. The brief
  named `scripts/…` at the repository root, but the root `scripts/` tree was removed in Phase 1
  and the site stream is scoped to `site/**`; putting it there keeps one owner and one home.
- Private navigation exists **only in the private build**. No public page lists, links or names
  a private item.
- A deliberate failing run is an acceptance criterion: the check must be *shown* failing when a
  private slug appears under `dist-public`.

## SEAM-5 — Withdrawal is destructive on the private side (ADR-0010)

- The private sync **deletes destination objects the current build did not produce**. A
  withdrawn private item must stop being readable, not merely stop being linked.
- This is the one place in the system where a build defect can remove data. It is gated by
  ADR-0010 decision 3: an empty or missing manifest **fails the build before the sync runs**.
- The hub declares its **expected sources**; a declared source whose prefix is entirely absent
  fails the build (ADR-0010 decision 4, closing C27).

## SEAM-6 — Ordering: the gate exists before the rewrites

Hosting **rejects** a configuration naming a Cloud Run service that does not exist (issue #10,
K2 — verified against the Hosting REST reference). Therefore:

1. `infra` creates Artifact Registry, Firestore, Identity Platform, the private bucket and the
   gate's service account.
2. `gate` is built and deployed to Cloud Run as `hub-gate` in `us-east1`, `min-instances=0`.
3. **Only then** does `firebase.json` gain the `/p/**` and `/session` rewrites.

A `firebase.json` carrying rewrites before step 2 breaks every deploy, including the public
site. The `site` stream owns `firebase.json` and must not add them until the service exists;
if that ordering is impossible within one PR, report it rather than working around it.

## SEAM-7 — What `phd-milestones` publishes

The repository exists and is **private**, created from the Incident A1 seed with its single
commit preserved (STATE A23–A25).

| Item | slug | format | section | visibility | path |
|---|---|---|---|---|---|
| Milestone tracker | `milestones` | `html` | `phd` | `private` | `site/index.html` |
| Committee dossier | `committee-dossier` | `html` | `phd` | `private` | `site/committee.html` |

- It publishes through the **same** `contract/publish` action `cv` uses. No new mechanism.
- Its identity is a new entry in `var.satellites` — one map entry, no new module (the Phase 2
  design exists to make this true).
- It holds **no GitHub credential** for `website`, and **no `storage.objects.list`**.
- `manifest_version` is emitted as `"1"` (ADR-0009), making it the first satellite to send it.

## SEAM-8 — Who owns which file

| Path | Owner |
|---|---|
| `gate/**` | `gate` |
| `infra/**` | `infra` |
| `site/**`, `.github/workflows/build.yml`, `firebase.json` | `site` |
| `.github/workflows/gate.yml` | `gate` |
| everything in `phd-milestones` | `satellite-phd` |
| `contract/**` | nobody this phase — report defects, do not edit |
| `llm/**`, `docs/**` | Lead Architect only |

## SEAM-9 — Validation each stream owes

- `gate`: pytest covering session mint/verify, non-member rejection, path traversal on `/p/`,
  and that no `/p/**` response carries `public` or `s-maxage` in `Cache-Control`. Python
  **3.12** (system Python is 3.8; a uv-managed CPython 3.12.11 is available).
- `infra`: `terraform fmt -check -recursive`, `init -backend=false`, `validate`. **Never**
  `plan` or `apply`.
- `site`: `npm test`, both builds, the leak check shown failing deliberately, `actionlint`.
- `satellite-phd`: its manifest validates against the hub's own
  `contract/validate-manifest.mjs`; `actionlint` on its workflow.
- **Every tracked `*.sh` beginning with a shebang must be committed `100755`.** `/mnt/c`
  reports every file as `0777`, so use `git ls-files -s`, never `ls -l`. CI enforces this
  (`budget-guard`), and it broke Phase 2 once already.

## Assumptions

- No cloud resource exists for this phase yet; no specialist has credentials, and all cloud
  verification happens at Checkpoint 4.
- `phd-milestones` work happens in a checkout; the Lead Architect commits and pushes there, as
  in `cv`.

## Cross-References

- `llm/governance/adr/0004-private-area-cloud-run-gate-behind-hosting.md`
- `llm/governance/adr/0005-two-output-build-with-leak-check.md`
- `llm/governance/adr/0009-manifest-version-lands-optional-first.md`
- `llm/governance/adr/0010-withdrawal-semantics.md`
- `llm/specs/2026-09-10-research-hub-design.md` §5, §6, §7, §8, §12
- `llm/master-roadmap.md` §phase-3-private-area
- `llm/sprints/2026-09-hub/contracts/phase-2-seams.md` — the precedent
