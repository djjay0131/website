import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildRedirectMap,
  findUncovered,
  inventoryRoutes,
  normalizeRoute,
  routesFromPagesDir,
  routesFromPublicDir,
} from "./route-inventory.mjs";
import { CI_PUBLIC_FILES, LEGACY_REDIRECTS, SMOKE_ROUTES } from "./site-routes.mjs";

const MAP_PATH = path.resolve("redirects/github-pages.json");
const BUILD_DIR = path.resolve("dist-public");

function touch(root: string, rel: string) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x");
}

describe("normalizeRoute", () => {
  it("gives pages a trailing slash and leaves files exact", () => {
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("cv/academic")).toBe("/cv/academic/");
    expect(normalizeRoute("/cv/academic/")).toBe("/cv/academic/");
    expect(normalizeRoute("/pdfs/academic.pdf")).toBe("/pdfs/academic.pdf");
    expect(normalizeRoute("//research//index/")).toBe("/research/index/");
  });
});

describe("route inventory of a build", () => {
  let dist: string;
  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "route-inventory-"));
    for (const f of [
      "index.html",
      "cv/index.html",
      "cv/academic/index.html",
      "cv/research-professional/index.html",
      "research/agentic-harnesses/index.html",
      "papers/index.html",
      "favicon.svg",
      "sitemap-index.xml",
      "_astro/spectral-latin-400-normal.abc123.woff2",
    ]) {
      touch(dist, f);
    }
  });
  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

  it("includes pages, files, CV PDFs, redirect sources, smoke routes and CI files, but not hashed assets", () => {
    const routes = inventoryRoutes({ distDir: dist });
    for (const r of ["/", "/cv/", "/cv/academic/", "/papers/", "/favicon.svg", "/sitemap-index.xml"]) {
      expect(routes).toContain(r);
    }
    expect(routes).toContain("/pdfs/academic.pdf");
    expect(routes).toContain("/pdfs/research-professional.pdf");
    expect(routes).not.toContain("/pdfs/index.pdf");
    for (const { from } of LEGACY_REDIRECTS) expect(routes).toContain(normalizeRoute(from));
    for (const r of SMOKE_ROUTES) expect(routes).toContain(normalizeRoute(r));
    for (const f of CI_PUBLIC_FILES) expect(routes).toContain(`/${f}`);
    expect(routes.some((r) => r.startsWith("/_astro/"))).toBe(false);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("maps every route from /website/<path> to /<path>", () => {
    const routes = inventoryRoutes({ distDir: dist });
    const map = buildRedirectMap(routes);
    expect(map).toHaveLength(routes.length);
    expect(map).toContainEqual({ from: "/website/", to: "/" });
    expect(map).toContainEqual({ from: "/website/cv/academic/", to: "/cv/academic/" });
    expect(map).toContainEqual({ from: "/website/pdfs/academic.pdf", to: "/pdfs/academic.pdf" });
    expect(findUncovered(map, routes)).toEqual([]);
  });

  it("reports a route the map misses or misdirects", () => {
    const routes = inventoryRoutes({ distDir: dist });
    const map = buildRedirectMap(routes);
    const dropped = map.filter((e) => e.to !== "/papers/");
    expect(findUncovered(dropped, routes)).toEqual(["/papers/"]);
    const wrong = map.map((e) => (e.to === "/cv/" ? { ...e, to: "/cv/academic/" } : e));
    expect(findUncovered(wrong, routes)).toEqual(["/cv/"]);
  });
});

describe("committed redirect map (redirects/github-pages.json)", () => {
  const map: { from: string; to: string }[] = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));

  it("is well formed: /website/<path> to /<path>, no duplicates", () => {
    expect(map.length).toBeGreaterThan(0);
    for (const e of map) expect(e.from).toBe(`/website${e.to}`);
    expect(new Set(map.map((e) => e.from)).size).toBe(map.length);
  });

  it("covers every static page, public file, redirect source, smoke route and CI file", () => {
    const routes = [
      ...routesFromPagesDir(path.resolve("src/pages")),
      ...routesFromPublicDir(path.resolve("public")),
      ...LEGACY_REDIRECTS.map((r) => r.from),
      ...SMOKE_ROUTES,
      ...CI_PUBLIC_FILES,
      "/sitemap-index.xml",
    ];
    expect(routes).toContain("/research/soa-agentic-se/agentic-memory/synthesis/");
    expect(findUncovered(map, routes)).toEqual([]);
  });

  // Opt-in: REDIRECT_MAP_CHECK_BUILD=1 npm test, after a build. The routes that
  // follow the CV data (/projects/<slug>/, /cv/<variant>/, /pdfs/<variant>.pdf)
  // change with each cv release, and CI runs npm test after a build has left
  // dist-public in place, so this must not run by default. Otherwise a new cv
  // project would fail the build and block both deploys.
  it.runIf(process.env.REDIRECT_MAP_CHECK_BUILD === "1")(
    "covers every route of the build in dist-public",
    () => {
      expect(fs.existsSync(path.join(BUILD_DIR, "index.html")), "run npm run build first").toBe(true);
      expect(findUncovered(map, inventoryRoutes({ distDir: BUILD_DIR }))).toEqual([]);
    },
  );
});
