import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {
  BINARY_EXTENSIONS,
  checkSearchIndexScope,
  collectPrivateItems,
  findLeaks,
  findRedirectStubLeaks,
  listDerivedOutputs,
} from "./check-no-private-in-public.mjs";
import { generateRedirectStubs } from "./generate-redirect-stubs.mjs";

const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");
const MAP_PATH = path.resolve("redirects/github-pages.json");
const ITEMS = collectPrivateItems(FIXTURE_SOURCES);

const dirs: string[] = [];
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "derived-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function writePagefindFragment(dist: string, name: string, url: string, content = "text") {
  const dir = path.join(dist, "pagefind", "fragment");
  fs.mkdirSync(dir, { recursive: true });
  const raw = Buffer.from(`pagefind_dcd${JSON.stringify({ url, content })}`);
  fs.writeFileSync(path.join(dir, name), zlib.gzipSync(raw));
}

function writePagefindEntry(dist: string) {
  const dir = path.join(dist, "pagefind");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "pagefind-entry.json"), JSON.stringify({ version: "1.5.2" }));
}

describe("listDerivedOutputs names the derived outputs (SEAM-P6)", () => {
  it("finds the sitemap, rss, og-card and the Pagefind text files", () => {
    const dist = scratch();
    for (const rel of [
      "index.html",
      "sitemap-index.xml",
      "sitemap-0.xml",
      "rss.xml",
      "og-card.png",
      "og-card.svg",
      "pagefind/pagefind-entry.json",
      "pagefind/pagefind.js",
      "pagefind/fragment/en_x.pf_fragment",
    ]) {
      const file = path.join(dist, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "x");
    }
    const kinds = listDerivedOutputs(dist);
    const byKind = (kind: string) => kinds.filter((k) => k.kind === kind).map((k) => k.file);
    expect(byKind("sitemap").sort()).toEqual(["sitemap-0.xml", "sitemap-index.xml"]);
    expect(byKind("rss")).toEqual(["rss.xml"]);
    expect(byKind("og-card").sort()).toEqual(["og-card.png", "og-card.svg"]);
    expect(byKind("search-text")).toContain("pagefind/pagefind-entry.json");
    expect(byKind("search-text")).toContain("pagefind/pagefind.js");
    // The gzip fragment is intentionally NOT a text output.
    expect(byKind("search-text")).not.toContain("pagefind/fragment/en_x.pf_fragment");
  });
});

describe("checkSearchIndexScope: the index must be built from dist-public only (SEAM-P6)", () => {
  it("passes a public-rooted index whose URLs resolve in this output", () => {
    const dist = scratch();
    fs.writeFileSync(path.join(dist, "index.html"), "<h1>home</h1>");
    fs.mkdirSync(path.join(dist, "cv", "academic"), { recursive: true });
    fs.writeFileSync(path.join(dist, "cv", "academic", "index.html"), "<h1>cv</h1>");
    writePagefindEntry(dist);
    writePagefindFragment(dist, "en_a.pf_fragment", "/index.html");
    writePagefindFragment(dist, "en_b.pf_fragment", "/cv/academic/");
    expect(checkSearchIndexScope(dist)).toEqual([]);
  });

  it("rejects an index URL under the private gate base /p/", () => {
    const dist = scratch();
    writePagefindEntry(dist);
    writePagefindFragment(dist, "en_a.pf_fragment", "/p/cv/academic/");
    const problems = checkSearchIndexScope(dist);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/private gate base \/p\//);
  });

  it("rejects an off-origin index URL", () => {
    const dist = scratch();
    writePagefindEntry(dist);
    writePagefindFragment(dist, "en_a.pf_fragment", "https://evil.invalid/secret/");
    expect(checkSearchIndexScope(dist)[0]).toMatch(/off-origin/);
  });

  it("rejects an index URL that resolves to no file in this output", () => {
    const dist = scratch();
    fs.writeFileSync(path.join(dist, "index.html"), "<h1>home</h1>");
    writePagefindEntry(dist);
    writePagefindFragment(dist, "en_a.pf_fragment", "/gone/");
    expect(checkSearchIndexScope(dist)[0]).toMatch(/no file under dist-public/);
  });

  it("reports an entry file with no fragments as an incomplete index", () => {
    const dist = scratch();
    writePagefindEntry(dist);
    expect(checkSearchIndexScope(dist)[0]).toMatch(/no \.pf_fragment files/);
  });

  // Red Team Wave 5 B4: deleting the entry file used to turn the whole
  // structural guard into a no-op.
  it("FAILS when pagefind/ exists but the entry file is missing", () => {
    const dist = scratch();
    writePagefindFragment(dist, "en_a.pf_fragment", "/index.html");
    const problems = checkSearchIndexScope(dist);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/missing or unreadable/);
  });

  it("is not applicable (no problems) only when there is no pagefind/ directory", () => {
    const dist = scratch();
    expect(fs.existsSync(path.join(dist, "pagefind"))).toBe(false);
    expect(checkSearchIndexScope(dist)).toEqual([]);
  });
});

