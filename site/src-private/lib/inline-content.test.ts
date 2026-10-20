import { describe, expect, it } from "vitest";
import { prepareInlineDocument, rewriteCssUrls, scopeCss } from "./inline-content.mjs";

const hostile = `<!doctype html><html><head>
<link rel="stylesheet" href="assets/site.css">
<style>:root{--x:red} body{background:url(../bg.png)} .bad{position:fixed;z-index:9999}</style>
</head><body>
<nav class="pages"><a href="other.html">Other</a></nav>
<script>alert(1)</script>
<iframe src="https://evil.invalid"></iframe>
<h1 id="sign-out">Title</h1>
<a id="jump" href="#sign-out">jump</a>
<a href="other.html">other page</a>
<a href="https://example.com/x">external</a>
<a href="javascript:alert(2)">bad</a>
<img src="img/a.png" onerror="alert(3)" style="position:fixed;z-index:1;color:red">
<form action="https://evil.invalid"><input name="q"></form>
<footer>satellite footer</footer>
</body></html>`;

describe("inline private project content", () => {
  it("removes scripts, frames, handlers and unsafe navigation", () => {
    const out = prepareInlineDocument({
      html: hostile,
      itemPath: "site/index.html",
      sourceDir: "/tmp/does-not-exist",
      payloadBase: "/p/_payload/source-a/site/",
      pageForPath: (p) => (p === "site/other.html" ? "/p/projects/source-a/other/" : null),
    });
    expect(out.html).not.toContain("<script");
    expect(out.html).not.toContain("<iframe");
    expect(out.html).not.toContain("onerror");
    expect(out.html).not.toContain("javascript:");
    expect(out.html).not.toContain("<footer");
    expect(out.html).not.toContain("nav class=\"pages\"");
    expect(out.html).toContain("doc-sign-out");
    expect(out.html).toContain('href="#doc-sign-out"');
    expect(out.html).toContain('href="/p/projects/source-a/other/"');
    expect(out.html).toContain('href="https://example.com/x"');
    expect(out.html).toContain('rel="noopener noreferrer"');
    expect(out.html).toContain('src="/p/_payload/source-a/site/img/a.png"');
    expect(out.html).toContain("position:static");
    expect(out.html).not.toContain("action=");
  });

  it("scopes linked and inline CSS and rewrites its asset URLs", () => {
    expect(scopeCss(":root{--x:red} body{color:red} .a{position:fixed}")).toContain(
      "@scope ([data-project-document])",
    );
    expect(scopeCss(":root{--x:red}")).toContain(":scope{--x:red}");
    expect(scopeCss(".a{position:fixed;z-index:99}")).not.toContain("fixed");
    expect(rewriteCssUrls("a{background:url(../x.png)}", "/p/_payload/source/site/assets")).toBe(
      "a{background:url(/p/_payload/source/site/x.png)}",
    );
    expect(rewriteCssUrls("a{background:url(https://x/y.png)}", "/base")).toBe(
      "a{background:url(https://x/y.png)}",
    );
  });

  it("fails safe when a stylesheet cannot be read", () => {
    const out = prepareInlineDocument({
      html: '<link rel="stylesheet" href="missing.css"><p>Hello</p>',
      itemPath: "index.html",
      sourceDir: "/tmp/does-not-exist",
      payloadBase: "/p/_payload/source/",
    });
    expect(out.html).toContain("Hello");
    expect(out.html).not.toContain("missing.css");
    expect(out.css).toBe("");
  });
});
