import { describe, it, expect } from "vitest";
import { DEFAULT_SITE_URL, normalizeBase, normalizeSiteUrl, resolveSiteEnv, withBase } from "./site-env.mjs";
import { isExcludedFromSitemap } from "./site-routes.mjs";

describe("SEAM-1 environment", () => {
  it("defaults to https://jason.cusati.us at / (ADR-0006)", () => {
    expect(DEFAULT_SITE_URL).toBe("https://jason.cusati.us");
    expect(resolveSiteEnv({})).toEqual({ site: "https://jason.cusati.us", base: "/" });
    expect(resolveSiteEnv({ SITE_URL: "", SITE_BASE: "" })).toEqual({ site: "https://jason.cusati.us", base: "/" });
  });

  it("builds the GitHub Pages variant", () => {
    expect(resolveSiteEnv({ SITE_URL: "https://djjay0131.github.io", SITE_BASE: "/website/" })).toEqual({
      site: "https://djjay0131.github.io",
      base: "/website/",
    });
  });

  it("normalizes the base", () => {
    for (const b of ["website", "/website", "/website/", " /website// "]) expect(normalizeBase(b)).toBe("/website/");
    expect(normalizeBase("/")).toBe("/");
  });

  it("accepts an origin and rejects a URL with a path", () => {
    expect(normalizeSiteUrl("https://jason.cusati.us/")).toBe("https://jason.cusati.us");
    expect(() => normalizeSiteUrl("https://djjay0131.github.io/website")).toThrow(/SITE_BASE/);
    expect(() => normalizeSiteUrl("jason.cusati.us")).toThrow();
  });

  it("joins base and path", () => {
    expect(withBase("/", "research/")).toBe("/research/");
    expect(withBase("/website/", "/research/")).toBe("/website/research/");
  });

  it("keeps phd out of the sitemap under either base", () => {
    expect(isExcludedFromSitemap("https://jason.cusati.us/phd/", "/")).toBe(true);
    expect(isExcludedFromSitemap("https://djjay0131.github.io/website/phd/", "/website/")).toBe(true);
    expect(isExcludedFromSitemap("https://jason.cusati.us/research/", "/")).toBe(false);
    expect(isExcludedFromSitemap("https://jason.cusati.us/phdx/", "/")).toBe(false);
  });
});
