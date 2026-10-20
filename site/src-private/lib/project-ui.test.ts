// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mountProjectLanding, mountProjectNavigation } from "./project-ui.mjs";

const items = [
  {
    section: "research",
    source: "study-a",
    slug: "overview",
    title: "Green but Wrong: overview",
    summary: "Overview summary.",
    visibility: "private",
    date: "2026-10-17",
    order: 0,
  },
  {
    section: "research",
    source: "study-a",
    slug: "design",
    title: "Green but Wrong: design",
    visibility: "private",
    date: "2026-10-16",
    order: 1,
  },
];

describe("the projects DOM", () => {
  beforeEach(() => document.body.replaceChildren());

  it("renders cards, not a flat item list", () => {
    const root = document.createElement("div");
    mountProjectLanding(root, items);
    expect(root.querySelectorAll(".project-card")).toHaveLength(1);
    expect(root.querySelector("h2 a")?.textContent).toBe("Green but Wrong");
    expect(root.textContent).toContain("2");
    expect(root.textContent).toContain("2026-10-17");
    expect(root.querySelectorAll(".project-card li")).toHaveLength(0);
  });

  it("renders a sub-nav, current page and previous/next links", () => {
    const nav = document.createElement("nav");
    const prev = document.createElement("nav");
    mountProjectNavigation({ navRoot: nav, prevRoot: prev, items, source: "study-a", slug: "design" });
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Overview", "Design"]);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Design");
    expect(prev.querySelector('[rel="prev"]')?.getAttribute("href")).toBe("/p/projects/study-a/overview/");
    expect(prev.querySelector('[rel="next"]')).toBeNull();
  });

  it("shows an empty state rather than stale cards", () => {
    const root = document.createElement("div");
    mountProjectLanding(root, []);
    expect(root.textContent).toContain("No projects");
    expect(root.querySelector(".project-card")).toBeNull();
  });
});
