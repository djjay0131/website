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
  // D27: an in-memory annotation store so the screenshot test can exercise the
  // capture island (GET/POST/DELETE) as a simulated member. Synthetic only.
  const notes = [];
  const readJson = (req) =>
    new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) req.destroy();
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(body || "{}"));
        } catch {
          resolve(null);
        }
      });
    });

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

  const server = http.createServer(async (req, res) => {
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

    if (url.pathname === "/private/me") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const nav = [
        { label: "Calendar", href: "/p/calendar/" },
        { label: "Notes", href: "/p/notes/" },
      ];
      if (principal.role === "owner") nav.push({ label: "Admin", href: "/p/admin/" });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          member: true,
          owner: principal.role === "owner",
          projects_href: "/p/projects/",
          nav,
        }),
      );
      return;
    }

    if (url.pathname === "/annotations" && req.method === "GET") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const source = url.searchParams.get("source");
      const slug = url.searchParams.get("slug");
      const rows = notes.filter(
        (note) => (!source || note.source === source) && (!slug || note.slug === slug),
      );
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ notes: rows }));
      return;
    }

    if (url.pathname === "/annotations" && req.method === "POST") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const note = await readJson(req);
      if (!note || typeof note !== "object") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "bad_request" }));
        return;
      }
      const row = {
        id: `note-${notes.length + 1}`,
        ...note,
        created: "2026-10-21T00:00:00Z",
      };
      notes.unshift(row);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ id: row.id, created: true }));
      return;
    }

    if (url.pathname.startsWith("/annotations/") && req.method === "DELETE") {
      if (!principal) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      const id = decodeURIComponent(url.pathname.slice("/annotations/".length));
      const at = notes.findIndex((note) => note.id === id);
      if (at >= 0) notes.splice(at, 1);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ deleted: at >= 0 }));
      return;
    }

    if (url.pathname.startsWith("/admin/")) {
      const owner = principal?.role === "owner";
      if (!owner) {
        denied();
        return;
      }
      const json = (status, body) => {
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(body));
      };
      if (url.pathname === "/admin/members" && req.method === "GET") {
        json(200, {
          members: principals.map((row) => ({
            email: `${row.id}@example.invalid`,
            role: row.role,
            groups: row.groups ?? [],
          })),
        });
        return;
      }
      if (url.pathname === "/admin/policy" && req.method === "GET") {
        json(200, { policy });
        return;
      }
      if (url.pathname === "/admin/audit" && req.method === "GET") {
        json(200, {
          audit: [
            {
              at: "2026-10-20T12:00:00Z",
              by: "owner@example.invalid",
              action: "set_rule",
              target: "source:visual-study",
            },
          ],
        });
        return;
      }
      if (url.pathname === "/admin/sync" && req.method === "GET") {
        json(200, {
          status: "ok",
          built_at: "2026-10-20T12:00:00Z",
          commit: "a".repeat(40),
          run_id: "12345",
          run_url: "https://github.com/example/example/actions/runs/12345",
          commit_url: "https://github.com/example/example/commit/" + "a".repeat(40),
          projects: [
            { source: "visual-study", published: "2026-10-20T00:00:00Z", items: 3, private_items: 3, age_days: 1, stale: false },
            { source: "visual-other", published: "2026-09-01T00:00:00Z", items: 1, private_items: 1, age_days: 50, stale: true },
          ],
        });
        return;
      }
      if (url.pathname === "/admin/shares/demo-share" && req.method === "DELETE") {
        json(200, { status: "ok" });
        return;
      }
      denied();
      return;
    }

    if (url.pathname === "/share" && req.method === "GET") {
      if (principal?.role !== "owner") {
        denied();
        return;
      }
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          shares: [
            {
              id: "demo-share",
              section: "research",
              source: "visual-study",
              slug: "overview",
              entry: "overview.html",
              created_by: "owner@example.invalid",
              expires_at: "2026-11-20T00:00:00Z",
            },
          ],
        }),
      );
      return;
    }
    if (url.pathname === "/share" && req.method === "POST") {
      if (principal?.role !== "owner") {
        denied();
        return;
      }
      const body = await readJson(req);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          token: "demo-share-token-123",
          expires_at: "2026-11-20T00:00:00Z",
          url: "/s/demo-share-token-123/",
          entry: body?.entry,
        }),
      );
      return;
    }

    if (url.pathname.startsWith("/s/demo-share-token-123")) {
      // A synthetic recipient view for the screenshot. The production banner is
      // gate-generated; this mirrors its shape and names no real item.
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Shared fixture</title></head><body>
<div style="position:sticky;top:0;padding:.55rem 1rem;background:#861f41;color:#fff;text-align:center;font:500 .9rem/1.4 system-ui,sans-serif">Shared with you &middot; Shared by Jason &middot; expires 2026-11-20</div>
<h1 style="font-family:Georgia,serif;margin:2rem 1.5rem 0">Visual Study: overview</h1>
<p style="margin:.75rem 1.5rem 2rem;max-width:60ch">A synthetic shared page. Only this one page is visible to the recipient.</p>
</body></html>`);
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
