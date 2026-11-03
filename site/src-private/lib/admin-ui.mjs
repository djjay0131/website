// D32 / ADR-0029: the owner administration island.
//
// The page is served ONLY by the gate's owner-checked /p/admin/ route. The API
// it calls is owner-checked again on every request, so hiding a control here is
// UX, not security. Every string from the API is written with textContent.
//
// No private value appears in this module: members, groups, source names and
// item keys all arrive from Firestore at request time.

export const ENDPOINTS = {
  members: "/admin/members",
  policy: "/admin/policy",
  audit: "/admin/audit",
  sync: "/admin/sync",
  shares: "/share",
};

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

async function api(path, options = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

function statusLine(container, message, kind = "note") {
  const node = el("p", {
    class: kind === "error" ? "admin-error" : "admin-note",
    role: kind === "error" ? "alert" : "status",
    text: message,
  });
  container.replaceChildren(node);
}

function groupsToText(groups) {
  return Array.isArray(groups) ? groups.join(", ") : "";
}

function textToGroups(text) {
  return String(text ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function derivedGroups(members) {
  const seen = new Map();
  for (const member of members) {
    for (const group of member.groups ?? []) {
      seen.set(group, (seen.get(group) ?? 0) + 1);
    }
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function syncState(project) {
  if (project.stale) return { label: "stale", kind: "warn" };
  return { label: "ok", kind: "ok" };
}

function renderMembers(container, members, refresh) {
  container.replaceChildren();
  const groups = derivedGroups(members);
  container.append(
    el("h2", { text: "Members & groups" }),
    el("p", {
      class: "admin-note",
      text: "Groups are derived from membership. A member's groups and role are saved together.",
    }),
  );

  if (groups.length) {
    const list = el("ul", { class: "admin-groups" });
    for (const [group, count] of groups) {
      list.append(el("li", { text: `${group} — ${count} member${count === 1 ? "" : "s"}` }));
    }
    container.append(list);
  }

  const table = el("table", { class: "admin-table" });
  table.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { text: "Member" }),
        el("th", { text: "Role" }),
        el("th", { text: "Groups" }),
        el("th", { text: "Actions" }),
      ),
    ),
  );
  const body = el("tbody");
  for (const member of members) {
    const role = el("select", { "aria-label": `Role for ${member.email}` });
    role.append(
      el("option", { value: "member", text: "member" }),
      el("option", { value: "owner", text: "owner" }),
    );
    role.value = member.role;
    const groupInput = el("input", {
      value: groupsToText(member.groups),
      "aria-label": `Groups for ${member.email}`,
      placeholder: "group-a, group-b",
    });
    const save = el("button", { type: "button", text: "Save" });
    save.addEventListener("click", async () => {
      save.disabled = true;
      const result = await api(`${ENDPOINTS.members}/${encodeURIComponent(member.email)}`, {
        method: "PATCH",
        body: JSON.stringify({ role: role.value, groups: textToGroups(groupInput.value) }),
      });
      save.disabled = false;
      if (!result.ok) {
        statusLine(container, result.body?.status ?? "Could not save the member.", "error");
        return;
      }
      await refresh();
    });
    const remove = el("button", { type: "button", class: "danger", text: "Remove" });
    remove.addEventListener("click", async () => {
      if (!globalThis.confirm?.(`Remove ${member.email}? This ends their access.`)) return;
      remove.disabled = true;
      const result = await api(`${ENDPOINTS.members}/${encodeURIComponent(member.email)}`, {
        method: "DELETE",
      });
      remove.disabled = false;
      if (!result.ok) {
        statusLine(container, result.body?.status ?? "Could not remove the member.", "error");
        return;
      }
      await refresh();
    });
    body.append(
      el(
        "tr",
        {},
        el("td", { text: member.email }),
        el("td", {}, role),
        el("td", {}, groupInput),
        el("td", { class: "admin-actions" }, save, remove),
      ),
    );
  }
  table.append(body);
  container.append(table);

  const form = el("form", { class: "admin-form" });
  form.append(el("h3", { text: "Add a member" }));
  const email = el("input", { type: "email", required: "required", placeholder: "member@example.org" });
  const role = el("select", {});
  role.append(el("option", { value: "member", text: "member" }), el("option", { value: "owner", text: "owner" }));
  const groupInput = el("input", { placeholder: "group-a, group-b" });
  const submit = el("button", { type: "submit", text: "Add member" });
  form.append(
    el("label", {}, "Email", email),
    el("label", {}, "Role", role),
    el("label", {}, "Groups", groupInput),
    submit,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const result = await api(ENDPOINTS.members, {
      method: "POST",
      body: JSON.stringify({
        email: email.value,
        role: role.value,
        groups: textToGroups(groupInput.value),
      }),
    });
    submit.disabled = false;
    if (!result.ok) {
      statusLine(container, result.body?.status ?? "Could not add the member.", "error");
      return;
    }
    await refresh();
  });
  container.append(form);
}

