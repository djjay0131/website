import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ===========================================================================
// THE STRUCTURAL GUARANTEE (Phase 3 contract, open question (a))
// ===========================================================================
// "Where should the private build's navigation live so that no fragment of it
// can reach the public build by accident? Recommend a structural guarantee, not
// a convention."
//
// The answer is that the two builds use DIFFERENT srcDirs. Astro routes exactly
// one directory -- <srcDir>/pages -- so the public build (srcDir ./src) is never
// even shown src-private/pages/**, and cannot emit a private route however badly
// someone edits a page. This file pins the two halves of that:
//
//   1. the arrangement itself still exists (a private pages tree outside src/);
//   2. the import direction is one-way -- nothing the PUBLIC build compiles
//      imports anything private. Without this, a public page could `import
//      { routeFor } from "../lib/private-content.mjs"` and pull private titles
//      into dist-public through a module graph rather than through the router.
//
// If someone deletes this test to make a change pass, that is the signal.

const SRC = path.resolve("src");
const SRC_PRIVATE = path.resolve("src-private");

/** Every source file the PUBLIC build could compile. */
function publicSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // src/content/sources is synced payload, not source code.
        if (full === path.join(SRC, "content", "sources")) continue;
        walk(full);
      } else if (/\.(astro|ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(SRC);
  return out;
}

describe("the private build's routes live outside the public build's srcDir", () => {
  it("has a private pages tree, and it is NOT under src/", () => {
    expect(fs.existsSync(path.join(SRC_PRIVATE, "pages")), "src-private/pages must exist").toBe(true);
    expect(fs.existsSync(path.join(SRC, "pages"))).toBe(true);
    expect(SRC_PRIVATE.startsWith(SRC + path.sep)).toBe(false);
  });

  it("keeps EVERY private module under src-private/, not just the routes", () => {
    // private-content.mjs decides what a private item's URL is and which of its
    // bytes travel. It began life under src/lib/, which is inside the PUBLIC
    // build's srcDir -- harmless in itself, but it made "all private code lives
    // outside the public source root" untrue, and that sentence is the whole
    // argument. It lives under src-private/lib/ now.
    expect(fs.existsSync(path.join(SRC_PRIVATE, "lib", "private-content.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(SRC, "lib", "private-content.mjs"))).toBe(false);
  });

  it("the public pages tree contains no private route", () => {
    const publicPages = publicSourceFiles().filter((f) => f.startsWith(path.join(SRC, "pages")));
    for (const file of publicPages) {
      expect(file).not.toMatch(/src-private/);
    }
    // /signin/ is the one public page this phase adds, and it is public on purpose.
    expect(fs.existsSync(path.join(SRC, "pages", "signin", "index.astro"))).toBe(true);
  });

  it("astro.config.mjs selects the srcDir from the output, so the trees cannot mix", () => {
    const config = fs.readFileSync(path.resolve("astro.config.mjs"), "utf8");
    expect(config).toMatch(/srcDir:\s*isPrivate\s*\?\s*'\.\/src-private'\s*:\s*'\.\/src'/);
  });
});

describe("nothing the public build compiles imports anything private", () => {
  const offenders: { file: string; line: string }[] = [];

  for (const file of publicSourceFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      if (!/\b(import|require)\b/.test(line)) continue;
      if (/src-private|private-content|private-build|PrivateBase/.test(line)) {
        offenders.push({ file: path.relative(process.cwd(), file), line: line.trim() });
      }
    }
  }

  it("no file under src/ imports src-private/, private-content or the private build", () => {
    expect(
      offenders,
      `these PUBLIC-build files import something private:\n${offenders
        .map((o) => `  ${o.file}: ${o.line}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("the sign-in page in particular names nothing private", () => {
    // It is a PUBLIC page and must reveal nothing about what is behind it: no
    // titles, no slugs, no counts (contract D6).
    const signin = fs.readFileSync(path.join(SRC, "pages", "signin", "index.astro"), "utf8");
    expect(signin).not.toMatch(/getCollection/);
    expect(signin).not.toMatch(/src-private/);
    expect(signin).not.toMatch(/private-content/);
  });
});

// ===========================================================================
// THE SHARED CHROME (Wave 0c; spec §7; ADR-0015 decision 5)
// ===========================================================================
// The band and footer are extracted into src/components/ so BOTH layouts share
// them while keeping their navigations separate. This block is an EXTENSION of
// the structural guarantee above, not a weakening of it: the shared components
// live inside the public srcDir (so the private build may import them), they
// import nothing private, and they carry no navigation of their own -- every
// link arrives as a prop, which is the property that keeps the public nav from
// riding into the private build through the shared chrome.
describe("the shared band and footer are safe for both builds", () => {
  it("ships SiteBand, SiteFooter and the icon set under src/components/", () => {
    for (const name of ["SiteBand.astro", "SiteFooter.astro", "SiteIcon.astro"]) {
      expect(fs.existsSync(path.join(SRC, "components", name)), `src/components/${name}`).toBe(true);
    }
  });

  it("both layouts import the same shared components", () => {
    const base = fs.readFileSync(path.join(SRC, "layouts", "Base.astro"), "utf8");
    const priv = fs.readFileSync(path.join(SRC_PRIVATE, "layouts", "PrivateBase.astro"), "utf8");
    for (const [label, text] of [
      ["Base.astro", base],
      ["PrivateBase.astro", priv],
    ] as const) {
      expect(text, `${label} imports SiteBand`).toMatch(/components\/SiteBand\.astro/);
      expect(text, `${label} imports SiteFooter`).toMatch(/components\/SiteFooter\.astro/);
    }
    // The private -> public arrow is the ONLY direction: PrivateBase reaches
    // into src/components/, and no file under src/ imports src-private/ (the
    // block above still proves the reverse is absent).
    expect(priv).toMatch(/\.\.\/\.\.\/src\/components\/SiteBand\.astro/);
    expect(priv).toMatch(/\.\.\/\.\.\/src\/components\/SiteFooter\.astro/);
  });

  it("the shared components import nothing private and carry no navigation", () => {
    for (const name of ["SiteBand", "SiteFooter", "SiteIcon"]) {
      const text = fs.readFileSync(path.join(SRC, "components", `${name}.astro`), "utf8");
      // Judge IMPORT lines, not prose: a comment may legitimately explain that
      // the private build imports this shared component.
      for (const line of text.split("\n")) {
        if (!/\b(import|require)\b/.test(line)) continue;
        expect(line, `${name} imports something private: ${line.trim()}`).not.toMatch(
          /src-private|private-content|PrivateBase|private-build/,
        );
      }
      // Navigation arrives as a prop; a component that read the collection or
      // hard-coded a route would be navigation of its own.
      expect(text, `${name} reads no collection`).not.toMatch(/getCollection/);
      expect(text, `${name} hard-codes no root-absolute link`).not.toMatch(/href="\//);
    }
  });
});

// ===========================================================================
// THE HOSTING REWRITES FOR SHARING (SEAM-S4; contract site-wave-3 requirement 1)
// ===========================================================================
// /share/** carries owner-only POST/GET/DELETE and /s/** the public share view.
// Both are Firebase Hosting prefix rewrites to the gate. The existing four
// rewrites must survive byte-identical in effect, and trailingSlash stays true.
describe("firebase.json routes sharing to the gate without disturbing the rest", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve("..", "firebase.json"), "utf8"));
  const rewrites = config.hosting.rewrites as { source: string; run?: { serviceId: string; region: string } }[];
  const bySource = new Map(rewrites.map((r) => [r.source, r]));

  it("adds /share/** and /s/** as us-east1 hub-gate prefix rewrites", () => {
    for (const source of ["/share/**", "/s/**"]) {
      expect(bySource.get(source), `${source} rewrite`).toEqual({
        source,
        run: { serviceId: "hub-gate", region: "us-east1" },
      });
    }
  });

  it("keeps the existing four gate rewrites in order, with the sharing routes appended", () => {
    // The contract Exit names all three sharing rewrites: the exact `/share`
    // for POST/GET, `/share/**` for DELETE by token, and `/s/**` for the
    // signed-out view. The four pre-existing gate rewrites are unchanged.
    expect(rewrites.map((r) => r.source)).toEqual([
      "/p/**",
      "/session",
      "/session/end",
      "/client-events",
      "/share",
      "/share/**",
      "/s/**",
    ]);
  });

  it("still publishes dist-public with trailing slashes", () => {
    expect(config.hosting.public).toBe("site/dist-public");
    expect(config.hosting.trailingSlash).toBe(true);
  });
});
