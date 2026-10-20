// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  countdownLabel,
  eventInstant,
  filterEvents,
  monthGrid,
  mountCalendar,
  parseFilters,
  upcomingEvents,
  whenLabel,
} from "./calendar-ui.mjs";

const events = [
  {
    id: "a:paper",
    project: "source-a",
    title: "Paper submission",
    kind: "submission",
    start: "2026-10-23",
    all_day: true,
    timezone: "AoE",
    conference: "Conf A",
    status: "active",
  },
  {
    id: "b:review",
    project: "source-b",
    title: "Review meeting",
    kind: "work",
    start: "2026-10-24T15:00:00Z",
    all_day: false,
    timezone: "UTC",
    status: "active",
  },
  {
    id: "a:old",
    project: "source-a",
    title: "Old event",
    kind: "milestone",
    start: "2026-09-01",
    all_day: true,
    timezone: "UTC",
    status: "done",
  },
];

describe("the private calendar view model", () => {
  it("treats a date-only AoE deadline as the end of that day in UTC-12", () => {
    expect(eventInstant(events[0])?.toISOString()).toBe("2026-10-24T11:59:59.000Z");
    expect(whenLabel(events[0])).toContain("AoE");
    expect(whenLabel(events[0])).toContain("local");
  });

  it("filters by project and conference without widening the list", () => {
    expect(filterEvents(events, { projects: ["source-a"] }).map((event) => event.id)).toEqual([
      "a:paper",
      "a:old",
    ]);
    expect(filterEvents(events, { conferences: ["Conf A"] }).map((event) => event.id)).toEqual(["a:paper"]);
    expect(filterEvents(events, { projects: ["unknown"] })).toEqual([]);
  });

  it("round-trips URL filters and view", () => {
    const filters = parseFilters("?project=source-a,source-b&conference=Conf%20A&view=agenda");
    expect(filters).toMatchObject({
      projects: ["source-a", "source-b"],
      conferences: ["Conf A"],
      view: "agenda",
    });
  });

  it("orders upcoming active events and excludes done ones", () => {
    const next = upcomingEvents(events, new Date("2026-10-20T00:00:00Z"));
    expect(next.map((event) => event.id)).toEqual(["a:paper", "b:review"]);
    expect(countdownLabel(events[0], new Date("2026-10-20T00:00:00Z"))).toMatch(/d/);
  });

  it("builds a 6x7 month grid containing the event", () => {
    const week = monthGrid(new Date(Date.UTC(2026, 9, 1)), events);
    expect(week).toHaveLength(6);
    const days = week.flat();
    expect(days.find((day) => day.events.some((event) => event.id === "a:paper"))?.date.getUTCDate()).toBe(23);
  });
});

describe("the calendar DOM", () => {
  beforeEach(() => document.body.replaceChildren());

  it("renders filters, upcoming, month and agenda with accessible controls", () => {
    const root = document.createElement("div");
    mountCalendar({ root, events, now: new Date("2026-10-20T00:00:00Z"), initial: parseFilters("") });
    expect(root.querySelectorAll(".calendar-filter").length).toBe(2);
    expect(root.querySelectorAll(".calendar-chip[aria-pressed]").length).toBeGreaterThan(0);
    expect(root.querySelector(".calendar-upcoming")?.textContent).toContain("Paper submission");
    expect(root.querySelector("table.calendar-grid")).not.toBeNull();
    expect(root.querySelector(".calendar-agenda-view")?.hasAttribute("hidden")).toBe(true);
  });

  it("wires the agenda toggle and month navigation", () => {
    const root = document.createElement("div");
    document.body.append(root);
    mountCalendar({ root, events, now: new Date("2026-10-20T00:00:00Z"), initial: parseFilters("") });
    const header = root.querySelector(".calendar-month-header h2");
    const before = header?.textContent;
    root.querySelector<HTMLButtonElement>('button[aria-label="Next month"]')?.click();
    expect(root.querySelector(".calendar-month-header h2")?.textContent).not.toBe(before);
    const agenda = [...root.querySelectorAll("button")].find((button) => button.textContent === "Agenda");
    agenda?.click();
    expect(root.querySelector(".calendar-agenda-view")?.hasAttribute("hidden")).toBe(false);
  });
});
