#!/usr/bin/env bash
# Replace website data/ + assets with symlinks into the local cv repo.
# After running, `npm run dev` reads live data and Astro hot-reloads on cv edits.
#
# Override the cv repo path: CV_REPO_PATH=/some/where ./scripts/sync-local-data.sh
set -euo pipefail

CV_REPO_PATH="${CV_REPO_PATH:-../cv}"
WEBSITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CV_ABS="$(cd "$WEBSITE_ROOT/$CV_REPO_PATH" 2>/dev/null && pwd)" || {
  echo "error: cannot resolve CV_REPO_PATH=$CV_REPO_PATH from $WEBSITE_ROOT" >&2
  exit 1
}

[[ -d "$CV_ABS/data/content"  ]] || { echo "error: $CV_ABS/data/content missing"  >&2; exit 1; }
[[ -d "$CV_ABS/data/variants" ]] || { echo "error: $CV_ABS/data/variants missing" >&2; exit 1; }
[[ -f "$CV_ABS/own-bib.bib"   ]] || { echo "error: $CV_ABS/own-bib.bib missing"   >&2; exit 1; }

cd "$WEBSITE_ROOT"

rm -rf data
mkdir -p data
ln -s "$CV_ABS/data/content"  data/content
ln -s "$CV_ABS/data/variants" data/variants
ln -s "$CV_ABS/own-bib.bib"   data/own-bib.bib

mkdir -p public/pdfs
if [[ -f "$CV_ABS/photo_jason_1.jpeg" ]]; then
  rm -f public/photo_jason_1.jpeg
  ln -s "$CV_ABS/photo_jason_1.jpeg" public/photo_jason_1.jpeg
fi

if [[ -f "$CV_ABS/academic.pdf" ]]; then
  rm -f public/pdfs/academic.pdf
  ln -s "$CV_ABS/academic.pdf" public/pdfs/academic.pdf
  echo "[sync] linked academic.pdf"
else
  echo "[sync] no local academic.pdf — PDF download link will 404 until you run latexmk in the cv repo"
fi

echo "[sync] linked data + assets from $CV_ABS"
