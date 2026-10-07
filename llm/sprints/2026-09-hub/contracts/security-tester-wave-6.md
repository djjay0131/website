# Contract — Security Tester, Wave 6 (annotations) — VETO

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`

## Mandate

Own the security gate for this wave. A single **FAIL blocks every merge**
(completion brief §7). Test, do not review prose. Report each check PASS / FAIL /
NOT TESTED and never infer a pass from a rendered page or a code read.

## Checks

1. **Cross-member isolation.** Member A cannot read, list or delete member B's
   notes through any annotation route, on both transports. Owner may read/delete
   all. Prove by exercising the routes, not by reading the handler.
2. **Auth.** `/annotations` signed-out and as a non-member → identical refusal
   on Hosting and `*.run.app`. State-changing routes refuse a missing/foreign
   Origin.
3. **Injection.** A stored comment/quote cannot execute script in My notes, the
   capture panel, or the exported Markdown (escaping proven, not assumed).
4. **Cache.** Every annotation response is `private, no-store`, never
   `public`/`s-maxage`.
5. **Logging.** No quote, comment, title, selector or private path in any log
   line; the planted marker is absent while the log layer is demonstrably alive.
6. **Header change.** `_payload/**` is `SAMEORIGIN`; every other `/p/**`
   response is `DENY`; no new framing exposure beyond same-origin.
7. **Public boundary.** No annotation tooling, endpoint, route or chunk in
   `dist-public`; the leak check catches a planted annotation needle
   (non-vacuously); Firestore rules still deny-all.
8. **IAM unchanged.** The gate still holds exactly `datastore.user`,
   `gateSessionMinter`; no new binding, key or export credential exists.

Report as `handoffs/security-tester-wave-6.md`.
