#!/usr/bin/env bash
# The bucket IAM test, live half (roadmap §phase-3-private-area: "The bucket IAM
# test runs on every deploy and fails if the private bucket grants public access
# or any reader other than the gate's service account. An anonymous request for
# a private object is refused"; design doc §12.1).
#
# THIS SCRIPT REQUIRES CLOUD CREDENTIALS. It reads a live IAM policy, so it
# cannot run in a credential-free CI job, and it is not pretending otherwise.
# Its home is:
#   - the deploy path, after authentication (the hub's deploy identity can read
#     this bucket's IAM policy only if granted storage.buckets.getIamPolicy --
#     see the note at the bottom, which is a real gap, not an oversight);
#   - the Checkpoint 4 runbook, run by the owner, which is where it actually
#     proves the criterion for the first time.
#
# The credential-free half -- that the CONFIGURATION still says the right thing
# -- is scripts/check_private_bucket_config.py, which runs on every push with no
# credentials at all. Neither replaces the other: this one catches drift and
# anything granted outside Terraform; that one catches the widening edit before
# it is ever applied.
#
# Usage, from anywhere:
#   PROJECT=cusati-hub BUCKET=cusati-hub-private \
#   GATE_SA=hub-gate@cusati-hub.iam.gserviceaccount.com \
#   HUB_SA=hub-deploy@cusati-hub.iam.gserviceaccount.com \
#     bash infra/scripts/check-private-bucket-iam.sh
#
# Every value is available from `terraform output` (see README §Phase 3).

set -euo pipefail

PROJECT="${PROJECT:?set PROJECT to the GCP project id}"
BUCKET="${BUCKET:?set BUCKET to the private bucket name}"
GATE_SA="${GATE_SA:?set GATE_SA to the gate runtime service account email}"
HUB_SA="${HUB_SA:?set HUB_SA to the hub deploy service account email}"

FAILED=0

fail() {
  echo "FAIL: $*"
  FAILED=1
}

pass() {
  echo "OK: $*"
}

echo "== Private bucket IAM test =="
echo "project ${PROJECT}, bucket gs://${BUCKET}"
echo

# ---------------------------------------------------------------------------
# 1. The bucket's own settings.
#
# uniform_bucket_level_access is checked FIRST and failure here stops the run,
# because every other assertion below is meaningless without it: with it off,
# object ACLs are live again and an object can be world-readable while the IAM
# policy this script reads looks perfectly correct.
# ---------------------------------------------------------------------------
# Parsed from JSON, not from --format=value(...), and this is not a style choice.
# The first real run of this script (Checkpoint 4) failed with
#   "uniform_bucket_level_access is 'enforced', expected True"
# because this gcloud returns the field FLAT as `uniform_bucket_level_access`,
# while the projection asked for `uniform_bucket_level_access.enabled`. That
# resolved to empty, so the two tab-separated values shifted by one and UBLA was
# handed public_access_prevention's value. A safety check that reports the wrong
# field is worse than no check: it fails a correct bucket, and the natural
# response to a check that cries wolf is to stop running it.
SETTINGS_JSON="$(gcloud storage buckets describe "gs://${BUCKET}" \
  --project "${PROJECT}" --format=json)"

read -r UBLA PAP <<<"$(printf '%s' "${SETTINGS_JSON}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ubla = d.get('uniform_bucket_level_access')
if isinstance(ubla, dict):          # older gcloud nests it
    ubla = ubla.get('enabled')
pap = d.get('public_access_prevention') or d.get('publicAccessPrevention')
print(f'{ubla} {pap}')
")"

if [ "${UBLA}" = "True" ]; then
  pass "uniform_bucket_level_access is True -- object ACLs are disabled and IAM is the only access path"
else
  fail "uniform_bucket_level_access is '${UBLA}', expected True. STOP: with it off, an object ACL can make a private object public with no IAM change, and this script's remaining checks prove nothing."
  exit 1
fi

