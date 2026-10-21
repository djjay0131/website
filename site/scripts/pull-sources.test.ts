import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PulledSourceError,
  buildManifest,
  fingerprintFor,
  pullSource,
  readConfig,
  stageCheckout,
  stageIntoDest,
  validateConfig,
} from "./pull-sources.mjs";

const temporary: string[] = [];

function tempDir(prefix = "pulled-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function config(overrides = {}) {
  return validateConfig({
    version: 1,
    sources: [
      {
        source: "pulled-example",
        repo: "example/pulled-example",
        ref: "main",
        basePath: "docs",
        stageDir: "site",
        repositoryNote: "Source of truth: the public repository. Edits appear within the hour.",
        pages: [
          {
            slug: "erupt-proposal",
            title: "Example proposal",
            path: "index.html",
            summary: "A pulled page.",
            order: 0,
          },
        ],
        ...overrides,
      },
    ],
  }).sources[0];
}

function checkout(files: Record<string, string> = { "docs/index.html": "<h1>Example</h1>" }) {
  const dir = tempDir("checkout-");
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  return dir;
}

function revision(sha = "a".repeat(40), published = "2026-10-20T20:24:44-04:00") {
  return { sha, published };
}

describe("pulled-source config", () => {
  it("accepts the committed config and forces private project items", () => {
    const parsed = readConfig(path.resolve("pulled-sources.json"));
    const ebay = parsed.sources.find((source) => source.source === "ebay-erupt");
    expect(ebay?.repo).toBe("chbrown13/ebay_erupt_2027");
    expect(ebay?.pages[0].slug).toBe("erupt-proposal");
    const manifest = buildManifest(ebay!, "2026-10-20T20:24:44-04:00");
    expect(manifest.items[0]).toMatchObject({
      section: "projects",
      format: "html",
      visibility: "private",
      path: "site/index.html",
      date: "2026-10-20",
    });
  });

  it("rejects path traversal, duplicate slugs, invalid refs and non-project sections", () => {
    expect(() => config({ basePath: "../outside" })).toThrow(PulledSourceError);
    expect(() => config({ ref: "refs/heads/main" })).toThrow(PulledSourceError);
    expect(() => config({ section: "cv" })).toThrow(PulledSourceError);
    expect(() =>
      config({ pages: [
        { slug: "same", title: "One", path: "index.html" },
        { slug: "same", title: "Two", path: "other.html" },
      ] }),
    ).toThrow(PulledSourceError);
    expect(() =>
      config({ pages: [{ slug: "erupt-proposal", title: "One", path: "../index.html" }] }),
    ).toThrow(PulledSourceError);
  });

  it("fingerprints source, repository, branch and commit", () => {
    const parsed = validateConfig({
      version: 1,
      sources: [config(), config({ source: "second-example", repo: "example/second" })],
    });
    const calls: string[] = [];
    const first = fingerprintFor(parsed, {
      lsRemote: (source) => {
        calls.push(`${source.source}@${source.ref}`);
        return source.source === "pulled-example" ? "1".repeat(40) : "2".repeat(40);
      },
    });
    const again = fingerprintFor(parsed, {
      lsRemote: () => "1".repeat(40),
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(again).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(again);
    expect(calls).toEqual(["pulled-example@main", "second-example@main"]);
  });
});

describe("pulled-source staging", () => {
  it("stages only the configured Pages tree and writes a private manifest", () => {
    const source = config();
    const root = tempDir();
    const repo = checkout({
      "docs/index.html": "<h1>Example</h1>",
      "docs/figure.png": "png",
      "docs/proposal.pdf": "pdf",
      "secret/private.txt": "must not be copied",
    });
    const work = path.join(root, "work");
    stageCheckout(source, repo, work, { revision: revision() });
    const dest = path.join(root, "sources");
    const result = stageIntoDest(source, work, dest);

    expect(result.manifest.published).toBe("2026-10-20T20:24:44-04:00");
    expect(result.manifest.items[0]).toMatchObject({
      slug: "erupt-proposal",
      title: "Example proposal",
      visibility: "private",
      path: "site/index.html",
    });
    expect(fs.existsSync(path.join(dest, "pulled-example", "site", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "pulled-example", "site", "figure.png"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "pulled-example", "site", "proposal.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "pulled-example", "secret"))).toBe(false);
  });

  it("refuses symlinks and missing page paths", () => {
    const source = config();
    const root = tempDir();
    const repo = checkout();
    fs.symlinkSync("/etc/passwd", path.join(repo, "docs", "leak"));
    expect(() => stageCheckout(source, repo, path.join(root, "work"), { revision: revision() })).toThrow(
      /refusing symlink/,
    );

    const missing = checkout({ "docs/other.html": "x" });
    expect(() =>
      stageCheckout(source, missing, path.join(root, "work2"), { revision: revision() }),
    ).toThrow(/does not contain/);
  });

  it("keeps the last good copy when a fetch fails", () => {
    const source = config();
    const root = tempDir();
    const repo = checkout();
    const workRoot = path.join(root, "cache");
    const work = path.join(workRoot, source.source);
    const dest = path.join(root, "sources");
    stageCheckout(source, repo, work, { revision: revision() });
    stageIntoDest(source, work, dest);

    const result = pullSource(source, {
      workRoot,
      destRoot: dest,
      allowStale: true,
      clone: () => {
        throw new Error("network down");
      },
    });
    expect(result.stale).toBe(true);
    expect(fs.existsSync(path.join(dest, "pulled-example", "manifest.json"))).toBe(true);
  });

  it("fails a fetch with no last good copy", () => {
    const source = config();
    const root = tempDir();
    expect(() =>
      pullSource(source, {
        workRoot: path.join(root, "cache"),
        destRoot: path.join(root, "sources"),
        allowStale: true,
        clone: () => {
          throw new Error("network down");
        },
      }),
    ).toThrow(/network down/);
  });

  it("replaces the previous work tree only after a complete copy", () => {
    const source = config();
    const root = tempDir();
    const work = path.join(root, "work");
    const good = checkout();
    stageCheckout(source, good, work, { revision: revision("1".repeat(40), "2026-10-20T00:00:00Z") });

    const bad = checkout({ "docs/other.html": "x" });
    expect(() =>
      stageCheckout(source, bad, work, { revision: revision("2".repeat(40), "2026-10-21T00:00:00Z") }),
    ).toThrow(/does not contain/);
    expect(JSON.parse(fs.readFileSync(path.join(work, "meta.json"), "utf8")).sha).toBe("1".repeat(40));
  });
});
