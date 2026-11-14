// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { installMemberProjects, renderMemberProjects } from "./member-projects.mjs";

// Synthetic names only: the repository is public.
const item = (source: string, extra: Record<string, unknown> = {}) => ({
  section: "research",
  source,
  slug: `${source}-overview`,
  title: `${source} title`,
  format: "html",
  visibility: "private",
  href: `/p/projects/${source}/${source}-overview/`,
  date: "2026-11-01",
  order: 0,
  ...extra,
});

function root() {
  const node = document.createElement("section");
  node.hidden = true;
  return node;
}

function fakeFetch(map: Record<string, { ok: boolean; body?: unknown }>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const hit = map[url] ?? { ok: false };
    return { ok: hit.ok, json: async () => hit.body } as Response;
  };
  return { impl, calls };
}

describe("public Projects page: the signed-in viewer's projects (D34)", () => {
  it("stays hidden and never asks for items when the caller is not a member", async () => {
    const node = root();
    const { impl, calls } = fakeFetch({ "/private/me": { ok: false } });
    expect(await installMemberProjects({ fetch: impl as typeof fetch, root: node })).toEqual([]);
    expect(node.hidden).toBe(true);
    expect(calls).toEqual(["/private/me"]);
  });

  it("draws a member's projects with children nested under a visible parent", async () => {
    const node = root();
    const { impl } = fakeFetch({
      "/private/me": { ok: true, body: { member: true, projects_href: "/p/projects/" } },
      "/private/items": {
        ok: true,
        body: { items: [item("portfolio-a"), item("child-one", { parent: "portfolio-a" }), item("study-x")] },
      },
    });
    const titles = await installMemberProjects({ fetch: impl as typeof fetch, root: node });
    expect(node.hidden).toBe(false);
    expect(titles).toHaveLength(2);
    const children = [...node.querySelectorAll(".member-project-children a")].map((a) => a.getAttribute("href"));
    expect(children).toEqual(["/p/projects/child-one/"]);
    expect(node.querySelector(".member-projects-all")?.getAttribute("href")).toBe("/p/projects/");
  });

  it("writes text, never markup, and refuses links outside /p/", () => {
    const node = root();
    renderMemberProjects(node, [item("evil-a", { title: "<img src=x onerror=alert(1)>" })], "https://example.com/");
    expect(node.querySelector("img")).toBeNull();
    expect(node.querySelector(".member-projects-all")).toBeNull();
    for (const a of node.querySelectorAll("a")) expect(a.getAttribute("href")?.startsWith("/p/")).toBe(true);
  });

  it("stays hidden for a member with no private projects", () => {
    const node = root();
    expect(renderMemberProjects(node, [])).toEqual([]);
    expect(node.hidden).toBe(true);
  });
});
