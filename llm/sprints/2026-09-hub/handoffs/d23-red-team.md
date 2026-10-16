# D23 — Red Team

Date: 2026-10-16 · Scope: PR #124, PR #125. Owner decision D23-B sets the rules of engagement.

Targets, per the D23 brief: any public leak of `saner2027`; WIF admitting another
repository/branch/fork/PR event; the publisher writing outside its prefix.

| # | Attack | Result | Disposition |
|---|---|---|---|
| **RT1** | **Can a public reader link the satellite to the venue/repo/author from the public repo or site?** | **Repo: YES. Site: NO.** `origin/satellite/saner2027` publicly names `saner2027`, `saner2027-governed-agents`, "SANER 2027 study", and "Jason (private repo)" in `infra/variables.tf`, `infra/README.md`, `infra/terraform.tfvars.example`, `llm/governance/adr/0019-*.md`, `llm/governance/governance-delta.md` and `llm/specs/2026-09-10-research-hub-design.md`. The served site carries none of it (check PASS; not in the allowlist). | **Accepted by D23-B.** The owner explicitly chose the real name over an opaque key; the site boundary holds. |
| **RT2** | Another repository, branch, fork or PR event authenticates. | Refused. `repository_id` + `repository_owner_id` are asserted by GitHub's OIDC issuer, and the impersonation binding pins `attribute.repository_id_ref/<id>/refs/heads/master`; `pull_request_target` is refused in the condition. | **Refused.** |
| **RT3** | The publisher writes outside `sources/saner2027/`. | Refused. The condition ends in a slash: `sources/saner2027-other/` does not `startsWith` `sources/saner2027/`; the role has no `list`. | **Refused.** |
| **RT4** | The satellite's *title* leaks with the source name omitted (e.g. a first-party page names the paper). | The paper/page title is **not** a committed needle; it is covered only by the manifest-derived item-title needles, which exist once the satellite publishes. A first-party page naming a title before the manifest carries it would not be caught. | **Accepted residual (D23-B).** A title literal in this public repo would itself be a disclosure, so it is deliberately not committed. |

## Side effects

None. All probing was read-only (git, grep, terraform console, a temp build). No
production requests, no writes, no applies.
