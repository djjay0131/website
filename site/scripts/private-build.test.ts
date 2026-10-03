import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { privateBuild } from "./private-build.mjs";
import { assertBuildIsSyncable } from "./sync-private.mjs";

// ===========================================================================
// THE SHARE-SERVABLE `_doc/` COPY (SEAM-S1, amended 2026-10-03)
// ===========================================================================
// The track run against the committed fixture tree, not the bucket-shaped
// src/content/sources tree: a pull-request build supplies only `cv` (the
// cv-release fallback), so `src/content/sources` cannot be relied on to carry
// the private phd-milestones source the assertion is about. The fixture tree is
// byte-identical for phd-milestones and committed.
//
// It drives the REAL astro:build:done hook rather than a hand-rolled copy of its
// body, so the staging, the SD-7 path check and the receipt are the production
// path. Astro itself (the member frames) is omitted; that is a separate render.
const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

describe("the private build stages an item-scoped _doc/ for a share", () => {
  let outDir: string;

  beforeAll(async () => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "private-doc-build-"));
    const integration = privateBuild({ sourcesDir: FIXTURE_SOURCES });
    const done = integration.hooks["astro:build:done"] as unknown as (ctx: {
      dir: URL;
      pages: unknown[];
      logger: { info: (message: string) => void };
    }) => Promise<void>;
    await done({ dir: pathToFileURL(outDir), pages: [], logger: { info: () => {} } });
  });

  afterAll(() => {
    if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
  });

  const docDir = () => path.join(outDir, "phd/phd-milestones/committee-dossier/_doc");

  it("copies the item's own document under its own basename under <section>/<source>/<slug>/_doc/", () => {
    const entry = path.join(docDir(), "committee.html");
    expect(fs.existsSync(entry), entry).toBe(true);
    expect(fs.readFileSync(entry, "utf8")).toContain("Committee Dossier (fixture)");
    expect(fs.readFileSync(entry, "utf8")).not.toContain("Programme Milestone Tracker");
    // The follow-up fix: renaming the entry to index.html served a PDF as
    // text/html. The entry keeps its real name and extension.
    expect(fs.existsSync(path.join(docDir(), "index.html"))).toBe(false);
  });

  it("carries the non-document asset beside it", () => {
    expect(fs.existsSync(path.join(docDir(), "assets/style.css"))).toBe(true);
  });

  it("carries NO sibling item's document under that _doc/", () => {
    // internal.html belongs to `internal-notes`; index.html to `milestones`.
    // Neither may appear; the only document is the item's own basename.
    expect(fs.existsSync(path.join(docDir(), "internal.html"))).toBe(false);
    expect(fs.existsSync(path.join(docDir(), "index.html"))).toBe(false);
    const html = (
      fs.readdirSync(docDir(), { recursive: true }) as unknown as string[]
    )
      .map(String)
      .filter((rel) => rel.endsWith(".html"));
    expect(html).toEqual(["committee.html"]);
  });

  it("leaves the members' _payload/ staging untouched", () => {
    expect(fs.existsSync(path.join(outDir, "_payload/phd-milestones/site/committee.html"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(outDir, "_payload/phd-milestones/site/assets/style.css"))).toBe(
      true,
    );
  });

  it("does NOT sweep a non-framed item's whole prefix into _doc/ (the cv trap)", () => {
    // cv/anthropic-fellow is effectively private in the fixture (the allowlist
    // omits it) and its `path` sits at the prefix root. A directory walk there
    // would copy every CV into one item's share tree.
    const cvDoc = path.join(outDir, "cv/cv/anthropic-fellow/_doc");
    expect(fs.existsSync(path.join(cvDoc, "anthropic-fellow.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(cvDoc, "index.html"))).toBe(false);
    expect(fs.existsSync(path.join(cvDoc, "academic.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(cvDoc, "sde-long.pdf"))).toBe(false);
  });

  it("keeps the build receipt consistent with the new files on disk", () => {
    // P4: the receipt's fileCount must equal what is on disk. The `_doc/` files
    // are counted too, so the receipt semantics are intact, and a new
    // docFileCount records the share copy without redefining payloadFileCount.
    const { receipt, files } = assertBuildIsSyncable(outDir);
    expect(receipt.docFileCount).toBeGreaterThan(0);
    expect(files).toContain("phd/phd-milestones/committee-dossier/_doc/committee.html");
    expect(files).toContain("phd/phd-milestones/committee-dossier/_doc/assets/style.css");
    expect(files).toContain("cv/cv/anthropic-fellow/_doc/anthropic-fellow.pdf");
    expect(files).not.toContain("phd/phd-milestones/committee-dossier/_doc/index.html");
    expect(files).toContain("_payload/phd-milestones/site/committee.html");
  });
});
