import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  cdata,
  collectTags,
  dateFromFilename,
  escapeXml,
  groupByMonth,
  isValidRabbitHoleFilename,
  pageCount,
  pageSlice,
  parseRabbitHoleDate,
  postUrl,
  publishedRabbitHoles,
  readRabbitHoles,
  readingLabel,
  readingMinutes,
  renderAtom,
  renderIndexJson,
  renderJsonFeed,
  renderRss,
  slugFromFilename,
  tagSlug,
  toRfc3339,
} from "./rabbit-holes.mjs";
import { rabbitHolesSchema } from "../content.config";

const ORIGIN = "https://jason.cusati.us";

/** A published sample post carrying a `]]>` in its HTML (a CDATA hazard). */
const POST = {
  slug: "hello-world",
  title: "Hello, world",
  date: new Date("2026-10-01T00:00:00.000Z"),
  summary: "A first post.",
  tags: ["meta", "AI Safety"],
  html: "<p>Hi &amp; bye</p><p>tricky ]]> end</p>",
};

function xmlDoc(xml: string): Document {
  const dom = new JSDOM();
  return new dom.window.DOMParser().parseFromString(xml, "application/xml");
}

// ---------------------------------------------------------------------------
// The Zod schema (D21): a bad date fails the build
// ---------------------------------------------------------------------------
describe("the Rabbit Holes schema validates frontmatter (D21)", () => {
  const base = {
    title: "A post",
    date: "2026-10-01",
    summary: "A summary.",
  };

  it("accepts a minimal post and defaults draft: true, tags: []", () => {
    const parsed = rabbitHolesSchema.parse(base);
    expect(parsed.draft).toBe(true);
    expect(parsed.tags).toEqual([]);
    expect(parsed.date instanceof Date).toBe(true);
  });

  it("accepts a full post with all optional fields", () => {
    const parsed = rabbitHolesSchema.parse({
      ...base,
      draft: false,
      tags: ["a", "b"],
      hero: "/rabbit-holes/hero.png",
      canonical: "https://example.com/original",
      sources: [{ title: "A paper", url: "https://example.com/paper" }],
    });
    expect(parsed.draft).toBe(false);
    expect(parsed.sources?.[0].title).toBe("A paper");
  });

  it("FAILS on a bad date — a draft with a bad date fails the build (D21)", () => {
    for (const bad of ["not-a-date", "2026-13-40", ""]) {
      expect(rabbitHolesSchema.safeParse({ ...base, date: bad }).success, bad).toBe(false);
    }
  });

  it("FAILS on a summary longer than 280 characters", () => {
    const long = "x".repeat(281);
    expect(rabbitHolesSchema.safeParse({ ...base, summary: long }).success).toBe(false);
    expect(rabbitHolesSchema.safeParse({ ...base, summary: "x".repeat(280) }).success).toBe(true);
  });

  it("FAILS on a missing title or summary", () => {
    expect(rabbitHolesSchema.safeParse({ date: "2026-10-01", summary: "s" }).success).toBe(false);
    expect(rabbitHolesSchema.safeParse({ title: "t", date: "2026-10-01" }).success).toBe(false);
  });

  it("FAILS on an unknown field (strict, like the manifest mirror)", () => {
    expect(rabbitHolesSchema.safeParse({ ...base, categorization: "nope" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Filename and date rules — one declaration, used everywhere
// ---------------------------------------------------------------------------
describe("the <yyyy-mm-dd>-<slug>.md filename rule", () => {
  it("strips the date prefix to form the slug", () => {
    expect(slugFromFilename("2026-10-10-why-a-blog-called-rabbit-holes.md")).toBe(
      "why-a-blog-called-rabbit-holes",
    );
    expect(dateFromFilename("2026-10-10-why-a-blog-called-rabbit-holes.md")).toBe("2026-10-10");
  });

  it("accepts the required shape and rejects a missing date or bad slug", () => {
    expect(isValidRabbitHoleFilename("2026-10-10-a-post.md")).toBe(true);
    expect(isValidRabbitHoleFilename("a-post.md")).toBe(false);
    expect(isValidRabbitHoleFilename("2026-10-10-A Post.md")).toBe(false);
  });

  it("parses a date-only string as UTC midnight in every timezone", () => {
    expect(parseRabbitHoleDate("2026-10-10").toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(toRfc3339("2026-10-10")).toBe("2026-10-10T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
describe("tag slugs, reading time and pagination", () => {
  it("slugifies free-form tags but keeps the display spelling", () => {
    expect(tagSlug("AI Safety")).toBe("ai-safety");
    expect(tagSlug("Rust/C++")).toBe("rust-c");
    expect(tagSlug("  spaced  ")).toBe("spaced");
  });

  it("collects tags with counts", () => {
    const tags = collectTags([
      { tags: ["AI Safety", "meta"] },
      { tags: ["meta"] },
    ]);
    expect(tags.map((t) => `${t.tag}:${t.count}`)).toEqual(["AI Safety:1", "meta:2"]);
  });

  it("estimates reading time at 200 wpm, minimum 1 minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("word ".repeat(400))).toBe(2);
    expect(readingLabel("word")).toBe("1 min read");
  });

  it("paginates at the page size", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(45, 20)).toBe(3);
    expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });

  it("groups posts by month, newest first", () => {
    const months = groupByMonth([
      { slug: "a", date: "2026-09-01" },
      { slug: "b", date: "2026-10-01" },
      { slug: "c", date: "2026-10-15" },
    ]);
    expect(months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(months[0].posts.map((p) => p.slug)).toEqual(["c", "b"]);
  });
});

// ---------------------------------------------------------------------------
// The feeds (D21): full content, valid XML/JSON
// ---------------------------------------------------------------------------
describe("renderRss produces valid RSS 2.0 with full content", () => {
  const doc = xmlDoc(renderRss([POST], { origin: ORIGIN }));

  it("is well-formed XML with a channel and one item", () => {
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.nodeName).toBe("rss");
    expect(doc.getElementsByTagName("title")[0].textContent).toBe("Rabbit Holes");
    expect(doc.getElementsByTagName("item")).toHaveLength(1);
  });

  it("carries the full HTML in content:encoded (CDATA split is safe)", () => {
    const encoded = doc.getElementsByTagNameNS(
      "http://purl.org/rss/1.0/modules/content/",
      "encoded",
    );
    expect(encoded).toHaveLength(1);
    // The `]]>` from the body survives intact after the CDATA split.
    expect(encoded[0].textContent).toContain("tricky ]]> end");
    expect(encoded[0].textContent).toContain("Hi &amp; bye");
  });

  it("links the post at its canonical URL and dates it RFC-822", () => {
    expect(doc.getElementsByTagName("link")[1].textContent).toBe(
      `${ORIGIN}/rabbit-holes/hello-world/`,
    );
    expect(doc.getElementsByTagName("pubDate")[0].textContent).toMatch(/GMT$/);
  });
});

describe("renderAtom produces valid Atom 1.0 with full content", () => {
  const doc = xmlDoc(renderAtom([POST], { origin: ORIGIN }));

  it("is well-formed with a feed and one entry", () => {
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.nodeName).toBe("feed");
    expect(doc.getElementsByTagName("entry")).toHaveLength(1);
  });

  it("carries content type=html and an RFC-3339 updated time", () => {
    const content = doc.getElementsByTagName("content")[0];
    expect(content.getAttribute("type")).toBe("html");
    expect(content.textContent).toContain("tricky ]]> end");
    expect(doc.getElementsByTagName("updated")[0].textContent).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("renderJsonFeed produces valid JSON Feed 1.1 with full content", () => {
  const feed = JSON.parse(renderJsonFeed([POST], { origin: ORIGIN }));

  it("declares the 1.1 version and one item with content_html", () => {
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].content_html).toContain("tricky ]]> end");
    expect(feed.items[0].url).toBe(`${ORIGIN}/rabbit-holes/hello-world/`);
    expect(feed.items[0].tags).toEqual(["meta", "AI Safety"]);
  });
});

describe("renderIndexJson is the stable public index (D21 decision 4)", () => {
  const index = JSON.parse(renderIndexJson([POST], { origin: ORIGIN }));

  it("carries exactly {slug,title,date,tags,summary,url} per post", () => {
    expect(index.version).toBe(1);
    expect(Object.keys(index.posts[0]).sort()).toEqual(
      ["date", "slug", "summary", "tags", "title", "url"].sort(),
    );
    expect(index.posts[0].date).toBe("2026-10-01");
  });
});

// ---------------------------------------------------------------------------
// XML building blocks
// ---------------------------------------------------------------------------
describe("XML helpers", () => {
  it("escapes markup and splits ]]> in CDATA", () => {
    expect(escapeXml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
    expect(cdata("a ]]> b")).toBe("<![CDATA[a ]]]]><![CDATA[> b]]>");
  });

  it("canonical frontmatter overrides the computed URL", () => {
    expect(postUrl({ slug: "x", canonical: "https://elsewhere.example/x" }, ORIGIN)).toBe(
      "https://elsewhere.example/x",
    );
    expect(postUrl({ slug: "x" }, ORIGIN)).toBe(`${ORIGIN}/rabbit-holes/x/`);
  });
});

// ---------------------------------------------------------------------------
// Injection (D21 security): frontmatter values cannot break the XML
// ---------------------------------------------------------------------------
describe("feed output escapes injected markup", () => {
  const evil = {
    ...POST,
    title: "<script>alert(1)</script>",
    summary: '"><img src=x onerror=alert(1)>',
  };

  it("escapes a script title in RSS and Atom so the XML cannot be broken", () => {
    const rss = renderRss([evil], { origin: ORIGIN });
    const atom = renderAtom([evil], { origin: ORIGIN });
    expect(rss).not.toContain("<script>");
    expect(atom).not.toContain("<script>");
    expect(rss).toContain("&lt;script&gt;");
    expect(xmlDoc(rss).querySelector("parsererror")).toBeNull();
    expect(xmlDoc(atom).querySelector("parsererror")).toBeNull();
  });

  it("keeps a JSON Feed title as an ordinary JSON string value", () => {
    const feed = JSON.parse(renderJsonFeed([evil], { origin: ORIGIN }));
    expect(feed.items[0].title).toBe("<script>alert(1)</script>");
  });
});

// ---------------------------------------------------------------------------
// The committed tree: the seed post is a draft
// ---------------------------------------------------------------------------
describe("the committed seed post is a draft (D21)", () => {
  const posts = readRabbitHoles(pathResolveSite());

  it("reads exactly the seed draft and excludes it from published", () => {
    expect(posts.some((p) => p.slug === "why-a-blog-called-rabbit-holes")).toBe(true);
    const seed = posts.find((p) => p.slug === "why-a-blog-called-rabbit-holes")!;
    expect(seed.draft).toBe(true);
    expect(publishedRabbitHoles(posts)).toEqual([]);
  });
});

/** site/ — the tests run with cwd site/, but be explicit for robustness. */
function pathResolveSite() {
  return process.cwd();
}
