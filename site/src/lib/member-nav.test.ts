// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyMemberNav, memberNavFromResponse } from "./member-nav.mjs";

function navList() {
  const list = document.createElement("ul");
  for (const [label, href] of [
    ["Research", "/research/"],
    ["Projects", "/projects/"],
    ["CV", "/cv/"],
  ]) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    li.append(a);
    list.append(li);
  }
  return list;
}

describe("the signed-in navigation augmentation", () => {
  beforeEach(() => document.body.replaceChildren());

  it("adds the gate's entries and repoints Projects without duplicating it", () => {
    const list = navList();
    const added = applyMemberNav(
      list,
      memberNavFromResponse({
        member: true,
        owner: false,
        projects_href: "/p/projects/",
        nav: [{ label: "Calendar", href: "/p/calendar/" }, { label: "Notes", href: "/p/notes/" }],
      }),
    );
    expect(added).toEqual(["Calendar", "Notes"]);
    expect([...list.querySelectorAll("a")].map((a) => a.textContent)).toEqual([
      "Research",
      "Projects",
      "CV",
      "Calendar",
      "Notes",
    ]);
    expect(list.querySelector('a[href="/p/projects/"]')?.textContent).toBe("Projects");
    expect([...list.querySelectorAll("a")].filter((a) => a.textContent === "Projects")).toHaveLength(1);
  });

  it("adds Admin only when the gate says owner", () => {
    const member = navList();
    applyMemberNav(
      member,
      memberNavFromResponse({
        member: true,
        owner: false,
        nav: [{ label: "Admin", href: "/p/admin/" }],
      }),
    );
    expect(member.textContent).not.toContain("Admin");

    const owner = navList();
    applyMemberNav(
      owner,
      memberNavFromResponse({ member: true, owner: true, nav: [{ label: "Admin", href: "/p/admin/" }] }),
    );
    expect(owner.textContent).toContain("Admin");
  });

  it("does nothing for a signed-out or malformed response", () => {
    const list = navList();
    expect(applyMemberNav(list, memberNavFromResponse({ member: false }))).toEqual([]);
    expect(applyMemberNav(list, memberNavFromResponse({ member: true, nav: [{ label: "x", href: "https://evil" }] })))
      .toEqual([]);
    expect([...list.querySelectorAll("a")]).toHaveLength(3);
  });
});
