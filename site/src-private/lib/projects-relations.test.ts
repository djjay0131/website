import { describe, it, expect } from "vitest";
import { buildProjects, projectRelations } from "./projects.mjs";

// ADR-0030. Synthetic names only: the repository is public.
const page = (source: string, extra: Record<string, unknown> = {}) => ({
  section: "research",
  source,
  slug: "overview",
  title: `${source} overview`,
  format: "html",
  visibility: "private",
  href: `/p/projects/${source}/overview/`,
  date: "2026-11-01",
  order: 0,
  ...extra,
});

const portfolio = page("portfolio-a", { related: ["study-x", "unseen-z"] });
const childOne = page("child-one", { parent: "portfolio-a" });
const childTwo = page("child-two", { parent: "portfolio-a", related: ["child-one"] });
const study = page("study-x");

describe("project relationships", () => {
  it("leaves projects without relationships exactly as before", () => {
    const projects = buildProjects([study]);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ source: "study-x", parent: null, children: [], related: [] });
  });

  it("nests children under a visible parent and resolves only visible related keys", () => {
    const projects = buildProjects([portfolio, childOne, childTwo, study]);
    expect(projects.map((p) => p.source).sort()).toEqual(["portfolio-a", "study-x"]);
    const parent = projects.find((p) => p.source === "portfolio-a")!;
    expect(parent.children.map((c: { source: string }) => c.source)).toEqual(["child-one", "child-two"]);
    // unseen-z is not in the viewer's items, so it never appears.
    expect(parent.related.map((r: { source: string }) => r.source)).toEqual(["study-x"]);
    expect(parent.children[1].related.map((r: { source: string }) => r.source)).toEqual(["child-one"]);
  });

  it("keeps a child top-level when the viewer cannot open its parent", () => {
    const projects = buildProjects([childOne, study]);
    const child = projects.find((p) => p.source === "child-one")!;
    expect(child.parent).toBeNull();
    expect(JSON.stringify(projects)).not.toContain("portfolio-a overview");
  });

  it("nests one level only and ignores self-parents", () => {
    const grandchild = page("grandchild", { parent: "child-one" });
    const self = page("self-a", { parent: "self-a" });
    const projects = buildProjects([portfolio, childOne, grandchild, self]);
    const top = projects.map((p) => p.source).sort();
    expect(top).toEqual(["grandchild", "portfolio-a", "self-a"]);
  });

  it("answers a project page's parent, children and related links", () => {
    const items = [portfolio, childOne, childTwo, study];
    expect(projectRelations(items, "child-two")).toMatchObject({
      parent: { source: "portfolio-a", href: "/p/projects/portfolio-a/" },
      children: [],
      related: [{ source: "child-one" }],
    });
    expect(projectRelations(items, "portfolio-a").children.map((c) => c.source)).toEqual(["child-one", "child-two"]);
    expect(projectRelations(items, "missing")).toEqual({ parent: null, children: [], related: [] });
  });
});
