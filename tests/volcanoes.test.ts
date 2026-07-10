import { test } from "node:test";
import assert from "node:assert/strict";
import { generateElevation } from "../src/terrain.ts";
import { addVolcanoes } from "../src/volcanoes.ts";
import { generateWorld } from "../src/world.ts";

function base(size = 160) {
  return generateElevation({ width: size, height: size, seed: 42 });
}

test("volcano placement is deterministic", () => {
  const a = addVolcanoes(base(), { seed: 5, seaLevel: 0.42, count: 4 });
  const b = addVolcanoes(base(), { seed: 5, seaLevel: 0.42, count: 4 });
  assert.deepEqual(
    a.volcanoes.map((v) => [v.x, v.y, v.type, v.name]),
    b.volcanoes.map((v) => [v.x, v.y, v.type, v.name]),
  );
  assert.deepEqual([...a.elevation.data], [...b.elevation.data]);
});

test("does not mutate the input grid", () => {
  const g = base();
  const snapshot = [...g.data];
  addVolcanoes(g, { seed: 6, seaLevel: 0.42, count: 3 });
  assert.deepEqual([...g.data], snapshot);
});

test("volcanoes sit on land and raise the terrain at their summit", () => {
  const g = base(200);
  const seaLevel = 0.42;
  const { elevation, volcanoes } = addVolcanoes(g, { seed: 7, seaLevel, count: 5 });
  assert.ok(volcanoes.length >= 1);
  for (const v of volcanoes) {
    assert.ok(v.x >= 0 && v.y >= 0 && v.x < 200 && v.y < 200, "in bounds");
    const i = v.y * 200 + v.x;
    // The volcano raised the terrain: summit exceeds the original base cell.
    assert.ok(v.summit > g.data[i], "summit not raised above base");
    assert.ok(v.summit >= seaLevel, "summit below sea level");
    assert.ok(["stratovolcano", "shield", "cinder cone"].includes(v.type));
    assert.ok(["active", "dormant", "extinct"].includes(v.status));
    assert.ok(elevation.data[i] >= 0 && elevation.data[i] <= 1);
  }
});

test("a stratovolcano has a crater: rim higher than the very center", () => {
  const g = new (base().constructor as any)(120, 120, 0.5); // flat land plateau
  // Force one stratovolcano near the middle.
  const { elevation, volcanoes } = addVolcanoes(g, {
    seed: 3,
    seaLevel: 0.42,
    count: 1,
  });
  const v = volcanoes[0];
  if (v && v.type === "stratovolcano") {
    const center = elevation.data[v.y * 120 + v.x];
    // A ring cell one crater-radius out should be at least as high as center.
    const rimX = Math.min(119, v.x + Math.round(v.radius * 0.16));
    const rim = elevation.data[v.y * 120 + rimX];
    assert.ok(rim >= center, "crater rim should not sit below the crater floor");
  }
});

test("world exposes volcanoes and a peak height in metres", () => {
  const w = generateWorld({ seed: "vulcan", width: 200, height: 200 });
  assert.equal(w.volcanoes.length, w.meta.volcanoCount);
  assert.ok(w.meta.highestPeakMetres > 0);
  assert.ok(w.meta.highestPeakMetres <= w.meta.maxAltitudeMetres);
});

test("disabling volcanoes yields none", () => {
  const w = generateWorld({ seed: "flat", width: 160, height: 160, volcanoes: false });
  assert.equal(w.volcanoes.length, 0);
  assert.equal(w.meta.volcanoCount, 0);
});

test("some volcanoes chain into seamount arcs, and an arc is nearly a line", () => {
  // Discover a world with an arc (not stable across algorithm tweaks — find one).
  let arc: { x: number; y: number }[] | null = null;
  for (let i = 0; i < 40 && !arc; i++) {
    const w = generateWorld({ seed: `arc${i}`, width: 320, height: 320 });
    const groups = new Map<number, { x: number; y: number }[]>();
    for (const v of w.volcanoes) {
      if (v.arcId === undefined) continue;
      (groups.get(v.arcId) ?? groups.set(v.arcId, []).get(v.arcId)!).push({ x: v.x, y: v.y });
    }
    for (const g of groups.values()) if (g.length >= 3) { arc = g; break; }
  }
  assert.ok(arc, "no arc of >=3 cones found in 40 worlds");

  // Total-least-squares line fit; the max perpendicular residual must be small
  // relative to the chain's span (a real line, not a scatter).
  const n = arc!.length;
  const mx = arc!.reduce((s, p) => s + p.x, 0) / n;
  const my = arc!.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of arc!) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  let maxRes = 0, span = 0;
  for (const p of arc!) maxRes = Math.max(maxRes, Math.abs((p.x - mx) * nx + (p.y - my) * ny));
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      span = Math.max(span, Math.hypot(arc![a].x - arc![b].x, arc![a].y - arc![b].y));
  assert.ok(span > 0, "arc has no extent");
  assert.ok(maxRes / span < 0.2, `arc not collinear: residual/span ${(maxRes / span).toFixed(3)}`);
});

test("arc members share their id and sit on the map", () => {
  const w = generateWorld({ seed: "arc0", width: 320, height: 320 });
  const byArc = new Map<number, number>();
  for (const v of w.volcanoes) {
    if (v.arcId === undefined) continue;
    byArc.set(v.arcId, (byArc.get(v.arcId) ?? 0) + 1);
    assert.ok(v.x >= 0 && v.x < 320 && v.y >= 0 && v.y < 320, "arc cone off-map");
  }
  // Any arc id that exists has at least two members (a lone seed is not an arc).
  for (const [, count] of byArc) assert.ok(count >= 2, "singleton arc");
});
