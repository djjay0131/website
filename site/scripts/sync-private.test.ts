import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_MAX_DELETE_RATIO,
  PrivateSyncError,
  RECEIPT_NAME,
  assertBuildIsSyncable,
  checkDeletionCeiling,
  planSync,
  syncPrivate,
} from "./sync-private.mjs";

// THE PRIVATE BUCKET DOES NOT EXIST and no credential exists in this
// environment, so every test here drives the LOCAL destination driver against a
// fixture tree. The bucket driver shares all of the decision logic below and
// differs only in the HTTP calls; that part is unexercised and said so plainly
// in the handoff.

function writeTree(root: string, files: Record<string, string>) {
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
}

function localDriver(destDir: string) {
  const walk = (dir: string, rel = ""): string[] => {
    const out: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...walk(dir, child));
      else out.push(child);
    }
    return out;
  };
  return {
    describe: () => destDir,
    list: () => (fs.existsSync(destDir) ? walk(destDir) : []),
    upload(sourceDir: string, rel: string) {
      const to = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(sourceDir, rel), to);
    },
    remove(rel: string) {
      fs.rmSync(path.join(destDir, rel), { force: true });
    },
  };
}

/** A well-formed private build: files plus a matching receipt. */
function buildPrivateOutput(root: string, files: Record<string, string>, over: Record<string, unknown> = {}) {
  writeTree(root, files);
  const receipt = {
    output: "private",
    builtAt: new Date().toISOString(),
    commit: "abc123",
    privateItemCount: 2,
    fileCount: Object.keys(files).length,
    ...over,
  };
  fs.writeFileSync(path.join(root, RECEIPT_NAME), JSON.stringify(receipt, null, 2));
  return receipt;
}

describe("the preconditions, each of which is a refusal", () => {
  let src: string;
  beforeEach(() => {
    src = fs.mkdtempSync(path.join(os.tmpdir(), "priv-src-"));
  });
  afterEach(() => fs.rmSync(src, { recursive: true, force: true }));

  it("P1 refuses a missing private build", () => {
    expect(() => assertBuildIsSyncable(path.join(src, "nope"))).toThrow(/P1 FAILED/);
  });

  it("P2 refuses a build with no receipt — ADR-0010 decision 3's gate", () => {
    // This is the important one: "the build succeeded and the manifests
    // validated" made checkable instead of assumed. A build that threw part way
    // leaves files but no receipt, and must not be able to delete anything.
    writeTree(src, { "index.html": "<p>half a build</p>" });
    expect(() => assertBuildIsSyncable(src)).toThrow(/P2 FAILED/);
    expect(() => assertBuildIsSyncable(src)).toThrow(PrivateSyncError);
  });

  it("P3 refuses a receipt from the PUBLIC build", () => {
    buildPrivateOutput(src, { "index.html": "x" }, { output: "public" });
    expect(() => assertBuildIsSyncable(src)).toThrow(/P3 FAILED/);
  });

  it("P4 refuses an output that does not match its own receipt", () => {
    buildPrivateOutput(src, { "index.html": "x" }, { fileCount: 9 });
    expect(() => assertBuildIsSyncable(src)).toThrow(/P4 FAILED/);
  });

  it("P4 catches a file appearing between build and sync", () => {
    buildPrivateOutput(src, { "index.html": "x" });
    fs.writeFileSync(path.join(src, "sneaked-in.html"), "y");
    expect(() => assertBuildIsSyncable(src)).toThrow(/P4 FAILED/);
  });

  it("P5 refuses a build that rendered no private item, unless told to", () => {
    buildPrivateOutput(src, { "index.html": "x" }, { privateItemCount: 0 });
    expect(() => assertBuildIsSyncable(src)).toThrow(/P5 FAILED/);
    // An empty private area IS legitimate (ADR-0010 decision 2) — but a human
    // has to say so, because it is indistinguishable from a build defect.
    expect(() => assertBuildIsSyncable(src, { allowEmpty: true })).not.toThrow();
  });

  it("accepts a well-formed private build", () => {
    buildPrivateOutput(src, { "index.html": "x", "a/b.css": "y" });
    const { files, receipt } = assertBuildIsSyncable(src);
    expect(files.sort()).toEqual(["a/b.css", "index.html"]);
    expect(receipt.output).toBe("private");
  });
});

describe("the plan deletes what the build did not produce (ADR-0010 decision 5)", () => {
  it("uploads the build and deletes the rest", () => {
    const plan = planSync(["index.html", "a.css"], ["index.html", "withdrawn/index.html", "old.css"]);
    expect(plan.upload).toEqual(["a.css", "index.html"]);
    expect(plan.delete).toEqual(["old.css", "withdrawn/index.html"]);
  });

  it("never proposes deleting the receipt itself", () => {
    const plan = planSync(["index.html"], ["index.html", RECEIPT_NAME]);
    expect(plan.delete).not.toContain(RECEIPT_NAME);
  });
});

