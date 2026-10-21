// D26 VISUAL CHECK (Playwright): calendar for owner, committee-only, project-team
// and signed-out. Synthetic events only; the same templates and access join as
// the production gate.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createVisualServer } from "./d25-visual-server.mjs";

const root = process.cwd();
const distPrivate = path.resolve(root, "dist-private");
const outDir = path.resolve(process.env.D26_SCREENSHOTS ?? "/tmp/d26-screenshots");
const principalsPath = process.env.D25_PRINCIPALS;
const policyPath = process.env.D25_POLICY;
if (!principalsPath || !policyPath) {
  console.error("D25_PRINCIPALS and D25_POLICY are required");
  process.exit(2);
}
const principals = JSON.parse(fs.readFileSync(principalsPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const ownerEventsPath = path.join(outDir, "owner-events.json");
fs.writeFileSync(
  ownerEventsPath,
  `${JSON.stringify(
    [
      {
        id: "owner:personal-milestone",
        project: null,
        title: "Owner-only personal milestone",
        kind: "milestone",
        start: "2026-12-01",
        all_day: true,
        timezone: "UTC",
        status: "active",
      },
    ],
    null,
    2,
  )}\n`,
);

const { server, port } = await createVisualServer({
  distDir: distPrivate,
  catalogPath: path.join(distPrivate, "_hub", "catalog.json"),
  policyPath,
  principals: principals.map((p) => ({
    id: p.id,
    label: p.label,
    role: p.role ?? "member",
    groups: p.groups ?? [],
  })),
  notFoundPath: path.resolve(root, "dist-public/404.html"),
  calendarPath: path.join(distPrivate, "_hub", "calendar.json"),
  ownerCalendarPath: ownerEventsPath,
});
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});

let failures = 0;
const results = [];
const check = (condition, message, principal) => {
  results.push({ principal, check: message, result: condition ? "PASS" : "FAIL" });
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${principal}] ${message}`);
  }
};

for (const principal of principals) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  if (!principal.signedOut) await context.addCookies([{ name: "d25", value: principal.id, url: base }]);
  const page = await context.newPage();
  const response = await page.goto(`${base}/p/calendar/`, { waitUntil: "networkidle" });

  if (principal.signedOut) {
    check((response?.status() ?? 0) === 404, "signed-out calendar is a styled 404", principal.label);
    check((await page.locator(".site-band").count()) > 0, "signed-out 404 keeps the site header", principal.label);
    check((await page.locator(".calendar-root").count()) === 0, "signed-out page has no calendar", principal.label);
    check(!(await page.content()).includes("github.com/example/"), "signed-out page carries no repository link", principal.label);
    await page.screenshot({ path: path.join(outDir, `${principal.id}-calendar-404.png`), fullPage: true });
    await context.close();
    continue;
  }

  check((response?.status() ?? 0) === 200, "calendar returns 200", principal.label);
  check((await page.locator(".site-band").count()) > 0, "calendar has the site header", principal.label);
  check((await page.locator("iframe").count()) === 0, "calendar has no iframe", principal.label);
  check((await page.locator("table.calendar-grid").count()) > 0, "calendar renders a month grid", principal.label);
  check((await page.locator(".calendar-upcoming").count()) > 0, "calendar renders an upcoming strip", principal.label);
  check((await page.locator('.calendar-filter button[aria-pressed]').count()) > 0, "calendar has accessible filter chips", principal.label);
  await page.screenshot({ path: path.join(outDir, `${principal.id}-calendar-month.png`), fullPage: true });

  const eventIds = await page.evaluate(async () => {
    const result = await fetch("/private/calendar", { credentials: "same-origin" });
    return (await result.json()).events.map((event) => event.id);
  });
  const hasStudy = eventIds.some((id) => id.startsWith("visual-study:"));
  const hasOther = eventIds.some((id) => id.startsWith("visual-other:"));
  const hasOwnerOnly = eventIds.includes("owner:personal-milestone");
  if (principal.id === "committee") {
    check(hasOther && !hasStudy && !hasOwnerOnly, "committee sees only the project it may open", principal.label);
  } else if (principal.id === "project-team") {
    check(hasOther && hasStudy && !hasOwnerOnly, "project team sees its project, not owner-only events", principal.label);
  } else if (principal.id === "owner") {
    check(hasOther && hasStudy && hasOwnerOnly, "owner sees every event", principal.label);
  }

  // Agenda toggle.
  await page.getByRole("button", { name: "Agenda" }).click();
  check((await page.locator(".calendar-agenda-view").isVisible()), "agenda view opens", principal.label);
  await page.screenshot({ path: path.join(outDir, `${principal.id}-calendar-agenda.png`), fullPage: true });

  // Filter: selecting the project chip keeps only that project's events visible.
  const chip = page.locator('.calendar-filter button[aria-pressed]', { hasText: hasOther ? "visual-other" : "visual-study" }).first();
  if (await chip.count()) {
    await chip.click();
    const text = await page.locator(".calendar-root").innerText();
    const leaked = hasOther ? "Visual Study paper submission" : "Visual Other abstract";
    check(!text.includes(leaked), "project filter narrows the visible events", principal.label);
    check(page.url().includes("project="), "filter is persisted in the URL", principal.label);
  }

  if (principal.expectSource) {
    const pageResponse = await page.goto(`${base}/p/projects/${principal.expectSource}/`, { waitUntil: "networkidle" });
    check((pageResponse?.status() ?? 0) === 200, "project section still loads", principal.label);
    check(
      (await page.locator("[data-project-upcoming] .calendar-upcoming-item").count()) > 0,
      "project hub shows its own upcoming deadlines",
      principal.label,
    );
    const repoHref = `https://github.com/example/${principal.expectSource}`;
    check(
      (await page.locator(`.repository-link a[href="${repoHref}"]`).count()) === 1,
      "project hub shows the repository link",
      principal.label,
    );
    check(
      (await page.locator(".repository-link-note").innerText()).includes("Requires GitHub access"),
      "repository link carries the access note",
      principal.label,
    );
    await page.screenshot({ path: path.join(outDir, `${principal.id}-project-hub.png`), fullPage: true });

    const projectPageHref = page.locator(".project-page-card a").first();
    if (await projectPageHref.count()) {
      await projectPageHref.click();
      await page.waitForLoadState("networkidle");
      check(
        (await page.locator("[data-project-upcoming] .calendar-upcoming-item").count()) > 0,
        "project section shows its own upcoming deadlines",
        principal.label,
      );
      check(
        (await page.locator(`.repository-link a[href="${repoHref}"]`).count()) === 1,
        "project sub-page keeps the repository link",
        principal.label,
      );
      await page.screenshot({ path: path.join(outDir, `${principal.id}-project-upcoming.png`), fullPage: true });
    }
  }

  await context.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`D26 visual check: ${results.length - failures} passed, ${failures} failed`);
if (failures) process.exit(1);
