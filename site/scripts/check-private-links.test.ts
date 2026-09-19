import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyLink, findBadLinks, normalizeBase, pageUrlFor } from "./check-private-links.mjs";

// ===========================================================================
// F-1: the guard could not see an off-origin link
// ===========================================================================
// Its regex was /(?:href|src)="(\/[^"]*)"/g -- it matched ONLY links beginning
// with "/". The Skeptic Verifier tested three shapes against a real private
// build of 5 pages, one at a time:
//
//   <img src="//evil.invalid/y.png">    -> RED   (starts with "/", caught)
//   <a href="https://evil.invalid/x">   -> GREEN (INVISIBLE)
//   <a href="../../elsewhere/">         -> GREEN (INVISIBLE)
//
// The guard's own error text says "a link outside /p/ reaches the PUBLIC origin
// and 404s for a signed-in member". An absolute off-origin URL is the STRONGEST
// form of that and it passed. It matters now because the private pages are
// authored in another repository and the satellite stream spent this same wave
// removing an off-origin font <link> from exactly these pages.
//
// THE CONSTRAINT THAT SHAPES THE FIX. A relative link is NOT automatically bad:
// the staged payload pages under _payload/** are satellite bytes served
// verbatim, and they legitimately carry href="assets/style.css". Banning
// relative links would fail the real build on a correct page -- and a guard that
// cries wolf on a correct build is switched off within a week. So a relative
// link is RESOLVED against the page that carries it, and judged on where it
// lands.

const SCRIPT = path.resolve("scripts/check-private-links.mjs");
const BASE = "/p/";

function tree(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "private-links-"));
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return root;
}

function run(dist: string) {
  return spawnSync(process.execPath, [SCRIPT, "--dist", dist, "--base", BASE], {
    encoding: "utf8",
  });
}

// ---------------------------------------------------------------------------
// The classifier, shape by shape
// ---------------------------------------------------------------------------
describe("classifyLink judges a link by where it RESOLVES, not by its first character", () => {
  const home = pageUrlFor("index.html", BASE); // /p/index.html
  const deep = pageUrlFor("phd/phd-milestones/milestones/index.html", BASE);

  it("accepts a root-absolute link under the base (the shape it always caught)", () => {
    expect(classifyLink("/p/phd/phd-milestones/milestones/", home, BASE)).toMatchObject({
      kind: "ok",
      path: "/p/phd/phd-milestones/milestones/",
    });
  });

  it("still catches ISSUE #27: a root-absolute link that is missing the base", () => {
    // The guard's original subject. It must not be lost while widening coverage.
    expect(classifyLink("/phd/phd-milestones/milestones/", home, BASE).kind).toBe("outside-base");
  });

  // -- F-1 SHAPE 2 --------------------------------------------------------
  it("catches an absolute off-origin https link, which used to pass GREEN", () => {
    const verdict = classifyLink("https://evil.invalid/x", home, BASE);
    expect(verdict.kind).toBe("off-origin");
    expect(verdict.why).toContain("evil.invalid");
  });

  it("catches http and protocol-relative off-origin links too", () => {
    expect(classifyLink("http://evil.invalid/x", home, BASE).kind).toBe("off-origin");
    // This one the old regex DID catch, because it starts with "/". It must stay
    // caught, and now it is reported as what it actually is.
    expect(classifyLink("//evil.invalid/y.png", home, BASE).kind).toBe("off-origin");
  });

  it("catches an off-origin font or stylesheet link — the regression the satellite just removed", () => {
    expect(classifyLink("https://fonts.googleapis.com/css2?family=Spectral", deep, BASE).kind).toBe(
      "off-origin",
    );
  });

  // -- F-1 SHAPE 3 --------------------------------------------------------
  it("catches a relative link that ESCAPES the base, which used to pass GREEN", () => {
    const verdict = classifyLink("../../elsewhere/", home, BASE);
    expect(verdict.kind).toBe("outside-base");
    expect(verdict.why).toContain("/elsewhere/");
  });

  it("catches a relative escape from a deep page as well", () => {
    // ../../../../ from /p/phd/phd-milestones/milestones/ climbs out of /p/.
    expect(classifyLink("../../../../elsewhere/", deep, BASE).kind).toBe("outside-base");
  });

  // -- the shape that must NOT become a false positive ---------------------
  it("ACCEPTS the satellite's own relative sibling link", () => {
    // _payload/** pages are satellite bytes staged verbatim and they carry
    // href="assets/style.css". This resolving correctly is what makes the fix
    // safe to land on the real build.
    const payload = pageUrlFor("_payload/phd-milestones/site/index.html", BASE);
    expect(classifyLink("assets/style.css", payload, BASE)).toMatchObject({
      kind: "ok",
      path: "/p/_payload/phd-milestones/site/assets/style.css",
    });
  });

  it("ignores links that fetch nothing from another origin", () => {
    expect(classifyLink("#main", home, BASE).kind).toBe("inert");
    expect(classifyLink("mailto:someone@example.edu", home, BASE).kind).toBe("inert");
    expect(classifyLink("data:image/svg+xml,<svg/>", home, BASE).kind).toBe("inert");
    expect(classifyLink("", home, BASE).kind).toBe("inert");
  });

  it("normalises the base the same way however it is spelled", () => {
    expect(normalizeBase("/p")).toBe("/p/");
    expect(normalizeBase("/p/")).toBe("/p/");
    expect(normalizeBase("")).toBe("/p/");
  });
});

