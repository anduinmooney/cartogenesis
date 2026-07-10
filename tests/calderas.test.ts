import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { Biome } from "../src/biomes.ts";

// Which seeds raise a caldera is not stable across algorithm tweaks, so discover
// one at run time rather than hard-code it (the D-022 discipline).
function firstWorldWith(pred: (w: ReturnType<typeof generateWorld>) => boolean) {
  for (let i = 0; i < 40; i++) {
    const w = generateWorld({ seed: `cald${i}`, width: 256, height: 256 });
    if (pred(w)) return w;
  }
  throw new Error("no seed in cald0..39 satisfied the predicate");
}

test("calderas are generated, with a flat floor below their rim", () => {
  const w = firstWorldWith((w) => w.volcanoes.some((v) => v.caldera));
  const v = w.volcanoes.find((x) => x.caldera)!;
  const { width, height, data } = w.elevation;
  const rim = v.caldera!.rimRadius;
  let floorMin = 1;
  let rimMax = 0;
  const R = Math.ceil(rim);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = v.x + dx;
      const y = v.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      const e = data[y * width + x];
      if (d <= rim * 0.4) floorMin = Math.min(floorMin, e); // floor
      if (Math.abs(d - rim) < 1.5) rimMax = Math.max(rimMax, e); // rim
    }
  }
  assert.ok(floorMin < rimMax, `caldera floor ${floorMin} not below rim ${rimMax}`);
});

test("a crater lake fills the caldera floor and reads as a lake everywhere", () => {
  const w = firstWorldWith((w) =>
    w.volcanoes.some((v) => v.caldera?.lakeLevel !== undefined),
  );
  const v = w.volcanoes.find((x) => x.caldera?.lakeLevel !== undefined)!;
  const level = v.caldera!.lakeLevel!;
  const { width, height, data } = w.elevation;
  const rim = v.caldera!.rimRadius;
  const R = Math.ceil(rim);
  let cells = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = v.x + dx;
      const y = v.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = y * width + x;
      if (w.water.lakeMask[i] !== 1) continue;
      if (dx * dx + dy * dy > rim * rim) continue;
      cells++;
      // Every crater-lake cell: below the fill level, above the sea, not ocean,
      // and classified as a lake so biomes/rendering agree.
      assert.ok(data[i] < level, "lake cell above fill level");
      assert.ok(data[i] >= w.meta.seaLevel, "crater lake below sea level");
      assert.equal(w.water.oceanMask[i], 0, "crater lake marked as ocean");
      assert.equal(w.biomes.ids[i], Biome.Lake, "crater lake not a Lake biome");
    }
  }
  assert.ok(cells > 8, `crater lake too small: ${cells} cells`);
});

test("no settlement is founded on a crater lake", () => {
  const w = firstWorldWith((w) =>
    w.volcanoes.some((v) => v.caldera?.lakeLevel !== undefined),
  );
  const { width } = w.elevation;
  for (const s of w.settlements.settlements) {
    assert.equal(
      w.water.lakeMask[s.y * width + s.x],
      0,
      `settlement ${s.name} sits on water`,
    );
  }
});

test("caldera generation is deterministic", () => {
  const a = generateWorld({ seed: "cald3", width: 200, height: 200 });
  const b = generateWorld({ seed: "cald3", width: 200, height: 200 });
  assert.deepEqual(
    a.volcanoes.map((v) => [v.x, v.y, v.caldera?.rimRadius, v.caldera?.lakeLevel]),
    b.volcanoes.map((v) => [v.x, v.y, v.caldera?.rimRadius, v.caldera?.lakeLevel]),
  );
});
