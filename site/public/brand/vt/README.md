# Virginia Tech logos

Served from `site/public/`, so each file is reachable at
`/brand/vt/<name>` on the built site.

## What is here, and what was left out

Source: `Virginia-Tech-Logos.zip` from
<https://brand.vt.edu/content/dam/brand_vt_edu/downloads/logo/Virginia-Tech-Logos.zip>,
pack dated 9.12.2023. Downloaded 2026-09-21.

The archive is **74 MB / 497 files**. This directory is **28 files / ~300 KB** —
the subset a web build can actually use:

| Kept | Why |
|---|---|
| `Digital RGB` | The web colour space. `Print CMYK` and `Print PMS` are for print and render wrong on screen. |
| `.svg`, `.png` | `.ai` and `.eps` need Illustrator; `.pdf` is not an image tag; `.jpg` cannot do transparency, which a logo needs. |
| Both orientations, all 7 colourways | Small enough that picking for you would be the wrong call. |

Committing the full pack would have put ~74 MB of print masters into git history
permanently, for files no page can render. If you need `.ai`/`.eps`/CMYK/PMS,
take them from the source archive rather than adding them here.

Filenames are normalised: lowercase, hyphenated, no spaces. The pack ships a
directory literally named `Orange:White` — a colon is illegal in a Windows path
and hostile in a URL — which became `orange-white`.

## Naming

```
vt-{horizontal|vertical}-{full-color|maroon|orange|orange-white|black|gray|white}.{svg|png}
```

Prefer **SVG** — it scales and stays crisp on high-DPI displays. Use PNG only
where SVG is not an option.

`white` and `orange-white` are for dark backgrounds; they are invisible on
light ones.

```html
<img src="/brand/vt/vt-horizontal-full-color.svg" alt="Virginia Tech" />
```

## Usage terms — read before shipping these publicly

**These are Virginia Tech trademarks, not this project's assets, and this
directory grants no rights to them.** The archive shipped no licence file; the
governing terms live at <https://brand.vt.edu>.

This site is public. University marks generally may not be used in a way that
implies institutional endorsement of personal work, and permitted use is usually
narrower than "affiliated person, therefore free to use". Two things worth
confirming against VT's current brand policy before these appear on a published
page:

1. whether personal or personal-academic sites may display the marks at all; and
2. if so, whether an affiliation statement is required and what it must say.

Nothing here has been reviewed against those terms. The files were added on
request; the compliance question is open and belongs to the site owner.
