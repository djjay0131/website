import { describe, expect, it } from "vitest";
import {
  breadcrumb,
  buildProjects,
  isProjectItem,
  neighbours,
  pageLabel,
  projectDescription,
  projectHref,
  projectPageHref,
  projectPages,
  projectTitle,
} from "./projects.mjs";

const items = [
  {
    section: "research",
    source: "study-a",
    slug: "overview",
    title: "Green but Wrong: study overview",
    summary: "A short overview of the study.",
    visibility: "private",
    date: "2026-10-17",
    order: 0,
  },
  {
    section: "research",
    source: "study-a",
    slug: "design",
    title: "Green but Wrong: study design",
    summary: "Design.",
    visibility: "private",
    date: "2026-10-16",
    order: 1,
  },
  {
    section: "research",
    source: "study-a",
    slug: "literature",
    title: "Green but Wrong: literature",
    visibility: "private",
    date: "2026-10-15",
    order: 2,
  },
  {
    section: "cv",
    source: "cv",
    slug: "private-cv",
    title: "A private CV",
    visibility: "private",
    date: "2026-10-18",
    order: 0,
  },
  {
    section: "projects",
    source: "public-source",
    slug: "public-item",
    title: "Public item",
    visibility: "public",
    date: "2026-10-18",
    order: 0,
  },
];

describe("the projects model", () => {
  it("excludes CV and public items from project cards", () => {
    expect(items.filter(isProjectItem).map((item) => item.slug)).toEqual([
      "overview",
      "design",
      "literature",
    ]);
  });

  it("groups one card per source and derives its title and description", () => {
    const projects = buildProjects(items);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      source: "study-a",
      title: "Green but Wrong",
      description: "A short overview of the study.",
      itemCount: 3,
      lastUpdated: "2026-10-17",
      href: "/p/projects/study-a/",
    });
  });

  it("keeps manifest order and derives sub-page labels", () => {
    const pages = projectPages(items, "study-a");
    expect(pages.map((item) => item.slug)).toEqual(["overview", "design", "literature"]);
    expect(pages.map((item) => pageLabel(item))).toEqual([
      "Study overview",
      "Study design",
      "Literature",
    ]);
  });

  it("builds routes, breadcrumbs and neighbours", () => {
    const item = items[1];
    expect(projectHref(item)).toBe("/p/projects/study-a/");
    expect(projectPageHref(item)).toBe("/p/projects/study-a/design/");
    expect(breadcrumb(item, projectTitle([item], "study-a")).map((crumb) => crumb.label)).toEqual([
      "Projects",
      "Green but Wrong",
      "Study design",
    ]);
    const around = neighbours(items, "study-a", "design");
    expect(around.previous?.slug).toBe("overview");
    expect(around.next?.slug).toBe("literature");
  });

  it("truncates a long card description", () => {
    const long = "x".repeat(400);
    expect(projectDescription([{ summary: long }])).toHaveLength(178);
  });
});
