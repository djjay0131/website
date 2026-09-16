#!/usr/bin/env bash
# Sync published content from the GCS content bucket into the build tree
# (SEAM-2, SEAM-4; ADR-0007). Replaces scripts/fetch-data.sh, which downloaded
# a cv GitHub release; the hub now reads only what satellites published through
# the contract.
#
#   gs://<bucket>/sources/<source>/...  ->  site/src/content/sources/<source>/...
#
# Modes
#   --bucket NAME            read the bucket (needs an OAuth access token)
#   --from DIR               read a local fixture tree shaped like the bucket
#                            (DIR/sources/<source>/...). No cloud, no credentials.
#   --fingerprint            print the fingerprint of the object set and exit
#
# Options
#   --dest DIR   where to write (default: src/content/sources)
#   --token TOK  OAuth access token; default $GCS_ACCESS_TOKEN
#   --link       --from only: symlink instead of copy, so a local cv checkout
#                hot-reloads (used by scripts/sync-local-data.sh)
#   --no-stage   skip the public-asset staging step
#
# ONLY TWO CLOUD OPERATIONS ARE USED, AND BOTH ARE OBJECT OPERATIONS:
#
#   objects.list   GET /storage/v1/b/<bucket>/o?prefix=sources/
#   objects.get    GET /storage/v1/b/<bucket>/o/<object>?alt=media
#
# The hub's grant is roles/storage.objectViewer on the bucket, unconditioned
# (infra/storage.tf, SEAM-4). That role carries storage.objects.list and
# storage.objects.get and NOTHING ELSE that matters here -- in particular it
# does NOT carry storage.buckets.get. So this script never reads bucket
# metadata: it never calls GET /storage/v1/b/<bucket>, never asks whether the
# bucket exists, and never stats it before reading. A helper that did would
# pass every local test and 403 against the real bucket.
#
# Unlike a satellite, the hub MAY list: it owns the bucket. The "never list"
# rule of ADR-0007 is a satellite constraint (storage.objects.list cannot be
# restricted by prefix, so a satellite holding it could enumerate every other
# source). It does not apply on this side.
#
# Requires: bash, curl, node. No gcloud, no jq, no gsutil -- node parses the
# JSON, so the script runs anywhere the site itself builds.
set -euo pipefail

SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SITE_ROOT"

BUCKET=""
FROM=""
DEST="src/content/sources"
TOKEN="${GCS_ACCESS_TOKEN:-}"
FINGERPRINT_ONLY=0
LINK=0
STAGE=1

die() { echo "sync-content: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --bucket) BUCKET="${2:-}"; shift 2 ;;
    --from) FROM="${2:-}"; shift 2 ;;
    --dest) DEST="${2:-}"; shift 2 ;;
    --token) TOKEN="${2:-}"; shift 2 ;;
    --fingerprint) FINGERPRINT_ONLY=1; shift ;;
    --link) LINK=1; shift ;;
    --no-stage) STAGE=0; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) die "unknown argument $1" ;;
  esac
done

[ -n "$BUCKET" ] || [ -n "$FROM" ] || die "one of --bucket NAME or --from DIR is required"
[ -z "$BUCKET" ] || [ -z "$FROM" ] || die "--bucket and --from are mutually exclusive"

API="https://storage.googleapis.com/storage/v1"

