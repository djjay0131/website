import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  githubRepositoryUrl,
  parseSatelliteRepositories,
  readSatelliteRepositories,
  repositoryFor,
} from "./repositories.mjs";

const VARIABLES = `
# a comment with repository = "wrong/wrong"
variable "satellites" {
  type = map(object({
    repository          = string
    repository_id       = string
    repository_owner_id = string
    default_branch      = string
  }))
  default = {
    source-a = {
      repository          = "example/source-a"
      repository_id       = "1"
      repository_owner_id = "2"
      default_branch      = "main"
    }
    # source-b is commented out
    source-b = {
      repository          = "example/source-b"
      repository_id       = "3"
      repository_owner_id = "2"
      default_branch      = "master"
    }
  }
}
`;

const TFVARS = `
satellites = {
  source-a = {
    repository    = "example/tfvars-a"
    default_branch = "main"
  }
}
`;

describe("the build-time satellite repository map", () => {
  it("reads the Terraform default map and ignores comments and numeric ids", () => {
    expect(parseSatelliteRepositories(VARIABLES)).toEqual({
      "source-a": "example/source-a",
      "source-b": "example/source-b",
    });
  });

  it("prefers terraform.tfvars over the variable default", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "repos-"));
    fs.mkdirSync(path.join(root, "infra"), { recursive: true });
    fs.writeFileSync(path.join(root, "infra", "variables.tf"), VARIABLES);
    fs.writeFileSync(path.join(root, "infra", "terraform.tfvars"), TFVARS);
    expect(readSatelliteRepositories({ root, env: {} })).toEqual({
      "source-a": "example/tfvars-a",
    });
    expect(repositoryFor("source-a", { root, env: {} })).toBe("example/tfvars-a");
    expect(repositoryFor("source-b", { root, env: {} })).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("uses an explicit environment map and drops malformed entries", () => {
    const repositories = readSatelliteRepositories({
      env: { HUB_SATELLITE_REPOS: '{"source-a":"example/ok","bad":"no-slash","source-b":7}' },
    });
    expect(repositories).toEqual({ "source-a": "example/ok" });
  });

  it("returns nothing rather than guessing when the config is absent or malformed", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "repos-"));
    expect(readSatelliteRepositories({ root, env: {} })).toEqual({});
    expect(repositoryFor("source-a", { root, env: {} })).toBeNull();
    expect(parseSatelliteRepositories('satellites = { source-a = { repository = "nope" }')).toEqual({});
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("builds only https GitHub URLs", () => {
    expect(githubRepositoryUrl("example/source-a")).toBe("https://github.com/example/source-a");
    expect(githubRepositoryUrl("not a repo")).toBeNull();
  });
});

describe("repository root discovery", () => {
  it("walks up from a nested directory to the repository root", async () => {
    const { findRepoRoot } = await import("./repositories.mjs");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "repos-root-"));
    fs.mkdirSync(path.join(root, "infra"), { recursive: true });
    fs.writeFileSync(path.join(root, "infra", "variables.tf"), VARIABLES);
    const nested = path.join(root, "site", "src-private", "lib");
    fs.mkdirSync(nested, { recursive: true });
    expect(findRepoRoot(nested)).toBe(root);
    expect(findRepoRoot(path.join(root, "no-such-dir"))).toBe(root);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
