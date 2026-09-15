#!/usr/bin/env bash
# Download the CV data and PDFs from the cv repository's release (SEAM-2).
#
# The one place that downloads CV data. It produces, relative to site/, exactly
# what build.yml's former inline "Fetch CV data and PDF" step produced:
#   data/content/, data/variants/, data/own-bib.bib   from cv-data.zip
#   public/pdfs/*.pdf                                 every PDF in the release
#   public/photo_jason_1.jpeg                         when the zip carries it
# It does not write public/build-info.json; CI writes that.
#
# Usage, from site/:   GH_TOKEN=<token> ./scripts/fetch-data.sh
# Overrides:           CV_REPO (default djjay0131/cv), CV_TAG (default latest)
# Requires:            gh, unzip
set -euo pipefail

REPO="${CV_REPO:-djjay0131/cv}"
TAG="${CV_TAG:-latest}"

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SITE_ROOT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching CV data from ${REPO}@${TAG} into ${SITE_ROOT}..."

mkdir -p data/content data/variants public/pdfs
gh release download "${TAG}" --repo "${REPO}" --pattern "cv-data.zip" --dir "$WORK" --clobber
# Pull every variant PDF in the release (one per data/variants/<name>.yaml).
gh release download "${TAG}" --repo "${REPO}" --pattern "*.pdf" --dir public/pdfs --clobber
unzip -o "$WORK/cv-data.zip" -d "$WORK/extracted"
cp -r "$WORK"/extracted/data/* data/ 2>/dev/null || true
cp "$WORK/extracted/own-bib.bib" data/ 2>/dev/null || true
cp "$WORK/extracted/photo_jason_1.jpeg" public/ 2>/dev/null || true

echo "CV data fetched."
