import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { worldReportMarkdown } from "../src/report.ts";
import { worldPosterSVG } from "../src/svgmap.ts";
import { renderBiomes } from "../src/render.ts";
import { encodePNG } from "../src/png.ts";

test("world report is deterministic and contains the key sections", () => {
  const w = generateWorld({ seed: "dossier", width: 140, height: 140 });
  const a = worldReportMarkdown(w);
  const b = worldReportMarkdown(w);
  assert.equal(a, b);
  for (const section of [
    "## Overview",
    "## Regions",
    "## Settlements",
    "## Chronicle",
  ]) {
    assert.ok(a.includes(section), `missing ${section}`);
  }
  assert.ok(a.includes(String(w.meta.seed)));
});

test("report references the capital and a real region name", () => {
  const w = generateWorld({ seed: "gazette", width: 160, height: 160 });
  const md = worldReportMarkdown(w);
  assert.ok(md.includes(w.meta.capital));
  assert.ok(md.includes(w.regions.regions[0].name));
});

test("SVG poster is well-formed and labels places", () => {
  const w = generateWorld({ seed: "poster", width: 160, height: 160 });
  const png = encodePNG(
    w.elevation.width,
    w.elevation.height,
    renderBiomes(w.biomes, w.elevation),
  );
  const svg = worldPosterSVG(w, png);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  assert.ok(svg.includes("data:image/png;base64,"));
  // Balanced-ish: same number of <text> opens and closes.
  const opens = (svg.match(/<text/g) ?? []).length;
  const closes = (svg.match(/<\/text>/g) ?? []).length;
  assert.equal(opens, closes);
  assert.ok(opens > 0, "expected some labels");
  // The largest region should be labeled.
  const biggest = [...w.regions.regions].sort((a, b) => b.area - a.area)[0];
  assert.ok(svg.includes(biggest.name));
});

test("SVG escapes special characters safely", () => {
  const w = generateWorld({ seed: "escape", width: 120, height: 120 });
  const png = encodePNG(
    w.elevation.width,
    w.elevation.height,
    renderBiomes(w.biomes, w.elevation),
  );
  const svg = worldPosterSVG(w, png, { title: "A & B <test>" });
  assert.ok(svg.includes("A &amp; B &lt;test&gt;"));
  assert.ok(!svg.includes("<test>"));
});
