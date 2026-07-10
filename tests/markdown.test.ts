import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, slug } from "../web/markdown.ts";
import { generateWorld } from "../src/world.ts";
import { worldReportMarkdown } from "../src/report.ts";

test("headings become tags and feed the table of contents", () => {
  const { html, headings } = renderMarkdown("# Title\n## Regions\n### Cities");
  assert.match(html, /<h1 id="title">Title<\/h1>/);
  assert.match(html, /<h2 id="regions">Regions<\/h2>/);
  // Only ## and ### go into the ToC (h1 is the world title, h4 is too deep).
  assert.deepEqual(
    headings.map((h) => h.id),
    ["regions", "cities"],
  );
});

test("bold and italic render inline", () => {
  const { html } = renderMarkdown("A **bold** and *italic* word.");
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test("unordered lists render", () => {
  const { html } = renderMarkdown("- one\n- two\n- three");
  assert.match(html, /<ul>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  assert.match(html, /<li>one<\/li>/);
});

test("a GitHub table renders with header and body", () => {
  const md = ["| Region | Area |", "|--------|-----:|", "| Foo | 10 |", "| Bar | 20 |"].join("\n");
  const { html } = renderMarkdown(md);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Region<\/th>/);
  assert.match(html, /<td>Foo<\/td>/);
  assert.equal((html.match(/<tr>/g) ?? []).length, 3); // 1 header + 2 body
});

test("HTML is escaped before formatting — no injection survives", () => {
  const { html } = renderMarkdown("# <script>alert(1)</script>\n\nBody <img src=x onerror=y>.");
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img /);
  assert.match(html, /&lt;script&gt;/);
});

test("bold containing escaped markup still does not inject", () => {
  const { html } = renderMarkdown("**<b>x</b>**");
  assert.match(html, /<strong>&lt;b&gt;x&lt;\/b&gt;<\/strong>/);
});

test("slug is stable and url-safe", () => {
  assert.equal(slug("Ruling houses"), "ruling-houses");
  assert.equal(slug("Rise & fall of realms"), "rise-fall-of-realms");
});

test("a real world report renders without throwing and yields a rich ToC", () => {
  const w = generateWorld({ seed: "atlas", width: 200, height: 200 });
  const md = worldReportMarkdown(w);
  const { html, headings } = renderMarkdown(md);
  assert.ok(html.length > 1000);
  // The gazetteer has many sections; the ToC should reflect them.
  assert.ok(headings.length >= 6, `only ${headings.length} headings`);
  assert.ok(headings.some((h) => /region|settlement|language/i.test(h.text)));
  // Sanity: no raw Markdown table pipes leaked into the output as text rows.
  assert.doesNotMatch(html, /\|----/);
});

test("rendering is deterministic for a fixed report", () => {
  const w = generateWorld({ seed: "borea", width: 180, height: 180 });
  const md = worldReportMarkdown(w);
  assert.equal(renderMarkdown(md).html, renderMarkdown(md).html);
});
