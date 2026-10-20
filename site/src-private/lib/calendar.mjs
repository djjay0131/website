// THE PRIVATE CALENDAR'S SATELLITE EVENTS (D26 / ADR-0027).
//
// A satellite MAY publish an optional `deadlines[]` array (manifest envelope
// version 2). The hub derives the project from the source key, validates and
// sanitises the event, and writes `_hub/calendar.json` into the private bucket.
// The gate joins that file with Firestore owner events and the Firestore access
// policy; nothing here decides who may read an event.
//
// Satellites 1-6 publish no deadlines and stay valid unchanged.
import fs from "node:fs";
import path from "node:path";

export const CALENDAR_OBJECT = "_hub/calendar.json";
export const CALENDAR_VERSION = 1;
export const EVENT_KINDS = [
  "submission",
  "abstract",
  "notification",
  "camera-ready",
  "conference",
  "milestone",
  "work",
];
export const EVENT_STATUSES = ["active", "done", "cancelled"];

// A timed value must carry an explicit offset (or Z); a date-only value has no
// time. The extra check below also rejects an impossible calendar date whose
// shape matches, such as 2026-02-31.
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
const TIMEZONE = /^[A-Za-z][A-Za-z0-9_+/-]{0,63}$/;
const URL = /^https:\/\/[^\s]+$/;

function validDate(value) {
  if (!DATE.test(value)) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return false;
  if (!value.includes("T")) return true;
  return !Number.isNaN(new Date(value).getTime());
}

/** Strip markup and control characters from a satellite string. */
export function plainText(value, max) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function optionalText(value, max) {
  const text = plainText(value, max);
  return text || undefined;
}

function sanitiseUrl(value) {
  const text = String(value ?? "").trim();
  return URL.test(text) ? text : undefined;
}

/**
 * Normalise one manifest deadline into the calendar event shape.
 * Returns null for a malformed entry; the contract already rejects malformed
 * manifests at publish time, so this is defence in depth for a stale bucket.
 */
export function normaliseDeadline(source, deadline, index = 0) {
  if (!deadline || typeof deadline !== "object") return null;
  const id = plainText(deadline.id, 64);
  const title = plainText(deadline.title, 200);
  const start = String(deadline.start ?? "").trim();
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !title || !validDate(start)) return null;
  if (!EVENT_KINDS.includes(deadline.kind)) return null;
  const end = deadline.end === undefined ? undefined : String(deadline.end).trim();
  if (end !== undefined && !validDate(end)) return null;
  const status = deadline.status === undefined ? "active" : String(deadline.status);
  if (!EVENT_STATUSES.includes(status)) return null;
  const allDay =
    typeof deadline.all_day === "boolean" ? deadline.all_day : !start.includes("T");
  const zone = optionalText(deadline.timezone, 64) ?? "UTC";
  const timezone = TIMEZONE.test(zone) ? zone : "UTC";
  return {
    id: `${source}:${id}`,
    project: source,
    title,
    kind: deadline.kind,
    start,
    ...(end ? { end } : {}),
    all_day: allDay,
    timezone,
    ...(optionalText(deadline.conference, 120)
      ? { conference: optionalText(deadline.conference, 120) }
      : {}),
    ...(sanitiseUrl(deadline.url) ? { url: sanitiseUrl(deadline.url) } : {}),
    ...(optionalText(deadline.notes, 2000) ? { notes: optionalText(deadline.notes, 2000) } : {}),
    status,
  };
}

/** Every source manifest's deadlines, merged into one private calendar. */
export function buildCalendar(options = {}) {
  const sourcesDir = path.resolve(options.sourcesDir ?? "src/content/sources");
  const events = [];
  if (fs.existsSync(sourcesDir)) {
    for (const name of fs.readdirSync(sourcesDir).sort()) {
      const dir = path.join(sourcesDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
      } catch {
        continue;
      }
      // The DIRECTORY is the assigned bucket prefix and therefore the project
      // identity. A manifest that names a different source is refused rather
      // than trusted: otherwise an untrusted deadline could be filed under a
      // project whose members never published it.
      if (manifest?.source !== name) continue;
      if (!Array.isArray(manifest?.deadlines)) continue;
      manifest.deadlines.forEach((deadline, index) => {
        const event = normaliseDeadline(name, deadline, index);
        if (event) events.push(event);
      });
    }
  }
  return { version: CALENDAR_VERSION, events };
}
