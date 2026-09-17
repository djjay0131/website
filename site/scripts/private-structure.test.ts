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
