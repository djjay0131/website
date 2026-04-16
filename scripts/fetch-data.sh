#!/usr/bin/env bash
set -euo pipefail

REPO="${CV_REPO:-djjay0131/cv}"
TAG="${CV_TAG:-latest}"

echo "Fetching data from ${REPO}@${TAG}..."

mkdir -p data public/pdfs /tmp/cv-fetch

gh release download "${TAG}" --repo "${REPO}" --pattern "cv-data.zip" --dir /tmp/cv-fetch --clobber
gh release download "${TAG}" --repo "${REPO}" --pattern "academic.pdf" --dir public/pdfs --clobber

# Extract data zip (contains data/ and own-bib.bib at top level inside the zip).
unzip -o /tmp/cv-fetch/cv-data.zip -d /tmp/cv-fetch/extracted

# Flatten: the zip puts files under data/ inside itself.
if [ -d /tmp/cv-fetch/extracted/data ]; then
  cp -r /tmp/cv-fetch/extracted/data/* data/
fi
if [ -f /tmp/cv-fetch/extracted/own-bib.bib ]; then
  cp /tmp/cv-fetch/extracted/own-bib.bib data/
fi
if [ -f /tmp/cv-fetch/extracted/photo_jason_1.jpeg ]; then
  cp /tmp/cv-fetch/extracted/photo_jason_1.jpeg public/
fi

rm -rf /tmp/cv-fetch

echo "Data fetched successfully."
ls data/ public/pdfs/
