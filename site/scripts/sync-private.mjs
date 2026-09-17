#!/usr/bin/env node
// THE DESTRUCTIVE PRIVATE SYNC (ADR-0010 decision 5; SEAM-5; contract D4).
//
//   node scripts/sync-private.mjs --dest-dir DIR   [--apply]   (local, no cloud)
//   node scripts/sync-private.mjs --bucket NAME    [--apply]   (the private bucket)
//
// Syncs site/dist-private to the private bucket and DELETES destination objects
// the current build did not produce, so a withdrawn private item stops being
// READABLE rather than merely stopping being linked. The public output gets this
// for free because dist-public is redeployed wholesale; the private side is a
// sync, and a sync that only adds leaves a withdrawn dossier served at its old
// path to every member. That is a privacy failure wearing the costume of a stale
// page (ADR-0010 Rationale).
//
// ===========================================================================
// THIS IS THE SHARPEST TOOL IN THIS REPOSITORY.
// ===========================================================================
// It is the ONE place where a build defect can remove data (ADR-0010 Risks). A
// bug that produced an empty dist-private would otherwise delete the private
// area. So it refuses to run unless EVERY precondition below holds, and it is
// DRY-RUN BY DEFAULT: without --apply it reports exactly what it would do and
// changes nothing.
//
// PRECONDITIONS, in the order they are checked. Each one is a refusal, not a
// warning:
//
//   P1  dist-private exists and is a directory.
//   P2  It carries the build receipt (.hub-private-build.json) that the private
//       build writes at the very end of astro:build:done. THIS IS ADR-0010
//       DECISION 3'S GATE, made concrete: the receipt is written only after
//       every manifest validated, the expected-source check passed and the build
//       completed, so its presence is proof the build succeeded -- not an
//       assumption that it did. A half-written or failed build leaves no receipt
//       and cannot sync.
//   P3  The receipt says output "private". A receipt from the public build
//       cannot authorise a private sync.
//   P4  The receipt's file count matches what is actually on disk. This catches
//       a truncated or partially-copied output between build and sync.
//   P5  The build produced at least one private item, unless --allow-empty is
//       passed explicitly. An empty private area is a legitimate state -- every
//       item withdrawn -- but it is indistinguishable from a build defect, so it
//       requires a human to say so in the command line.
//   P6  THE DELETION CEILING (my answer to the contract's open question (b)).
//       If the sync would delete more than DEFAULT_MAX_DELETE_RATIO of the
//       objects currently at the destination, it STOPS and demands
//       --allow-prune-ratio. Withdrawing one dossier deletes a handful of
//       objects; a build defect deletes all of them. The two are trivially
//       distinguishable by proportion, and nothing else in this system
//       distinguishes them at all.
//
// Nothing here reads or writes a cloud resource unless --bucket is given AND
// --apply is passed. The local --dest-dir mode exists so the destructive
// behaviour can be exercised, and IS exercised by sync-private.test.ts, without
// any credential -- the private bucket does not exist yet.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OUTPUT_DIRS } from "./site-output.mjs";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The build receipt the private build writes at the root of dist-private. */
export const RECEIPT_NAME = ".hub-private-build.json";

/** Refuse to delete more than this share of the destination without a flag. */
export const DEFAULT_MAX_DELETE_RATIO = 0.34;

const API = "https://storage.googleapis.com/storage/v1";

export class PrivateSyncError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrivateSyncError";
  }
}

function walkFiles(dir, rel = "") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walkFiles(dir, child));
    else out.push(child);
  }
  return out;
}

/**
 * Check P1-P5 against a built private output.
 *
 * @param {string} sourceDir dist-private
 * @param {{allowEmpty?: boolean}} [options]
 * @returns {{receipt: object, files: string[]}}
 * @throws {PrivateSyncError} naming the precondition that failed
 */
