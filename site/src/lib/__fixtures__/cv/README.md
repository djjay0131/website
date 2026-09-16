# CV data test fixture

A small, synthetic content pool and two variants for `src/lib/cv-data.test.ts`.
Every name, id and value here is invented.

The exact-value assertions in that test run against this fixture, not against
the payload the `cv` satellite published, which `scripts/sync-content.sh` syncs
into `site/src/content/sources/cv/cv-data/` from the content bucket (Phase 2,
SEAM-5). Tests that read the synced payload check structure only, so `npm test`
passes whatever `cv` last published.

This is not the same thing as `site/fixtures/content/`, which is a whole
bucket-shaped tree used to build the site with no cloud access. This one is a
content pool for unit tests and nothing else.

Change this fixture and the assertions together.
