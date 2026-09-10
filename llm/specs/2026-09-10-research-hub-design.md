# Research Hub — Design Authority Document

Status: Approved for Phase 0–3 execution
Last updated: 2026-09-10
Owner: Jason Cusati (project owner, sole human reviewer)
Governance: agentic-governance v0.5 (pin in governance-delta.md)
Path in repo: `llm/specs/2026-09-10-research-hub-design.md` (handoff branch `handoff/research-hub`)

This is the design-authority document for the research hub. Per the
Project Operating System it sits at rank 2 of the design-authority
hierarchy, beneath the governance delta. Decisions recorded here are
already made; the ADRs listed in §9 formalize them. Agents implement
against this document and do not re-litigate it. Open questions are in
§10 and are the only places where an agent should ask the owner.

---

## 1. Mission

A personal research site, owned outright by Jason (personal GitHub,
personal Google Cloud, personal domain), that publishes content produced
in many repositories and many formats into one site with a public face and
a gated private area. Private items can be shared with specific people. It
must outlive the PhD.

It is not: a CMS, a blog engine, an application, or a place where content
is authored. Content is authored in satellites; the hub renders it.

## 2. Input repositories (corrected 2026-09-10)

| Repo | Owner | Role in this design | Notes |
|---|---|---|---|
| `website` | Jason | **Becomes the hub.** Already Astro; already consumes `cv`. Moves from GitHub Pages to Firebase Hosting. | Do not start a new hub repo. Evolve this one. |
| `cv` | Jason (private) | Satellite #1 (public items). Already integrated ad hoc; formalize under the manifest contract. | Private repo, public output — the proof case. |
| `phd-milestones` | Jason (to create) | Satellite #2 (private items): milestone tracker, committee dossier, VT policy. | Source tarball is committed on the handoff branch at `llm/plans/handoff/phd-milestones.tar.gz`; create the private GitHub repo from it, then delete the tarball from `website`. |
| `agentic-kg` | Jason | Satellite #3: project page (public) from its `docs/`; optional private research notes. Already has `llm/` + `docs/` layout. | The agentic knowledge-graph research project. |
| `construction-ai-proposal` | Jason | Satellite #4: project page (public). | Later phase. |
| `agentic-governance` | Jason | **Not a content satellite.** It is the operating system this build runs under. Adopt via `/governance:establish`. May publish its README as a project page later. | |
| `agentic-research` | Jason | **Not a content satellite.** Jason's plugin for academic writing projects (paper/proposal skeletons, citation matrix, originality review). Part of the toolkit available in the execution environment. May publish its README as a project page later. | Corrected 2026-09-10: this is tooling, not the KG project. |
| Constellize | third party | Not a satellite. A plugin the governance framework delegates specialist personas to. | Removed from earlier drafts. |
| superpowers | third party | Not a satellite. A skills library available in the execution environment. | Removed from earlier drafts. |

## 3. Architecture

Two kinds of repository. **Satellites** own their build, format and
privacy, and publish a finished `dist/` plus a `manifest.json`. The
**hub** owns chrome, navigation, design system, and deploy. It reads
manifests; it never needs to know how a satellite built its output.

```
satellite repo ──publish dist/ + manifest──▶ GCS content bucket
                                                   │ repository_dispatch
                                                   ▼
                                   hub (website) GitHub Actions
                                   sync bucket → astro build
                                   ├─ public/  ──▶ Firebase Hosting (CDN, domain, SSL)
                                   └─ private/ ──▶ GCS private bucket (no public access)
                                                          │ reads
Browser ──▶ Firebase Hosting ──rewrite /p/** /s/**──▶ Cloud Run gate (FastAPI)
                                                          │ verify
                                                   Firebase Auth + Firestore allowlist
```

Properties this guarantees:

- A satellite never has write access to the hub. It uploads to a bucket
  prefix it is scoped to (Workload Identity Federation, per-repo) and
  fires a dispatch event.
- Private content never enters a repository that could become public.
  Path is bucket → build → private bucket. The hub build **fails** if any
  item with `visibility: private` appears in `public/`.
- One domain serves both areas. Firebase Hosting rewrites `/p/**` and
  `/s/**` to the gate.

## 4. Publishing contract

A satellite publishes a folder and a `manifest.json`. That is the entire
interface. Schema lives in the hub at `contract/manifest.schema.json` and
is mirrored as the Astro content-collection schema in
`site/src/content.config.ts`. Both ends validate against it.

```json
{
  "source": "phd-milestones",
  "published": "2026-09-10T14:02:11Z",
  "items": [
    {
      "slug": "committee-dossier",
      "title": "External Committee Dossier",
      "section": "phd",
      "format": "html",
      "path": "committee/index.html",
      "visibility": "private",
      "date": "2026-08-31",
      "summary": "Twelve vetted external committee candidates, ranked.",
      "tags": ["committee", "phd"]
    }
  ]
}
```