describe("P6, the deletion ceiling — the answer to 'what else before it deletes'", () => {
  it("allows a proportionate withdrawal", () => {
    // one item withdrawn out of ten objects
    const plan = planSync([], Array.from({ length: 10 }, (_, i) => `f${i}`));
    plan.delete = ["f9"];
    expect(checkDeletionCeiling(plan, 10).allowed).toBe(true);
  });

  it("REFUSES a mass deletion, which is what a build defect looks like", () => {
    const dest = Array.from({ length: 10 }, (_, i) => `f${i}`);
    const plan = planSync(["f0"], dest);
    const verdict = checkDeletionCeiling(plan, dest.length);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/exceeds the ceiling/);
    expect(verdict.ratio).toBeGreaterThan(DEFAULT_MAX_DELETE_RATIO);
  });

  it("can be overridden deliberately for a real mass withdrawal", () => {
    const dest = Array.from({ length: 10 }, (_, i) => `f${i}`);
    const plan = planSync(["f0"], dest);
    expect(checkDeletionCeiling(plan, dest.length, 1).allowed).toBe(true);
  });

  it("does not trip on a first sync into an empty destination", () => {
    const plan = planSync(["a", "b"], []);
    expect(checkDeletionCeiling(plan, 0).allowed).toBe(true);
  });
});

describe("the sync itself, against a local destination", () => {
  let src: string;
  let dest: string;
  beforeEach(() => {
    src = fs.mkdtempSync(path.join(os.tmpdir(), "priv-src-"));
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "priv-dest-"));
  });
  afterEach(() => {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  });

  it("DRY RUNS by default and changes nothing", async () => {
    buildPrivateOutput(src, { "index.html": "new" });
    writeTree(dest, { "withdrawn.html": "still here" });

    // maxDeleteRatio is opened up here so this test exercises DRY RUN rather
    // than P6; the ceiling has its own tests above. With a one-object
    // destination every deletion is 100% of it and would trip the ceiling first.
    const result = await syncPrivate({
      sourceDir: src,
      driver: localDriver(dest),
      maxDeleteRatio: 1,
      log: () => {},
    });

    expect(result.applied).toBe(false);
    expect(result.plan.delete).toEqual(["withdrawn.html"]);
    expect(fs.existsSync(path.join(dest, "withdrawn.html"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "index.html"))).toBe(false);
  });

  it("A WITHDRAWN PRIVATE ITEM STOPS BEING READABLE, not merely unlinked", async () => {
    // The whole point of ADR-0010 decision 5. The destination is serving a
    // dossier; the new build no longer produces it; after the sync the bytes are
    // gone from the destination, so the gate cannot serve it at its old path.
    buildPrivateOutput(src, {
      "index.html": "members area",
      "phd/phd-milestones/milestones/index.html": "tracker",
    });
    writeTree(dest, {
      "index.html": "old members area",
      "phd/phd-milestones/milestones/index.html": "old tracker",
      "phd/phd-milestones/committee-dossier/index.html": "THE WITHDRAWN DOSSIER",
      "_payload/phd-milestones/site/committee.html": "THE WITHDRAWN PAYLOAD",
    });

    const result = await syncPrivate({
      sourceDir: src,
      driver: localDriver(dest),
      apply: true,
      maxDeleteRatio: 1, // exercising the deletion itself, not the ceiling
      log: () => {},
    });

    expect(result.applied).toBe(true);
    expect(fs.existsSync(path.join(dest, "phd/phd-milestones/committee-dossier/index.html"))).toBe(false);
    expect(fs.existsSync(path.join(dest, "_payload/phd-milestones/site/committee.html"))).toBe(false);
    // and the surviving item is still there, freshly uploaded
    expect(fs.readFileSync(path.join(dest, "phd/phd-milestones/milestones/index.html"), "utf8")).toBe("tracker");
  });

  it("refuses to run at all when the build left no receipt", async () => {
    writeTree(src, { "index.html": "x" });
    writeTree(dest, { "everything.html": "precious" });

    await expect(
      syncPrivate({ sourceDir: src, driver: localDriver(dest), apply: true, log: () => {} }),
    ).rejects.toThrow(/P2 FAILED/);

    expect(fs.existsSync(path.join(dest, "everything.html"))).toBe(true);
  });

  it("refuses a mass deletion even with --apply, and deletes nothing first", async () => {
    buildPrivateOutput(src, { "index.html": "just one file" }, { privateItemCount: 1, fileCount: 1 });
    writeTree(dest, Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}.html`, "x"])));

    await expect(
      syncPrivate({ sourceDir: src, driver: localDriver(dest), apply: true, log: () => {} }),
    ).rejects.toThrow(/P6 FAILED/);

    // Nothing was uploaded and nothing deleted: the refusal happens before any
    // mutation, which is the property that makes the ceiling worth having.
    expect(fs.readdirSync(dest).length).toBe(12);
  });
});
