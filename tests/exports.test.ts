import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { worldReportMarkdown } from "../src/report.ts";
import { worldPosterSVG } from "../src/svgmap.ts";
import { encodePNG } from "../src/png.ts";
import { renderRegions } from "../src/render.ts";

// The browser export buttons call these same pure functions. If they produce
// valid content here, they produce it in the app.

test("the report export is non-empty Markdown for a world", () => {
  const w = generateWorld({ seed: "atlas", width: 160, height: 160 });
  const md = worldReportMarkdown(w);
  assert.ok(md.length > 500);
  assert.match(md, /^# /m);
  assert.match(md, /## Languages/);
});

test("the poster export is well-formed SVG built from a data URI", () => {
  const w = generateWorld({ seed: "atlas", width: 160, height: 160 });
  const png = encodePNG(w.meta.width, w.meta.height, renderRegions(w.regions, w.water, w.elevation));
  const uri = `data:image/png;base64,${png.toString("base64")}`;
  const svg = worldPosterSVG(w, uri);
  assert.match(svg, /^<svg[\s>]/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.ok(svg.includes(uri), "the background data URI is embedded verbatim");
  // Balanced-ish: every <image opens the base layer once.
  assert.equal((svg.match(/<image /g) ?? []).length, 1);
});

test("the poster embeds whatever data URI it is handed (browser or Node)", () => {
  // The browser passes canvas.toDataURL; Node passes an encodePNG buffer. Same
  // signature, so a fake URI must round-trip.
  const w = generateWorld({ seed: "borea", width: 140, height: 140 });
  const svg = worldPosterSVG(w, "data:image/png;base64,SENTINEL");
  assert.ok(svg.includes("data:image/png;base64,SENTINEL"));
});

test("exports are deterministic for a fixed world", () => {
  const w = generateWorld({ seed: "borea", width: 150, height: 150 });
  assert.equal(worldReportMarkdown(w), worldReportMarkdown(w));
  const uri = "data:image/png;base64,X";
  assert.equal(worldPosterSVG(w, uri), worldPosterSVG(w, uri));
});
