#!/usr/bin/env bash
# Seed the members allowlist (SEAM-3, design doc §6 responsibility 2).
#
# Firestore Native, collection `members`, document id = the email LOWERCASED,
# fields {added_by, added_at, note, role}. The gate lowercases the email in the
# verified ID token before looking it up, so a mixed-case document id is a silent
# "not shared with you" -- indistinguishable from a deliberate refusal.
#
# Uses the Firestore REST API with an ADC token: no client library, no key file.
# Idempotent -- re-running updates the same documents rather than duplicating.
#
#   PROJECT=cusati-hub bash infra/scripts/seed-members.sh
set -euo pipefail

PROJECT="${PROJECT:-${GCP_PROJECT_ID:-}}"
if [ -z "${PROJECT}" ]; then
  echo "PROJECT is required (e.g. PROJECT=cusati-hub)" >&2
  exit 2
fi
DB="${DB:-(default)}"
COLLECTION="${COLLECTION:-members}"

TOKEN="$(gcloud auth print-access-token)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BY="${ADDED_BY:-djjay@vt.edu}"

# email|role|note   -- role is omitted entirely when empty (SEAM-3: cbrown has no role field)
MEMBERS=(
  "djjay@vt.edu|owner|Owner. Seeded at Checkpoint 4."
  "cbrown@vt.edu||Committee member. Seeded at Checkpoint 4."
)

for entry in "${MEMBERS[@]}"; do
  IFS='|' read -r EMAIL ROLE NOTE <<<"${entry}"
  KEY="$(printf '%s' "${EMAIL}" | tr '[:upper:]' '[:lower:]')"

  FIELDS="\"added_by\":{\"stringValue\":\"${BY}\"},\"added_at\":{\"timestampValue\":\"${NOW}\"},\"note\":{\"stringValue\":\"${NOTE}\"}"
  MASK="updateMask.fieldPaths=added_by&updateMask.fieldPaths=added_at&updateMask.fieldPaths=note"
  if [ -n "${ROLE}" ]; then
    FIELDS="${FIELDS},\"role\":{\"stringValue\":\"${ROLE}\"}"
    MASK="${MASK}&updateMask.fieldPaths=role"
  fi

  URL="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents/${COLLECTION}/${KEY}?${MASK}"
  CODE="$(curl -s -o /tmp/seed-members.out -w '%{http_code}' -X PATCH "${URL}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"fields\":{${FIELDS}}}")"

  if [ "${CODE}" = "200" ]; then
    echo "seeded ${KEY}${ROLE:+ (role: ${ROLE})}"
  else
    echo "::error::failed to seed ${KEY}: HTTP ${CODE}" >&2
    cat /tmp/seed-members.out >&2 || true
    exit 1
  fi
done

cat <<'NOTE'

THE MATCHING TRAP (SEAM-3). The allowlist matches the exact email in the Firebase
ID token. The owner's Google/GitHub identity is djjay0131@gmail.com, which is NOT
on this list -- signing in with that account produces a token that will not match
djjay@vt.edu and yields the "nothing here has been shared with you" page. That is
CORRECT behaviour and is indistinguishable from a bug. Sign in as djjay@vt.edu.
NOTE
