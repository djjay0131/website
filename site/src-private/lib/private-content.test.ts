import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GATE_SEGMENT_PATTERN,
  PAYLOAD_ROOT,
  findUnservablePaths,
  payloadUrlFor,
  routeFor,
  stagingPlanFor,
} from "./private-content.mjs";

const FIXTURE_SOURCES = path.resolve("fixtures/content/sources");

const MILESTONES = {
  source: "phd-milestones",
  slug: "milestones",
  section: "phd",
  format: "html",
  path: "site/index.html",
};
const DOSSIER = {
  source: "phd-milestones",
  slug: "committee-dossier",
  section: "phd",
  format: "html",
  path: "site/committee.html",
};

describe("where a private item is served", () => {
  it("routes at /<section>/<source>/<slug>/", () => {
    expect(routeFor(MILESTONES)).toBe("/phd/phd-milestones/milestones/");
  });

  it("serves its payload under the payload root, keeping the satellite's own layout", () => {
    expect(payloadUrlFor(MILESTONES)).toBe(`/${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
  });

  // ISSUE #27. These build RAW strings, so Astro's `base` never reaches them. The
  // private build passes import.meta.env.BASE_URL, which is /p/ -- the path the gate
  // serves under and strips to form the object name. Before this, every route and
  // payload URL pointed at the PUBLIC origin and 404'd for a signed-in member, while
  // the build, the sync and the gate were each individually correct.
  it("prefixes the gate's base, which is what the private build passes", () => {
    expect(routeFor(MILESTONES, "/p/")).toBe("/p/phd/phd-milestones/milestones/");
    expect(payloadUrlFor(MILESTONES, "/p/")).toBe(
      `/p/${PAYLOAD_ROOT}/phd-milestones/site/index.html`,
    );
  });
});

describe("staging an html item takes its DIRECTORY, not just its file", () => {
  // Phase 2 staged one file per item, which is right for a pdf and wrong for
  // html: both fixture pages load site/assets/style.css and cross-link to each
  // other. Copying only the named file renders them broken with no error at all.
  const plan = stagingPlanFor(FIXTURE_SOURCES, [MILESTONES, DOSSIER]);
  const to = plan.map((p) => p.to);

  it("stages the sibling stylesheet the manifest never mentions", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`);
  });

  it("stages both declared pages", () => {
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
    expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/committee.html`);
  });

  it("emits each file exactly once, though both items share one directory", () => {
    expect(new Set(to).size).toBe(to.length);
  });

  it("every planned source file actually exists", () => {
    for (const { from } of plan) expect(fs.existsSync(from), from).toBe(true);
  });
});

describe("a WITHDRAWN document's leftover bytes are not staged (ADR-0010 decision 1)", () => {
  it("skips an .html file no surviving item declares", () => {
    // A satellite cannot prune (ADR-0007), so a withdrawn page's bytes are still
    // sitting in the directory. A plain directory copy would re-publish exactly
    // the document someone withdrew.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage-"));
    try {
      const dir = path.join(root, "phd-milestones", "site");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), "live");
      fs.writeFileSync(path.join(dir, "committee.html"), "live");
      fs.writeFileSync(path.join(dir, "withdrawn.html"), "SHOULD NOT TRAVEL");
      fs.writeFileSync(path.join(dir, "assets", "style.css"), "body{}");

      const to = stagingPlanFor(root, [MILESTONES, DOSSIER]).map((p) => p.to);

      expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/index.html`);
      expect(to).toContain(`${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`);
      expect(to).not.toContain(`${PAYLOAD_ROOT}/phd-milestones/site/withdrawn.html`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages only the named file for a non-document format", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage-pdf-"));
    try {
      fs.mkdirSync(path.join(root, "cv"), { recursive: true });
      fs.writeFileSync(path.join(root, "cv", "academic.pdf"), "%PDF");
      fs.writeFileSync(path.join(root, "cv", "unrelated.pdf"), "%PDF");

      const to = stagingPlanFor(root, [
        { source: "cv", slug: "academic", section: "cv", format: "pdf", path: "academic.pdf" },
      ]).map((p) => p.to);

      expect(to).toEqual([`${PAYLOAD_ROOT}/cv/academic.pdf`]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages nothing when there are no private items", () => {
    expect(stagingPlanFor(FIXTURE_SOURCES, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SD-7: every emitted path must be one the gate can actually serve
// ---------------------------------------------------------------------------
describe("paths the gate could never serve fail the build, not the member", () => {
  // The gate validates /p/{path} with an ALLOWLIST -- each segment must match
  // [A-Za-z0-9._-] -- and 404s anything else before reading the bucket. A file
  // outside that set syncs perfectly and is then permanently unreachable, with
  // nothing failing anywhere. Only the members it exists for ever see it.

  it("accepts everything the two fixture items actually produce", () => {
    const emitted = [
      "index.html",
      "phd/phd-milestones/milestones/index.html",
      "phd/phd-milestones/committee-dossier/index.html",
      `${PAYLOAD_ROOT}/phd-milestones/site/index.html`,
      `${PAYLOAD_ROOT}/phd-milestones/site/committee.html`,
      `${PAYLOAD_ROOT}/phd-milestones/site/assets/style.css`,
      "_astro/index.BrYAj1_h.css",
      ".hub-private-build.json",
    ];
    expect(findUnservablePaths(emitted)).toEqual([]);
  });

  it("names the offending path AND the offending segment", () => {
    const bad = findUnservablePaths(["phd/phd milestones/index.html"]);
    expect(bad).toEqual([{ path: "phd/phd milestones/index.html", segment: "phd milestones" }]);
  });

  it("catches each character class that plausibly gets here", () => {
    for (const segment of ["a b", "a~b", "a+b", "a@b", "a%20b", "a:b", "a(b)", "café", "a#b"]) {
      expect(findUnservablePaths([`ok/${segment}/index.html`]), segment).toHaveLength(1);
    }
  });

  it("allows the separators Astro and the payload root really use", () => {
    for (const segment of ["_astro", "_payload", "committee-dossier", "style.css", "a_b", "A1"]) {
      expect(GATE_SEGMENT_PATTERN.test(segment), segment).toBe(true);
    }
  });
});
