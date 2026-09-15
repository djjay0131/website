# CV data test fixture

A small, synthetic content pool and two variants for `src/lib/cv-data.test.ts`.
Every name, id and value here is invented.

The exact-value assertions in that test run against this fixture, not against
`site/data/`, which `scripts/fetch-data.sh` fills from whichever `cv` release
is current. Tests that read `site/data/` check structure only, so `npm test`
passes whatever release is fetched (SEAM-1, SEAM-2).

Change this fixture and the assertions together.
