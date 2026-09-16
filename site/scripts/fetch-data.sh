#!/usr/bin/env bash
# FALLBACK CV data source: the cv repository's GitHub release.
#
#   ./scripts/fetch-data.sh            # or: npm run data:fetch
#   CV_REPO=owner/repo CV_TAG=v1 ./scripts/fetch-data.sh
#
# Phase 2's real path is scripts/sync-content.sh, which reads the GCS content
# bucket that the cv satellite publishes to through the contract (ADR-0007,
# ADR-0008). This script is what runs when that path is not available, and it
# exists because two things are both true:
#
#   1. The hub reads the bucket as its deploy service account, which may be
#      impersonated only from refs/heads/main (infra/wif.tf). A pull_request run
#      carries refs/pull/<n>/merge, so it CANNOT authenticate and CANNOT sync.
#   2. GitHub Pages is authoritative until Phase 6 (ADR-0001 decision 4) and
#      serves live CV links. No build, on any trigger, may produce a site
#      without the CV.
#
# There is also an ordering window: between merging Phase 2 and the owner
# applying Terraform and setting vars.GCP_CONTENT_BUCKET at Checkpoint 3, there
# is no bucket to read. This script covers that window too, so the change is
# safe to merge whenever and degrades to the Phase 1 path rather than to a
# CV-less site.
#
# IT PRODUCES EXACTLY WHAT THE BUCKET WOULD. The release is unzipped into a
# tree shaped like gs://<bucket>/sources/cv/ (SEAM-2), given the manifest the cv
# satellite would publish (SEAM-5), and handed to scripts/sync-content.sh. So
# everything downstream -- manifest validation in src/content.config.ts, the
# data-item claim check, public-asset staging, the CV pages -- runs identically
# whichever source supplied the payload. Only the transport differs.
#
# Requires: gh, unzip, node. Uses only the hub's own GITHUB_TOKEN; no satellite
# holds a credential for this repository, and none is used here.
set -euo pipefail

REPO="${CV_REPO:-djjay0131/cv}"
TAG="${CV_TAG:-latest}"

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SITE_ROOT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "fetch-data: FALLBACK path -- building the cv payload from ${REPO}@${TAG}."
echo "fetch-data: the contract path is scripts/sync-content.sh --bucket <name>."

# The bucket-shaped staging tree. Gitignored; rebuilt on every run.
STAGE=".release-content"
PREFIX="$STAGE/sources/cv"
rm -rf "$STAGE"
mkdir -p "$PREFIX/cv-data"

gh release download "${TAG}" --repo "${REPO}" --pattern "cv-data.zip" --dir "$WORK" --clobber
# One PDF per data/variants/<name>.yaml, as the cv satellite publishes them.
gh release download "${TAG}" --repo "${REPO}" --pattern "*.pdf" --dir "$PREFIX" --clobber

unzip -qo "$WORK/cv-data.zip" -d "$WORK/extracted"
# The cv-data item (SEAM-5): data/content/, data/variants/, own-bib.bib and the
# photo -- exactly cv-data.zip's contents, unzipped.
cp -r "$WORK/extracted/data" "$PREFIX/cv-data/data"
cp "$WORK/extracted/own-bib.bib" "$PREFIX/cv-data/" 2>/dev/null || true
cp "$WORK/extracted/photo_jason_1.jpeg" "$PREFIX/cv-data/" 2>/dev/null || true

# The manifest the cv satellite would have published for this payload,
# generated from what the release actually contains so it never over-promises.
# It is validated downstream like any other manifest.
PREFIX="$PREFIX" node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const prefix = process.env.PREFIX;
  const today = new Date().toISOString().slice(0, 10);
  const variants = fs
    .readdirSync(path.join(prefix, "cv-data", "data", "variants"))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
  const items = variants
    .filter((slug) => fs.existsSync(path.join(prefix, `${slug}.pdf`)))
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
  const manifest = { source: "cv", published: `${new Date().toISOString().slice(0, 19)}Z`, items };
  fs.writeFileSync(path.join(prefix, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`fetch-data: manifest describes ${items.length} item(s).`);
'

# Any PDF in the release with no matching variant is not a published item, so
# it must not sit in the tree pretending to be one.
PREFIX="$PREFIX" node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const prefix = process.env.PREFIX;
  const manifest = JSON.parse(fs.readFileSync(path.join(prefix, "manifest.json"), "utf8"));
  const declared = new Set(manifest.items.map((i) => i.path));
  for (const f of fs.readdirSync(prefix)) {
    if (f.endsWith(".pdf") && !declared.has(f)) {
      fs.rmSync(path.join(prefix, f));
      console.log(`fetch-data: dropped ${f} (no matching variant, so not a published item).`);
    }
  }
'

./scripts/sync-content.sh --from "$STAGE"

echo "fetch-data: CV payload in place through the contract path."
