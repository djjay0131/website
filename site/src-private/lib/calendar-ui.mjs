// THE PRIVATE CALENDAR'S VIEW MODEL AND DOM (D26 / ADR-0027).
//
// The gate returns only events for projects the viewer may open. Everything here
// is presentation: filters, month grid, agenda, upcoming strip, AoE/local time.
// A filter can only narrow the already-filtered list, so it cannot widen access.
//
// AoE is Anywhere on Earth (UTC-12). A date-only AoE deadline means the END of
// that calendar day in UTC-12, which is the next day at 11:59:59Z. The UI shows
// the AoE date plus the viewer's local equivalent; the countdown uses the same
// instant.

export const CALENDAR_ENDPOINT = "/private/calendar";
export const KINDS = [
  "submission",
  "abstract",
  "notification",
  "camera-ready",
  "conference",
  "milestone",
  "work",
];
const AOE_OFFSET_MS = 12 * 60 * 60 * 1000;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Load the viewer's calendar. A failure is an empty list, never a fallback. */
export async function loadCalendar(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  try {
    const response = await fetchImpl(CALENDAR_ENDPOINT, { credentials: "same-origin" });
    if (!response?.ok) return { ok: false, reason: "refused", events: [] };
    const body = await response.json();
    return { ok: true, events: Array.isArray(body?.events) ? body.events : [] };
  } catch {
    return { ok: false, reason: "unreachable", events: [] };
  }
}

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

/** The instant an event's start represents, including AoE's end-of-day rule. */
export function eventInstant(event) {
  const parts = dateParts(event?.start);
  if (!parts) return null;
  const hasTime = String(event.start).includes("T");
  if (hasTime) {
    const value = new Date(event.start);
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (event.timezone === "AoE" || event.timezone === "UTC-12") {
    return new Date(Date.UTC(parts.year, parts.month, parts.day + 1, 11, 59, 59));
  }
  return new Date(Date.UTC(parts.year, parts.month, parts.day, 23, 59, 59));
}

export function isPast(event, now = new Date()) {
  const end = event?.end ? eventInstant({ ...event, start: event.end }) : eventInstant(event);
  return end ? end.getTime() < now.getTime() : false;
}

export function isActive(event, now = new Date()) {
  return event?.status !== "done" && event?.status !== "cancelled" && !isPast(event, now);
}

/** AoE/local display for one event. */
export function whenLabel(event, locale = undefined) {
  const parts = dateParts(event?.start);
  if (!parts) return String(event?.start ?? "");
  const dateText = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(parts.year, parts.month, parts.day)));
  const zone = event.timezone || "UTC";
  const instant = eventInstant(event);
  if (zone === "AoE") {
    // AoE keeps its own date, and the viewer sees the same instant in the
    // browser's local zone. A date-only AoE deadline ends at 23:59:59 UTC-12,
    // so the local equivalent is often the next calendar day.
    if (!instant) return `${dateText} · AoE`;
    const local = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(instant);
    return `${dateText} · AoE (${local} local)`;
  }
  if (event.all_day) return `${dateText} · ${zone}`;
  if (!instant) return dateText;
  const local = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
  return zone === "UTC" ? `${dateText} · ${local}` : `${dateText} · ${local} (${zone})`;
}

export function shortKind(kind) {
  return String(kind ?? "").replace(/-/g, " ");
}

