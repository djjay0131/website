// D28-B VISUAL CHECK (Playwright): the pulled eBay project is visible to the
// owner and the eBay group only, renders inline in the Projects layout, and is a
// styled 404 for everyone else.
//
// Synthetic project content only. The repository link is synthetic via
// HUB_SATELLITE_REPOS in the workflow; the "source of truth" note is the real
// pulled-source note from site/pulled-sources.json.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createVisualServer } from "./d25-visual-server.mjs";

const root = process.cwd();
const distPrivate = path.resolve(root, "dist-private");
const outDir = path.resolve(process.env.D28_SCREENSHOTS ?? "/tmp/d28-screenshots");
const principalsPath = process.env.D25_PRINCIPALS;
const policyPath = process.env.D25_POLICY;
if (!principalsPath || !policyPath) {
  console.error("D25_PRINCIPALS and D25_POLICY are required");
  process.exit(2);
}
const principals = JSON.parse(fs.readFileSync(principalsPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

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
  notFoundPath: path.resolve(root, "dist-public/404.html"),
});
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});

const results = [];
let failures = 0;
const check = (condition, message, principal) => {
  results.push({ principal, check: message, result: condition ? "PASS" : "FAIL" });
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${principal}] ${message}`);
  }
};
const screenshot = (page, name) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });

for (const principal of principals) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  if (!principal.signedOut) await context.addCookies([{ name: "d25", value: principal.id, url: base }]);
  const page = await context.newPage();
  const allowed = !principal.signedOut && ["owner", "ebay-member"].includes(principal.id);

  const landing = await page.goto(`${base}/p/projects/`, { waitUntil: "networkidle" });
  const landingStatus = landing?.status() ?? 0;
  const content = await page.content();

  if (principal.signedOut) {
    check(landingStatus === 404, "signed-out Projects is a styled 404", principal.label);
    check((await page.locator(".site-band").count()) > 0, "signed-out 404 keeps the site header", principal.label);
    check(!content.includes("eBay eRUPT proposal"), "signed-out page names no eBay project", principal.label);
    await screenshot(page, `${principal.id}-signed-out-404`);
    await context.close();
    continue;
  }

  check(landingStatus === 200, "Projects landing returns 200", principal.label);
  const card = page.locator(".project-card", { hasText: "eBay eRUPT proposal" });
  check((await card.count()) === (allowed ? 1 : 0), allowed ? "eBay project card is visible" : "eBay project card is absent", principal.label);
  await screenshot(page, `${principal.id}-projects-landing`);

  const hub = await page.goto(`${base}/p/projects/ebay-erupt/`, { waitUntil: "networkidle" });
  const hubStatus = hub?.status() ?? 0;
  if (!allowed) {
    check(hubStatus === 404, "eBay project hub is a 404 for this member", principal.label);
    await screenshot(page, `${principal.id}-ebay-denied`);
    await context.close();
    continue;
  }

  check(hubStatus === 200, "eBay project hub returns 200", principal.label);
  check((await page.locator(".site-band").count()) > 0, "eBay project hub keeps the site header", principal.label);
  check((await page.locator(".breadcrumbs").count()) > 0, "eBay project hub has a breadcrumb", principal.label);
  check((await page.locator("iframe").count()) === 0, "eBay project hub has no iframe", principal.label);
  check((await page.locator("h1").first().innerText()).includes("eBay eRUPT proposal"), "project title is the owner-approved title", principal.label);
  check(
    (await page.locator('.repository-link a[href="https://github.com/example/ebay-erupt"]').count()) === 1,
    "project hub links to the pulled repository",
    principal.label,
  );
  check(
    (await page.locator(".repository-link-note").innerText()).includes("Source of truth"),
    "repository card names the source of truth and the refresh expectation",
    principal.label,
  );
  await screenshot(page, `${principal.id}-ebay-project-hub`);

  const item = await page.goto(`${base}/p/projects/ebay-erupt/erupt-proposal/`, { waitUntil: "networkidle" });
  check((item?.status() ?? 0) === 200, "eBay proposal sub-page returns 200", principal.label);
  check((await page.locator("[data-project-document]").count()) === 1, "pulled HTML renders inline", principal.label);
  check(
    (await page.locator("[data-project-document] script, [data-project-document] iframe").count()) === 0,
    "pulled HTML contains no script or iframe",
    principal.label,
  );
  check(
    (await page.locator("[data-project-document]").innerText()).includes("rendered inline"),
    "pulled proposal body is present",
    principal.label,
  );
  await screenshot(page, `${principal.id}-ebay-proposal`);

  await context.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`D28 visual check: ${results.length - failures} passed, ${failures} failed`);
if (failures) process.exit(1);