function ruleLabel(rule) {
  const groups = (rule?.groups ?? []).join(", ");
  const roles = (rule?.roles ?? []).join(", ");
  if (!groups && !roles) return "no one except the owner";
  return [groups && `groups: ${groups}`, roles && `roles: ${roles}`].filter(Boolean).join(" · ");
}

function renderPolicy(container, policy, refresh) {
  container.replaceChildren();
  container.append(
    el("h2", { text: "Access rules" }),
    el("p", {
      class: "admin-note",
      text: "Resolved item → source → section → default. The owner is always allowed.",
    }),
  );

  const list = el("ul", { class: "admin-rules" });
  const addRow = (label, rule, scope, name) => {
    const row = el("li");
    row.append(el("strong", { text: label }), el("span", { text: ` — ${ruleLabel(rule)}` }));
    if (scope !== "default" && name) {
      const remove = el("button", { type: "button", class: "danger", text: "Remove" });
      remove.addEventListener("click", async () => {
        if (!globalThis.confirm?.(`Remove the ${scope} rule for ${name}?`)) return;
        remove.disabled = true;
        const query = new URLSearchParams({ scope, name }).toString();
        const result = await api(`${ENDPOINTS.policy}/rule?${query}`, { method: "DELETE" });
        remove.disabled = false;
        if (!result.ok) {
          statusLine(container, result.body?.status ?? "Could not remove the rule.", "error");
          return;
        }
        await refresh();
      });
      row.append(" ", remove);
    }
    list.append(row);
  };
  addRow("default", policy.default, "default", null);
  for (const [name, rule] of Object.entries(policy.sections ?? {})) addRow(`section ${name}`, rule, "section", name);
  for (const [name, rule] of Object.entries(policy.sources ?? {})) addRow(`source ${name}`, rule, "source", name);
  for (const [name, rule] of Object.entries(policy.items ?? {})) addRow(`item ${name}`, rule, "item", name);
  container.append(list);

  const form = el("form", { class: "admin-form" });
  form.append(el("h3", { text: "Set a rule" }));
  const scope = el("select", {});
  for (const value of ["default", "section", "source", "item"]) {
    scope.append(el("option", { value, text: value }));
  }
  const name = el("input", { placeholder: "source-name, section-name or section/source/slug" });
  const groups = el("input", { placeholder: "group-a, group-b" });
  const roles = el("input", { placeholder: "member, owner" });
  const submit = el("button", { type: "submit", text: "Save rule" });
  form.append(
    el("label", {}, "Scope", scope),
    el("label", {}, "Name", name),
    el("label", {}, "Groups", groups),
    el("label", {}, "Roles", roles),
    submit,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const result = await api(`${ENDPOINTS.policy}/rule`, {
      method: "POST",
      body: JSON.stringify({
        scope: scope.value,
        name: scope.value === "default" ? null : name.value,
        groups: textToGroups(groups.value),
        roles: textToGroups(roles.value),
      }),
    });
    submit.disabled = false;
    if (!result.ok) {
      statusLine(container, result.body?.status ?? "Could not save the rule.", "error");
      return;
    }
    await refresh();
  });
  container.append(form);
}

function renderShares(container, shares, refresh) {
  container.replaceChildren();
  container.append(
    el("h2", { text: "Share links" }),
    el("p", {
      class: "admin-note",
      text: "Active links only. A link is a bearer credential for one page; creating one from that page is the shortest path.",
    }),
  );
  if (!shares.length) {
    container.append(el("p", { class: "admin-note", text: "No active share links." }));
    return;
  }
  const table = el("table", { class: "admin-table" });
  table.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { text: "Item" }),
        el("th", { text: "Created by" }),
        el("th", { text: "Expires" }),
        el("th", { text: "Actions" }),
      ),
    ),
  );
  const body = el("tbody");
  for (const share of shares) {
    const revoke = el("button", { type: "button", class: "danger", text: "Revoke" });
    revoke.addEventListener("click", async () => {
      if (!globalThis.confirm?.("Revoke this share link?")) return;
      revoke.disabled = true;
      const result = await api(`/admin/shares/${encodeURIComponent(share.id)}`, { method: "DELETE" });
      revoke.disabled = false;
      if (!result.ok) {
        statusLine(container, "Could not revoke that link.", "error");
        return;
      }
      await refresh();
    });
    body.append(
      el(
        "tr",
        {},
        el("td", { text: `${share.section}/${share.source}/${share.slug}` }),
        el("td", { text: share.created_by }),
        el("td", { text: share.expires_at }),
        el("td", { class: "admin-actions" }, revoke),
      ),
    );
  }
  table.append(body);
  container.append(table);
}

