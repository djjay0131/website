#!/usr/bin/env bash
# The bucket IAM test, live half (roadmap §phase-3-private-area: "The bucket IAM
# test runs on every deploy and fails if the private bucket grants public access
# or any reader other than the gate's service account. An anonymous request for
# a private object is refused"; design doc §12.1).
#
# THIS SCRIPT REQUIRES CLOUD CREDENTIALS. It reads a live IAM policy, so it
# cannot run in a credential-free CI job, and it is not pretending otherwise.
# Its home is:
#   - the private-bucket-live-iam job in .github/workflows/build.yml, which runs
#     on the HOURLY SCHEDULE and on every push to main, authenticating as the
#     read-only auditor identity (infra/auditor.tf). It fails that job. The
#     scheduled half is the load-bearing one: a bucket exposure introduced by a
#     console action changes no file here and is invisible to any check that
#     runs only on a code change (issue #58);
#   - the Checkpoint 4 runbook, run by the owner, where the PROBE_OBJECT half
#     can be pointed at a real private object.
#
# IT RAN NOWHERE UNTIL WAVE 0. Before issue #58 this script was named in one
# COMMENT in build.yml and invoked by no workflow, while infra/README.md and two
# other documents described it as the mitigation for a live exposure. The guard
# that asserts this stays wired -- credential-free, so it runs on pull requests
# too -- is the "live bucket IAM check is wired to a job that runs" step in
# build.yml's budget-guard job.
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

#
# BOTH SPELLINGS ARE READ, for UBLA as well as for PAP (Wave 0 item A-11). Until
# now the PAP reader tolerated snake_case AND camelCase while the UBLA reader
# accepted snake_case only -- an asymmetry with no reason behind it. It fails
# CLOSED, so it was never dangerous: a gcloud that returned
# `uniformBucketLevelAccess` would resolve None, compare unequal to True and
# stop the run. But stopping the run on a CORRECT bucket is precisely the
# Checkpoint 4 cry-wolf failure described above, paid for a second time.
#
# `if ubla is None` rather than `a or b`: `or` would also swallow a literal
# False, reporting the field as absent when it was present and OFF -- the one
# case where the message must be exact, because it is the real finding.
read -r UBLA PAP <<<"$(printf '%s' "${SETTINGS_JSON}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
ubla = d.get('uniform_bucket_level_access')
if ubla is None:                    # a future gcloud may spell it camelCase
    ubla = d.get('uniformBucketLevelAccess')
if isinstance(ubla, dict):          # older gcloud nests it
    ubla = ubla.get('enabled')
pap = d.get('public_access_prevention') or d.get('publicAccessPrevention')
print(f'{ubla} {pap}')
")"

if [ "${UBLA}" = "True" ]; then
  pass "uniform_bucket_level_access is True -- object ACLs are disabled and IAM is the only access path"
else
  fail "uniform_bucket_level_access is '${UBLA}', expected True (read under both the snake_case and camelCase spellings of the field). STOP: with it off, an object ACL can make a private object public with no IAM change, and this script's remaining checks prove nothing."
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
# 2b. WHAT THE LEGACY PLACEHOLDERS ACTUALLY EXPAND TO. This is the check that
#     turns a silent, latent exposure into a loud one.
#
# The four legacy bindings printed above name PLACEHOLDERS, not principals:
#
#   projectViewer:<project>  <- every principal holding roles/viewer
#     legacyBucketReader, legacyObjectReader -> objects.get, objects.list
#
#   projectEditor:<project>  <- every principal holding roles/editor
#     legacyBucketOwner  -> objects.create, objects.delete, objects.list,
#                           objects.restore, and buckets.setIamPolicy
#     legacyObjectOwner  -> objects.get, objects.update, objects.setIamPolicy
#     UNION: create, delete, get, LIST, update, setIamPolicy on EVERY object.
#
#   projectOwner:<project>   <- every principal holding roles/owner
#     the same two owner bindings as projectEditor.
#
# WHY THIS BLOCK WAS WRONG UNTIL WAVE 0, stated plainly because the mistake is
# instructive (#55; Chief Reviewer B-4; Boundary Tester 6b; Skeptic Verifier
# F-4). It expanded roles/viewer ONLY, and its reasoning was entirely about
# READERS. Live IAM says roles/viewer has no binding on this project at all,
# while roles/editor is POPULATED. So the guard asserted over the empty set,
# passed, protected nothing -- and was presented in infra/README.md as the
# mitigation for exactly the exposure it could not see. A guard that cannot fail
# is worse than no guard, because it is counted as coverage.
#
# objects.list is the sharpest part of the editor union. SEAM-1 withholds list
# from the GATE deliberately -- "object names in this bucket are themselves
# private material" -- and privateObjectReader holds exactly storage.objects.get
# for that reason. An untracked identity reaching the same bucket with list
# undoes that decision without touching this module.
#
# Uniform bucket-level access does NOT remove these bindings: established from
# the live policy rather than assumed. UBLA is enforced on this bucket and all
# four legacy bindings are still present in the output printed above.
#
# THE THREE ROLES ARE TREATED DIFFERENTLY, and the difference is the point:
#   roles/viewer  FAILS -- nobody should hold it; it reads every private object.
#   roles/editor  FAILS -- it reads, WRITES, DELETES and LISTS every private
#                 object, and can rewrite the bucket's own IAM policy.
#   roles/owner   REPORTED, never failed -- the project owner holds it, that is
#                 expected and irremovable, and failing on it would make this
#                 check red on every run. A check that is always red is a check
#                 that gets switched off, and then the two above stop being
#                 watched too.
#
# Removing the legacy bindings is NOT attempted here and must not be: it needs
# an authoritative google_storage_bucket_iam_policy, which would also strip the
# OWNER's own object access, since projectOwner reaches objects by the same
# mechanism. That is a separate decision with the owner (Wave 0 infra handoff,
# item 5).
# ---------------------------------------------------------------------------
PROJECT_POLICY="$(gcloud projects get-iam-policy "${PROJECT}" --format=json)"

