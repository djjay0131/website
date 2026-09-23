#!/usr/bin/env bash
# Run the site locally against a local checkout of the cv repository, with no
# cloud access and no credentials of any kind.
#
#   ./scripts/sync-local-data.sh                 # cv checkout at ../../cv
#   CV_REPO_PATH=/path/to/cv ./scripts/sync-local-data.sh
#   npm run dev:local                            # this, then astro dev
#
# Phase 2 moved the hub's content behind the publishing contract: the build
# reads src/content/sources/, which scripts/sync-content.sh fills from the GCS
# content bucket. Local development must not require a credential for that
# bucket (site-phase-2.md D6), so this script does what the cv satellite's
# publish step would do, minus the upload:
#
#   1. Build a fixture tree shaped exactly like the bucket, at
#      .local-content/sources/cv/, from the cv checkout. Its manifest is
#      generated from the checkout's own data/variants/*.yaml and *.pdf, so it
#      describes what is actually there.
#   2. Hand that tree to scripts/sync-content.sh --from ... --link.
#
# Everything downstream -- the manifest validation in src/content.config.ts,
# the claim check, the public-asset staging -- then runs exactly as it does in
# CI. A local run exercises the real code path rather than a parallel one, and
# a mistake in the payload shape shows up here rather than at Checkpoint 3.
#
# --link means the synced tree is symlinks into the cv checkout, so `astro dev`
# hot-reloads on cv edits, as it did before Phase 2. (The staged PDFs under
# public/pdfs/ are copies: re-run this after `make all` in cv to refresh them.)
set -euo pipefail

CV_REPO_PATH="${CV_REPO_PATH:-../../cv}"
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CV_ABS="$(cd "$SITE_ROOT" && cd "$CV_REPO_PATH" 2>/dev/null && pwd)" || {
  echo "error: cannot resolve CV_REPO_PATH=$CV_REPO_PATH from $SITE_ROOT" >&2
  echo "hint: with no cv checkout at all, build against the committed fixture:" >&2
  echo "      ./scripts/sync-content.sh --from fixtures/content" >&2
  exit 1
}

[[ -d "$CV_ABS/data/content"  ]] || { echo "error: $CV_ABS/data/content missing"  >&2; exit 1; }
[[ -d "$CV_ABS/data/variants" ]] || { echo "error: $CV_ABS/data/variants missing" >&2; exit 1; }
[[ -f "$CV_ABS/own-bib.bib"   ]] || { echo "error: $CV_ABS/own-bib.bib missing"   >&2; exit 1; }

cd "$SITE_ROOT"

# The bucket-shaped staging tree. Gitignored; rebuilt on every run.
STAGE=".local-content"
PREFIX="$STAGE/sources/cv"
rm -rf "$STAGE"
mkdir -p "$PREFIX/cv-data/data"

# The cv-data item (SEAM-5): exactly today's cv-data.zip payload, unzipped.
ln -s "$CV_ABS/data/content"  "$PREFIX/cv-data/data/content"
ln -s "$CV_ABS/data/variants" "$PREFIX/cv-data/data/variants"
ln -s "$CV_ABS/own-bib.bib"   "$PREFIX/cv-data/own-bib.bib"
if [[ -f "$CV_ABS/photo_jason_1.jpeg" ]]; then
  ln -s "$CV_ABS/photo_jason_1.jpeg" "$PREFIX/cv-data/photo_jason_1.jpeg"
fi

# The pdf items: one per variant PDF the checkout has actually produced.
shopt -s nullglob
linked=0
for pdf in "$CV_ABS"/*.pdf; do
  ln -s "$pdf" "$PREFIX/$(basename "$pdf")"
  linked=$((linked + 1))
done
shopt -u nullglob
if [[ $linked -eq 0 ]]; then
  echo "[sync] no variant PDFs in $CV_ABS — Download links will 404 until you run \`make all\` there"
fi

# The manifest the cv satellite would publish, generated from what is present
# so it never over-promises. Validated downstream like any other manifest.
CV_ABS="$CV_ABS" PREFIX="$PREFIX" node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const cv = process.env.CV_ABS;
  const prefix = process.env.PREFIX;
  const today = new Date().toISOString().slice(0, 10);
  const items = fs
    .readdirSync(path.join(cv, "data", "variants"))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .filter((slug) => fs.existsSync(path.join(cv, `${slug}.pdf`)))
    .sort()
    .map((slug) => ({
      slug,
      title: `${slug} CV`,
      section: "cv",
      format: "pdf",
      path: `${slug}.pdf`,
      visibility: "public",
      date: today,
    }));
  items.push({
    slug: "cv-data",
    title: "CV source data",
    section: "cv",
    format: "data",
    path: "cv-data/",
    visibility: "public",
    date: today,
    schema_version: "1",
  });
  const manifest = {
    source: "cv",
    published: `${new Date().toISOString().slice(0, 19)}Z`,
    items,
  };
  fs.writeFileSync(path.join(prefix, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
'

# --partial for the same reason as fetch-data.sh: a cv checkout is one source,
# and the hub also requires phd-milestones (ADR-0010 decision 4), which is
# private and reachable only through the content bucket. Local development must
# not require a credential for that bucket (site-phase-2.md D6), so this tree
# declares that it cannot be complete instead of failing every local build.
./scripts/sync-content.sh --from "$STAGE" --link --provenance local-cv-checkout --partial

echo "[sync] linked the cv checkout at $CV_ABS through the publishing contract"
