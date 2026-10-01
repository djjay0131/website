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
- **`kgis` is live** (`https://jason.cusati.us/projects/kgis/kgis-docs/`). Published
  from `agentic-kgis` through the contract on a push to its `main` (75 objects), then
  synced from the bucket by the hub with no commit to `website`. The frame, its
  `/_payload/kgis/` payload and its CSS/JS all serve 200. `kgis` is `required: true`.
- **The dependency audit runs in CI** (report-only, #56/#59) with a recorded baseline
  (`site/audit-baseline.json`); a new advisory is reported, not silently ignored.
- **Four alert policies** are enabled, including "gate started misconfigured" — but
  deliver nothing until the notification channel is verified (owner-only).
- Governance adopted (agentic-governance v0.9); `main` requires `governance-checks` and
  `budget-guard`. ADRs 0001–0014 Accepted. The owner's $5 budget alert is live.
- `/email/` and `/privacy/` are live, in the owner's supplied wording (PR #15).

## Done, most recent first

- **Wave 2 (`agentic-kg-research`, private) provisioned and published** 2026-10-01 —
  infra PR #77 (satellite 4, boundary-proven including reverse legs), satellite #3
  published 61 objects, hub private-sync 139 uploaded / 0 deleted with no `dist-public`
  trace; leak-check false positive FP-1 found by CI and fixed (PR #79). Member view awaits
  the owner's D12 seed.
- **Wave 1 (`kgis`) complete** 2026-10-01 — site stream + records PR #74 (Chief Reviewer
  Approve); K10 boundary proof passed; #54 metric forgery fixed (Red Team disproved the
  earlier value-only fix); `agentic-kgis` publish un-gated (its PR #53), first publish
  live; `required: true` PR #75; Phase 5 criterion 1 ticked.
- **Emblem home page** (#71, 2026-09-25), after Licensing declined the VT marks.
- **A1 proven live** (#69, 2026-09-23): member sign-in through the narrowed role.
- **Wave 0 merged** 2026-09-23 — #45, #48, #65, #53, #67, #47, close-out #68. Applied
  from `feat/infra-wave-0` at `63fc0d3` before merge (D9).
- **Phase 3 — Private area**, merged as PR #25 and wired by PR #29; Checkpoint 4
  executed 2026-09-17 (29 added, 0 changed, 0 destroyed).

## What is left

- **Satellites run (#72)**: satellite 3 `kgis` is done; satellite 4
  `agentic-kg-research` (private, for the team) is Wave 2.
- **Checkpoint 4 is not passed** (#52) until the owner's non-member sign-in records A3
  and A4. A13 is closed (the `phd-milestones` prefix proofs ran, K10 included).
- **Wave 0b (#46)**: private by default — the hub owns the publish decision. Not started.
- Phases 4–6 of `llm/master-roadmap.md` (sharing, satellite remainder, Phase 6), plus
  the branding wave (0c).

## Known issues

Every open issue, once:

- #21 `sync-content.sh` needs curl ≥ 7.76 and misreports the failure as a bucket error.
- #42 Backlog: a traffic-analysis page now that structured logging exists.
- #46 Wave 0b — private by default.
- #51 Phase 3 criterion 7 is half-unsatisfiable; deferred to Phase 4.
- #52 Checkpoint 4 is not passed — needs the owner's non-member sign-in for A3/A4.
- #56 `npm audit --omit=dev`: **4 high** (`@grpc/grpc-js` via `firebase`) remain, now
  recorded in `site/audit-baseline.json` with a reachability argument and reported in CI.
- #57 The alert-channel guard asserts a string shape.
- #59 `npm audit` is wired report-only; the decision whether it ever blocks is open.
- #61 Hosting answers `/p/` null-byte paths with 500 while `run.app` returns the gate's 404.
- #63 SHA-pinned `latex-action` wraps a mutable `texlive-full:latest` run as root.
- #72 Satellites run: Wave 1 (`kgis`) done; Wave 2 (`agentic-kg-research`) next.

Closed on this wave's evidence: **#50** (A13 ran; K10 the last proof), **#54** (metric
forgery fixed — the Red Team disproved the earlier value-only fix, assembled-pair
neutralisation added), **#62** (tfvars.example documents `gate_extra_allowed_origins`,
landed in `a68feea`).

Not tracked as issues, recorded in `STATE.md`: the residual exposure from Incident A1
(the owner declined the GitHub purge), and the standing rule that no satellite identity
may ever hold `storage.objects.list`.

## Governance adoption

- 2026-09-14: adopted agentic-governance v0.9 (canon 0.9.0; pin moved by PR #22) — issue #7.
  Delta: `llm/governance/governance-delta.md`.