if [ "${PAP}" = "enforced" ]; then
  pass "public_access_prevention is enforced"
else
  fail "public_access_prevention is '${PAP}', expected enforced"
fi
echo

# ---------------------------------------------------------------------------
# 2. The IAM policy holds EXACTLY the two expected members, in the two expected
#    roles, and nothing else.
#
# Note what is deliberately NOT treated as a failure: Cloud Storage adds
# legacyBucketOwner / legacyObjectOwner (projectEditor, projectOwner) and
# legacyBucketReader / legacyObjectReader (projectViewer) to every bucket at
# creation. They are automatic defaults, not declared by this module, and were
# recorded at Checkpoint 3 on the content bucket. They are filtered out here so
# the check is about what this module grants -- but they are NOT harmless: they
# mean any principal with project Viewer can read every private object. That is
# an owner decision, surfaced in the handoff §Risks and printed below rather
# than hidden by the filter.
# ---------------------------------------------------------------------------
POLICY="$(gcloud storage buckets get-iam-policy "gs://${BUCKET}" \
  --project "${PROJECT}" --format=json)"

# Anonymous principals first: the single worst outcome, checked on its own.
if echo "${POLICY}" | grep -qE '"(allUsers|allAuthenticatedUsers)"'; then
  fail "the bucket policy names allUsers or allAuthenticatedUsers. The private bucket is never public."
else
  pass "no allUsers and no allAuthenticatedUsers in the bucket policy"
fi

NON_LEGACY="$(echo "${POLICY}" | python3 -c '
import json, sys
policy = json.load(sys.stdin)
for binding in policy.get("bindings", []):
    role = binding.get("role", "")
    # Cloud Storage creates these on every bucket; they are project-level, not
    # granted by this module. Reported separately below.
    if role.startswith("roles/storage.legacy"):
        continue
    for member in binding.get("members", []):
        print(f"{role}\t{member}")
' | sort)"

EXPECTED="$(printf '%s\n' \
  "projects/${PROJECT}/roles/privateObjectReader	serviceAccount:${GATE_SA}" \
  "projects/${PROJECT}/roles/privateSyncWriter	serviceAccount:${HUB_SA}" | sort)"

if [ "${NON_LEGACY}" = "${EXPECTED}" ]; then
  pass "exactly two non-legacy bindings: the gate reads, the hub syncs"
else
  fail "the bucket's non-legacy bindings are not exactly the two expected."
  echo "--- expected ---"
  echo "${EXPECTED}"
  echo "--- actual ---"
  echo "${NON_LEGACY}"
  echo "----------------"
fi
echo

echo "The legacy project-role bindings Cloud Storage creates automatically on every"
echo "bucket. They are not declared by this module and cannot be removed by adding"
echo "IAM members to it -- only by replacing the bucket's whole IAM policy."
echo "${POLICY}" | python3 -c '
import json, sys
policy = json.load(sys.stdin)
for binding in policy.get("bindings", []):
    if binding.get("role", "").startswith("roles/storage.legacy"):
        print("   ", binding["role"], "->", ", ".join(binding.get("members", [])))
'
echo

# ---------------------------------------------------------------------------
# 2b. WHAT projectViewer ACTUALLY EXPANDS TO. This is the check that turns a
#     silent, latent exposure into a loud one.
#
# legacyBucketReader and legacyObjectReader are granted to the PLACEHOLDER
# "projectViewer:<project>", which expands to every principal holding
# roles/viewer on the project. On a bucket holding the committee dossier that
# means: anyone granted project Viewer can read every private object, with no
# change to this bucket's policy and nothing in this module mentioning them.
#
# Uniform bucket-level access does NOT remove these bindings -- established from
# the live policy rather than assumed: UBLA is enforced on this bucket and the
# legacy bindings are still present in the output printed above.
#
# So the control that is actually available is to grant project Viewer to
# NOBODY, and to notice immediately if that ever changes. Today the expansion is
# EMPTY: the project has no roles/viewer binding at all, and the owner holds
# roles/owner, which maps to projectOwner, not projectViewer. This check
# therefore passes today and goes red the moment someone is granted Viewer --
# which is exactly the moment a human should decide whether that person should
# be able to read the dossier.
# ---------------------------------------------------------------------------
VIEWERS="$(gcloud projects get-iam-policy "${PROJECT}" --format=json | python3 -c '
import json, sys
policy = json.load(sys.stdin)
for binding in policy.get("bindings", []):
    if binding.get("role") == "roles/viewer":
        for member in binding.get("members", []):
            print(member)