/** Human countdown from now to an event's start. */
export function countdownLabel(event, now = new Date()) {
  const instant = eventInstant(event);
  if (!instant) return "";
  const ms = instant.getTime() - now.getTime();
  if (ms < 0) return "past";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function parseFilters(search = "") {
  const params = new URLSearchParams(search);
  const list = (name) =>
    (params.get(name) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  return {
    projects: list("project"),
    conferences: list("conference"),
    view: params.get("view") === "agenda" ? "agenda" : "month",
  };
}

export function filtersToSearch(filters, month) {
  const params = new URLSearchParams();
  if (filters.projects?.length) params.set("project", filters.projects.join(","));
  if (filters.conferences?.length) params.set("conference", filters.conferences.join(","));
  if (filters.view === "agenda") params.set("view", "agenda");
  if (month) params.set("month", `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Narrow the gate-filtered list. Filters never expand it. */
export function filterEvents(events, filters = {}) {
  const projects = new Set(filters.projects ?? []);
  const conferences = new Set(filters.conferences ?? []);
  return (events ?? []).filter((event) => {
    if (projects.size && !projects.has(event.project)) return false;
    if (conferences.size && !conferences.has(event.conference)) return false;
    return true;
  });
}

export function upcomingEvents(events, now = new Date(), limit = 5) {
  return (events ?? [])
    .filter((event) => isActive(event, now))
    .sort((a, b) => (eventInstant(a)?.getTime() ?? 0) - (eventInstant(b)?.getTime() ?? 0))
    .slice(0, limit);
}

export function monthKey(event) {
  const parts = dateParts(event?.start);
  return parts ? `${parts.year}-${String(parts.month + 1).padStart(2, "0")}` : "";
}

export function eventDay(event) {
  const parts = dateParts(event?.start);
  return parts ? parts.day : null;
}

/** A 6x7 month grid, Monday-first, with the events that start on each day. */
export function monthGrid(month, events) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, monthIndex, 1 - offset));
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start.getTime() + (week * 7 + day) * 86400000);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      days.push({
        date,
        inMonth: date.getUTCMonth() === monthIndex,
        events: events.filter((event) => monthKey(event) === key.slice(0, 7) && eventDay(event) === date.getUTCDate()),
      });
    }
    weeks.push(days);
  }
  return weeks;
}

export function monthLabel(month) {
  return `${MONTHS[month.getUTCMonth()]} ${month.getUTCFullYear()}`;
}

export function filterOptions(events) {
  const projects = new Map();
  const conferences = new Set();
  for (const event of events ?? []) {
    if (event.project) projects.set(event.project, event.project);
    if (event.conference) conferences.add(event.conference);
  }
  return {
    projects: [...projects.values()].sort(),
    conferences: [...conferences].sort(),
  };
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (typeof value === "function" && key.startsWith("on")) {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function eventChip(event, now) {
  const classes = ["calendar-event", `kind-${event.kind}`];
  if (event.status === "done" || event.status === "cancelled") classes.push("is-done");
  else if (isPast(event, now)) classes.push("is-past");
  const item = el("li", { class: classes.join(" ") });
  const title = event.url
    ? el("a", { href: event.url, rel: "noopener noreferrer", target: "_blank", text: event.title })
    : el("span", { text: event.title });
  item.append(
    el("span", { class: "calendar-kind", text: shortKind(event.kind) }),
    title,
    el("span", { class: "calendar-when", text: whenLabel(event) }),
  );
  return item;
}

/** Mount the full calendar UI. `events` is already access-filtered. */
export function mountCalendar({ root, events, now = new Date(), initial = parseFilters(location.search) }) {
  let filters = { projects: [...initial.projects], conferences: [...initial.conferences] };
  let view = initial.view;
  let month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const controls = el("div", { class: "calendar-controls" });
  const upcoming = el("section", { class: "calendar-upcoming", "aria-labelledby": "calendar-upcoming-title" });
  const monthView = el("section", { class: "calendar-month-view", "aria-label": "Month view" });
  const agendaView = el("section", { class: "calendar-agenda-view", "aria-label": "Agenda view" });
  root.replaceChildren(controls, upcoming, monthView, agendaView);

  function updateUrl() {
    const search = filtersToSearch({ ...filters, view }, month);
    history.replaceState(null, "", `${location.pathname}${search}`);
  }

  function chipGroup(label, values, selected, onToggle, prefix) {
    const group = el("fieldset", { class: "calendar-filter" }, el("legend", { text: label }));
    for (const value of values) {
      const active = selected.has(value);
      const button = el("button", {
        type: "button",
        class: `calendar-chip${active ? " is-active" : ""}`,
        "aria-pressed": active ? "true" : "false",
        text: value,
      });
      button.addEventListener("click", () => {
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        onToggle();
      });
      group.append(button);
    }
    if (values.length === 0) group.append(el("p", { class: "calendar-note", text: `No ${label.toLowerCase()} yet.` }));
    return group;
  }

  function renderControls() {
    const options = filterOptions(events);
    const projectSet = new Set(filters.projects);
    const conferenceSet = new Set(filters.conferences);
    const viewGroup = el(
      "div",
      { class: "calendar-view-toggle", role: "group", "aria-label": "View" },
      el("button", {
        type: "button",
        class: `calendar-chip${view === "month" ? " is-active" : ""}`,
        "aria-pressed": view === "month" ? "true" : "false",
        text: "Month",
        onclick: () => {
          view = "month";
          updateUrl();
          render();
        },
      }),
      el("button", {
        type: "button",
        class: `calendar-chip${view === "agenda" ? " is-active" : ""}`,
        "aria-pressed": view === "agenda" ? "true" : "false",
        text: "Agenda",
        onclick: () => {
          view = "agenda";
          updateUrl();
          render();
        },
      }),
    );
    controls.replaceChildren(
      el(
        "div",
        { class: "calendar-filters", role: "group", "aria-label": "Filters" },
        chipGroup("Projects", options.projects, projectSet, () => {
          filters.projects = [...projectSet];
          updateUrl();
          render();
        }),
        chipGroup("Conferences", options.conferences, conferenceSet, () => {
          filters.conferences = [...conferenceSet];
          updateUrl();
          render();
        }),
      ),
      viewGroup,
    );
  }

  function renderUpcoming(filtered) {
    const next = upcomingEvents(filtered, now, 5);
    upcoming.replaceChildren();
    upcoming.append(el("h2", { id: "calendar-upcoming-title", text: "Upcoming" }));
    if (next.length === 0) {
      upcoming.append(el("p", { class: "calendar-note", text: "No upcoming deadlines for this selection." }));
      return;
    }
    const list = el("ul", { class: "calendar-upcoming-list" });
    for (const event of next) {
      list.append(
        el(
          "li",
          { class: "calendar-upcoming-item" },
          el("span", { class: "calendar-countdown", text: countdownLabel(event, now) }),
          el("span", { class: "calendar-kind", text: shortKind(event.kind) }),
          el("span", { class: "calendar-upcoming-title", text: event.title }),
          el("span", { class: "calendar-when", text: whenLabel(event) }),
        ),
      );
    }
    upcoming.append(list);
  }

  function renderMonth(filtered) {
    monthView.hidden = view !== "month";
    monthView.replaceChildren();
    if (view !== "month") return;
    const header = el(
      "div",
      { class: "calendar-month-header" },
      el("button", {
        type: "button",
        class: "calendar-chip",
        "aria-label": "Previous month",
        text: "‹",
        onclick: () => {
          month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
          updateUrl();
          render();
        },
      }),
      el("h2", { text: monthLabel(month) }),
      el("button", {
        type: "button",
        class: "calendar-chip",
        "aria-label": "Next month",
        text: "›",
        onclick: () => {
          month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
          updateUrl();
          render();
        },
      }),
    );
    const table = el("table", { class: "calendar-grid" });
    table.append(
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          ...["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) =>
            el("th", { scope: "col", text: day }),
          ),
        ),
      ),
    );
    const body = el("tbody");
    for (const week of monthGrid(month, filtered)) {
      const row = el("tr");
      for (const day of week) {
        const cell = el("td", { class: day.inMonth ? "" : "is-outside" });
        cell.append(el("span", { class: "calendar-day", text: String(day.date.getUTCDate()) }));
        if (day.events.length) {
          const list = el("ul", { class: "calendar-day-events" });
          for (const event of day.events) list.append(eventChip(event, now));
          cell.append(list);
        }
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    monthView.append(header, table);
  }

  function renderAgenda(filtered) {
    agendaView.hidden = view !== "agenda";
    agendaView.replaceChildren();
    if (view !== "agenda") return;
    const groups = new Map();
    for (const event of [...filtered].sort(
      (a, b) => (eventInstant(a)?.getTime() ?? 0) - (eventInstant(b)?.getTime() ?? 0),
    )) {
      const key = event.start.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }
    if (groups.size === 0) {
      agendaView.append(el("p", { class: "calendar-note", text: "No events match this selection." }));
      return;
    }
    for (const [key, rows] of groups) {
      const section = el("section", { class: "calendar-agenda-month" });
      const [year, monthNumber] = key.split("-");
      section.append(el("h2", { text: `${MONTHS[Number(monthNumber) - 1]} ${year}` }));
      const list = el("ul", { class: "calendar-agenda-list" });
      for (const event of rows) list.append(eventChip(event, now));
      section.append(list);
      agendaView.append(section);
    }
  }

  function render() {
    const filtered = filterEvents(events, filters);
    renderControls();
    renderUpcoming(filtered);
    renderMonth(filtered);
    renderAgenda(filtered);
    updateUrl();
  }

  render();
  return { render, get filters() { return { ...filters, view }; } };
}

/** A compact upcoming strip for one project section. */
export function mountProjectUpcoming(root, events, source, now = new Date(), limit = 4) {
  const next = upcomingEvents(
    (events ?? []).filter((event) => event.project === source),
    now,
    limit,
  );
  root.replaceChildren();
  root.append(el("h2", { class: "project-upcoming-title", text: "Upcoming deadlines" }));
  if (next.length === 0) {
    root.append(el("p", { class: "calendar-note", text: "No upcoming deadlines for this project." }));
    return;
  }
  const list = el("ul", { class: "calendar-upcoming-list" });
  for (const event of next) {
    list.append(
      el(
        "li",
        { class: "calendar-upcoming-item" },
        el("span", { class: "calendar-countdown", text: countdownLabel(event, now) }),
        el("span", { class: "calendar-upcoming-title", text: event.title }),
        el("span", { class: "calendar-when", text: whenLabel(event) }),
      ),
    );
  }
  root.append(list);
}
