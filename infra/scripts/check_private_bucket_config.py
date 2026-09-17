# The bucket IAM test, credential-free half (roadmap: "The bucket IAM test runs
# on every deploy and fails if the private bucket grants public access or any
# reader other than the gate's service account"; design doc §12.1; ADR-0005
# decision 3).
#
# WHAT THIS IS, AND WHAT IT IS NOT.
#
# The roadmap's criterion is ultimately about a live IAM policy, and a live
# policy cannot be read without cloud credentials. This script checks the half
# that CAN be checked with no credentials at all: that the CONFIGURATION which
# produces that policy still says what it must. The other half -- the policy as
# the project actually holds it -- is scripts/check-private-bucket-iam.sh, which
# needs a token and belongs on the deploy path and in the Checkpoint 4 runbook.
#
# Both halves are needed, and neither replaces the other:
# - A configuration check runs on every pull request, before anything is
#   applied, and catches the edit that would widen access at review time.
# - A live check catches drift, a console click, and anything granted outside
#   Terraform -- which Terraform structurally cannot see, because it knows only
#   what it declares.
#
# It is written as a Python module with NO shebang, invoked as
# `python3 infra/scripts/check_private_bucket_config.py`, deliberately: this
# repository requires every tracked *.sh beginning with a shebang to be
# committed 100755, and the filesystem it is developed on (/mnt/c, DrvFs)
# reports every file as 0777, so a mode defect is invisible locally and fails
# only on a Linux runner. Not depending on an executable bit removes that
# failure mode for the check CI runs on every push. It mirrors the inline
# python3 the budget-guard job already uses for the same class of assertion.
#
# Exit status: 0 if every invariant holds, 1 otherwise, with a
# ::error file=...:: annotation per failure so GitHub annotates the offending
# file.

import re
import sys
from pathlib import Path

# Resolve paths relative to infra/, so the script runs from the repository root
# or from infra/ without a --chdir flag.
INFRA = Path(__file__).resolve().parent.parent

# The exact permission lists the two private-bucket roles must hold. Written
# here as well as in private-roles.tf on purpose: this is a guard, and a guard
# that reads its expectation from the file it is guarding checks nothing.
EXPECTED_ROLE_PERMISSIONS = {
    "private_object_reader": ["storage.objects.get"],
    "private_sync_writer": [
        "storage.objects.create",
        "storage.objects.delete",
        "storage.objects.get",
        "storage.objects.list",
    ],
}

# The only two resources allowed to hold a binding on the private bucket, and
# the custom role each must use. A third binding, or a different role on an
# existing one, fails this check.
EXPECTED_PRIVATE_BUCKET_BINDINGS = {
    "gate_private_reader": "private_object_reader",
    "hub_deploy_private_sync": "private_sync_writer",
}

FAILURES = []


def fail(path, message):
    print(f"::error file={path}::{message}")
    FAILURES.append(message)


def read_without_comments(relative_path):
    """Read a Terraform file with # comments stripped.

    Every file in this module carries long comment blocks that quote the very
    strings being asserted -- 'storage.objects.list' appears a dozen times in
    prose explaining why it is absent. Matching against raw text would pass on a
    comment and fail on nothing, so comments are removed before any assertion.
    """
    text = (INFRA / relative_path).read_text(encoding="utf-8")
    return re.sub(r"#[^\n]*", "", text)


def permissions_of(source, resource_name):
    """Return the permission list of a google_project_iam_custom_role block."""
    block = re.search(
        r'resource\s+"google_project_iam_custom_role"\s+"'
        + re.escape(resource_name)
        + r'"\s*\{(.*?)\n\}',
        source,
        re.S,
    )
    if not block:
        return None
    permissions = re.search(r"permissions\s*=\s*\[(.*?)\]", block.group(1), re.S)
    if not permissions:
        return []
    return re.findall(r'"([^"]+)"', permissions.group(1))