export function assertBuildIsSyncable(sourceDir, options = {}) {
  // P1
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new PrivateSyncError(
      `P1 FAILED: there is no private build at ${sourceDir}. The destructive sync never runs ` +
        `against a missing output -- that is how "nothing was built" becomes "everything was ` +
        `deleted" (ADR-0010 decision 3).`,
    );
  }

  // P2
  const receiptPath = path.join(sourceDir, RECEIPT_NAME);
  if (!fs.existsSync(receiptPath)) {
    throw new PrivateSyncError(
      `P2 FAILED: ${sourceDir} carries no build receipt (${RECEIPT_NAME}). The private build ` +
        `writes it only after every manifest validated and the build completed, so its absence ` +
        `means the build did not finish or did not validate. ADR-0010 decision 3 requires the ` +
        `build to have succeeded before anything is deleted; this is that gate.`,
    );
  }
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  } catch (error) {
    throw new PrivateSyncError(`P2 FAILED: ${RECEIPT_NAME} is not valid JSON: ${error.message}`);
  }

  // P3
  if (receipt?.output !== "private") {
    throw new PrivateSyncError(
      `P3 FAILED: the receipt says output ${JSON.stringify(receipt?.output)}, not "private". ` +
        `A public build must never authorise a delete against the private bucket.`,
    );
  }

  const files = walkFiles(sourceDir).filter((f) => f !== RECEIPT_NAME);

  // P4
  if (receipt.fileCount !== files.length) {
    throw new PrivateSyncError(
      `P4 FAILED: the receipt records ${receipt.fileCount} file(s) but ${files.length} are on ` +
        `disk. The output changed between the build and this sync -- a truncated copy, a partial ` +
        `artifact download, or something writing into dist-private. Refusing to delete anything ` +
        `on the strength of an output that does not match its own receipt.`,
    );
  }

  // P5
  if (!options.allowEmpty && !(receipt.privateItemCount > 0)) {
    throw new PrivateSyncError(
      `P5 FAILED: the build produced ${receipt.privateItemCount} private item(s). An empty ` +
        `private area is a legitimate state -- every item withdrawn (ADR-0010 decision 2) -- but ` +
        `it is indistinguishable from a build defect that rendered nothing, and the consequence ` +
        `of guessing wrong is deleting the private area. Pass --allow-empty to say deliberately ` +
        `that this is a real withdrawal.`,
    );
  }

  return { receipt, files };
}

/**
 * The plan: what to upload, and what to delete because the build did not
 * produce it.
 *
 * @param {string[]} sourceFiles relative paths the build produced
 * @param {string[]} destObjects relative object names currently at the destination
 */
export function planSync(sourceFiles, destObjects) {
  const source = new Set(sourceFiles);
  const dest = new Set(destObjects);
  return {
    upload: [...source].sort(),
    delete: [...dest].filter((o) => !source.has(o) && o !== RECEIPT_NAME).sort(),
    keptReceipt: dest.has(RECEIPT_NAME),
  };
}

/**
 * P6, the deletion ceiling.
 *
 * @returns {{allowed: boolean, ratio: number, reason?: string}}
 */
export function checkDeletionCeiling(plan, destObjectCount, maxRatio = DEFAULT_MAX_DELETE_RATIO) {
  if (plan.delete.length === 0) return { allowed: true, ratio: 0 };
  if (destObjectCount === 0) return { allowed: true, ratio: 0 };
  const ratio = plan.delete.length / destObjectCount;
  if (ratio <= maxRatio) return { allowed: true, ratio };
  return {
    allowed: false,
    ratio,
    reason:
      `P6 FAILED: this sync would delete ${plan.delete.length} of ${destObjectCount} object(s) at ` +
      `the destination (${(ratio * 100).toFixed(1)}%), which exceeds the ceiling of ` +
      `${(maxRatio * 100).toFixed(1)}%. Withdrawing an item deletes a few objects; a build defect ` +
      `deletes most of them, and proportion is the only signal that separates the two. If this ` +
      `really is a mass withdrawal, re-run with --allow-prune-ratio <0..1>.`,
  };
}

// --- Destination drivers ----------------------------------------------------
//
// One interface, two implementations, so the dangerous logic above is identical
// in both and the local one is genuinely testable.

function localDriver(destDir) {
  return {
    describe: () => destDir,
    list() {
      return fs.existsSync(destDir) ? walkFiles(destDir) : [];
    },
    upload(sourceDir, rel) {
      const to = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(sourceDir, rel), to);
    },
    remove(rel) {
      fs.rmSync(path.join(destDir, rel), { force: true });
    },
  };
}

function bucketDriver(bucket, token) {
  // NOTE FOR THE REVIEWER AND FOR CHECKPOINT 4: this path has NEVER been run.
  // The private bucket does not exist, no credential exists in this environment
  // and none may be created, so only the local driver is exercised by tests.
  // The two share every decision above; what is unverified here is the HTTP.
  if (!token) {
    throw new PrivateSyncError(
      "--bucket needs an access token (--token or $GCS_ACCESS_TOKEN).",
    );
  }
  const auth = { Authorization: `Bearer ${token}` };
  return {
    describe: () => `gs://${bucket}/`,
    async list() {
      const names = [];
      let pageToken = "";
      for (;;) {
        let url = `${API}/b/${bucket}/o?maxResults=1000&fields=nextPageToken,items(name)`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
        const res = await fetch(url, { headers: auth });
        if (!res.ok) {
          throw new PrivateSyncError(`objects.list failed for gs://${bucket}/: ${res.status} ${await res.text()}`);
        }
        const page = await res.json();
        for (const o of page.items ?? []) if (!o.name.endsWith("/")) names.push(o.name);
        if (!page.nextPageToken) break;
        pageToken = page.nextPageToken;
      }
      return names;
    },
    async upload(sourceDir, rel) {
      const body = fs.readFileSync(path.join(sourceDir, rel));
      const url =
        `${API.replace("/storage/v1", "/upload/storage/v1")}/b/${bucket}/o` +
        `?uploadType=media&name=${encodeURIComponent(rel)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/octet-stream" },
        body,
      });
      if (!res.ok) {
        throw new PrivateSyncError(`objects.insert failed for ${rel}: ${res.status} ${await res.text()}`);
      }
    },
    async remove(rel) {
      const res = await fetch(`${API}/b/${bucket}/o/${encodeURIComponent(rel)}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok && res.status !== 404) {
        throw new PrivateSyncError(`objects.delete failed for ${rel}: ${res.status} ${await res.text()}`);
      }
    },
  };
}

