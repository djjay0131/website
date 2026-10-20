import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCalendar, normaliseDeadline } from "./calendar.mjs";

const deadline = {
  id: "paper-submission",
  title: "Paper <script>alert(1)</script> submission",
  kind: "submission",
  start: "2026-10-23T23:59:00-12:00",
  all_day: false,
  timezone: "AoE",
  conference: "ExampleConf",
  url: "https://example.test/cfp",
  notes: "<b>Do not</b> miss it",
  status: "active",
};

describe("the private calendar's satellite events", () => {
  it("normalises a valid deadline and derives the project from the source", () => {
    const event = normaliseDeadline("source-a", deadline);
    expect(event).toMatchObject({
      id: "source-a:paper-submission",
      project: "source-a",
      kind: "submission",
      all_day: false,
      timezone: "AoE",
      conference: "ExampleConf",
      status: "active",
    });
    expect(event.title).not.toContain("<script");
    expect(event.notes).toBe("Do not miss it");
  });

  it("rejects malformed dates, kinds, URLs and statuses", () => {
    expect(normaliseDeadline("s", { ...deadline, start: "23/10/2026" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, start: "2026-02-31" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, start: "2026-10-23T09:00:00" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, kind: "deadline" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, status: "live" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, id: "Not A Slug" })).toBeNull();
    expect(normaliseDeadline("s", { ...deadline, url: "javascript:alert(1)" }).url).toBeUndefined();
  });

  it("defaults all_day for date-only events and keeps explicit datetime offsets", () => {
    expect(normaliseDeadline("s", { ...deadline, start: "2026-10-23", all_day: undefined }).all_day).toBe(true);
    expect(normaliseDeadline("s", deadline).start).toBe("2026-10-23T23:59:00-12:00");
  });

  it("merges deadlines from every manifest and ignores sources without them", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-"));
    fs.mkdirSync(path.join(root, "a"), { recursive: true });
    fs.mkdirSync(path.join(root, "b"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "a", "manifest.json"),
      JSON.stringify({ source: "a", manifest_version: "2", items: [], deadlines: [deadline] }),
    );
    fs.writeFileSync(
      path.join(root, "b", "manifest.json"),
      JSON.stringify({ source: "b", items: [] }),
    );
    // A manifest under directory `c` that claims to be project `a` must not be
    // able to file an event under `a`; the directory is the assigned prefix.
    fs.mkdirSync(path.join(root, "c"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "c", "manifest.json"),
      JSON.stringify({ source: "a", manifest_version: "2", items: [], deadlines: [deadline] }),
    );
    const calendar = buildCalendar({ sourcesDir: root });
    expect(calendar.version).toBe(1);
    expect(calendar.events).toHaveLength(1);
    expect(calendar.events[0].project).toBe("a");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
