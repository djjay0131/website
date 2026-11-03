// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { derivedGroups, syncState } from "./admin-ui.mjs";

describe("admin UI helpers", () => {
  it("derives groups and counts from members", () => {
    expect(
      derivedGroups([
        { email: "a@example.org", groups: ["committee", "team"] },
        { email: "b@example.org", groups: ["team"] },
      ]),
    ).toEqual([
      ["committee", 1],
      ["team", 2],
    ]);
  });

  it("marks a stale project as a warning and a fresh one as ok", () => {
    expect(syncState({ stale: true })).toEqual({ label: "stale", kind: "warn" });
    expect(syncState({ stale: false })).toEqual({ label: "ok", kind: "ok" });
  });
});
