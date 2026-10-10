// RABBIT HOLES — the public blog on the hub (owner decision D21, Wave 8).
//
// Plain JavaScript, like hub-content.mjs and frame-content.mjs, so one file can
// be imported by the Astro content config, the `.astro` pages, the OG-image build
// integration, the leak check and the tests. There is exactly one declaration of
// everything here: the directory, the slug/date-from-filename rule, the feed
// builders and the pagination helper.
//
// TOPICS ARE RANDOM BY DESIGN (D21). Nothing here assumes a category taxonomy.
// Tags are free-form strings; a tag gets a URL by slugifying it, but its spelling
// is never restricted. There is deliberately no tag enum, no category field and
// no primary-topic concept.
//
// WHAT IS PUBLIC. Every post with `draft: false` is public. There is no gate, no
// allowlist and no visibility field: Rabbit Holes is author-written content in
// this repository, not a satellite manifest. A `draft: true` post must reach
// NEITHER dist-public NOR any feed, sitemap, search index or OG image; the
// content collection filters drafts out of every page and the leak check gains
// each draft's route/slug/title/summary as a needle (`scripts/check-no-private-in-public.mjs`).

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/** The URL segment and route prefix. No leading or trailing slash. */
export const RABBIT_HOLES_SECTION = "rabbit-holes";

/** Committed Markdown, relative to site/. */
export const RABBIT_HOLES_CONTENT_DIR = "src/content/rabbit-holes";

/** The blog's name, used in feeds, the OG image and page titles. */
export const RABBIT_HOLES_TITLE = "Rabbit Holes";

/**
 * The tagline, in the owner's "here's where I went this week" voice (D21 asks the
 * agent to propose one). One line.
 */
export const RABBIT_HOLES_TAGLINE = "Notes from wherever this week's reading, building or argument went.";

/** Long description used in feed channel metadata. */
export const RABBIT_HOLES_DESCRIPTION =
  "Rabbit Holes — where Jason Cusati writes down whatever he is reading, building or arguing about this week.";

/** D21: the summary is at most 280 characters (used by the feed and OG). */
export const SUMMARY_MAX_LENGTH = 280;

/** D21: pagination at 20 posts per page. */
export const PAGE_SIZE = 20;

/** The `YYYY-MM-DD-` filename prefix. */
const FILENAME_DATE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/**
 * The slug of a content filename, with its `YYYY-MM-DD-` prefix removed.
 * `2026-10-10-why-a-blog-called-rabbit-holes.md` -> `why-a-blog-called-rabbit-holes`.
 *
 * Exported because the collection's `generateId`, the build-time reader and the
 * tests must agree on it character for character: a drift here would put a post
 * at one URL and its feed entry at another.
 */
export function slugFromFilename(filename) {
  const base = String(filename).replace(/\.mdx?$/i, "");
  const match = FILENAME_DATE.exec(base);
  return match ? match[2] : base;
}

/** The `YYYY-MM-DD` date prefix of a content filename, or null. */
export function dateFromFilename(filename) {
  const base = String(filename).replace(/\.mdx?$/i, "");
  const match = FILENAME_DATE.exec(base);
  return match ? match[1] : null;
}

/** True when a filename matches the required `<yyyy-mm-dd>-<slug>.md` shape. */
export function isValidRabbitHoleFilename(filename) {
  const base = String(filename).replace(/\.mdx?$/i, "");
  return FILENAME_DATE.test(base) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugFromFilename(filename));
}

/**
 * Parse a frontmatter `date` into a UTC Date. Accepts a Date (YAML already
 * parsed one), a `YYYY-MM-DD` string or a full timestamp. A date-only value is
 * midnight UTC, so the same date renders identically in every timezone.
 */