def main():
    bucket = read_without_comments("private-bucket.tf")
    roles = read_without_comments("private-roles.tf")

    # ------------------------------------------------------------------
    # 1. Uniform bucket-level access.
    #
    # THE ONE THAT FAILS OPEN. Without it an IAM condition does not apply at
    # all, and object ACLs -- which can make a single object public with no IAM
    # change anywhere -- are re-enabled. Nothing errors when it is off. This
    # assertion exists because the breakage is invisible everywhere else.
    # ------------------------------------------------------------------
    if not re.search(r"\buniform_bucket_level_access\s*=\s*true\b", bucket):
        fail(
            "infra/private-bucket.tf",
            "google_storage_bucket.private must set uniform_bucket_level_access = true. "
            "Without it, object ACLs are re-enabled and any IAM condition stops applying "
            "-- the boundary fails open with no error anywhere.",
        )

    # ------------------------------------------------------------------
    # 2. Public access prevention. Half of the roadmap's criterion verbatim:
    #    the test fails if the private bucket grants public access.
    # ------------------------------------------------------------------
    if not re.search(r'\bpublic_access_prevention\s*=\s*"enforced"', bucket):
        fail(
            "infra/private-bucket.tf",
            'google_storage_bucket.private must set public_access_prevention = "enforced". '
            "The private bucket is never public (design doc §12.1).",
        )

    # ------------------------------------------------------------------
    # 3. No anonymous or all-authenticated principal anywhere near this bucket.
    #
    # public_access_prevention would refuse such a binding at the API, so this is
    # the second of two independent controls. It is worth having twice because it
    # is the failure with the worst consequence in the repository.
    #
    # Note the scope: allUsers IS correct on the Cloud Run service (ADR-0004 --
    # the gate's invoker is allUsers deliberately, and authorisation is
    # application-level). This check is about the BUCKET, so it reads
    # private-bucket.tf only and says nothing about gate.tf.
    # ------------------------------------------------------------------
    for principal in ("allUsers", "allAuthenticatedUsers"):
        if principal in bucket:
            fail(
                "infra/private-bucket.tf",
                f"{principal} must never appear in private-bucket.tf. The private bucket "
                "has exactly two principals: the gate's service account (read) and the "
                "hub's deploy identity (sync).",
            )

    # ------------------------------------------------------------------
    # 4. The two custom roles hold exactly their permissions.
    #
    # privateObjectReader must never gain storage.objects.list: object names in
    # the private bucket are themselves private material, so a gate that can list
    # can enumerate what exists before reading a byte.
    # ------------------------------------------------------------------
    for resource_name, expected in EXPECTED_ROLE_PERMISSIONS.items():
        found = permissions_of(roles, resource_name)
        if found is None:
            fail(
                "infra/private-roles.tf",
                f'private-roles.tf must declare resource "google_project_iam_custom_role" '
                f'"{resource_name}".',
            )
        elif sorted(found) != sorted(expected):
            fail(
                "infra/private-roles.tf",
                f"{resource_name} must grant exactly {sorted(expected)} -- got "
                f"{sorted(found)}.",
            )

    # ------------------------------------------------------------------
    # 5. The private bucket carries exactly two bindings, each with its own role.
    #
    # This is the "no reader other than..." clause, asserted structurally: a new
    # google_storage_bucket_iam_member on this bucket fails the check until it is
    # added here deliberately, with a reviewer looking at it.
    # ------------------------------------------------------------------
    bindings = dict(
        re.findall(
            r'resource\s+"google_storage_bucket_iam_member"\s+"([A-Za-z0-9_]+)"\s*\{'
            r"(?:[^{}]|\{[^{}]*\})*?"
            r"bucket\s*=\s*google_storage_bucket\.private\.name"
            r"(?:[^{}]|\{[^{}]*\})*?"
            r"role\s*=\s*google_project_iam_custom_role\.([A-Za-z0-9_]+)\.name",
            bucket,
            re.S,
        )
    )
    if bindings != EXPECTED_PRIVATE_BUCKET_BINDINGS:
        fail(
            "infra/private-bucket.tf",
            "The private bucket must carry exactly these bindings: "
            f"{EXPECTED_PRIVATE_BUCKET_BINDINGS} -- found {bindings}. Every binding must "
            "use one of the two custom roles in private-roles.tf; a predefined role here "
            "would carry storage.objects.list.",
        )

    if FAILURES:
        print(f"\n{len(FAILURES)} private-bucket invariant(s) violated.")
        return 1

    print(
        "OK: private bucket declares uniform bucket-level access and enforced public "
        "access prevention, names no anonymous principal, and carries exactly two "
        "bindings -- the gate (storage.objects.get) and the hub's sync "
        "(create/delete/get/list)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
