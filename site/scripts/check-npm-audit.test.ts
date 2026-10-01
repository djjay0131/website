import { describe, it, expect } from "vitest";
import { advisoryIdFromUrl, classify, collectAdvisories } from "./check-npm-audit.mjs";

const audit = {
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 } },
  vulnerabilities: {
    "@grpc/grpc-js": {
      severity: "high",
      via: [
        { name: "@grpc/grpc-js", severity: "high", url: "https://github.com/advisories/GHSA-m9gg-hp2v-232j" },
        { name: "@grpc/grpc-js", severity: "low", url: "https://github.com/advisories/GHSA-f596-whhp-79r4" },
      ],
    },
    firebase: { severity: "high", via: ["@firebase/firestore"] },
  },
};

const baseline = {
  accepted: [{ id: "GHSA-m9gg-hp2v-232j" }, { id: "GHSA-f596-whhp-79r4" }],
};

describe("check-npm-audit reads an audit report", () => {
  it("extracts the GHSA id from an advisory URL", () => {
    expect(advisoryIdFromUrl("https://github.com/advisories/GHSA-abcd-efgh-ijkl")).toBe(
      "GHSA-abcd-efgh-ijkl",
    );
    expect(advisoryIdFromUrl("not a url")).toBeNull();
  });

  it("collects each advisory once, ignoring the string 'via' entries", () => {
    expect(collectAdvisories(audit).map((a) => a.id)).toEqual([
      "GHSA-f596-whhp-79r4",
      "GHSA-m9gg-hp2v-232j",
    ]);
  });

  it("reports nothing NEW when every advisory is in the baseline", () => {
    expect(classify(audit, baseline).novel).toEqual([]);
    expect(classify(audit, baseline).known.map((a) => a.id)).toHaveLength(2);
  });

  it("SHOWS RED on an advisory outside the baseline", () => {
    // The guard is only a guard if a new advisory is visibly different from an
    // accepted one. Drop one id from the baseline and it must surface as NEW.
    const thin = { accepted: [{ id: "GHSA-m9gg-hp2v-232j" }] };
    const { novel } = classify(audit, thin);
    expect(novel.map((a) => a.id)).toEqual(["GHSA-f596-whhp-79r4"]);
  });
});
