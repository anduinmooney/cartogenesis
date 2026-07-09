import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateRivers } from "../src/rivers.ts";

function build(seed: string, size = 128) {
  const w = generateWorld({ seed, width: size, height: size });
  const rivers = generateRivers(w.elevation, w.water, w.moisture, {});
  return { w, rivers };
}

test("generateRivers is deterministic", () => {
  const a = build("rio", 96);
  const b = build("rio", 96);
  assert.deepEqual([...a.rivers.riverMask], [...b.rivers.riverMask]);
  assert.deepEqual([...a.rivers.flowTo], [...b.rivers.flowTo]);
  assert.equal(a.rivers.maxFlow, b.rivers.maxFlow);
});

test("every land cell drains to a terminal without cycles", () => {
  const { w, rivers } = build("drain", 100);
  const { width, height } = w.elevation;
  const n = width * height;
  const isWater = (i: number) =>
    w.water.oceanMask[i] === 1 || w.water.lakeMask[i] === 1;

  // Sample a spread of land cells and follow the flow to a terminal.
  for (let i = 0; i < n; i += 37) {
    if (isWater(i)) continue;
    let cur = i;
    let steps = 0;
    while (cur >= 0 && !isWater(cur)) {
      cur = rivers.flowTo[cur];
      if (++steps > n) {
        assert.fail(`drainage did not terminate from cell ${i} (cycle?)`);
      }
    }
    // Terminated either at a water cell (cur is water) or a border outlet (-1).
    assert.ok(cur === -1 || isWater(cur));
  }
});

test("mass is conserved: rainfall in == flow out at all terminals", () => {
  const { w, rivers } = build("mass", 120);
  const n = w.elevation.width * w.elevation.height;
  const isWater = (i: number) =>
    w.water.oceanMask[i] === 1 || w.water.lakeMask[i] === 1;

  let input = 0;
  for (let i = 0; i < n; i++) {
    if (!isWater(i)) input += 0.1 + w.moisture.data[i];
  }

  let output = 0;
  for (let i = 0; i < n; i++) {
    if (isWater(i)) {
      output += rivers.flowAccum.data[i]; // water absorbed at the coast/lakes
    } else if (rivers.flowTo[i] === -1) {
      output += rivers.flowAccum.data[i]; // land border outlet
    }
  }

  assert.ok(
    Math.abs(input - output) < 1e-6 * (input + 1),
    `input ${input} vs output ${output}`,
  );
});

test("a reasonably sized world grows at least one river", () => {
  const { rivers } = build("riverine", 160);
  assert.ok(rivers.riverFraction > 0, "expected some river cells");
  assert.ok(rivers.maxFlow > 40, `main river flow ${rivers.maxFlow}`);
});

test("maxFlow equals the maximum accumulated flow", () => {
  const { rivers } = build("peakflow", 96);
  let m = 0;
  for (const v of rivers.flowAccum.data) if (v > m) m = v;
  assert.equal(rivers.maxFlow, m);
});
