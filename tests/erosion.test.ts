import { test } from "node:test";
import assert from "node:assert/strict";
import { generateElevation } from "../src/terrain.ts";
import { erode } from "../src/erosion.ts";

function base(size = 96) {
  return generateElevation({ width: size, height: size, seed: 7 });
}

test("erosion is deterministic", () => {
  const a = erode(base(), { seed: 1 });
  const b = erode(base(), { seed: 1 });
  assert.deepEqual([...a.data], [...b.data]);
});

test("eroded elevation stays within [0,1]", () => {
  const a = erode(base(), { seed: 2 });
  const { min, max } = a.extent();
  assert.ok(min >= 0 && max <= 1, `out of range: ${min}..${max}`);
});

test("erosion actually changes the terrain", () => {
  const before = base();
  const after = erode(before, { seed: 3 });
  let changed = 0;
  for (let i = 0; i < before.data.length; i++) {
    if (Math.abs(before.data[i] - after.data[i]) > 1e-6) changed++;
  }
  assert.ok(changed > before.data.length * 0.1, `only ${changed} cells changed`);
});

test("different seeds erode differently", () => {
  const a = erode(base(), { seed: 4 });
  const b = erode(base(), { seed: 5 });
  assert.notDeepEqual([...a.data], [...b.data]);
});

test("erosion does not move the input Grid (returns a new one)", () => {
  const before = base();
  const snapshot = [...before.data];
  erode(before, { seed: 6 });
  assert.deepEqual([...before.data], snapshot);
});