# ---------------------------------------------------------------------------
# Listing. One line per object: "<name>\t<generation>\t<size>".
#
# The listing is the whole fingerprint input, so a DELETED object changes it:
# its line is simply gone. A fingerprint built from "the newest object" or "the
# latest publish timestamp" would not change when an item is withdrawn, and a
# withdrawn item that leaves the site looking unchanged is a defect
# (SEAM-4, ADR-0007 Risks).
# ---------------------------------------------------------------------------
list_bucket() {
  [ -n "$TOKEN" ] || die "--bucket needs an access token (--token or \$GCS_ACCESS_TOKEN)"
  local page_token="" url body
  while :; do
    url="${API}/b/${BUCKET}/o?prefix=sources%2F&maxResults=1000&fields=nextPageToken,items(name,generation,size)"
    [ -z "$page_token" ] || url="${url}&pageToken=${page_token}"
    body="$(curl -sS --fail-with-body -H "Authorization: Bearer ${TOKEN}" "$url")" \
      || die "objects.list failed for gs://${BUCKET}/sources/ -- ${body}"
    printf '%s' "$body" | node -e '
      let raw = "";
      process.stdin.on("data", (c) => (raw += c));
      process.stdin.on("end", () => {
        const page = JSON.parse(raw || "{}");
        for (const o of page.items ?? []) {
          // A "directory placeholder" object ends in / and carries no bytes.
          if (o.name.endsWith("/")) continue;
          process.stdout.write(`${o.name}\t${o.generation}\t${o.size}\n`);
        }
        if (page.nextPageToken) process.stderr.write(page.nextPageToken);
      });
    ' 2>"$TMP/next-page"
    page_token="$(cat "$TMP/next-page")"
    [ -n "$page_token" ] || break
  done
}

list_local() {
  [ -d "$FROM/sources" ] || return 0
  # Same shape as the bucket listing. There are no generations in a fixture
  # tree, so the size stands in; the fingerprint is only ever compared with
  # itself.
  #
  # find -L, not plain find: scripts/sync-local-data.sh builds its tree out of
  # SYMLINKED DIRECTORIES pointing into a cv checkout (that is what makes
  # `astro dev` hot-reload on cv edits). Plain find does not descend a symlinked
  # directory, so it would list the manifest and nothing else, and the build
  # would fail with the CV missing. -L follows them and -type f then tests the
  # target, so a symlink to a file is listed as the file it is.
  (cd "$FROM" && find -L sources -type f | LC_ALL=C sort | while IFS= read -r f; do
    printf '%s\t-\t%s\n' "$f" "$(wc -c <"$f" | tr -d ' ')"
  done)
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "$BUCKET" ]; then
  list_bucket | LC_ALL=C sort >"$TMP/listing"
else
  list_local | LC_ALL=C sort >"$TMP/listing"
fi

OBJECT_COUNT="$(wc -l <"$TMP/listing" | tr -d ' ')"

if [ "$FINGERPRINT_ONLY" -eq 1 ]; then
  # An empty bucket is a real state, not an error: it is how a source that has
  # never published looks, and it must have a stable fingerprint of its own.
  if [ "$OBJECT_COUNT" -eq 0 ]; then
    echo "empty"
  else
    sha256sum <"$TMP/listing" | cut -d' ' -f1
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Download. The destination is rebuilt from scratch so an object withdrawn from
# the bucket cannot linger in the build tree from a previous run.
# ---------------------------------------------------------------------------
rm -rf "$DEST"
mkdir -p "$DEST"

if [ "$OBJECT_COUNT" -eq 0 ]; then
  echo "sync-content: no objects under sources/ -- nothing to sync."
else
  while IFS="$(printf '\t')" read -r NAME _GEN _SIZE; do
    REL="${NAME#sources/}"
    OUT="$DEST/$REL"
    mkdir -p "$(dirname "$OUT")"
    if [ -n "$BUCKET" ]; then
      ENCODED="$(NAME="$NAME" node -e 'process.stdout.write(encodeURIComponent(process.env.NAME))')"
      curl -sS --fail-with-body -o "$OUT" \
        -H "Authorization: Bearer ${TOKEN}" \
        "${API}/b/${BUCKET}/o/${ENCODED}?alt=media" \
        || die "objects.get failed for ${NAME}"
    elif [ "$LINK" -eq 1 ]; then
      rm -f "$OUT"
      # Point at the real file, not at the staging tree's own symlink chain, so
      # a file watcher sees the cv checkout directly.
      ln -s "$(realpath "$FROM/$NAME")" "$OUT"
    else
      cp -L "$FROM/$NAME" "$OUT"
    fi
  done <"$TMP/listing"
  echo "sync-content: synced ${OBJECT_COUNT} object(s) into ${DEST}."
fi

if [ "$STAGE" -eq 1 ]; then
  node "$SITE_ROOT/scripts/stage-public-assets.mjs" --sources "$DEST"
fi