export function parseRabbitHoleDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00.000Z`);
  return new Date(text);
}

/** `YYYY-MM-DD` (UTC), for `<time datetime>`, the JSON index and filenames. */
export function isoDate(value) {
  return parseRabbitHoleDate(value).toISOString().slice(0, 10);
}

/** RFC-822/1123, the RSS 2.0 `<pubDate>` format. */
export function toRfc822(value) {
  return parseRabbitHoleDate(value).toUTCString();
}

/** RFC-3339, the Atom and JSON Feed timestamp format. */
export function toRfc3339(value) {
  return parseRabbitHoleDate(value).toISOString();
}

/**
 * A tag's URL slug: lowercased, runs of non-alphanumerics collapsed to `-`.
 * `"AI Safety"` -> `ai-safety`. Free-form tags are allowed; only the URL form is
 * constrained, and two spellings that slugify the same share one tag page.
 */
export function tagSlug(tag) {
  return String(tag)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The base-relative route of a post: `/rabbit-holes/<slug>/`. */
export function postPath(slug) {
  return `/${RABBIT_HOLES_SECTION}/${slug}/`;
}

/** Split a frontmatter block from a Markdown body. */
export function splitFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(text));
  if (!match) return { data: {}, body: String(text) };
  let data = {};
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
  } catch {
    // A malformed frontmatter block is the collection schema's to report, with a
    // useful message, during the build. Reading must not pre-empt it.
    data = {};
  }
  return { data, body: match[2] ?? "" };
}

/**
 * Read every committed Rabbit Holes post straight from disk.
 *
 * Used by the build-time OG-image integration, the leak check (for the draft
 * needles) and the tests. It is deliberately NOT the renderer: Astro's content
 * collection remains the authority for the page HTML and for schema validation.
 * This reader answers only "which posts exist, which are drafts, and what are
 * their title/slug/date/tags/summary", from the same files and the same
 * slug/date rules, so the two cannot drift.
 *
 * @param {string} [siteRoot] the site/ directory; defaults to the cwd
 * @returns {{id: string, slug: string, filename: string, title: string,
 *   date: Date, dateText: string, summary: string, tags: string[], draft: boolean,
 *   hero?: string, canonical?: string, sources?: {title: string, url: string}[],
 *   body: string}[]}
 */
export function readRabbitHoles(siteRoot = process.cwd()) {
  const dir = path.join(siteRoot, RABBIT_HOLES_CONTENT_DIR);
  if (!fs.existsSync(dir)) return [];
  const posts = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.mdx?$/i.test(name)) continue;
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const { data, body } = splitFrontmatter(raw);
    const slug = slugFromFilename(name);
    const date = parseRabbitHoleDate(data.date ?? dateFromFilename(name));
    posts.push({
      id: slug,
      slug,
      filename: name,
      title: typeof data.title === "string" ? data.title : slug,
      date,
      dateText: isoDate(date),
      summary: typeof data.summary === "string" ? data.summary : "",
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      draft: data.draft !== false,
      hero: typeof data.hero === "string" ? data.hero : undefined,
      canonical: typeof data.canonical === "string" ? data.canonical : undefined,
      sources: Array.isArray(data.sources) ? data.sources : undefined,
      body,
    });
  }
  return sortPostsNewestFirst(posts);
}

/** True for a published (non-draft) post. */
export function isPublished(post) {
  return post?.draft !== true;
}

/** The published posts only, newest first. */
export function publishedRabbitHoles(posts) {
  return sortPostsNewestFirst((posts ?? []).filter(isPublished));
}

/** Newest first; ties broken by slug so the order is stable across builds. */
export function sortPostsNewestFirst(posts) {
  return [...(posts ?? [])].sort((a, b) => {
    const at = parseRabbitHoleDate(a.date).getTime();
    const bt = parseRabbitHoleDate(b.date).getTime();
    if (at !== bt) return bt - at;
    return String(a.slug).localeCompare(String(b.slug));
  });
}

/** Estimated reading time in whole minutes (at 200 words/minute), minimum 1. */
export function readingMinutes(body) {
  const words = String(body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** `4 min read`, for the index and post metadata. */
export function readingLabel(body) {
  return `${readingMinutes(body)} min read`;
}

/**
 * Every tag in use, with its slug and post count, sorted by label.
 * @returns {{tag: string, slug: string, count: number}[]}
 */
export function collectTags(posts) {
  const bySlug = new Map();
  for (const post of posts ?? []) {
    for (const tag of post.tags ?? []) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const entry = bySlug.get(slug) ?? { tag, slug, count: 0 };
      entry.count += 1;
      bySlug.set(slug, entry);
    }
  }
  return [...bySlug.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Posts grouped by `YYYY-MM` month, newest month first, for the archive page.
 * @returns {{month: string, label: string, posts: object[]}[]}
 */
export function groupByMonth(posts, locale = "en-US") {
  const groups = new Map();
  for (const post of sortPostsNewestFirst(posts)) {
    const month = isoDate(post.date).slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(post);
  }
  return [...groups.entries()].map(([month, items]) => ({
    month,
    label: new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }),
    posts: items,
  }));
}

/** The page count for `total` posts at PAGE_SIZE, minimum 1 (the index). */
export function pageCount(total, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The slice of `posts` shown on a 1-based page number. */
export function pageSlice(posts, page, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return posts.slice(start, start + pageSize);
}

// --- Feed and index builders -------------------------------------------------
//
// Plain string/object builders, not Astro components, so a validator test can
// exercise them without a build. Every post passed in carries `html` (the
// rendered content) alongside its data.

/** XML-escape text or an attribute value. */
export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap `html` in CDATA, splitting any `]]>` it contains. */
export function cdata(html) {
  return `<![CDATA[${String(html ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** The absolute canonical URL of a post. */
export function postUrl(post, origin) {
  if (post?.canonical) return post.canonical;
  return `${origin}${postPath(post.slug)}`;
}

const RABBIT_HOLES_HOME = (origin) => `${origin}/${RABBIT_HOLES_SECTION}/`;

/**
 * RSS 2.0, full content in `<content:encoded>` (D21: feeds carry full content,
 * not summaries). `post.url` overrides the computed link (canonical frontmatter).
 */
export function renderRss(posts, { origin }) {
  const home = RABBIT_HOLES_HOME(origin);
  const lastBuild = posts.length ? toRfc822(posts[0].date) : toRfc822(new Date());
  const items = posts
    .map((post) => {
      const url = postUrl(post, origin);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${toRfc822(post.date)}</pubDate>`,
        `      <description>${escapeXml(post.summary)}</description>`,
        `      <content:encoded>${cdata(post.html)}</content:encoded>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(RABBIT_HOLES_TITLE)}</title>
    <link>${escapeXml(home)}</link>
    <description>${escapeXml(RABBIT_HOLES_DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(`${home}rss.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/** Atom 1.0, full content in `<content type="html">`. */
export function renderAtom(posts, { origin }) {
  const home = RABBIT_HOLES_HOME(origin);
  const updated = posts.length ? toRfc3339(posts[0].date) : toRfc3339(new Date());
  const entries = posts
    .map((post) => {
      const url = postUrl(post, origin);
      return [
        "  <entry>",
        `    <title>${escapeXml(post.title)}</title>`,
        `    <link href="${escapeXml(url)}"/>`,
        `    <id>${escapeXml(url)}</id>`,
        `    <updated>${toRfc3339(post.date)}</updated>`,
        `    <published>${toRfc3339(post.date)}</published>`,
        `    <summary>${escapeXml(post.summary)}</summary>`,
        `    <content type="html">${escapeXml(post.html)}</content>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(RABBIT_HOLES_TITLE)}</title>
  <subtitle>${escapeXml(RABBIT_HOLES_DESCRIPTION)}</subtitle>
  <link href="${escapeXml(`${home}atom.xml`)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(home)}"/>
  <id>${escapeXml(home)}</id>
  <updated>${updated}</updated>
  <author><name>Jason Cusati</name></author>
  <rights>© Jason Cusati</rights>
${entries}
</feed>
`;
}

/** JSON Feed 1.1, full content in `content_html`. */
export function renderJsonFeed(posts, { origin }) {
  const home = RABBIT_HOLES_HOME(origin);
  return `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: RABBIT_HOLES_TITLE,
      home_page_url: home,
      feed_url: `${home}feed.json`,
      description: RABBIT_HOLES_DESCRIPTION,
      language: "en-US",
      authors: [{ name: "Jason Cusati", url: origin }],
      items: posts.map((post) => ({
        id: postUrl(post, origin),
        url: postUrl(post, origin),
        title: post.title,
        summary: post.summary,
        content_html: post.html,
        date_published: toRfc3339(post.date),
        tags: post.tags ?? [],
      })),
    },
    null,
    2,
  )}\n`;
}

/**
 * The public, stable JSON index of posts (D21 decision 4): what the owner's
 * weekly topic suggester reads to avoid repeats and link to prior posts.
 */
export function renderIndexJson(posts, { origin }) {
  return `${JSON.stringify(
    {
      version: 1,
      generated_from: RABBIT_HOLES_TITLE,
      posts: posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        date: isoDate(post.date),
        tags: post.tags ?? [],
        summary: post.summary,
        url: postUrl(post, origin),
      })),
    },
    null,
    2,
  )}\n`;
}

/** The feed-discovery `<link rel="alternate">` set, for the base layout. */
export function feedAlternates(origin) {
  const home = RABBIT_HOLES_HOME(origin);
  return [
    { type: "application/rss+xml", title: "Rabbit Holes", href: `${home}rss.xml` },
    { type: "application/atom+xml", title: "Rabbit Holes", href: `${home}atom.xml` },
    { type: "application/feed+json", title: "Rabbit Holes", href: `${home}feed.json` },
  ];
}
