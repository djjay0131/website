// D29 VISUAL CHECK (Playwright): a private PDF item renders inside the normal
// project layout with an inline viewer and a download link. Synthetic content
// only; the PDF is the committed one-page fixture.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createVisualServer } from "./d25-visual-server.mjs";

const root = process.cwd();
const distPrivate = path.resolve(root, "dist-private");
const outDir = path.resolve(process.env.D29_SCREENSHOTS ?? "/tmp/d29-screenshots");
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

const title = "Visual Study: submission paper";
const pagePath = "/p/projects/visual-study/submission-paper/";
const payloadPath = "/p/_payload/visual-study/site/paper.pdf";
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
  const allowed =
    !principal.signedOut &&
    (principal.role === "owner" || (principal.groups ?? []).includes("project-team"));

  const response = await page.goto(`${base}${pagePath}`, { waitUntil: "networkidle" });
  const status = response?.status() ?? 0;
  const content = await page.content();

  if (!allowed) {
    check(status === 404, "PDF page is a styled 404 for this principal", principal.label);
    check((await page.locator(".site-band").count()) > 0, "denial keeps the site header", principal.label);
    check(!content.includes(title), "denial names no PDF item", principal.label);
    const payload = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return { status: res.status };
    }, payloadPath);
    check(payload.status === 404, "PDF payload is a 404 for this principal", principal.label);
    await screenshot(page, `${principal.id}-pdf-denied`);
    await context.close();
    continue;
  }

  check(status === 200, "PDF page returns 200", principal.label);
  check((await page.locator(".site-band").count()) > 0, "PDF page keeps the site header", principal.label);
  check((await page.locator(".breadcrumbs").count()) > 0, "PDF page has a breadcrumb", principal.label);
  check((await page.locator(`h1:text-is("${title}")`).count()) === 1, "PDF page shows the item title", principal.label);
  check((await page.locator("iframe").count()) === 0, "PDF page uses no iframe", principal.label);

  const viewer = page.locator('object.project-pdf-viewer[type="application/pdf"]');
  check((await viewer.count()) === 1, "PDF page has an inline viewer", principal.label);
  check((await viewer.getAttribute("data")) === payloadPath, "viewer points at the gated PDF payload", principal.label);

  const download = page.locator('.project-pdf-actions a[download]').first();
  check((await download.count()) === 1, "PDF page offers a download link", principal.label);
  check((await download.getAttribute("href")) === payloadPath, "download link points at the gated PDF payload", principal.label);

  const payload = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: "same-origin" });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      type: res.headers.get("content-type") ?? "",
      magic: String.fromCharCode(...bytes.slice(0, 5)),
    };
  }, payloadPath);
  check(payload.status === 200, "the PDF payload is served to an allowed member", principal.label);
  check(payload.type.startsWith("application/pdf"), "the payload is served as application/pdf", principal.label);
  check(payload.magic === "%PDF-", "the payload is a PDF", principal.label);
  await screenshot(page, `${principal.id}-pdf-viewer`);
  await context.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`D29 visual check: ${results.length - failures} passed, ${failures} failed`);
if (failures) process.exit(1);
