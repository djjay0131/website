import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  canonicalTarget,
  escapeHtml,
  generateRedirectStubs,
  isHtmlNavigable,
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

  // Red Team Wave 5 B5 / Skeptic Wave 5 G1: `..` made `path.join` escape outDir.
  it("refuses `..`, `.`, empty segments and backslashes (fail closed)", () => {
    expect(() => stubRelativePath("/website/../pwned.html")).toThrow(/forbidden path segment/);
    expect(() => stubRelativePath("/website/../dist-public/index.html")).toThrow(
      /forbidden path segment/,
    );
    expect(() => stubRelativePath("/website/cv/../../../tmp/escaped.html")).toThrow(
      /forbidden path segment/,
    );
    expect(() => stubRelativePath("/website/cv/./x.html")).toThrow(/forbidden path segment/);
    expect(() => stubRelativePath("/website/cv//x")).toThrow(/forbidden path segment/);
    expect(() => stubRelativePath("/website/cv\\..\\x")).toThrow(/backslash/);
  });
});

describe("generateRedirectStubs fails closed on traversal (Red Team Wave 5 B5)", () => {
  it("writes nothing outside outDir for the exact hostile entry", () => {
    const root = scratch();
    const outDir = path.join(root, "dist-redirects");
    const outside = path.join(root, "pwned.html");
    expect(() =>
      generateRedirectStubs({
        map: [
          { from: "/website/", to: "/" },
          { from: "/website/../pwned.html", to: "/attacker" },
        ],
        outDir,
      }),
    ).toThrow(/forbidden path segment/);
    expect(fs.existsSync(outside)).toBe(false);
    // Every path is validated before the artifact directory is touched, so the
    // valid entry above did not leave a partial artifact behind either.
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it("cannot overwrite the deploy artifact via `from: /website/../dist-public/index.html`", () => {
    const root = scratch();
    const distPublic = path.join(root, "dist-public");
    fs.mkdirSync(distPublic, { recursive: true });
    const index = path.join(distPublic, "index.html");
    fs.writeFileSync(index, "the real site");
    expect(() =>
      generateRedirectStubs({
        map: [{ from: "/website/../dist-public/index.html", to: "/attacker" }],
        outDir: path.join(root, "dist-redirects"),
      }),
    ).toThrow(/forbidden path segment/);
    expect(fs.readFileSync(index, "utf8")).toBe("the real site");
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

// Skeptic Wave 5 G0: this escaping was correct but had NO committed test, so a
// one-line regression was invisible. These tests fail if `escapeHtml` is removed.
describe("escapeHtml and the `to` scheme are pinned against injection (Skeptic G0)", () => {
  it("escapes <script>, double/single quotes and ampersands", () => {
    expect(escapeHtml(`<script>alert("x")&'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;",
    );
  });

  it("a markup-bearing `to` cannot break out of the refresh attribute", () => {
    const stub = renderStub({ to: '/"><script>alert(1)</script>' });
    expect(stub).not.toContain("<script>alert(1)</script>");
    expect(stub).toContain("&quot;&gt;&lt;script&gt;");
    // The only url= value is the canonical target, never a raw attribute break.
    expect(stub).toContain("url=https://jason.cusati.us/");
  });

  it("a `javascript:` `to` is prefixed with the canonical origin, not executable", () => {
    const stub = renderStub({ to: "javascript:alert(1)" });
    expect(stub).toContain("url=https://jason.cusati.us/javascript:alert(1)");
    expect(stub).not.toContain("url=javascript:alert(1)");
    expect(stub).not.toContain('href="javascript:alert(1)"');
  });
});

describe("the 404 page", () => {
  const notFound = render404();

  it("forwards only a /website/** legacy path to its canonical equivalent", () => {
    expect(notFound).toContain('var legacy = "/website"');
    expect(notFound).toContain("window.location.replace(origin + target + window.location.search");
  });

  it("does not redirect a canonical path to itself (no loop on Firebase)", () => {
    // The generic fallback only runs when the path has the legacy prefix.
    expect(notFound).toMatch(
      /if \(target === null && \(p === legacy \|\| p\.indexOf\(legacy \+ "\/"\) === 0\)\)/,
    );
  });

  it("lists file-shaped entries and escapes every injected value (Dissenter D2)", () => {
    const page = render404([{ from: '/website/x"><script>alert(1)</script>', to: "/y" }]);
    expect(page).toContain("\\u003cscript\\u003e");
    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).not.toContain('"/website/x"');
  });
});

describe("generateRedirectStubs writes the stubs-only artifact", () => {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) as { from: string; to: string }[];

  it("writes a per-path stub for HTML-navigable entries and 404.html for the rest", () => {
    const out = scratch();
    const publicDir = path.join(scratch(), "dist-public");
    fs.mkdirSync(publicDir);
    const result = generateRedirectStubs({ map, outDir: out, publicDir });

    expect(result.count).toBe(map.length);
    const rels = map.map((e) => stubRelativePath(e.from));
    const expected = rels.filter((rel) => isHtmlNavigable(rel));
    expect(expected.length).toBeGreaterThan(0);
    for (const rel of expected) expect(fs.existsSync(path.join(out, rel))).toBe(true);
    // File-shaped entries get NO per-path HTML stub (Pages MIME; Dissenter D2).
    const fileRels = rels.filter((rel) => !isHtmlNavigable(rel));
    expect(fileRels.length).toBeGreaterThan(0);
    for (const rel of fileRels) expect(fs.existsSync(path.join(out, rel))).toBe(false);
    expect(fs.existsSync(path.join(out, "404.html"))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, "404.html"))).toBe(true);
    const notFound = fs.readFileSync(path.join(out, "404.html"), "utf8");
    const fileEntries = map.filter((e) => !isHtmlNavigable(stubRelativePath(e.from)));
    for (const entry of fileEntries) expect(notFound).toContain(entry.to);
  });

  it("a `.pdf` entry produces no per-path stub and is listed in the 404 mapping", () => {
    const out = scratch();
    generateRedirectStubs({
      map: [
        { from: "/website/", to: "/" },
        { from: "/website/pdfs/academic.pdf", to: "/pdfs/academic.pdf" },
      ],
      outDir: out,
    });
    expect(fs.existsSync(path.join(out, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(out, "pdfs", "academic.pdf"))).toBe(false);
    const notFound = fs.readFileSync(path.join(out, "404.html"), "utf8");
    expect(notFound).toContain("/website/pdfs/academic.pdf");
    expect(notFound).toContain("/pdfs/academic.pdf");
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
