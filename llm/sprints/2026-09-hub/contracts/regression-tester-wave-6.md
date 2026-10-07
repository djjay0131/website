# Contract — Regression Tester, Wave 6 (annotations)

Status: Issued
Date: 2026-10-07
Owner: Lead Architect
Issue: #107
Branch: `feat/annotations`
Baseline (pre-wave, on `main` @ `4f33edc`): site **421 passed / 2 skipped**;
gate pytest green (record the exact count before and after).

## Mandate

Prove nothing existing regressed. Record the pre-wave baseline and the
post-change numbers and compare like for like. Report PASS/FAIL per suite, and a
finding for any change even if it looks benign.

## Checks

1. Every existing suite green and unchanged in count or explained: `site`
   `npm test`, `npm run build:public`, `npm run build:private`,
   `npm run check:no-private-in-public`, `npm run check:private-links`,
   `npm run check:publish-allowlist`, `npm run check:smoke-routes`,
   `npm run contrast`; `gate` `pytest`; `contract` tests.
2. **Leak check gains the annotation needles and stays green on a clean build**;
   the demo (`npm run demo:leak-check`) still fails as designed.
3. The `X-Frame-Options` change did not relax any non-`_payload` response.
4. `/share`, `/s/**`, `/p/**` and `/session/*` behaviour is unchanged (the
   shares suite and the gate security/header suites still pass).
5. `/p/notes/` does not appear in the public build; the private build still
   emits the existing item frames and the Shares page.
6. `governance-checks --layout` 4/4 (the Lead Architect runs this too).

Report as `handoffs/regression-tester-wave-6.md`.