// ---------------------------------------------------------------------------
// Against a tree, through the real script
// ---------------------------------------------------------------------------
describe("the script fails the build on each new shape", () => {
  let dist: string;
  afterEach(() => {
    if (dist) fs.rmSync(dist, { recursive: true, force: true });
  });

  it("passes a clean private output, including a relative payload link", () => {
    dist = tree({
      "index.html": '<a href="/p/phd/x/y/">Item</a>',
      "phd/x/y/index.html": '<a href="/p/">Back</a><img src="/p/_payload/s/site/pic.png">',
      "_payload/s/site/index.html": '<link href="assets/style.css"><a href="./other.html">Other</a>',
      "_payload/s/site/other.html": "<p>other</p>",
      "_payload/s/site/assets/style.css": "body{}",
      "_payload/s/site/pic.png": "not-really-a-png",
    });
    const result = run(dist);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS");
  });

  it("FAILS on an absolute off-origin link (F-1 shape 2)", () => {
    dist = tree({ "index.html": '<a href="https://evil.invalid/x">x</a>' });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("evil.invalid");
    expect(result.stderr).toContain("another origin");
  });

  it("FAILS on a relative link that escapes the base (F-1 shape 3)", () => {
    dist = tree({ "index.html": '<a href="../../elsewhere/">x</a>' });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("outside /p/");
  });

  it("still FAILS on issue #27's unprefixed root-absolute link", () => {
    dist = tree({ "index.html": '<a href="/phd/x/y/">x</a>' });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("#27");
  });

  it("still FAILS on a based link that points at nothing", () => {
    dist = tree({ "index.html": '<a href="/p/phd/x/y/">x</a>' });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("points at nothing");
  });

  it("FAILS on a relative link that stays inside the base but resolves to nothing", () => {
    dist = tree({ "_payload/s/site/index.html": '<link href="assets/missing.css">' });
    const result = run(dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("points at nothing");
  });

  it("exits 2 when there is no private build to inspect", () => {
    dist = tree({ "keep.txt": "no html here" });
    const result = run(path.join(dist, "absent"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no private build");
  });
});

describe("findBadLinks names the file, the link and the reason", () => {
  let dist: string;
  beforeEach(() => {
    dist = tree({
      "index.html": '<a href="https://evil.invalid/x">x</a><a href="/p/">ok</a>',
    });
  });
  afterEach(() => fs.rmSync(dist, { recursive: true, force: true }));

  it("reports only the bad one", () => {
    const bad = findBadLinks(dist, BASE);
    expect(bad).toHaveLength(1);
    expect(bad[0].link).toBe("https://evil.invalid/x");
    expect(bad[0].kind).toBe("off-origin");
    expect(path.basename(bad[0].file)).toBe("index.html");
  });
});