/**
 * Run the sync. Dry-run unless `apply` is true.
 */
export async function syncPrivate({
  sourceDir,
  driver,
  apply = false,
  allowEmpty = false,
  maxDeleteRatio = DEFAULT_MAX_DELETE_RATIO,
  log = console.log,
}) {
  const { receipt, files } = assertBuildIsSyncable(sourceDir, { allowEmpty });

  const destObjects = await driver.list();
  const plan = planSync(files, destObjects);
  const ceiling = checkDeletionCeiling(plan, destObjects.length, maxDeleteRatio);

  log(`sync-private: source ${sourceDir}`);
  log(`sync-private: destination ${driver.describe()}`);
  log(
    `sync-private: receipt — built ${receipt.builtAt} from ${receipt.commit ?? "(no commit)"}, ` +
      `${receipt.privateItemCount} private item(s), ${receipt.fileCount} file(s)`,
  );
  log(`sync-private: ${plan.upload.length} object(s) to upload, ${plan.delete.length} to DELETE`);
  for (const rel of plan.delete) log(`  DELETE ${rel}`);

  if (!ceiling.allowed) throw new PrivateSyncError(ceiling.reason);

  if (!apply) {
    log(
      `sync-private: DRY RUN — nothing was uploaded and nothing was deleted. Pass --apply to ` +
        `perform this sync.`,
    );
    return { plan, applied: false, receipt };
  }

  // Upload before delete. If the run dies halfway the destination holds a
  // superset of the truth, never a subset: a stale extra object is a bug, a
  // missing one is an outage.
  for (const rel of plan.upload) await driver.upload(sourceDir, rel);
  for (const rel of plan.delete) await driver.remove(rel);

  log(
    `sync-private: applied — ${plan.upload.length} uploaded, ${plan.delete.length} deleted. ` +
      `A withdrawn private item is now unreadable, not merely unlinked (ADR-0010 decision 5).`,
  );
  return { plan, applied: true, receipt };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    source: null, destDir: null, bucket: null, token: process.env.GCS_ACCESS_TOKEN ?? "",
    apply: false, allowEmpty: false, maxDeleteRatio: DEFAULT_MAX_DELETE_RATIO,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--apply") args.apply = true;
    else if (flag === "--allow-empty") args.allowEmpty = true;
    else if (flag === "--source") args.source = argv[++i];
    else if (flag === "--dest-dir") args.destDir = argv[++i];
    else if (flag === "--bucket") args.bucket = argv[++i];
    else if (flag === "--token") args.token = argv[++i];
    else if (flag === "--allow-prune-ratio") args.maxDeleteRatio = Number(argv[++i]);
    else throw new Error(`unknown argument: ${flag}`);
  }
  if (!args.destDir && !args.bucket) throw new Error("one of --dest-dir DIR or --bucket NAME is required");
  if (args.destDir && args.bucket) throw new Error("--dest-dir and --bucket are mutually exclusive");
  if (!(args.maxDeleteRatio >= 0 && args.maxDeleteRatio <= 1)) {
    throw new Error("--allow-prune-ratio must be between 0 and 1");
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`sync-private: ${error.message}`);
    process.exit(2);
  }

  const sourceDir = args.source
    ? path.resolve(args.source)
    : path.join(SITE_ROOT, OUTPUT_DIRS.private);

  try {
    const driver = args.bucket
      ? bucketDriver(args.bucket, args.token)
      : localDriver(path.resolve(args.destDir));
    await syncPrivate({
      sourceDir,
      driver,
      apply: args.apply,
      allowEmpty: args.allowEmpty,
      maxDeleteRatio: args.maxDeleteRatio,
    });
  } catch (error) {
    console.error(`\nsync-private: ${error.message}\n`);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(`::error title=Private sync refused::${error.message}`);
    }
    process.exit(1);
  }
}
