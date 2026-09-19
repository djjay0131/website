import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stagePublicAssets } from "./stage-public-assets.mjs";
import {
  CONTENT_PROVENANCE_FILE,
  PUBLIC_PDF_DIR,
  PUBLIC_PHOTO_PATH,
} from "../src/lib/hub-content.mjs";

// scripts/sync-content.sh CANNOT be exercised against a real content bucket
// here: no credential exists, none may be created, and the bucket itself does
// not exist until Checkpoint 3. So the bucket transport is tested against a
// local tree shaped exactly like the bucket (site/fixtures/content), which is
// the same --from path scripts/fetch-data.sh and scripts/sync-local-data.sh
// hand it. The objects.list/objects.get calls themselves are verified by
// reading the script, not by running it, and that is stated in the handoff.
const SCRIPT = path.resolve("scripts/sync-content.sh");
const FIXTURE = path.resolve("fixtures/content");

function run(args: string[]) {
  return spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8" });
}

describe("sync-content.sh --from (the bucket-shaped local tree)", () => {
  let dest: string;
  beforeEach(() => {
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "sync-dest-"));
  });
  afterEach(() => fs.rmSync(dest, { recursive: true, force: true }));

  it("lays the bucket out under the destination, prefix stripped", () => {
    const r = run(["--from", FIXTURE, "--dest", dest, "--no-stage"]);
    expect(r.status, r.stderr).toBe(0);
    for (const rel of [
      "cv/manifest.json",
      "cv/academic.pdf",
      "cv/research-professional.pdf",
      "cv/cv-data/data/content/meta.yaml",
      "cv/cv-data/data/variants/academic.yaml",
      "cv/cv-data/own-bib.bib",
    ]) {
      expect(fs.existsSync(path.join(dest, rel)), rel).toBe(true);
    }
    // sources/ is the bucket prefix, not part of the synced layout (SEAM-2).
    expect(fs.existsSync(path.join(dest, "sources"))).toBe(false);
  });

  it("rebuilds the destination, so a withdrawn object cannot linger", () => {
    fs.mkdirSync(path.join(dest, "cv"), { recursive: true });
    fs.writeFileSync(path.join(dest, "cv", "withdrawn.pdf"), "stale");
    run(["--from", FIXTURE, "--dest", dest, "--no-stage"]);
    expect(fs.existsSync(path.join(dest, "cv", "withdrawn.pdf"))).toBe(false);
  });

  it("refuses --bucket together with --from", () => {
    const r = run(["--from", FIXTURE, "--bucket", "b", "--dest", dest]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("mutually exclusive");
  });

  it("refuses --bucket with no access token", () => {
    const r = spawnSync("bash", [SCRIPT, "--fingerprint", "--bucket", "example-bucket"], {
      encoding: "utf8",
      env: { ...process.env, GCS_ACCESS_TOKEN: "" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("access token");
  });
});

describe("the fingerprint covers the whole object set, deletions included", () => {
  let tree: string;
  beforeEach(() => {
    tree = fs.mkdtempSync(path.join(os.tmpdir(), "sync-src-"));
    fs.cpSync(FIXTURE, tree, { recursive: true });
  });
  afterEach(() => fs.rmSync(tree, { recursive: true, force: true }));

  const fingerprint = (dir: string) => {
    const r = run(["--fingerprint", "--from", dir]);
    expect(r.status, r.stderr).toBe(0);
    return r.stdout.trim();
  };

  it("is stable for an unchanged tree", () => {
    expect(fingerprint(tree)).toBe(fingerprint(tree));
    expect(fingerprint(tree)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("CHANGES WHEN AN OBJECT IS DELETED — a withdrawn item must never look unchanged", () => {
    const before = fingerprint(tree);
    fs.rmSync(path.join(tree, "sources/cv/sde-long.pdf"));
    expect(fingerprint(tree)).not.toBe(before);
  });

  it("changes when an object is added", () => {
    const before = fingerprint(tree);
    fs.writeFileSync(path.join(tree, "sources/cv/extra.pdf"), "%PDF-1.4");
    expect(fingerprint(tree)).not.toBe(before);
  });

  it("changes when an object's content changes", () => {
    const before = fingerprint(tree);
    fs.appendFileSync(path.join(tree, "sources/cv/manifest.json"), "\n");
    expect(fingerprint(tree)).not.toBe(before);
  });

  it("reports an empty object set as a stable fingerprint of its own", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "sync-empty-"));
    expect(fingerprint(empty)).toBe("empty");
    fs.rmSync(empty, { recursive: true, force: true });
  });
});

describe("stage-public-assets — Phase 1's URLs keep resolving", () => {
  let siteRoot: string;
  let sources: string;
  beforeEach(() => {
    siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "stage-site-"));
    sources = fs.mkdtempSync(path.join(os.tmpdir(), "stage-sources-"));
    fs.cpSync(path.join(FIXTURE, "sources"), sources, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(siteRoot, { recursive: true, force: true });
    fs.rmSync(sources, { recursive: true, force: true });
  });

  it("puts each published cv pdf at public/pdfs/<slug>.pdf and the photo beside it", () => {
    const { staged } = stagePublicAssets(sources, siteRoot);
    expect(staged).toContain(`${PUBLIC_PDF_DIR}/academic.pdf`);
    expect(staged).toContain(`${PUBLIC_PDF_DIR}/research-professional.pdf`);
    expect(staged).toContain(PUBLIC_PHOTO_PATH);
    expect(fs.existsSync(path.join(siteRoot, PUBLIC_PDF_DIR, "sde-long.pdf"))).toBe(true);
  });

  it("stops serving a pdf whose item was withdrawn from the manifest", () => {
    stagePublicAssets(sources, siteRoot);
    const manifestPath = path.join(sources, "cv", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.items = manifest.items.filter((i: { slug: string }) => i.slug !== "sde-long");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const { staged } = stagePublicAssets(sources, siteRoot);
    expect(staged).not.toContain(`${PUBLIC_PDF_DIR}/sde-long.pdf`);
    // The manifest is the authority on what exists, even though the bytes
    // remain under the prefix (a satellite cannot list, so it cannot prune).
    expect(fs.existsSync(path.join(sources, "cv", "sde-long.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(siteRoot, PUBLIC_PDF_DIR, "sde-long.pdf"))).toBe(false);
  });

  it("stages nothing, and fails nothing, when no content has been synced", () => {
    const { staged } = stagePublicAssets(path.join(os.tmpdir(), "absent-sources"), siteRoot);
    expect(staged).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The provenance marker (ADR-0010 decision 4; src/lib/hub-content.mjs)
// ---------------------------------------------------------------------------
//
// The expected-source check asks "has a declared source's whole prefix
// vanished?", and that question means nothing for a tree whose producer could
// never have carried every source. This script is the only writer of the synced
// tree, so it is the only thing that knows -- and it records the answer here
// rather than leaving every later step to infer it.
describe("sync-content.sh records how the tree was produced", () => {
  let dest: string;
  beforeEach(() => {
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "sync-prov-"));
  });
  afterEach(() => fs.rmSync(dest, { recursive: true, force: true }));

  const marker = () =>
    JSON.parse(fs.readFileSync(path.join(dest, CONTENT_PROVENANCE_FILE), "utf8"));

  it("writes a marker on every sync, defaulting a --from tree to local and COMPLETE", () => {
    const r = run(["--from", FIXTURE, "--dest", dest, "--no-stage"]);
    expect(r.status, r.stderr).toBe(0);
    expect(marker().provenance).toBe("local");
    expect(marker().complete).toBe(true);
    expect(marker().objectCount).toBeGreaterThan(0);
    expect(marker().syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("records --provenance and --partial, exactly as fetch-data.sh passes them", () => {
    // The cv release carries "cv" alone, and every pull-request build reads it.
    const r = run([
      "--from", FIXTURE, "--dest", dest, "--no-stage",
      "--provenance", "cv-release", "--partial",
    ]);
    expect(r.status, r.stderr).toBe(0);
    expect(marker().provenance).toBe("cv-release");
    expect(marker().complete).toBe(false);
    expect(r.stdout).toContain("complete=false");
  });

  it("REWRITES the marker on every run, so a stale one cannot outlive its tree", () => {
    // The destination is rebuilt from scratch, so an exemption written by one
    // producer can never be inherited by the next. Without this, one fallback
    // run would silently disable the check for every later bucket sync.
    fs.writeFileSync(
      path.join(dest, CONTENT_PROVENANCE_FILE),
      JSON.stringify({ provenance: "cv-release", complete: false }),
    );
    const r = run(["--from", FIXTURE, "--dest", dest, "--no-stage"]);
    expect(r.status, r.stderr).toBe(0);
    expect(marker().complete).toBe(true);
    expect(marker().provenance).toBe("local");
  });
});
