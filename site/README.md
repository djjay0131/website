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

## CV data

The CV, resumes, papers, projects and home page render data from the `cv`
repository's `latest` release. None of it is committed: `data/`,
`public/pdfs/` and `public/photo_jason_1.jpeg` are gitignored.

```sh
GH_TOKEN=<token> ./scripts/fetch-data.sh    # or: npm run data:fetch
```

`scripts/fetch-data.sh` is the one place that downloads CV data. It writes
`data/content/`, `data/variants/` and `data/own-bib.bib` from `cv-data.zip`,
every release PDF into `public/pdfs/`, and the photo into `public/`. It needs
`gh` and `unzip`; `CV_REPO` and `CV_TAG` override the repository and tag. CI
also writes `public/build-info.json` (the `cv` release fingerprint); the
script does not.

To work against a local `cv` checkout instead, with live reload:

```sh
npm run dev:local                                   # links ../../cv, then astro dev
CV_REPO_PATH=/path/to/cv npm run data:link          # link a checkout elsewhere
```

`scripts/sync-local-data.sh` replaces `data/` with symlinks into that checkout.

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
  styles/tokens.css        design tokens: type, light and dark palettes
  layouts/Base.astro       document head, navigation, footer
  layouts/SectionIndex.astro   a section landing: title, lede, item list or empty state
  layouts/ItemPage.astro   one item: title, date and metadata, body, back link
  pages/                   routes (research, projects, writing, cv, phd, papers, resumes)
  components/              research-track components
  lib/                     CV, bibliography and Markdown loaders
scripts/                   data fetch, redirect map, contrast check
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