Fields: `slug` (unique within source), `title`, `section` (from a fixed
set declared in the hub: `research`, `projects`, `writing`, `cv`, `phd`),
`format` ∈ {`md`, `mdx`, `html`, `pdf`, `bundle`}, `path` (relative to
dist/), `visibility` ∈ {`public`, `private`}, `date` (ISO), optional
`summary`, `tags`.

| Format | Satellite ships | Hub does |
|---|---|---|
| md / mdx | Markdown + frontmatter | Renders in site chrome; indexed by search |
| html | Self-contained page/folder | Serves verbatim at `/<section>/<source>/<slug>/`, thin frame with back link |
| pdf | The file | Serves verbatim; download card + inline viewer |
| bundle | Built app folder | Serves folder as-is under slug |

Satellite integration is one workflow step, using a reusable composite
action published from the hub:

```yaml
- uses: djjay0131/website/contract/publish@main
  with:
    dist: ./dist
    source: phd-milestones
```

The action: validates manifest against schema → uploads to
`gs://<content-bucket>/sources/<source>/` (WIF auth, no keys) → fires
`repository_dispatch` `{event_type: "publish", client_payload: {source}}`
at the hub.

## 5. Frontend

**Astro with React islands.** Already the stack of `website`; the
decision is to keep it, not to adopt it.

Why (recorded for the ADR): the site renders documents from a typed
manifest with occasional interactive widgets. Content collections turn the
manifest contract into a validated schema; islands allow widgets in React,
which Jason knows; zero JS ships by default; static output cannot break at
runtime, which matters for solo maintenance after 2027.

Rejected: Next.js (right if this becomes an app; it will not), Hugo (no
component model for widgets), Vue/Nuxt (learning curve, no gain),
Eleventy (untyped collections), FastAPI+Jinja for the public site (runtime
rendering; FastAPI is the gate only).

Two outputs from one source tree: `astro build` with an env var
`HUB_OUTPUT=public|private` that filters collections by visibility, run
twice in CI. A post-build check greps `public/` for any private slug and
fails the job on a hit.

Design system: carry over the palette and type already used on the
tracker and dossier — Spectral (display), IBM Plex Sans (body), IBM Plex
Mono (metadata); petrol accent `#0F5C5A`, brass caution, clay risk; light
and dark via tokens. Details in `site/src/styles/tokens.css`.

## 6. The gate

One FastAPI service on Cloud Run, reachable only via Hosting rewrites.
Four responsibilities; keep it small enough to read in one sitting.

1. **Sessions.** Client signs in with Firebase Auth (Google or email-link).
   `POST /session` verifies the ID token with Firebase Admin SDK and mints
   a Firebase session cookie (14 days, `HttpOnly`, `Secure`, `SameSite=Lax`).
2. **Allowlist.** Firestore collection `members/{email}` with `{added_by,
   added_at, note}`. Non-member sign-ins get a "not shared with you" page.
   Members with `role: owner` may manage members and shares.
3. **Serve.** `GET /p/{path:path}` → check session → stream from private
   bucket. Gate service account is the bucket's only reader. Correct
   `Content-Type`, `Cache-Control: private, no-store`.
4. **Share links.** `POST /share {slug, expires_in_days}` (owner only)
   mints a random token, stores `{slug, exp, created_by, revoked}` in
   Firestore `shares/{token}`. `GET /s/{token}/{path:path}` serves that one
   slug's files without a session. `DELETE /share/{token}` revokes.

`min-instances=0`. Cold start ≈1s is acceptable.

Tests required (pytest): session mint/verify, non-member rejection,
path traversal rejection on `/p/` and `/s/`, expired and revoked share
rejection, share cannot escape its slug.

## 7. Access model

Three tiers. This was an assumption in the proposal; treat it as decided
unless the owner says otherwise in §10.

| Tier | Who | How |
|---|---|---|
| Public | Anyone | CDN, no auth |
| Member | Allowlisted emails | Sign in once; session cookie |
| Shared | Holder of a link | Signed token, one slug, expires, revocable |

## 8. Infrastructure

One GCP project under Jason's personal account. Terraform in `infra/`.

| Component | Service | Terraform resource(s) |
|---|---|---|
| Public site | Firebase Hosting | `firebase.json` + CLI deploy in Actions (Hosting is not fully Terraformable) |
| Gate | Cloud Run | `google_cloud_run_v2_service`, IAM invoker = allUsers (auth is app-level) |
| Identity | Firebase Auth / Identity Platform | `google_identity_platform_config` (enable Google + email-link) |
| Allowlist, shares | Firestore (Native) | `google_firestore_database` |
| Content bucket | GCS | `google_storage_bucket` + per-satellite prefix IAM conditions |
| Private bucket | GCS | `google_storage_bucket`, no `allUsers`, uniform access |
| Images | Artifact Registry | `google_artifact_registry_repository`, keep last 5 |
| CI identity | Workload Identity Federation | `google_iam_workload_identity_pool` + provider; one SA for hub deploy, one SA per satellite scoped to its prefix |
| Guardrail | Billing budget | `google_billing_budget` at $5 with email alert |

Region `us-east1`. Blaze plan required (Hosting→Cloud Run rewrites);
expected run rate $0–3/month plus domain renewal.

