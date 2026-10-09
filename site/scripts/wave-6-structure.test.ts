import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { routesFromPagesDir } from "./route-inventory.mjs";
import { findAnnotationLeaks } from "./check-no-private-in-public.mjs";

// ===========================================================================
// WAVE 6 / WAVE 7 STRUCTURAL GUARANTEE
// ===========================================================================
// Wave 6 built the capture island and the My notes page entirely under
// src-private/**. D20 MOVED the capture island into the SHARED public tree
// (src/lib/annotations-island.ts + src/components/AnnotationsMount.astro) so the
// same island mounts on both outputs; only the My notes surface stays private.
//
// The first block pins what remains private. The second pins the shared island's
// home and the one-way import arrow. The build blocks then prove dist-public
// carries the island's TOOLING but not the private route (AN-LEAK, D20), and
// dist-private emits both surfaces.

const PUBLIC_PAGES = path.resolve("src/pages");
const PRIVATE_PAGES = path.resolve("src-private/pages");
const PUBLIC_DIST = path.resolve("dist-public");
const PRIVATE_DIST = path.resolve("dist-private");

/** The surfaces that MUST remain private-only (My notes). */
const PRIVATE_ONLY_SOURCES = ["components/NotesIsland.tsx", "pages/notes.astro"];

/** The SHARED capture island, in the public tree so both builds compile it. */
const SHARED_SOURCES = [
  "lib/annotations.mjs",
  "lib/annotations-island.ts",
  "components/AnnotationsMount.astro",
];

describe("the private My notes surface lives only in the private pages tree", () => {
  it("has the notes island and the notes page under src-private/", () => {
    for (const rel of PRIVATE_ONLY_SOURCES) {
      expect(fs.existsSync(path.resolve("src-private", rel)), rel).toBe(true);
    }
  });

  it("has no notes page or My notes island under src/", () => {
    expect(fs.existsSync(path.join(PUBLIC_PAGES, "notes.astro"))).toBe(false);
    expect(fs.existsSync(path.join(PUBLIC_PAGES, "notes"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/components/NotesIsland.tsx"))).toBe(false);
  });

  it("the private pages tree routes /notes/ and the public tree does not", () => {
    expect(routesFromPagesDir(PRIVATE_PAGES)).toContain("/notes/");
    expect(routesFromPagesDir(PUBLIC_PAGES)).not.toContain("/notes/");
  });
});

describe("the shared capture island lives in the public tree (D20)", () => {
  it("ships the pure logic, the island module and the mount under src/", () => {
    for (const rel of SHARED_SOURCES) {
      expect(fs.existsSync(path.resolve("src", rel)), rel).toBe(true);
    }
  });

  it("no longer keeps the old private React island or the private copy of the logic", () => {
    expect(fs.existsSync(path.resolve("src-private/components/AnnotationsIsland.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve("src-private/lib/annotations.mjs"))).toBe(false);
  });

  it("both item page templates pass the item identity to the SAME shared mount", () => {
    const publicFrame = fs.readFileSync(path.resolve("src/pages/[section]/[source]/[slug].astro"), "utf8");
    const privateFrame = fs.readFileSync(path.resolve("src-private/pages/[...itemPath].astro"), "utf8");
    for (const [label, text] of [
      ["public frame", publicFrame],
      ["private frame", privateFrame],
    ] as const) {
      expect(text, `${label} imports AnnotationsMount`).toMatch(/AnnotationsMount/);
      expect(text, `${label} passes section`).toMatch(/section=\{item\.section\}/);
      expect(text, `${label} passes source`).toMatch(/source=\{item\.source\}/);
      expect(text, `${label} passes slug`).toMatch(/slug=\{item\.slug\}/);
      expect(text, `${label} marks the payload frame`).toMatch(/data-annotation-frame/);
    }
  });

  it("no file under src-private/other than the island imports is required for the public build", () => {
    // The import arrow is one-way: the private build may import the shared island
    // from ../../src/, and nothing under src/ imports src-private/ (pinned in
    // private-structure.test.ts). This asserts the shared island itself imports
    // nothing private.
    for (const rel of SHARED_SOURCES) {
      const text = fs.readFileSync(path.resolve("src", rel), "utf8");
      for (const line of text.split("\n")) {
        if (!/\b(import|require)\b/.test(line)) continue;
        expect(line, `${rel} imports something private: ${line.trim()}`).not.toMatch(
          /src-private|private-content|PrivateBase|private-build/,
        );
      }
    }
  });
});

describe.runIf(fs.existsSync(path.join(PUBLIC_DIST, "index.html")))(
  "dist-public carries the island tooling, never the private route (AN-LEAK, D20)",
  () => {
    it("has no notes page under the public output", () => {
      expect(fs.existsSync(path.join(PUBLIC_DIST, "notes"))).toBe(false);
      expect(fs.existsSync(path.join(PUBLIC_DIST, "notes", "index.html"))).toBe(false);
    });

    it("contains none of the PRIVATE annotation needles in any path or file's contents", () => {
      expect(findAnnotationLeaks(PUBLIC_DIST)).toEqual([]);
    });

    it("emits no My notes island chunk", () => {
      const astro = path.join(PUBLIC_DIST, "_astro");
      const files = fs.existsSync(astro) ? fs.readdirSync(astro) : [];
      for (const name of files) {
        expect(name).not.toMatch(/NotesIsland/);
      }
    });

    it("emits the shared island tooling, and that chunk carries no /p/notes", () => {
      const astro = path.join(PUBLIC_DIST, "_astro");
      const files = fs.existsSync(astro) ? fs.readdirSync(astro) : [];
      const chunks = files.filter((name) => /\.js$/.test(name));
      const carriesTooling = chunks.some((name) =>
        fs.readFileSync(path.join(astro, name), "utf8").includes("/annotations"),
      );
      expect(carriesTooling, "the shared island bundle should name /annotations").toBe(true);
      for (const name of chunks) {
        expect(fs.readFileSync(path.join(astro, name), "utf8")).not.toContain("/p/notes");
      }
    });
  },
);

describe.runIf(fs.existsSync(path.join(PRIVATE_DIST, "index.html")))(
  "the private build emits the My notes page and the shared capture island",
  () => {
    it("emits the notes page at notes/index.html (the gate serves it under /p/)", () => {
      expect(fs.existsSync(path.join(PRIVATE_DIST, "notes", "index.html"))).toBe(true);
    });

    it("emits the shared island chunk", () => {
      const astro = path.join(PRIVATE_DIST, "_astro");
      const files = fs.existsSync(astro) ? fs.readdirSync(astro) : [];
      const carriesTooling = files.some(
        (name) =>
          /\.js$/.test(name) && fs.readFileSync(path.join(astro, name), "utf8").includes("/annotations"),
      );
      expect(carriesTooling).toBe(true);
    });

    it("mounts the capture island on a framed item page", () => {
      const frame = path.join(PRIVATE_DIST, "phd", "phd-milestones", "milestones", "index.html");
      expect(fs.existsSync(frame), "fixture frame page").toBe(true);
      const html = fs.readFileSync(frame, "utf8");
      expect(html).toContain("data-annotation-frame");
      expect(html).toContain("data-annotation-island");
    });
  },
);
