import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { routesFromPagesDir } from "./route-inventory.mjs";
import { findAnnotationLeaks } from "./check-no-private-in-public.mjs";

// ===========================================================================
// WAVE 6 STRUCTURAL GUARANTEE (contract site-wave-6 requirement 8; AN-CAP 1)
// ===========================================================================
// The capture island and My notes page exist ONLY in src-private/**, so the
// public build's srcDir (./src) never resolves them. The route-level assertions
// run without a build; the build-level assertions run when a build is present
// (CI runs npm test before the builds, so they are conditional, as wave-5 does).
//
// The second half is AN-LEAK: no annotation needle (`/annotations`, `/p/notes`,
// `hub:annotation:`, `data-annotation-`) may appear in dist-public by path or by
// contents, and no annotation island chunk may be emitted.

const PUBLIC_PAGES = path.resolve("src/pages");
const PRIVATE_PAGES = path.resolve("src-private/pages");
const PUBLIC_DIST = path.resolve("dist-public");
const PRIVATE_DIST = path.resolve("dist-private");

const PRIVATE_SOURCES = [
  "components/AnnotationsIsland.tsx",
  "components/NotesIsland.tsx",
  "pages/notes.astro",
  "lib/annotations.mjs",
];

describe("the annotation surfaces live only in the private pages tree", () => {
  it("has the capture island, the notes island, the page and the pure logic under src-private/", () => {
    for (const rel of PRIVATE_SOURCES) {
      expect(fs.existsSync(path.resolve("src-private", rel)), rel).toBe(true);
    }
  });

  it("has no notes page or annotation island under src/", () => {
    expect(fs.existsSync(path.join(PUBLIC_PAGES, "notes.astro"))).toBe(false);
    expect(fs.existsSync(path.join(PUBLIC_PAGES, "notes"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/components/AnnotationsIsland.tsx"))).toBe(false);
    expect(fs.existsSync(path.resolve("src/components/NotesIsland.tsx"))).toBe(false);
  });

  it("the private pages tree routes /notes/ and the public tree does not", () => {
    expect(routesFromPagesDir(PRIVATE_PAGES)).toContain("/notes/");
    expect(routesFromPagesDir(PUBLIC_PAGES)).not.toContain("/notes/");
  });

  it("no file under src/ imports the annotation island or the annotation logic", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(astro|ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (/\b(import|require)\b[^\n]*(annotations\.mjs|AnnotationsIsland|NotesIsland)/.test(text)) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(path.resolve("src"));
    expect(offenders).toEqual([]);
  });

  it("the item frame mounts the island with the item identity as props", () => {
    const page = fs.readFileSync(path.resolve("src-private/pages/[...itemPath].astro"), "utf8");
    expect(page).toMatch(/AnnotationsIsland/);
    expect(page).toMatch(/client:load/);
    expect(page).toMatch(/section=\{item\.section\}/);
    expect(page).toMatch(/source=\{item\.source\}/);
    expect(page).toMatch(/slug=\{item\.slug\}/);
    expect(page).toMatch(/item\.format === "html" \|\| item\.format === "bundle"/);
  });
});

describe.runIf(fs.existsSync(path.join(PUBLIC_DIST, "index.html")))(
  "dist-public carries no annotation surface (AN-LEAK)",
  () => {
    it("has no notes page under the public output", () => {
      expect(fs.existsSync(path.join(PUBLIC_DIST, "notes"))).toBe(false);
      expect(fs.existsSync(path.join(PUBLIC_DIST, "notes", "index.html"))).toBe(false);
    });

    it("contains none of the annotation needles in any path or file's contents", () => {
      expect(findAnnotationLeaks(PUBLIC_DIST)).toEqual([]);
    });

    it("emits no annotation island chunk", () => {
      const astro = path.join(PUBLIC_DIST, "_astro");
      const files = fs.existsSync(astro) ? fs.readdirSync(astro) : [];
      for (const name of files) {
        expect(name).not.toMatch(/AnnotationsIsland|NotesIsland/);
      }
    });
  },
);

describe.runIf(fs.existsSync(path.join(PRIVATE_DIST, "index.html")))(
  "the private build emits the My notes page and the capture island",
  () => {
    it("emits the notes page at notes/index.html (the gate serves it under /p/)", () => {
      expect(fs.existsSync(path.join(PRIVATE_DIST, "notes", "index.html"))).toBe(true);
    });

    it("emits an annotation island chunk", () => {
      const astro = path.join(PRIVATE_DIST, "_astro");
      const files = fs.existsSync(astro) ? fs.readdirSync(astro) : [];
      expect(files.some((name) => /AnnotationsIsland/.test(name))).toBe(true);
    });

    it("mounts the capture island on a framed item page", () => {
      const frame = path.join(PRIVATE_DIST, "phd", "phd-milestones", "milestones", "index.html");
      expect(fs.existsSync(frame), "fixture frame page").toBe(true);
      const html = fs.readFileSync(frame, "utf8");
      expect(html).toContain("data-annotation-frame");
      expect(html).toMatch(/AnnotationsIsland/);
    });
  },
);