`firebase.json` (hub root):

```json
{
  "hosting": {
    "public": "site/dist-public",
    "ignore": ["firebase.json", "**/.*"],
    "rewrites": [
      { "source": "/p/**", "run": { "serviceId": "hub-gate", "region": "us-east1" } },
      { "source": "/s/**", "run": { "serviceId": "hub-gate", "region": "us-east1" } },
      { "source": "/session", "run": { "serviceId": "hub-gate", "region": "us-east1" } },
      { "source": "/share/**", "run": { "serviceId": "hub-gate", "region": "us-east1" } }
    ],
    "headers": [
      { "source": "**", "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]}
    ]
  }
}
```

## 9. Hub repository layout (target state of `website`)

```
website/
├── llm/                          # control plane (governance-managed)
│   ├── governance/               # delta, ADRs, checks
│   │   ├── governance-delta.md
│   │   └── adr/
│   ├── specs/2026-09-10-research-hub-design.md   ← this document
│   ├── plans/
│   ├── sprints/
│   └── memory_bank/
├── docs/                         # data plane: satellite how-to, published views
├── site/                         # Astro (existing src/ moves here or stays; agent decides, records in ADR)
│   ├── src/content.config.ts
│   ├── src/content/local/
│   ├── src/content/sources/      # synced at build; gitignored
│   ├── src/components/
│   ├── src/layouts/
│   └── src/styles/tokens.css
├── gate/                         # FastAPI
│   ├── app/{main,auth,members,share,serve}.py
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── contract/
│   ├── manifest.schema.json
│   ├── README.md
│   └── publish/action.yml
├── infra/                        # Terraform
├── firebase.json
└── .github/workflows/
    ├── build.yml                 # push + repository_dispatch: sync, build ×2, leak check, deploy
    └── gate.yml                  # gate/** change: test, build image, deploy Cloud Run
```

ADRs to write (Chief-Architect), numbered from the next free number
after `/governance:establish`:

1. Promote `website` to hub; migrate hosting from GitHub Pages to Firebase
   Hosting (alternatives: new repo; stay on Pages with a separate private
   host).
2. Hub/satellite publishing model with bucket + dispatch (alternatives:
   satellites commit into hub; hub pulls satellites at build).
3. Keep Astro with React islands (alternatives per §5).
4. Private area via Cloud Run gate behind Hosting rewrites, Firebase Auth
   sessions, Firestore allowlist (alternatives: IAP; allowlist-only without
   share links).
5. Two-output build with leak check (alternatives: single build with
   runtime filtering).

## 10. Open questions — the owner answers these; agents do not guess

| # | Question | Blocks |
|---|---|---|
| Q1 | Domain name to bind. | Phase 1 deploy |
| Q2 | GCP project id (new or existing) and confirmation Blaze is enabled. | Phase 1 infra |
| Q3 | Confirm share links are wanted (§7), or cut them. | Phase 4 only |
| Q4 | Initial members to seed: default Jason + Chris Brown (emails). | Phase 3 |
| Q5 | Does `site/` become a subdirectory of `website`, or stay at root with `gate/`, `infra/` alongside? Agent proposes in ADR 1; owner approves. | Phase 1 |
| Q6 | After cv and phd-milestones, order of agentic-kg and construction-ai-proposal. | Phase 5 |

## 11. Phases and what ships

| Phase | Scope | Ships |
|---|---|---|
| 0 | `/governance:establish` on `website`; delta; ADRs 1–5; this doc committed; roadmap | Governed repo, decisions on record |
| 1 | Infra (Terraform + WIF + budget), Firebase project + Hosting + domain, Actions deploy, design tokens, section shells | Domain serves the site from Jason's cloud |
| 2 | Contract schema, publish action, content bucket, dispatch rebuild; `cv` formalized as satellite #1 | CV published through the contract |
| 3 | Gate service + tests, Identity Platform, Firestore, private bucket, two-output build + leak check, `/p/**` rewrite; `phd-milestones` as satellite #2; seed members | Tracker + dossier behind sign-in |
| 4 | Share mint/list/revoke; Shares page (React island) | 14-day link to one document |
| 5 | `agentic-kg`, `construction-ai-proposal` as satellites; project index | Self-updating projects section |
| 6 | Pagefind search (public only), RSS, OG images, redirects from `djjay0131.github.io/website`; retire Pages | Old URL forwards |

## 12. Non-negotiables reviewers protect

1. **No private content in public output.** Build-time check, bucket IAM
   test, both on every deploy.
2. **No long-lived cloud keys.** WIF only. A JSON key file anywhere in a
   repo or in GitHub secrets is a review failure.
3. **Satellites are untrusted.** A satellite can publish only under its own
   prefix; it can never affect another source or the hub's code.
4. **Static public site.** Nothing on the public path executes at request
   time.
5. **Owner can rebuild from the repo.** Terraform + Actions + this
   document are sufficient to recreate the system in a fresh GCP project.
6. **Cost guardrail stays on.** The budget alert is never removed.
