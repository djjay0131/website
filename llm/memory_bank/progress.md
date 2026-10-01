# Progress

Status: Active
Last updated: 2026-10-01
Owner: Chief Architect

What belongs here: what works, what is left, and known issues — recorded against
merged reality, not plans.

## What works

- **https://jason.cusati.us** serves the site from Firebase Hosting (project `cusati-hub`),
  deployed on every push to `main` through WIF; no service-account keys exist.
  `https://research.cusati.us` 301-redirects to it, preserving paths. GitHub Pages
  (`djjay0131.github.io/website/`) still serves the same build until Phase 6.
- **The home page carries an original emblem** (#71, 2026-09-25). Licensing declined
  use of the Virginia Tech marks on 2026-09-24, so no VT mark is served anywhere.
- **Members sign in and read the private area.** Proven live 2026-09-23 (A1): the owner
  signed in, the gate minted a session under its narrowed role, and both private
  documents were served under `/p/`.
- **Sign-out.** `POST /session/end` clears `__session` and returns 200 on
  `jason.cusati.us` and on the `*.run.app` URL; a cross-origin POST is refused 403. The
  CSRF check compares `Origin` against a set built at startup from
  `GATE_ALLOWED_ORIGINS`, never from the request; unset, it refuses every caller.
- **The gate runs on a narrowed identity**: `gateSessionMinter`
  (`firebaseauth.users.createSession`, `firebaseauth.users.get`) and `datastore.viewer`.
  `roles/firebaseauth.admin` is removed.
- **The private bucket's legacy exposure is closed.** `roles/editor` is empty
  project-wide, so the automatic `projectEditor` bindings expand to nobody.
  `private-bucket-live-iam` runs hourly and on every push to `main`, and passes.
- **Satellites publish through a moving `v1` tag** (ADR-0014). Proven from `cv`: the
  `@v1` run on `cv` `master` (`e1e7721`) published and wrote `sources/cv/manifest.json`.
  Third-party actions in every satellite are pinned by full SHA.
- **The CV is published through the contract** from `cv`, and the hub polls the bucket;
  `build-info.json` reports `content_source: bucket`.
- **The content bucket's prefix boundary** holds for `cv` (`STATE.md` §Checkpoint 3):
  a satellite can create, overwrite, read and delete inside its own prefix and is
  refused every write outside it and every `list`, including of its own prefix.
- **Four alert policies** are enabled, including "gate started misconfigured" — but
  deliver nothing until the notification channel is verified (owner-only).
- Governance adopted (agentic-governance v0.9); `main` requires `governance-checks` and
  `budget-guard`. ADRs 0001–0014 Accepted. The owner's $5 budget alert is live.
- `/email/` and `/privacy/` are live, in the owner's supplied wording (PR #15).

## Done, most recent first

- **Emblem home page** (#71, 2026-09-25), after Licensing declined the VT marks.
- **A1 proven live** (#69, 2026-09-23): member sign-in through the narrowed role.
- **Wave 0 merged** 2026-09-23 — #45, #48, #65, #53, #67, #47, close-out #68. Applied
  from `feat/infra-wave-0` at `63fc0d3` before merge (D9).
- **Phase 3 — Private area**, merged as PR #25 and wired by PR #29; Checkpoint 4
  executed 2026-09-17 (29 added, 0 changed, 0 destroyed).

## What is left

- **Satellites run (#72)**: satellite 3 `kgis` (public), then satellite 4
  `agentic-kg-research` (private, for the team). Phase 3 bookkeeping rides with it:
  the `phd-milestones` prefix proofs (A13) and the non-member sign-in (A3, A4).
- **Checkpoint 4 is not passed** (#52) until A3, A4 and A13 are recorded.
- **Wave 0b (#46)**: private by default — the hub owns the publish decision. Not started.
- Phases 4–6 of `llm/master-roadmap.md`.

## Known issues

Every open issue, once:

- #21 `sync-content.sh` needs curl ≥ 7.76 and misreports the failure as a bucket error.
- #42 Backlog: a traffic-analysis page now that structured logging exists.
- #46 Wave 0b — private by default.
- #50 Phase 3 A13: the `phd-milestones` prefix-boundary test has not been recorded.
- #51 Phase 3 criterion 7 is half-unsatisfiable; deferred to Phase 4.
- #52 Checkpoint 4 is not passed.
- #54 Log-based metrics are forgeable by an anonymous caller through `POST /client-events`.
- #56 `npm audit --omit=dev`: **4 high** on `main` as of 2026-10-01 (`@grpc/grpc-js`
  via `firebase`), after reaching 0 with the astro 7.3.3 upgrade.
- #57 The alert-channel guard asserts a string shape.
- #59 `npm audit` runs in no workflow, which is why #56 recurred unnoticed.
- #61 Hosting answers `/p/` null-byte paths with 500 while `run.app` returns the gate's 404.
- #62 `terraform.tfvars.example` omits `gate_extra_allowed_origins`.
- #63 SHA-pinned `latex-action` wraps a mutable `texlive-full:latest` run as root.
- #72 Satellite 3 — `agentic-kgis` publishes as source `kgis`.

Not tracked as issues, recorded in `STATE.md`: the residual exposure from Incident A1
(the owner declined the GitHub purge), and the standing rule that no satellite identity
may ever hold `storage.objects.list`.

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.9 (canon 0.9.0; pin moved by PR #22) — issue #7.
  Delta: `llm/governance/governance-delta.md`.