# One read of the project policy, three expansions of it. Reading it once also
# means the three answers cannot disagree with each other.
members_of() {
  printf '%s' "${PROJECT_POLICY}" | python3 -c '
import json, sys
wanted = sys.argv[1]
policy = json.load(sys.stdin)
for binding in policy.get("bindings", []):
    if binding.get("role") == wanted:
        for member in binding.get("members", []):
            print(member)
' "$1" | sort
}

VIEWERS="$(members_of roles/viewer)"
EDITORS="$(members_of roles/editor)"
OWNERS="$(members_of roles/owner)"

if [ -z "${VIEWERS}" ]; then
  pass "no principal holds roles/viewer on ${PROJECT}, so projectViewer expands to the empty set and the legacy READER bindings grant nobody anything"
else
  fail "roles/viewer on ${PROJECT} is NOT empty. Through the automatic legacyBucketReader/legacyObjectReader bindings, each principal below can READ (storage.objects.get) and ENUMERATE (storage.objects.list) EVERY PRIVATE OBJECT in gs://${BUCKET}:"
  echo "${VIEWERS}" | sed 's/^/    /'
  echo "    Remove roles/viewer from them, or replace this bucket's IAM policy"
  echo "    authoritatively to drop the legacy reader bindings (Wave 0 infra"
  echo "    handoff, item 5 -- note it would also drop the owner's own access)."
fi

if [ -z "${EDITORS}" ]; then
  pass "no principal holds roles/editor on ${PROJECT}, so projectEditor expands to the empty set and the legacy OWNER bindings grant nobody anything"
else
  fail "roles/editor on ${PROJECT} is NOT empty. Through the automatic legacyBucketOwner/legacyObjectOwner bindings, each principal below holds create, delete, get, LIST, update and setIamPolicy on EVERY OBJECT in gs://${BUCKET}, plus storage.buckets.setIamPolicy on the bucket itself -- so it can read the committee dossier, DESTROY it, ENUMERATE every private object name, and rewrite who else may do so:"
  echo "${EDITORS}" | sed 's/^/    /'
  echo "    storage.objects.list is the sharpest of those: SEAM-1 withholds it"
  echo "    from the GATE itself, because object names in this bucket are"
  echo "    private material. An untracked identity must not hold it."
  echo "    Remove roles/editor from them (the default compute service account"
  echo "    holds it unless it was removed), or replace this bucket's IAM policy"
  echo "    authoritatively -- see the note above on what that also removes."
fi

# Reported, never failed. See the header: the owner holds roles/owner, and a
# check that is red on every correct run is a check nobody keeps running.
if [ -n "${OWNERS}" ]; then
  echo "NOTE: roles/owner on ${PROJECT} expands to the principals below. They reach"
  echo "      every object in gs://${BUCKET} through projectOwner, by exactly the"
  echo "      same legacy mechanism as projectEditor. This is EXPECTED and is not"
  echo "      failed on -- but it is the reason the legacy bindings cannot simply"
  echo "      be dropped, and it should be a SHORT list:"
  echo "${OWNERS}" | sed 's/^/    /'
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
# WHICH IDENTITY RUNS THIS, and why it is not the deploy identity. Settled in
# Wave 0 (#58); the previous version of this note left it open.
#
# Reading a bucket's IAM policy needs storage.buckets.getIamPolicy, and §2b
# additionally needs resourcemanager.projects.getIamPolicy. The hub's deploy
# identity holds NEITHER: its grants are roles/storage.objectViewer on the
# content bucket and privateSyncWriter's four object permissions on this one --
# object permissions, none of which reads bucket metadata, a bucket policy, or
# the project policy. (The same gap was recorded in Phase 2:
# roles/storage.objectViewer does not include storage.buckets.get.)
#
# The three options were:
#   (a) add those permissions to privateSyncWriter -- rejected. It widens the
#       identity that can DELETE every private object, for a check rather than
#       for the work.
#   (b) a separate, read-only auditor identity used by the check only -- TAKEN.
#       infra/auditor.tf: hub-auditor holds exactly three permissions, no
#       storage.objects.* of any kind, no key, and authenticates only from
#       refs/heads/main through the existing WIF pool.
#   (c) leave it an owner/Checkpoint procedure -- which is what "this phase
#       implements" used to say, and is how the live half came to run nowhere
#       for two phases while three documents said it ran.
# ---------------------------------------------------------------------------
