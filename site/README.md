# site

The Astro site behind the Research Hub: static output, no server runtime
(ADR-0003). It is served from Firebase Hosting at its canonical host,
`https://jason.cusati.us/` (ADR-0006), and, until Phase 6, from GitHub Pages at
`https://djjay0131.github.io/website/` (ADR-0001).

`site/` is a self-contained npm project. Run every command below from this
directory.

## Build interface

```sh
npm ci          # install
npm test        # unit tests; no network, no credentials
npm run build   # static site into dist-public/
npm run check:smoke-routes   # fail if a smoke-test route has no file in dist-public/
```

The build reads the CV data described under [CV data](#cv-data). It needs no
credentials.

`npm run check:smoke-routes [-- <output-dir>]` (SEAM-7) runs after either
build variant. It reads `SMOKE_ROUTES` from `scripts/site-routes.mjs` and
requires `<route>/index.html` for each page route and the file itself for each
file route, such as `/pdfs/academic.pdf`. Output paths never include
`SITE_BASE`. It prints each missing route and exits 1, or exits 2 when there is
no build output. A local build has no CV PDFs unless the data was fetched, so
`/pdfs/academic.pdf` is reported missing there.

### Environment variables

Both are optional. An unset or empty variable takes its default.

| Variable    | Meaning                                         | Default                   |
| ----------- | ----------------------------------------------- | ------------------------- |
| `SITE_URL`  | Absolute origin, no path and no trailing slash  | `https://jason.cusati.us` |
| `SITE_BASE` | Path the site is served under                   | `/`                       |

```sh
npm run build                                                            # Firebase Hosting
SITE_URL=https://djjay0131.github.io SITE_BASE=/website/ npm run build   # GitHub Pages
```

`SITE_URL` sets canonical URLs, the sitemap and `robots.txt`. `SITE_BASE`
prefixes every internal link, asset and redirect target. Code builds links
with `import.meta.env.BASE_URL`; never write a base such as `/website/` into
a page. `astro.config.mjs` reads both variables through
`scripts/site-env.mjs`, which rejects a `SITE_URL` that carries a path.

Node: see `engines` in `package.json` (CI uses Node 22).

## Published content

The CV, resumes, papers, projects and home page render content that a
**satellite repository published through the publishing contract**
(`../contract/`, ADR-0002, ADR-0007, ADR-0008). None of it is committed:
`src/content/sources/`, `public/pdfs/` and `public/photo_jason_1.jpeg` are
gitignored, and so are the staging trees `.release-content/` and
`.local-content/`.

```text
gs://<bucket>/sources/<source>/manifest.json   the manifest: what this source publishes
gs://<bucket>/sources/<source>/<path…>         exactly that source's dist/
                    │
                    ▼  scripts/sync-content.sh
src/content/sources/<source>/…                 what the build reads
```

`src/content.config.ts` validates each `manifest.json` against a Zod mirror of
`../contract/manifest.schema.json` and fails the build on anything the JSON
Schema would reject, on a duplicate `slug`, and on a `format: data` item the hub
does not claim. The claimed set — in Phase 2, exactly `("cv", "cv-data")` — is
declared in `src/lib/hub-content.mjs`, which is also the one place that says
where the synced payload lives.

`scripts/stage-public-assets.mjs` then copies each published CV PDF to
`public/pdfs/<slug>.pdf` and the photo to `public/photo_jason_1.jpeg`, so every
URL Phase 1 served keeps resolving. The sync runs it automatically.

### Getting content locally

None of these needs a cloud credential.

```sh
npm run data:link                            # a local cv checkout at ../../cv
CV_REPO_PATH=/path/to/cv npm run data:link   # a checkout elsewhere
npm run dev:local                            # data:link, then astro dev (hot reload)
npm run data:fetch                           # the cv GitHub release (needs gh, unzip)
npm run content:fixture                      # the committed fixture: no cv, no network
```

All four produce the same bucket-shaped tree and the same manifest, so they
exercise the same validation the bucket path does. `fixtures/` explains what the
fixture is for and what it is not.

### Reading the bucket

```sh
./scripts/sync-content.sh --bucket <name> --token <oauth-token>
./scripts/sync-content.sh --fingerprint --bucket <name>   # the poll's fingerprint
```

The script makes exactly two kinds of call, `objects.list` and `objects.get`,
and never reads bucket metadata: the hub's grant is
`roles/storage.objectViewer`, which does not include `storage.buckets.get`. CI
obtains the token through Workload Identity Federation; there is no key file
anywhere. The fingerprint is a SHA-256 over the sorted listing of every object,
so it changes when one is **deleted** as well as added or replaced — a withdrawn
item must never leave the site looking unchanged.

CI also writes `public/build-info.json` (`content_fingerprint`,
`cv_fingerprint`, `content_source`); no script does.

## Local development

```sh
npm run dev        # http://localhost:4321/
npm run preview    # serve dist-public/ after a build
npx astro check    # type-check .astro and .ts files
```

The VS Code launch configuration in the repository's `.vscode/` starts the
dev server from `site/`.

## Layout

```text
src/
  content.config.ts        the Zod mirror of ../contract/manifest.schema.json
  content/sources/         published content, synced from the bucket (gitignored)
  styles/tokens.css        design tokens: type, light and dark palettes
  layouts/Base.astro       document head, navigation, footer
  layouts/SectionIndex.astro   a section landing: title, lede, item list or empty state
  layouts/ItemPage.astro   one item: title, date and metadata, body, back link
  pages/                   routes (research, projects, writing, cv, phd, papers, resumes)
  components/              research-track components
  lib/                     CV, bibliography and Markdown loaders
  lib/hub-content.mjs      the claimed data items, and where the payload lives
scripts/                   content sync, redirect map, contrast check
fixtures/content/          a bucket-shaped tree for credential-free local work
redirects/github-pages.json    redirect map from the GitHub Pages URLs
```

### Design system

Spectral for display type, IBM Plex Sans for body text and IBM Plex Mono for
metadata, self-hosted from `@fontsource` packages; nothing is loaded from a
font CDN. The palette uses a petrol accent (`#0F5C5A`), brass for caution and
clay for risk. It has light and dark variants, chosen by the reader's
`prefers-color-scheme`; no JavaScript is involved. Use the tokens (`var(--color-…)`,
`var(--font-…)`) rather than literal colours. `npm run contrast` prints each
text colour's contrast ratio, and `npm test` fails if one drops below WCAG AA
(4.5:1).

### Sections

`research`, `projects`, `writing` and `cv` are in the public navigation, with
`papers` and `resumes` beside them. `phd` is an empty shell. It is not linked,
is marked `noindex`, and is left out of the sitemap. Section names are the
fixed set in the design doc §4.

## Redirect map

`redirects/github-pages.json` maps every route the GitHub Pages build serves
(`/website/<path>`) to its path on the new host (`/<path>`). It is recorded
now and served in Phase 6. The map is generated, never edited by hand:

```sh
npm run redirects:generate   # build the Pages variant in a temp dir, inventory it, write the map
npm run redirects:check      # the same inventory; fail if the committed map misses a route
```

The inventory covers every page and file in the build except content-hashed
`_astro/` assets, plus every Astro `redirects` source, the `build.yml` smoke-test
routes, and the files CI adds (`build-info.json`, the photo, and one PDF per CV
variant). Page routes are in trailing-slash form. `npm test` checks the committed
map against every static page, public file, redirect source and smoke-test route.
Those routes do not depend on the CV data. `REDIRECT_MAP_CHECK_BUILD=1 npm test`,
run after a build, also checks every route in `dist-public/`, including the
data-dependent ones. That check is off by default, so a new `cv` release cannot
fail CI. Regenerate the map when a page, a CV variant or a project is added.

## Hosting

`../firebase.json` publishes `dist-public/` with `cleanUrls: false` and
`trailingSlash: true`. A file path such as `/pdfs/academic.pdf` is served as is.
A page path without its trailing slash (for example `/cv/academic`) gets a 301
to the slash form (`/cv/academic/`), which serves `cv/academic/index.html`.
GitHub Pages does the same.
