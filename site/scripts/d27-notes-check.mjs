// D27 NOTE-COMPOSER CHECK (Playwright): a simulated member can select text,
// open the Comment composer, click the textarea, type and save a note.
//
// Runs against the local visual server and synthetic project content only. The
// before/after screenshots land in the CI artifact; no private value is used.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createVisualServer } from "./d25-visual-server.mjs";

const root = process.cwd();
const distPrivate = path.resolve(root, "dist-private");
const distPublic = path.resolve(root, "dist-public");
const outDir = path.resolve(process.env.D27_SCREENSHOTS ?? "/tmp/d27-screenshots");
const principalsPath = process.env.D25_PRINCIPALS;
const policyPath = process.env.D25_POLICY;
const source = process.env.D27_SOURCE ?? "visual-study";
const slug = process.env.D27_SLUG ?? "overview";
if (!principalsPath || !policyPath) {
  console.error("D25_PRINCIPALS and D25_POLICY are required");
  process.exit(2);
}
const principals = JSON.parse(fs.readFileSync(principalsPath, "utf8"));
const principal = principals.find((entry) => entry.id === "project-team");
if (!principal) {
  console.error("the principals file has no project-team principal");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await createVisualServer({
  distDir: distPrivate,
  catalogPath: path.join(distPrivate, "_hub", "catalog.json"),
  policyPath,
  principals: principals.map((entry) => ({
    id: entry.id,
    label: entry.label,
    role: entry.role ?? "member",
    groups: entry.groups ?? [],
  })),
  notFoundPath: path.resolve(distPublic, "404.html"),
  calendarPath: path.join(distPrivate, "_hub", "calendar.json"),
});
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await context.addCookies([{ name: "d25", value: principal.id, url: base }]);
const page = await context.newPage();

const results = [];
let failures = 0;
const check = (condition, message) => {
  results.push({ check: message, result: condition ? "PASS" : "FAIL" });
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
};

const response = await page.goto(`${base}/p/projects/${source}/${slug}/`, { waitUntil: "networkidle" });
check((response?.status() ?? 0) === 200, "project sub-page returns 200");
await page.waitForSelector("[data-annotation-island]", { state: "attached" });
await page.waitForFunction(() => {
  const root = document.querySelector("[data-annotation-island]");
  return root && root.hidden === false;
});

// Select a real range in the document (not the island chrome), then let the
// island's mouseup handler open the toolbar.
const selected = await page.evaluate(() => {
  const root = document.querySelector("[data-project-document]");
  if (!root) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    if (text.trim().length >= 20) {
      const range = document.createRange();
      const start = text.indexOf(text.trim());
      range.setStart(node, start);
      range.setEnd(node, Math.min(text.length, start + 20));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return true;
    }
  }
  return false;
});
check(selected, "the document exposes selectable text");
await page.waitForSelector("[data-annotation-toolbar]", { state: "visible", timeout: 5000 });
check(true, "selecting text opens the annotation toolbar");

await page.getByRole("button", { name: "Comment", exact: true }).click();
const textarea = page.locator("textarea.annotation-comment-input");
await textarea.waitFor({ state: "visible" });
check(true, "Comment opens the textarea composer");
await page.screenshot({ path: path.join(outDir, "note-composer-before.png"), fullPage: true });

await textarea.click();
const focused = await textarea.evaluate((node) => node === document.activeElement);
check(focused, "clicking the textarea focuses it");
await page.keyboard.type("D27 composer focus check");
const typed = await textarea.inputValue();
check(typed === "D27 composer focus check", "the member can type in the textarea");
await page.screenshot({ path: path.join(outDir, "note-composer-after.png"), fullPage: true });

await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForSelector(".annotation-toast", { state: "visible", timeout: 5000 });
check(true, "Save returns the confirmation toast");
await page.screenshot({ path: path.join(outDir, "note-saved.png"), fullPage: true });

const stored = await page.evaluate(async ({ source, slug }) => {
  const result = await fetch(`/annotations?source=${encodeURIComponent(source)}&slug=${encodeURIComponent(slug)}`, {
    credentials: "same-origin",
  });
  return result.ok ? (await result.json()).notes : [];
}, { source, slug });
check(
  stored.some((note) => note.comment === "D27 composer focus check"),
  "the note reached the annotation endpoint",
);

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`D27 notes check: ${results.length - failures} passed, ${failures} failed`);
if (failures) process.exit(1);