function renderSync(container, sync) {
  container.replaceChildren();
  container.append(el("h2", { text: "Sync status" }));
  if (sync.status !== "ok") {
    container.append(
      el("p", {
        class: "admin-error",
        role: "alert",
        text: `Publish status is ${sync.status}: ${sync.reason ?? "unknown"}.`,
      }),
    );
    return;
  }
  const build = el("p", { class: "admin-note" });
  build.append(
    el("span", { text: `Built ${sync.built_at ?? "unknown"}. ` }),
    sync.run_url ? el("a", { href: sync.run_url, text: "Open the run" }) : el("span", { text: "No run link." }),
    sync.commit_url ? el("span", { text: " · " }) : null,
    sync.commit_url ? el("a", { href: sync.commit_url, text: "Commit" }) : null,
  );
  container.append(build);

  const table = el("table", { class: "admin-table" });
  table.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { text: "Project" }),
        el("th", { text: "Last publish" }),
        el("th", { text: "Items" }),
        el("th", { text: "Status" }),
      ),
    ),
  );
  const body = el("tbody");
  for (const project of sync.projects ?? []) {
    const state = syncState(project);
    body.append(
      el(
        "tr",
        {},
        el("td", { text: project.source }),
        el("td", { text: `${project.published} (${project.age_days ?? "?"} days)` }),
        el("td", {
          text: `${project.items ?? "?"} item${project.items === 1 ? "" : "s"}${
            project.private_items === undefined ? "" : `, ${project.private_items} private`
          }`,
        }),
        el("td", {}, el("span", { class: `admin-pill ${state.kind}`, text: state.label })),
      ),
    );
  }
  table.append(body);
  container.append(table);
}

function renderAudit(container, rows) {
  container.replaceChildren();
  container.append(
    el("h2", { text: "Change log" }),
    el("p", { class: "admin-note", text: "Access, calendar and share actions, newest first." }),
  );
  if (!rows.length) {
    container.append(el("p", { class: "admin-note", text: "No changes recorded yet." }));
    return;
  }
  const table = el("table", { class: "admin-table" });
  table.append(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { text: "When" }),
        el("th", { text: "By" }),
        el("th", { text: "Action" }),
        el("th", { text: "Target" }),
      ),
    ),
  );
  const body = el("tbody");
  for (const row of rows) {
    body.append(
      el(
        "tr",
        {},
        el("td", { text: row.at ?? "" }),
        el("td", { text: row.by ?? "" }),
        el("td", { text: row.action ?? "" }),
        el("td", { text: row.target ?? "" }),
      ),
    );
  }
  table.append(body);
  container.append(table);
}

/**
 * Load and render every admin panel. A single failed endpoint is shown as an
 * inline error rather than blanking the page; the owner needs the rest.
 */
export async function mountAdmin(root, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const endpoints = deps.endpoints ?? ENDPOINTS;
  const panels = {
    members: root.querySelector("[data-admin-members]"),
    policy: root.querySelector("[data-admin-policy]"),
    shares: root.querySelector("[data-admin-shares]"),
    sync: root.querySelector("[data-admin-sync]"),
    audit: root.querySelector("[data-admin-audit]"),
  };
  const refresh = {
    members: async () => {
      const result = await api(endpoints.members, {}, fetchImpl);
      if (!panels.members) return;
      if (!result.ok || !Array.isArray(result.body?.members)) {
        statusLine(panels.members, "Could not load members.", "error");
        return;
      }
      renderMembers(panels.members, result.body.members, refresh.members);
    },
    policy: async () => {
      const result = await api(endpoints.policy, {}, fetchImpl);
      if (!panels.policy) return;
      if (!result.ok || !result.body?.policy) {
        statusLine(panels.policy, "Could not load the access policy.", "error");
        return;
      }
      renderPolicy(panels.policy, result.body.policy, refresh.policy);
    },
    shares: async () => {
      const result = await api(endpoints.shares, {}, fetchImpl);
      if (!panels.shares) return;
      if (!result.ok || !Array.isArray(result.body?.shares)) {
        statusLine(panels.shares, "Could not load share links.", "error");
        return;
      }
      renderShares(panels.shares, result.body.shares, refresh.shares);
    },
    sync: async () => {
      const result = await api(endpoints.sync, {}, fetchImpl);
      if (!panels.sync) return;
      if (!result.ok) {
        statusLine(panels.sync, "Could not load sync status.", "error");
        return;
      }
      renderSync(panels.sync, result.body);
    },
    audit: async () => {
      const result = await api(endpoints.audit, {}, fetchImpl);
      if (!panels.audit) return;
      if (!result.ok || !Array.isArray(result.body?.audit)) {
        statusLine(panels.audit, "Could not load the change log.", "error");
        return;
      }
      renderAudit(panels.audit, result.body.audit);
    },
  };
  await Promise.all(Object.values(refresh).map((fn) => fn()));
  return refresh;
}
