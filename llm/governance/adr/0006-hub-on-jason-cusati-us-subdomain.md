# ADR-0006: The hub lives at `jason.cusati.us`; `research.cusati.us` redirects; `cusati.us` is reserved for a family site

Status: Accepted
Date: 2026-09-15

## Context

ADR-0001 Decision 2 bound the hub to `cusati.us`, the owner's answer to design doc
§10 Q1. Before anything was applied or merged, the owner reconsidered where the hub
should sit on that domain.

`cusati.us` is a surname domain. It already carries Google Workspace mail (MX records to
`aspmx.l.google.com`) and a Google site-verification record, so it is in use beyond this
project. The owner wants `cusati.us` and `www.cusati.us` to serve a **family home page**,
with the research hub on a subdomain of its own. The owner also wants both
`jason.cusati.us` and `research.cusati.us` to reach the hub.

Nothing had been applied, merged or linked, so changing the host now costs a handful of
string changes; changing it after cutover would break inbound links.

## Decision

1. **`cusati.us` and `www.cusati.us` are reserved for a family home page**, which is
   outside this project. The hub repository does not host it, the hub's Terraform does
   not bind the apex or `www`, and hub work never changes the apex, `www`, MX or existing
   TXT records.
2. **The hub's canonical host is `jason.cusati.us`** — Terraform `var.domain`, the site's
   default `SITE_URL`, the sitemap and canonical links.
3. **`research.cusati.us` is connected to the same Firebase Hosting site as a second
   custom domain that answers with a 301 redirect to `jason.cusati.us`**
   (`redirect_target`). It is not a bare DNS CNAME: Hosting issues a certificate only
   for hostnames connected to it, so an unconnected alias would fail TLS.
4. The private area's session cookie belongs to the canonical host only.

## Rationale

A surname domain already used for household mail is naturally the family's. Putting the
hub on a subdomain gives it a home under the owner's own name that covers everything it
holds — CV, papers, projects, writing and research — while `research.` remains a
discoverable alias. A single canonical host avoids duplicate pages in search and a split
sign-in session: the session cookie is scoped to one hostname, so serving the site on
both would sign a visitor in on one and not the other. Host-only cookies also keep the
hub's private-area session out of reach of a family site at the apex.

## Alternatives Considered

### Hub at the apex, `www` redirecting to it (ADR-0001 as written)

No change. But the family page would have to live on a subdomain of its own surname
domain, and the apex — the domain's natural front door — would belong to one person's
professional site.

### A minimal landing page at the apex, linking to family and research

Neutral, but it adds a third site to build and maintain for no gain over reserving the
apex for the family page, which can link to the hub itself.

### Both subdomains serving the site, with no redirect

Rejected: duplicate content in search, and a sign-in on one host is not recognised on
the other.

### A bare DNS CNAME from `research.cusati.us` to `jason.cusati.us`

Rejected: `research.cusati.us` would resolve to Hosting without being connected to it,
and HTTPS would fail on a certificate mismatch.

## Consequences

### Positive

- The family keeps the surname domain; the hub has a clear, personal address.
- One canonical host; `research.cusati.us` works as an alias with one hop.
- The hub's private-area cookie cannot be read by an apex site.

### Negative / Tradeoffs

- Two hostnames need DNS records at the registrar instead of one.
- The family site, when it exists, is a separate project with its own hosting.

### Risks

- **Mail breakage.** Adding hub records must never replace or delete the apex MX, TXT or
  `www` records. Mitigation: the manual DNS step adds only the records Terraform outputs,
  for the two hub hostnames.
- **Cookie collision.** A future family site that sets a cookie named `__session` with
  `Domain=cusati.us` would have it sent to the hub too, alongside the hub's own. The
  family site must not set cookies on the parent domain under that name.

## Impacted Areas

- [ ] Product
- [ ] Domain model
- [ ] Data architecture
- [ ] AI architecture
- [ ] Domain-specific systems (see governance delta)
- [x] Integrations
- [x] UX
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0001-promote-website-to-hub-on-firebase-hosting.md` Decision 2
- `llm/specs/2026-09-10-research-hub-design.md` §10 Q1
- `llm/sprints/2026-09-hub/STATE.md`

## Related Issues / PRs

- PR #12 — Phase 1; merging it accepts this ADR
- #10 — hub-001; #13 — OpenClaw Email pages on this host

## Supersedes

Amends ADR-0001 Decision 2 (the domain only). ADR-0001 otherwise stands.

## Superseded By

None.
