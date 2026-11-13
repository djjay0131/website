import { describe, it, expect } from "vitest";
import { projectRelationsFor } from "./catalog.mjs";

// ADR-0030. Synthetic names only: the repository is public.
describe("project relationships on catalog items", () => {
  it("is empty when the manifest declares none, so old catalogs are unchanged", () => {
    expect(projectRelationsFor({ source: "child-a" }, "child-a")).toEqual({});
    expect(projectRelationsFor({ project: {} }, "child-a")).toEqual({});
  });

  it("carries parent and de-duplicated related keys", () => {
    expect(
      projectRelationsFor({ project: { parent: "parent-a", related: ["other-a", "other-a", "other-b"] } }, "child-a"),
    ).toEqual({ parent: "parent-a", related: ["other-a", "other-b"] });
  });

  it("drops self-references and a related key equal to the parent", () => {
    expect(
      projectRelationsFor({ project: { parent: "child-a", related: ["child-a", "parent-b"] } }, "child-a"),
    ).toEqual({ related: ["parent-b"] });
    expect(projectRelationsFor({ project: { parent: "parent-a", related: ["parent-a"] } }, "child-a")).toEqual({
      parent: "parent-a",
    });
  });
});