' | sort)"

if [ -z "${VIEWERS}" ]; then
  pass "no principal holds roles/viewer on ${PROJECT}, so projectViewer expands to the empty set and the legacy reader bindings grant nobody anything"
else
  fail "the following principals hold roles/viewer on ${PROJECT} and can therefore READ EVERY PRIVATE OBJECT in gs://${BUCKET} through the automatic legacyObjectReader binding:"
  echo "${VIEWERS}" | sed 's/^/    /'
  echo "    Either remove roles/viewer from them, or replace this bucket's IAM"
  echo "    policy authoritatively to drop the legacy reader bindings. See the"
  echo "    Wave 0 infra handoff, item 5, for the decision and its tradeoff."
fi
echo

# ---------------------------------------------------------------------------
# 3. The criterion's last clause: an anonymous request for a private object is
#    refused.
#
# This is the end-to-end proof, and it needs no credential at all -- which is
# the point. An object name is required; pass PROBE_OBJECT, or the check is
# skipped loudly rather than silently passing.
# ---------------------------------------------------------------------------
if [ -n "${PROBE_OBJECT:-}" ]; then
  ENCODED="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "${PROBE_OBJECT}")"
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
    "https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${ENCODED}?alt=media")"
  case "${STATUS}" in
    401 | 403 | 404)
      pass "anonymous GET of ${PROBE_OBJECT} returned ${STATUS} -- refused"
      ;;
    200)
      fail "anonymous GET of ${PROBE_OBJECT} returned 200. A private object is readable without credentials."
      ;;
    *)
      fail "anonymous GET of ${PROBE_OBJECT} returned ${STATUS}; expected 401, 403 or 404"
      ;;
  esac
else
  echo "SKIPPED: set PROBE_OBJECT to a real object path (for example 'index.html')"
  echo "         to run the anonymous-request half of the criterion."
fi
echo

if [ "${FAILED}" -ne 0 ]; then
  echo "::error::Private bucket IAM test FAILED. Do not deploy."
  exit 1
fi

echo "Private bucket IAM test passed."

# ---------------------------------------------------------------------------
# A NOTE ON RUNNING THIS ON THE DEPLOY PATH, stated plainly rather than
# discovered at Checkpoint 4:
#
# Reading a bucket's IAM policy needs storage.buckets.getIamPolicy. The hub's
# deploy identity does NOT hold it: its grants are roles/storage.objectViewer on
# the content bucket and the four object permissions of privateSyncWriter on this
# one -- object permissions, none of which reads bucket metadata or policy. (The
# same gap was recorded in Phase 2: roles/storage.objectViewer does not include
# storage.buckets.get.)
#
# So a deploy-path run of THIS script needs one of:
#   (a) storage.buckets.getIamPolicy added to privateSyncWriter -- a real
#       widening of the deploy identity, for a check rather than for the work;
#   (b) a separate, read-only auditor identity used by the check step only;
#   (c) accept that the live check is an owner/Checkpoint procedure, while every
#       deploy runs the credential-free configuration check
#       (check_private_bucket_config.py) plus the anonymous-request probe in
#       section 3, which needs no credential whatsoever.
#
# (c) is what this phase implements and what the handoff recommends: the
# anonymous probe is the half of the criterion that actually catches a public
# object, and it runs on every deploy with no identity at all. (a) and (b) are
# recorded for the owner as an ADR candidate.
# ---------------------------------------------------------------------------
