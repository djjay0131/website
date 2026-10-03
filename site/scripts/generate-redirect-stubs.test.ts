import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  canonicalTarget,
  generateRedirectStubs,
  normalizeMap,
  render404,
  renderStub,
  stubRelativePath,
} from "./generate-redirect-stubs.mjs";
import { findRedirectStubLeaks, collectPrivateItems } from "./check-no-private-in-public.mjs";

const MAP_PATH = path.resolve("redirects/github-pages.json");
const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

const dirs: string[] = [];
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redirect-stubs-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("canonicalTarget", () => {
  it("forwards to the canonical origin, not the retired Pages host", () => {
    expect(canonicalTarget("/")).toBe("https://jason.cusati.us/");
    expect(canonicalTarget("/cv/academic/")).toBe("https://jason.cusati.us/cv/academic/");
    expect(canonicalTarget("pdfs/academic.pdf")).toBe("https://jason.cusati.us/pdfs/academic.pdf");
  });
});

describe("stubRelativePath maps a /website/<path> URL into the Pages artifact", () => {
  it("uses index.html for directory routes and the exact name for files", () => {
    expect(stubRelativePath("/website/")).toBe("index.html");
    expect(stubRelativePath("/website/cv/")).toBe("cv/index.html");
    expect(stubRelativePath("/website/research/soa-agentic-se/")).toBe(
      "research/soa-agentic-se/index.html",
    );
    expect(stubRelativePath("/website/build-info.json")).toBe("build-info.json");
    expect(stubRelativePath("/website/pdfs/academic.pdf")).toBe("pdfs/academic.pdf");
  });

  it("refuses an entry that is not under the retired base, rather than writing it wrong", () => {
    expect(() => stubRelativePath("/elsewhere/")).toThrow(/not under the retired Pages base/);
  });
});

describe("the stub carries only the target path", () => {
  const stub = renderStub({ from: "/website/cv/academic/", to: "/cv/academic/" });

  it("is an HTML meta-refresh AND canonical link to the canonical target", () => {
    expect(stub).toContain('http-equiv="refresh"');
    expect(stub).toContain('url=https://jason.cusati.us/cv/academic/');
    expect(stub).toContain('<link rel="canonical" href="https://jason.cusati.us/cv/academic/">');
    expect(stub).toContain('<meta name="robots" content="noindex">');
  });

  it("links the target as text, never a human title", () => {
    expect(stub).toContain("This page has moved to");
    expect(stub).toContain('<a href="https://jason.cusati.us/cv/academic/">');
    expect(stub).not.toContain("<h1>");
  });
});

describe("the 404 page", () => {
  const notFound = render404();

  it("forwards only a /website/** legacy path to its canonical equivalent", () => {
    expect(notFound).toContain('var legacy = "/website"');
    expect(notFound).toContain('window.location.replace("https://jason.cusati.us" + rest');
  });

  it("does not redirect a canonical path to itself (no loop on Firebase)", () => {
    // The redirect only runs when the path has the legacy prefix.
    expect(notFound).toMatch(/if \(p === legacy \|\| p\.indexOf\(legacy \+ "\/"\) === 0\)/);
  });
});

describe("generateRedirectStubs writes the stubs-only artifact", () => {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) as { from: string; to: string }[];

  it("writes one stub per map entry plus 404.html, and mirrors 404.html into dist-public", () => {
    const out = scratch();
    const publicDir = path.join(scratch(), "dist-public");
    fs.mkdirSync(publicDir);
    const result = generateRedirectStubs({ map, outDir: out, publicDir });

    expect(result.count).toBe(map.length);
    const expected = map.map((e) => stubRelativePath(e.from));
    expect(new Set(expected).size).toBe(map.length); // every entry has a distinct stub
    for (const rel of expected) expect(fs.existsSync(path.join(out, rel))).toBe(true);
    expect(fs.existsSync(path.join(out, "404.html"))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, "404.html"))).toBe(true);
  });

  it("clears a stale artifact before writing, so a removed route leaves no stub", () => {
    const out = scratch();
    fs.mkdirSync(path.join(out, "stale"), { recursive: true });
    fs.writeFileSync(path.join(out, "stale", "index.html"), "stale");
    generateRedirectStubs({ map: [{ from: "/website/", to: "/" }], outDir: out });
    expect(fs.existsSync(path.join(out, "stale"))).toBe(false);
    expect(fs.existsSync(path.join(out, "index.html"))).toBe(true);
  });

  it("rejects a malformed map rather than writing a partial artifact", () => {
    expect(() => normalizeMap([{ from: "/website/" }])).toThrow(/must have string "from" and "to"/);
  });

  // THE CONTRACT'S "NO PRIVATE TITLE/SUMMARY IN A STUB" (SEAM-P5, SEAM-P6).
  it("never writes a private title or summary, though it repeats the legacy path", () => {
    const out = scratch();
    generateRedirectStubs({ map, outDir: out });
    const items = collectPrivateItems(FIXTURE_SOURCES);
    expect(findRedirectStubLeaks(out, items)).toEqual([]);
    // The private fellowship PATH is present, as ADR-0020 requires: the map
    // already names it, and the stub must forward it.
    const fellowship = items.find((i) => i.slug === "anthropic-fellow");
    expect(fellowship).toBeTruthy();
  });
});
