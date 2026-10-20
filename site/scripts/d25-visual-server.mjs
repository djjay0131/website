// A LOCAL SIMULATION OF THE GATE, FOR THE D25 VISUAL CHECK.
//
// It is not used in production and holds no private value of its own. It reads
// the built `_hub/catalog.json` and a policy document supplied by the caller,
// applies the same item -> source -> section -> default join as gate/app/access.py,
// and serves dist-private. That is enough to render the Projects landing, a
// project section and a sub-page as different principals without minting a
// Firebase session.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
};

const SHARED_PREFIXES = ["_astro/", "emblem/", "badges/"];
const MEMBER_PAGES = new Set([
  "index.html",
  "projects/index.html",
  "calendar/index.html",
  "shares/index.html",
  "notes/index.html",
]);
const SHARED_FILES = new Set(["favicon.ico", "favicon.svg"]);

function allows(rule, profile) {
  if (!rule) return false;
  if (profile.role === "owner") return true;
  if (profile.role && (rule.roles ?? []).includes(profile.role)) return true;
  return (rule.groups ?? []).some((group) => (profile.groups ?? []).includes(group));
}

export function createVisualServer({
  distDir,
  catalogPath,
  policyPath,
  principals,
  notFoundPath,
  calendarPath = null,
  ownerCalendarPath = null,
  port = 0,
}) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const notFound = fs.readFileSync(notFoundPath, "utf8");
  const readEvents = (file) => {
    if (!file) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(raw) ? raw : raw.events ?? [];
  };
  const satelliteEvents = readEvents(calendarPath);
  const ownerEvents = readEvents(ownerCalendarPath);
  const byCookie = new Map(principals.map((principal) => [principal.id, principal]));

  const allowedItem = (profile, key) => {
    const item = catalog.items[key];
    if (!item) return false;
    if (profile.role === "owner") return true;
    if (item.visibility === "public") return true;
    return allows(
      policy.items?.[key] ?? policy.sources?.[item.source] ?? policy.sections?.[item.section] ?? policy.default,
      profile,
    );
  };

  const allowedProject = (profile, source) => {
    if (profile.role === "owner") return true;
    return Object.entries(catalog.items).some(
      ([key, item]) => item.source === source && allowedItem(profile, key),
    );
  };

  const allowedObject = (profile, relative) => {
    if (profile.role === "owner") return true;
    if (
      MEMBER_PAGES.has(relative) ||
      SHARED_FILES.has(relative) ||
      SHARED_PREFIXES.some((prefix) => relative.startsWith(prefix))
    ) {
      return true;
    }
    const keys = catalog.objects[relative] ?? [];
    return keys.some((key) => allowedItem(profile, key));
  };

  const serveIndex = (relative) => (relative === "" || relative.endsWith("/") ? `${relative}index.html` : relative);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const cookies = Object.fromEntries(
      (req.headers.cookie ?? "")
        .split(/;\s*/)
        .filter(Boolean)
        .map((pair) => {
          const at = pair.indexOf("=");
          return [pair.slice(0, at), decodeURIComponent(pair.slice(at + 1))];
        }),
    );
    const principal = byCookie.get(cookies.d25);
    const denied = () => {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(notFound);
    };

    if (url.pathname === "/private/items") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const items = Object.entries(catalog.items)
        .filter(([key]) => allowedItem(principal, key))
        .map(([, item]) => item);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ items }));
      return;
    }

    if (url.pathname === "/private/calendar") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const events = [...satelliteEvents, ...ownerEvents].filter(
        (event) =>
          principal.role === "owner" || (event.project && allowedProject(principal, event.project)),
      );
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ events }));
      return;
    }

    if (!url.pathname.startsWith("/p/")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    if (!principal) {
      denied();
      return;
    }

    const relative = decodeURIComponent(url.pathname.slice(3));
    const object = serveIndex(relative);
    if (!allowedObject(principal, object)) {
      denied();
      return;
    }

    const file = path.resolve(distDir, object);
    if (!file.startsWith(path.resolve(distDir) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      denied();
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}
