import { describe, it, expect } from "vitest";
import { evaluateAllowlist, readRawSources } from "./check-publish-allowlist.mjs";
import { ALLOWLIST_VERSION, parsePublishAllowlist, readPublishAllowlist } from "../src/lib/hub-content.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const allowlist = (items: { source: string; slug: string }[]) =>
  parsePublishAllowlist({ version: ALLOWLIST_VERSION, items });

describe("evaluateAllowlist", () => {
  const sources = [
    { source: "cv", manifest: { items: [{ slug: "academic", visibility: "public" }] } },
  ];

  it("passes when every entry resolves", () => {
    const result = evaluateAllowlist(sources, allowlist([{ source: "cv", slug: "academic" }]), {
      mode: "pr",
    });
    expect(result.fails).toBe(false);
  });

  it("always fails a conflict, in either mode", () => {
    const conflicting = [
      { source: "cv", manifest: { items: [{ slug: "secret", visibility: "private" }] } },
    ];
    const list = allowlist([{ source: "cv", slug: "secret" }]);
    expect(evaluateAllowlist(conflicting, list, { mode: "pr" }).fails).toBe(true);
    expect(evaluateAllowlist(conflicting, list, { mode: "deploy" }).fails).toBe(true);
  });

  it("fails a stale entry on a PR but only warns on deploy", () => {
    const list = allowlist([{ source: "cv", slug: "academic" }, { source: "cv", slug: "gone" }]);
    const pr = evaluateAllowlist(sources, list, { mode: "pr" });
    expect(pr.stale).toHaveLength(1);
    expect(pr.fails).toBe(true);
    const deploy = evaluateAllowlist(sources, list, { mode: "deploy" });
    expect(deploy.stale).toHaveLength(1);
    expect(deploy.fails).toBe(false);
  });
});

describe("readRawSources", () => {
  it("reads manifests without the expected-source enforcement", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-"));
    try {
      fs.mkdirSync(path.join(root, "cv"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "cv", "manifest.json"),
        JSON.stringify({ source: "cv", published: "2026-09-16T00:00:00Z", items: [] }),
      );
      const sources = readRawSources(root);
      expect(sources.map((s) => s.source)).toEqual(["cv"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the committed allowlist is internally valid", () => {
  it("parses and has no duplicate entries", () => {
    const parsed = readPublishAllowlist();
    expect(parsed.entries.length).toBe(new Set(parsed.keys).size);
  });
});
