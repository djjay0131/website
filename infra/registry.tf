# Artifact Registry for the gate image (design doc §8; roadmap
# §phase-3-private-area "images in Artifact Registry keeping the last 5", R-A4).
#
# One Docker repository in var.region, holding exactly one image: the gate.
# .github/workflows/gate.yml (the gate stream) builds and pushes to it, and
# Cloud Run pulls from it.
#
# WHO TOUCHES IT, and with what:
# - gate-deploy pushes (roles/artifactregistry.writer, gate.tf), granted on THIS
#   REPOSITORY and not on the project.
# - The Cloud Run Service Agent pulls. It needs no grant here: the repository and
#   the service are in the same project, and image pulling is done by the
#   service agent, not by the gate's runtime identity. The gate's own service
#   account therefore holds nothing on this repository -- stated because
#   "the runtime SA needs artifactregistry.reader" is a common and unnecessary
#   addition.
#
# KEEPING THE LAST 5 (roadmap R-A4). Two policies, which is how Artifact
# Registry expresses "keep N": a DELETE policy that matches every version, and a
# KEEP policy that protects the newest five. Precedence makes the pair safe:
# "When an artifact matches the criteria for both a delete policy and a keep
# policy, the artifact is kept" (Artifact Registry, "Configure cleanup
# policies"). So the effect is exactly: the five most recent versions survive,
# everything older is removed.
#
# cleanup_policy_dry_run is set to false EXPLICITLY. It defaults to false, but it
# is stated because true is the setting that makes this whole block a no-op --
# "If true, the cleanup pipeline is prevented from deleting versions in this
# repository" -- and a cleanup policy that silently never deletes looks
# identical, in the configuration, to one that works.
#
# Deliberately NOT set:
# - docker_config.immutable_tags: the deploy re-points a moving tag at each new
#   image, and immutable tags would refuse that. Provenance comes from the image
#   digest Cloud Run records on the revision, not from tag immutability.
# - kms_key_name (CMEK): Google-managed encryption is the default and a KMS key
#   is a key to rotate, guard and pay for. The image is built from a public
#   repository's Dockerfile and holds no secret.
# - a remote or virtual repository: nothing here proxies an upstream registry.
# - vulnerability_scanning_config: Artifact Analysis is billed per scanned image
#   and is outside the $5 budget's headroom. Worth revisiting if the gate grows
#   dependencies; recorded in the handoff rather than silently omitted.

resource "google_artifact_registry_repository" "gate" {
  project       = var.project_id
  location      = var.region
  repository_id = local.gate_service_name
  description   = "Container images for the ${local.gate_service_name} Cloud Run service. Keeps the 5 most recent versions (roadmap R-A4)."
  format        = "DOCKER"
  mode          = "STANDARD_REPOSITORY"

  # Deletes any version, tagged or untagged, EXCEPT those the keep policy below
  # protects. tag_state = "ANY" is the provider default; it is written out
  # because the default is what makes this policy match everything, and a reader
  # should not have to know that to see it.
  cleanup_policies {
    id     = "delete-superseded-images"
    action = "DELETE"
    condition {
      tag_state = "ANY"
    }
  }

  # Protects the 5 most recent versions, and wins over the DELETE policy above.
  # package_name_prefixes is omitted so it applies to every package in the
  # repository -- there is only one, the gate.
  cleanup_policies {
    id     = "keep-last-5-images"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policy_dry_run = false

  depends_on = [google_project_service.phase3]
}
