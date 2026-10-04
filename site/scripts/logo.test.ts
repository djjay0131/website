import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { contrastRatio, parseThemes } from "./contrast.mjs";

// D16 (2026-10-04): the emblem returns to the band and to og:image, and one
// owner-made badge is knowingly served on the home hero. These are SOURCE-LEVEL
// guards, deliberately not build-dependent, because CI's `npm test` (ci.yml:64,
// build.yml) runs before and independently of a build. The Dissenter's D-S1:
// before this file, all three surfaces could be reverted with `npm test` still
// green. Each assertion here has a matching way to go red (rename the alt or
// the file, repoint og:image, swap the emblem colours).
const siteRoot = path.resolve(".");
const read = (rel: string) => fs.readFileSync(path.join(siteRoot, rel), "utf8");

const BAND = "src/components/SiteBand.astro";
const HOME = "src/pages/index.astro";
const BASE = "src/layouts/Base.astro";
const MAP = "redirects/github-pages.json";

const BADGE = "public/badges/vt-badge-hokiebird-laptop-tower-research-today.png";
const BADGE_2X = "public/badges/vt-badge-hokiebird-laptop-tower-research-today-2x.png";
// The gate validates /p/{path} segment by segment; public files are copied into
// the private build too, so a filename outside this class fails the private
// build's SD-7 check (it caught `@2x`).
const GATE_SEGMENT = /^[A-Za-z0-9._-]+$/;

describe("D16 — the emblem is in the band, left of the wordmark", () => {
  const band = read(BAND);

  it("links the emblem svg with the exact alt text", () => {
    expect(band).toContain('class="band-emblem"');
    expect(band).toMatch(/<a class="band-emblem"\s+href=\{homeHref\}>/);
    expect(band).toContain("emblem/research-emblem.svg");
    expect(band).toContain('alt="Jason Cusati research emblem"');
  });

  it("keeps the band focus ring visible in both themes", () => {
    expect(band).toMatch(/\.site-band :focus-visible\s*\{[\s\S]*?outline-color:\s*var\(--color-on-band\)/);
  });

  it("renders the emblem at 40px inside a 44px hit target", () => {
    expect(band).toMatch(/width="40"/);
    expect(band).toMatch(/height="40"/);
    expect(band).toMatch(/\.band-emblem\s*\{[\s\S]*?width:\s*44px/);
    expect(band).toMatch(/\.band-emblem\s*\{[\s\S]*?height:\s*44px/);
  });

  it("puts the emblem before the wordmark in source order", () => {
    expect(band.indexOf("band-emblem")).toBeLessThan(band.indexOf("band-wordmark"));
  });
});

describe("D16 — the badge is the home hero where the portrait used to be", () => {
  const home = read(HOME);

  it("shows the badge with a 1x/2x srcset", () => {
    expect(home).toContain("badges/vt-badge-hokiebird-laptop-tower-research-today.png");
    expect(home).toContain("badges/vt-badge-hokiebird-laptop-tower-research-today-2x.png");
    expect(home).toMatch(/srcset=/);
    expect(home).toMatch(/class="identity-badge"/);
  });

  it("is the identity block's hero, not hidden", () => {
    expect(home).toMatch(/class="identity"[\s\S]*?class="identity-badge"/);
    expect(home).not.toMatch(/\.identity-badge\s*\{[^}]*display:\s*none/);
  });

  it("is not lazy-loaded (it is above the fold) and has descriptive alt text", () => {
    expect(home).not.toMatch(/class="identity-badge"[\s\S]*?loading="lazy"/);
    expect(home).toMatch(/class="identity-badge"[\s\S]*?alt="[^"]*HokieBird[^"]*"/);
  });

  it("commits both files, each under 150KB, with gate-servable names", () => {
    for (const file of [BADGE, BADGE_2X]) {
      const full = path.join(siteRoot, file);
      expect(fs.existsSync(full), file).toBe(true);
      expect(fs.statSync(full).size, file).toBeLessThan(150 * 1024);
      for (const segment of file.replace(/^public\//, "").split("/")) {
        expect(segment, file).toMatch(GATE_SEGMENT);
      }
    }
  });

  it("covers both files in the committed redirect map", () => {
    const map: { from: string; to: string }[] = JSON.parse(read(MAP));
    for (const file of [BADGE, BADGE_2X]) {
      const route = `/${file.replace(/^public\//, "")}`;
      expect(map).toContainEqual({ from: `/website${route}`, to: route });
    }
  });
});

describe("D16 — the default og:image is the emblem, not the generated card", () => {
  const base = read(BASE);

  it("falls back to research-emblem.png", () => {
    expect(base).toContain("emblem/research-emblem.png");
    expect(base).not.toContain("og-card.png");
  });

  it("ships the file the default points at", () => {
    expect(fs.existsSync(path.join(siteRoot, "public/emblem/research-emblem.png"))).toBe(true);
  });
});

describe("D16 — the emblem's visible rings meet AA non-text contrast on the band", () => {
  const emblem = read("public/emblem/research-emblem.svg");

  it("uses the burnt-orange ring and the white disc the band relies on", () => {
    // Tie the colours to the actual rings (r=188 orange, r=176 white disc), so
    // repainting the ring itself is caught, not only deleting a colour.
    expect(emblem).toMatch(/r="188"\s+fill="#e5751f"/);
    expect(emblem).toMatch(/r="176"\s+fill="#fbfbf8"/);
  });

  it("has those two at >= 3:1 against --color-band in the light theme", () => {
    const { light } = parseThemes(read("src/styles/tokens.css"));
    const band = light["color-band"];
    expect(band, "tokens.css must define --color-band").toBeTruthy();
    expect(contrastRatio("#e5751f", band)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#fbfbf8", band)).toBeGreaterThanOrEqual(3);
  });
});

// Built-output guards (Skeptic A/B/C/E). `npm test` runs before the builds in
// ci.yml, but build.yml runs it after them, so these fire as soon as a build is
// present — the same conditional pattern as wave-5-structure.test.ts.
const PUBLIC_INDEX = path.join(siteRoot, "dist-public/index.html");
const PRIVATE_INDEX = path.join(siteRoot, "dist-private/index.html");

describe.runIf(fs.existsSync(PUBLIC_INDEX))("built / carries the emblem and the badge", () => {
  it("has the linked emblem with its alt text", () => {
    const html = fs.readFileSync(PUBLIC_INDEX, "utf8");
    expect(html).toMatch(/class="band-emblem"[^>]*href="[^"]*"[^>]*>[\s\S]*?alt="Jason Cusati research emblem"/);
  });

  it("has og:image resolving to the emblem", () => {
    const html = fs.readFileSync(PUBLIC_INDEX, "utf8");
    expect(html).toMatch(/property="og:image" content="[^"]*emblem\/research-emblem\.png"/);
  });

  it("has the badge hero", () => {
    const html = fs.readFileSync(PUBLIC_INDEX, "utf8");
    expect(html).toContain("badges/vt-badge-hokiebird-laptop-tower-research-today.png");
  });
});

describe.runIf(fs.existsSync(PRIVATE_INDEX))("built /p/ carries the emblem but not the badge", () => {
  it("has the emblem with its alt text", () => {
    const html = fs.readFileSync(PRIVATE_INDEX, "utf8");
    expect(html).toContain('alt="Jason Cusati research emblem"');
  });

  it("does not carry the public home badge hero", () => {
    const html = fs.readFileSync(PRIVATE_INDEX, "utf8");
    expect(html).not.toContain("identity-badge");
  });
});
