import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findMissingSmokeRoutes, smokeRouteFile } from "./check-smoke-routes.mjs";
import { SMOKE_ROUTES } from "./site-routes.mjs";

const SCRIPT = path.resolve("scripts/check-smoke-routes.mjs");

function touch(root: string, rel: string) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x");
}

function runCheck(dir: string) {
  return spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
}

describe("smokeRouteFile", () => {
  it("maps page routes, with or without a trailing slash, to index.html", () => {
    expect(smokeRouteFile("/")).toBe("index.html");
    expect(smokeRouteFile("/cv/one-page")).toBe("cv/one-page/index.html");
    expect(smokeRouteFile("/cv/one-page/")).toBe("cv/one-page/index.html");
    expect(smokeRouteFile("/papers/")).toBe("papers/index.html");
  });

  it("maps file routes to the file itself", () => {
    expect(smokeRouteFile("/pdfs/one-page.pdf")).toBe("pdfs/one-page.pdf");
  });
});

describe("smoke-route presence check (SEAM-7)", () => {
  let dist: string;
  beforeEach(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-routes-"));
    for (const route of SMOKE_ROUTES) touch(dist, smokeRouteFile(route));
  });
  afterEach(() => fs.rmSync(dist, { recursive: true, force: true }));

  it("checks a page route and a file route from site-routes.mjs", () => {
    expect(SMOKE_ROUTES).toContain("/cv/research-2p");
    expect(SMOKE_ROUTES).toContain("/pdfs/one-page.pdf");
  });

  it("passes when every smoke route is present", () => {
    expect(findMissingSmokeRoutes(dist)).toEqual([]);
    const run = runCheck(dist);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain(`all ${SMOKE_ROUTES.length} smoke routes present`);
  });

  it("fails and names a missing page route and a missing file route", () => {
    fs.rmSync(path.join(dist, "cv/research-2p"), { recursive: true });
    fs.rmSync(path.join(dist, "pdfs/one-page.pdf"));

    expect(findMissingSmokeRoutes(dist)).toEqual([
      { route: "/cv/research-2p", file: "cv/research-2p/index.html" },
      { route: "/pdfs/one-page.pdf", file: "pdfs/one-page.pdf" },
    ]);

    const run = runCheck(dist);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("MISSING /cv/research-2p → cv/research-2p/index.html");
    expect(run.stdout).toContain("MISSING /pdfs/one-page.pdf → pdfs/one-page.pdf");
    expect(run.stderr).toContain("2 of 7 smoke routes missing");
    expect(run.stderr).toContain("/cv/research-2p, /pdfs/one-page.pdf");
  });

  it("does not accept a directory in place of a page's index.html", () => {
    fs.rmSync(path.join(dist, "papers/index.html"));
    expect(findMissingSmokeRoutes(dist).map((m) => m.route)).toEqual(["/papers/"]);
  });

  it("exits 2 when the output directory does not exist", () => {
    const run = runCheck(path.join(dist, "absent"));
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("no build output");
  });
});
