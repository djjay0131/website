// HEADLESS VISUAL CHECK FOR D25 (Playwright, no browser download).
//
// Renders the Projects landing, a project section and one sub-page for each
// configured principal, asserts the structural promises (no iframe, site header,
// breadcrumb, sub-nav, correct projects per principal, signed-out styled 404),
// and saves screenshots for the PR artifact.
//
// Run against the LOCAL visual server in scripts/d25-visual-server.mjs. That
// server reads the real built catalog and a policy file, so the check never
// needs a live session and never commits private values.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createVisualServer } from "./d25-visual-server.mjs";
import { buildProjects, projectPageHref } from "../src-private/lib/projects.mjs";

const root = process.cwd();
const distPrivate = path.resolve(root, "dist-private");
const distPublic = path.resolve(root, "dist-public");
const outDir = path.resolve(process.env.D25_SCREENSHOTS ?? path.join(root, "d25-screenshots"));
const principalsPath = process.env.D25_PRINCIPALS;
const policyPath = process.env.D25_POLICY;
if (!principalsPath || !policyPath) {
  console.error("D25_PRINCIPALS and D25_POLICY are required (paths outside the repository)");
  process.exit(2);
}
const principals = JSON.parse(fs.readFileSync(principalsPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const notFoundPath = path.join(distPublic, "404.html");
const { server, port } = await createVisualServer({
  distDir: distPrivate,
  catalogPath: path.join(distPrivate, "_hub", "catalog.json"),
  policyPath,
  principals: principals.map((principal) => ({
    id: principal.id,
    label: principal.label,
    role: principal.role ?? "member",
    groups: principal.groups ?? [],
  })),
  notFoundPath,
});
const base = `http://127.0.0.1:${port}`;

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });

const results = [];
let failures = 0;
function check(condition, message, principal) {
  if (condition) {
    results.push({ principal, check: message, result: "PASS" });
  } else {
    failures += 1;
    results.push({ principal, check: message, result: "FAIL" });
    console.error(`FAIL [${principal}] ${message}`);
  }
}

async function screenshot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

for (const principal of principals) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (!principal.signedOut) {
    await context.addCookies([{ name: "d25", value: principal.id, url: base }]);
  }
  const page = await context.newPage();
  const landing = await page.goto(`${base}/p/projects/`, { waitUntil: "networkidle" });
  const landingStatus = landing?.status() ?? 0;

  if (principal.signedOut) {
    const html = await page.content();
    check(landingStatus === 404, "signed-out landing is a 404", principal.label);
    check(html.includes('class="site-band"'), "signed-out 404 keeps the styled site header", principal.label);
    check(!/<h1[^>]*>\s*Projects\s*<\/h1>/i.test(html), "signed-out 404 reveals no Projects heading", principal.label);
    await screenshot(page, `${principal.id}-signed-out-404`);
    await context.close();
    continue;
  }

  check(landingStatus === 200, "Projects landing returns 200", principal.label);
  check((await page.locator(".site-band").count()) > 0, "Projects landing has the site header", principal.label);
  check((await page.locator("iframe").count()) === 0, "Projects landing has no iframe", principal.label);
  const cards = page.locator(".project-card");
  const cardCount = await cards.count();
  check(cardCount > 0, "Projects landing shows at least one card", principal.label);
  check(cardCount !== 0, "Projects landing is cards, not a flat item list", principal.label);
  await screenshot(page, `${principal.id}-projects-landing`);

  const items = await page.evaluate(async () => {
    const response = await fetch("/private/items", { credentials: "same-origin" });
    return response.ok ? (await response.json()).items : [];
  });
  const projects = buildProjects(items);
  const project = projects.find((entry) => entry.source === principal.expectSource) ?? projects[0];

  if (principal.expectSources) {
    const sources = projects.map((entry) => entry.source).sort();
    check(
      JSON.stringify(sources) === JSON.stringify(principal.expectSources.slice().sort()),
      `project list is exactly ${principal.expectSources.join(", ")}`,
      principal.label,
    );
  }
  if (principal.forbidSource) {
    check(!projects.some((entry) => entry.source === principal.forbidSource), `cannot see ${principal.forbidSource}`, principal.label);
  }

  if (project) {
    const sectionResponse = await page.goto(`${base}/p/projects/${project.source}/`, { waitUntil: "networkidle" });
    check((sectionResponse?.status() ?? 0) === 200, "project section returns 200", principal.label);
    check((await page.locator(".site-band").count()) > 0, "project section has the site header", principal.label);
    check((await page.locator(".breadcrumbs").count()) > 0, "project section has a breadcrumb", principal.label);
    check((await page.locator("iframe").count()) === 0, "project section has no iframe", principal.label);
    check((await page.locator(".project-page-card").count()) > 0, "project section lists its pages", principal.label);
    await screenshot(page, `${principal.id}-project-section`);

    const firstPage =
      project.pages.find((entry) => ["html", "bundle", "md"].includes(entry.format)) ?? project.pages[0];
    const pageResponse = await page.goto(`${base}${projectPageHref(firstPage)}`, { waitUntil: "networkidle" });
    check((pageResponse?.status() ?? 0) === 200, "project sub-page returns 200", principal.label);
    check((await page.locator(".site-band").count()) > 0, "sub-page has the site header", principal.label);
    check((await page.locator(".breadcrumbs").count()) > 0, "sub-page has a breadcrumb", principal.label);
    check((await page.locator("[data-project-nav] a").count()) > 0, "sub-page has a project sub-nav", principal.label);
    check((await page.locator("iframe").count()) === 0, "sub-page has no iframe", principal.label);
    if (["html", "bundle", "md"].includes(firstPage.format)) {
      check((await page.locator("[data-project-document]").count()) > 0, "sub-page renders content inline", principal.label);
      check(
        (await page.locator("[data-project-document] script, [data-project-document] iframe").count()) === 0,
        "inline content contains no script or iframe",
        principal.label,
      );
    }
    await screenshot(page, `${principal.id}-project-page`);
  }

  await context.close();
}

await browser.close();
server.close();

fs.writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`D25 visual check: ${results.length - failures} passed, ${failures} failed`);
console.log(`screenshots: ${outDir}`);
if (failures > 0) process.exit(1);
