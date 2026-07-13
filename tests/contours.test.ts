import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { pickContourInterval, renderContours } from "../src/render.ts";

// Metre-accurate topo contours: round intervals sized to the relief, with
// heavier index lines every fifth. Rendering only — no fingerprints involved.

test("pickContourInterval chooses round intervals that keep <= 20 bands", () => {
  assert.equal(pickContourInterval(450), 25);
  assert.equal(pickContourInterval(900), 50);
  assert.equal(pickContourInterval(1900), 100);
  assert.equal(pickContourInterval(4000), 200);
  assert.equal(pickContourInterval(4500), 250);
  assert.equal(pickContourInterval(9000), 500);
  for (const peak of [100, 700, 1500, 3200, 4500, 8000, 15000]) {
    const iv = pickContourInterval(peak);
    assert.ok(peak / iv <= 20, `${peak} m / ${iv} m = ${peak / iv} bands`);
  }
});

test("contours render with two line weights (regular and index)", () => {
  const w = generateWorld({ seed: "atlas", width: 160, height: 160 });
  const px = renderContours(w.elevation, w.meta.seaLevel, w.meta.maxAltitudeMetres);
  // Count darkened pixels: index lines are much darker (k=0.22) than regular
  // (k=0.55). Classify by luminance against the local topo ramp being >= ~90.
  let dark = 0;
  let veryDark = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
    if (px[i + 3] !== 255) continue;
    if (lum > 0 && lum < 40) veryDark++;
    else if (lum >= 40 && lum < 90) dark++;
  }
  assert.ok(dark > 50, `no regular contour lines found (${dark})`);
  assert.ok(veryDark > 10, `no index contour lines found (${veryDark})`);
});

test("contour rendering is deterministic", () => {
  const w = generateWorld({ seed: "borea", width: 140, height: 140 });
  const a = renderContours(w.elevation, w.meta.seaLevel, w.meta.maxAltitudeMetres);
  const b = renderContours(w.elevation, w.meta.seaLevel, w.meta.maxAltitudeMetres);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
});
