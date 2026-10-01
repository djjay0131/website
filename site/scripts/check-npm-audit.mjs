#!/usr/bin/env node
// DEPENDENCY-AUDIT REPORT (#56, #59).
//
//   node scripts/check-npm-audit.mjs [--report] [--json]
//
// Runs `npm audit --omit=dev --json` and compares it against the accepted set
// recorded in audit-baseline.json. Exit codes:
//
//   0  no NEW finding beyond the baseline (or --report, which never fails)
//   1  a new advisory beyond the baseline (without --report)
//   2  the audit could not run or could not be parsed
//
// WHY THIS IS NOT JUST `npm audit` IN A WORKFLOW. A dependency audit differs
// from every other guard in this repo: it goes red because the WORLD changed,
// not because someone changed the code. A new CVE in a transitive dependency
// turns an unrelated PR red without a commit, and the pressure is then to
// suppress it -- which is how audit suppressions accumulate until the audit
// means nothing. So CI runs it REPORT-ONLY today; the report makes recurrence
// visible (#59's "found by a human reading a checklist" was the gap), and the
// baseline makes "accepted" a written decision. Failing on a DELTA against the
// baseline is the graduation path, and `--report` is the switch that keeps this
// non-blocking until the owner chooses to make it blocking.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = path.join(SITE_ROOT, "audit-baseline.json");

/** The GHSA id inside an advisory URL, e.g. .../advisories/GHSA-xxxx-yyyy-zzzz. */
export function advisoryIdFromUrl(url) {
  const match = /\/(GHSA-[a-z0-9-]+)$/i.exec(String(url ?? ""));
  return match ? match[1] : null;
}

/** The unique advisories an `npm audit --json` report contains. */
export function collectAdvisories(audit) {
  const out = new Map();
  for (const [pkg, vuln] of Object.entries(audit?.vulnerabilities ?? {})) {
    for (const via of vuln?.via ?? []) {
      if (!via || typeof via !== "object") continue;
      const id = via.id ?? advisoryIdFromUrl(via.url) ?? (via.source ? `source-${via.source}` : null);
      if (!id) continue;
      if (!out.has(id)) {
        out.set(id, {
          id,
          package: via.name ?? pkg,
          severity: via.severity ?? vuln.severity ?? "unknown",
          title: via.title ?? via.url ?? "",
        });
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Split an audit report into the accepted advisories and the new ones. */
export function classify(audit, baseline) {
  const acceptedIds = new Set((baseline?.accepted ?? []).map((a) => a.id));
  const advisories = collectAdvisories(audit);
  return {
    advisories,
    known: advisories.filter((a) => acceptedIds.has(a.id)),
    novel: advisories.filter((a) => !acceptedIds.has(a.id)),
    counts: audit?.metadata?.vulnerabilities ?? {},
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const report = args.has("--report");
  const asJson = args.has("--json");

  const run = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  let audit;
  try {
    audit = JSON.parse(run.stdout);
  } catch {
    console.error("check-npm-audit: npm audit did not return JSON; it could not run.");
    console.error(run.stderr?.trim() || `exit ${run.status}`);
    process.exit(2);
  }

  let baseline = { accepted: [] };
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(`check-npm-audit: cannot read ${path.relative(process.cwd(), BASELINE_PATH)}`);
    process.exit(2);
  }

  const { advisories, known, novel, counts } = classify(audit, baseline);

  if (asJson) {
    console.log(JSON.stringify({ counts, known, novel }, null, 2));
  } else {
    const c = counts;
    console.log(
      `check-npm-audit: npm audit --omit=dev reports ` +
        `${c.critical ?? 0} critical, ${c.high ?? 0} high, ${c.moderate ?? 0} moderate, ` +
        `${c.low ?? 0} low.`,
    );
    console.log(
      `check-npm-audit: ${known.length} accepted advisory(ies) in the baseline, ` +
        `${novel.length} NEW.`,
    );
    for (const a of novel) {
      console.log(`  NEW  ${a.severity} ${a.id}  ${a.package}  ${a.title}`);
    }
    if (novel.length === 0) {
      console.log(
        "check-npm-audit: no advisory outside the recorded baseline. This guard is " +
          "REPORT-ONLY in CI (#59); a new finding is information, not yet a merge block.",
      );
    } else {
      console.log(
        "check-npm-audit: add each NEW advisory to site/audit-baseline.json with its reachability " +
          "reason, or bump the dependency. Accepting it silently is what the baseline exists to prevent.",
      );
    }
    console.log(
      `check-npm-audit: ${advisories.length} unique advisory(ies) total in this report.`,
    );
  }

  process.exit(report || novel.length === 0 ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
