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
| [0002](0002-satellite-publishing-via-content-bucket-and-dispatch.md) | Satellites publish to a content bucket and notify the hub by dispatch | Accepted |
| [0003](0003-keep-astro-with-react-islands.md) | Keep Astro, with React islands for interactive widgets | Accepted |
| [0004](0004-private-area-cloud-run-gate-behind-hosting.md) | Private area via a Cloud Run gate behind Hosting rewrites | Accepted |
| [0005](0005-two-output-build-with-leak-check.md) | Two-output build with a leak check | Accepted |

## Lifecycle

1. Proposed
2. Accepted
3. Superseded
4. Deprecated

Each row's Status cell must match the first word of the corresponding
file's `Status:` line; the `adr-index` governance check enforces this.

Creating or modifying ADR *content* is L1. Flipping an ADR *status* to
record a decision already approved in a merged PR is L0, and must be
status-line-only in the constrained form
`Status: <Proposed|Accepted|Superseded|Deprecated> (via PR #n[, YYYY-MM-DD])`.

Policy: agentic-governance `llm/governance/architecture-governance.md`
§ADR Process.
