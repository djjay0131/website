# Architecture Decision Records

Durable decisions for this repository. An ADR *is* the decision, not a
report of one, so ADRs are control-plane content and live here under
`llm/governance/adr/`. A published ADR index may be generated into the
artifacts tree as a derived view.

Files are named `NNNN-short-title.md`, numbered from `0001`. Draft new ADRs
from `0000-template.md`.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-promote-website-to-hub-on-firebase-hosting.md) | Promote `website` to the hub and move hosting to Firebase Hosting | Accepted |
| [0002](0002-satellite-publishing-via-content-bucket-and-dispatch.md) | Satellites publish to a content bucket (the dispatch half is superseded by ADR-0007) | Accepted |
| [0003](0003-keep-astro-with-react-islands.md) | Keep Astro, with React islands for interactive widgets | Accepted |
| [0004](0004-private-area-cloud-run-gate-behind-hosting.md) | Private area via a Cloud Run gate behind Hosting rewrites | Accepted |
| [0005](0005-two-output-build-with-leak-check.md) | Two-output build with a leak check | Accepted |
| [0006](0006-hub-on-jason-cusati-us-subdomain.md) | The hub lives at `jason.cusati.us`; `research.cusati.us` redirects; `cusati.us` is reserved for a family site | Accepted |
| [0007](0007-hub-polls-content-bucket-no-satellite-github-credential.md) | The hub polls the content bucket; no satellite holds a GitHub credential | Accepted |
| [0008](0008-manifest-data-format-hub-renders-cv.md) | The manifest gains a `data` format; the hub keeps rendering the CV | Accepted |
| [0009](0009-manifest-version-lands-optional-first.md) | `manifest_version` lands optional, and becomes required later | Accepted |
| [0010](0010-withdrawal-semantics.md) | Withdrawal semantics — the manifest is the authority, and a private withdrawal must actually stop serving | Accepted |
| [0011](0011-two-srcdirs-not-a-visibility-filter.md) | The private build is a second `srcDir`, not a visibility filter | Accepted |
| [0012](0012-dev-staging-in-a-separate-project.md) | Dev-staging lives in a separate GCP project | Accepted |
| [0013](0013-unauthenticated-client-telemetry-endpoint.md) | The gate exposes an unauthenticated client-telemetry endpoint | Accepted |
| [0014](0014-satellites-call-the-publish-contract-at-a-moving-v1-tag.md) | Satellites call the publish contract at a moving `v1` tag | Accepted |

## Lifecycle

1. Proposed
2. Accepted
3. Superseded
4. Deprecated

Each row's Status cell must match the first word of the corresponding
file's `Status:` line; the `adr-index` governance check enforces this.

Which ADR changes are semantic and which status flips are administrative,
and the required form of an administrative status flip: agentic-governance
`llm/governance/architecture-governance.md` §ADR Process and
`llm/governance/l0-fast-track.md` §L0 Path Allowlist.