describe("findRedirectStubLeaks scans stubs for titles/summaries (SEAM-P6)", () => {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) as { from: string; to: string }[];

  it("accepts the ADR-0020 legacy path, which names the private slug", () => {
    const out = scratch();
    generateRedirectStubs({ map, outDir: out });
    // The fellowship path IS present in the artifact...
    const fellowship = ITEMS.find((i) => i.slug === "anthropic-fellow");
    expect(fellowship).toBeTruthy();
    expect(fs.readFileSync(path.join(out, "cv", "anthropic-fellow", "index.html"), "utf8")).toContain(
      "anthropic-fellow",
    );
    // ...but the guard flags only the item's title/summary, so it passes.
    expect(findRedirectStubLeaks(out, ITEMS)).toEqual([]);
  });

  it("flags a private title planted into a stub", () => {
    const out = scratch();
    generateRedirectStubs({ map, outDir: out });
    const stub = path.join(out, "cv", "index.html");
    const victim = ITEMS.find((i) => i.title)!;
    fs.appendFileSync(stub, `<p>${victim.title}</p>`);
    const leaks = findRedirectStubLeaks(out, ITEMS);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some((l) => l.kind.startsWith("title"))).toBe(true);
  });
});

describe("the Pagefind gzip payloads are contents-scanned (SEAM-P6, Red Team B1-B3)", () => {
  it("names the gzip fragment extensions as binary-on-disk", () => {
    expect([...BINARY_EXTENSIONS].sort()).toEqual([".pf_fragment", ".pf_index", ".pf_meta"]);
  });

  it("finds a private title decompressed from a .pf_fragment", () => {
    const dist = scratch();
    const victim = ITEMS.find((i) => i.title)!;
    writePagefindFragment(dist, "en_x.pf_fragment", "/x/", victim.title);
    const leaks = findLeaks(dist, ITEMS);
    expect(leaks.some((l) => l.kind === "title" && l.file.endsWith(".pf_fragment"))).toBe(true);
  });

  it("finds a private title decompressed from a .pf_meta and a .pf_index", () => {
    const dist = scratch();
    const victim = ITEMS.find((i) => i.title)!;
    for (const rel of ["pagefind/x.pf_meta", "pagefind/index/x.pf_index"]) {
      const file = path.join(dist, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, zlib.gzipSync(Buffer.from(`pagefind_dcd${victim.title}`)));
    }
    const files = findLeaks(dist, ITEMS)
      .filter((l) => l.kind === "title")
      .map((l) => l.file);
    expect(files).toContain("pagefind/x.pf_meta");
    expect(files).toContain("pagefind/index/x.pf_index");
  });

  it("falls back to PATH-only when a .pf_* file is not valid gzip", () => {
    const dist = scratch();
    const victim = ITEMS.find((i) => i.title)!;
    fs.mkdirSync(path.join(dist, "pagefind"), { recursive: true });
    fs.writeFileSync(path.join(dist, "pagefind", "broken.pf_meta"), Buffer.from(victim.title));
    expect(findLeaks(dist, ITEMS).filter((l) => l.where === "contents")).toEqual([]);
  });
});
