import { describe, it, expect } from "vitest";
import {
  ALLOWLIST_VERSION,
  PublishAllowlistError,
  effectiveVisibility,
  findAllowlistConflicts,
  findStaleAllowlistEntries,
  isAllowlisted,
  parsePublishAllowlist,
  readPublishAllowlist,
} from "./hub-content.mjs";

const allowlist = (items: { source: string; slug: string }[]) =>
  parsePublishAllowlist({ version: ALLOWLIST_VERSION, items });

describe("parsePublishAllowlist", () => {
  it("accepts satellite and hub entries", () => {
    const parsed = allowlist([
      { source: "cv", slug: "academic" },
      { source: "hub", slug: "research/soa-agentic-se/agentic-harnesses" },
    ]);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.hub.has("research/soa-agentic-se/agentic-harnesses")).toBe(true);
  });

  it("fails on a wrong or missing version rather than guessing", () => {
    expect(() => parsePublishAllowlist({ items: [] })).toThrow(PublishAllowlistError);
    expect(() => parsePublishAllowlist({ version: 2, items: [] })).toThrow(/version 2/);
  });

  it("fails on a duplicate (source, slug)", () => {
    expect(() =>
      allowlist([
        { source: "cv", slug: "academic" },
        { source: "cv", slug: "academic" },
      ]),
    ).toThrow(/more than once/);
  });

  it("rejects a satellite slug that is a path, and a hub slug that is not", () => {
    expect(() => allowlist([{ source: "cv", slug: "a/b" }])).toThrow(/not valid/);
    expect(() => allowlist([{ source: "hub", slug: "Not A Path" }])).toThrow(/not valid/);
  });
});

describe("effectiveVisibility — the one computation (D8 / SEAM-B2)", () => {
  const list = allowlist([{ source: "cv", slug: "academic" }]);

  it("is public only when BOTH the manifest requests it and the allowlist agrees", () => {
    expect(effectiveVisibility({ visibility: "public", slug: "academic" }, "cv", list)).toBe("public");
    expect(effectiveVisibility({ visibility: "public", slug: "anthropic-fellow" }, "cv", list)).toBe(
      "private",
    );
    expect(effectiveVisibility({ visibility: "private", slug: "academic" }, "cv", list)).toBe("private");
  });

  it("is private for a missing item or allowlist — never throws into a public default", () => {
    expect(effectiveVisibility(null, "cv", list)).toBe("private");
    expect(effectiveVisibility({ visibility: "public", slug: "x" }, "cv", undefined)).toBe("private");
  });

  it("agrees with isAllowlisted", () => {
    expect(isAllowlisted(list, "cv", "academic")).toBe(true);
    expect(isAllowlisted(list, "cv", "anthropic-fellow")).toBe(false);
  });
});

describe("findAllowlistConflicts (SEAM-B5 condition A)", () => {
  it("flags an allowlist entry that names a manifest-private item", () => {
    const sources = [
      {
        source: "cv",
        manifest: {
          items: [{ slug: "secret", visibility: "private" }],
        },
      },
    ];
    const list = allowlist([{ source: "cv", slug: "secret" }]);
    const problems = findAllowlistConflicts(sources, list);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/never[\s\S]*override/);
  });

  it("says nothing when the item is public", () => {
    const sources = [{ source: "cv", manifest: { items: [{ slug: "academic", visibility: "public" }] } }];
    expect(findAllowlistConflicts(sources, allowlist([{ source: "cv", slug: "academic" }]))).toEqual([]);
  });
});

describe("findStaleAllowlistEntries (SEAM-B5 condition B)", () => {
  const sources = [
    { source: "cv", manifest: { items: [{ slug: "academic", visibility: "public" }] } },
  ];

  it("flags a missing slug when the source IS present", () => {
    const list = allowlist([{ source: "cv", slug: "renamed-away" }]);
    expect(findStaleAllowlistEntries(sources, list).map((e) => `${e.source}/${e.slug}`)).toEqual([
      "cv/renamed-away",
    ]);
  });

  it("does NOT flag an entry whose whole source prefix is absent — that is ADR-0010's check", () => {
    // The cv-release fallback tree a pull-request build reads carries `cv` alone;
    // flagging kgis here would fail every PR for a missing prefix.
    const list = allowlist([
      { source: "cv", slug: "academic" },
      { source: "kgis", slug: "kgis-docs" },
    ]);
    expect(findStaleAllowlistEntries(sources, list)).toEqual([]);
  });

  it("never treats a hub entry as stale", () => {
    const list = allowlist([{ source: "hub", slug: "research/soa-agentic-se" }]);
    expect(findStaleAllowlistEntries(sources, list)).toEqual([]);
  });
});

describe("the committed allowlist", () => {
  it("parses, and publishes exactly the day-one public cv items", () => {
    const parsed = readPublishAllowlist();
    expect(parsed.entries.map((e) => `${e.source}/${e.slug}`)).toEqual(
      expect.arrayContaining([
        "cv/academic",
        "cv/research-professional",
        "cv/sde-long",
        "cv/cv-data",
        "kgis/kgis-docs",
      ]),
    );
    expect(parsed.keys.has("cv/anthropic-fellow")).toBe(false);
  });
});
