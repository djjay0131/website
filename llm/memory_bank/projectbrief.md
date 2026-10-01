# Project Brief

Status: Active
Last updated: 2026-10-01
Owner: Chief Architect

What belongs here: the durable statement of what this project is, for whom, and
what it is not — pointing at the design authority rather than restating it.

## Mission

A personal research site, owned outright by Jason (personal GitHub, personal
Google Cloud, personal domain), that publishes content produced in many
repositories and many formats into one site with a public face and a gated
private area. Private items can be shared with specific people. It must outlive
the PhD.

It is not a CMS, a blog engine, an application, or a place where content is
authored. Content is authored in satellites; the hub renders it.

## The satellite model

Each satellite is its own repository that builds its content and publishes it,
with a manifest, to its own prefix of a content bucket through the hub's
contract. The hub polls that bucket and renders what it finds; it holds no
credential to any satellite. An item is public only if its manifest asks to be
**and** the hub's publish allowlist agrees — everything else renders only in the
private build.

## What the site exists to carry

The owner's research, under three tenets (owner, branding plan §11):
**Knowledge Graphs**, **Agentic Software Engineering**, and **AI Safety**.

## Who the private area is for

Allowlisted members only, signed in at `/p/`: the owner (`role: owner`) and the
people they name. It holds PhD milestone material and research shared with the
owner's team.

## Where the decisions live

- Design authority: `llm/specs/2026-09-10-research-hub-design.md`
- Roadmap: `llm/master-roadmap.md`
- Current state and decisions D1–D9: `llm/sprints/2026-09-hub/STATE.md`
- Governance delta: `llm/governance/governance-delta.md` (agentic-governance;
  steward merge authority INACTIVE)
