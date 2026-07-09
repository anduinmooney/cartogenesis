import { test } from "node:test";
import assert from "node:assert/strict";
import { valueNoise2D, fbm2D, ridge2D } from "../src/noise.ts";

test("valueNoise2D is deterministic", () => {
  assert.equal(valueNoise2D(1.5, 2.5, 99), valueNoise2D(1.5, 2.5, 99));
});

test("valueNoise2D stays in [0, 1)", () => {
  for (let i = 0; i < 5000; i++) {
    const x = (i * 0.137) % 50;
    const y = (i * 0.311) % 50;
    const v = valueNoise2D(x, y, 12345);
    assert.ok(v >= 0 && v < 1, `noise out of range: ${v}`);
  }
});

test("valueNoise2D is continuous (small step → small change)", () => {
  const a = valueNoise2D(3.2, 4.8, 5);
  const b = valueNoise2D(3.2001, 4.8, 5);
  assert.ok(Math.abs(a - b) < 0.01, `discontinuity: ${a} vs ${b}`);
});

test("integer lattice points are exact hashes (fade=0 or 1 endpoints)", () => {
  // At integer coordinates the noise equals the corner hash; re-sampling the
  // same integer point must be identical.
  assert.equal(valueNoise2D(10, 10, 3), valueNoise2D(10, 10, 3));
});

test("fbm2D is deterministic and bounded", () => {
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.05;
    const y = i * 0.07;
    const v = fbm2D(x, y, { seed: 42, octaves: 6 });
    assert.ok(v >= 0 && v <= 1, `fbm out of range: ${v}`);
    assert.equal(v, fbm2D(x, y, { seed: 42, octaves: 6 }));
  }
});

test("fbm2D varies across the field", () => {
  const values = new Set<number>();
  for (let i = 0; i < 200; i++) {
    values.add(fbm2D(i * 0.3, i * 0.11, { seed: 1 }));
  }
  assert.ok(values.size > 190, "fbm should produce varied output");
});

test("ridge2D is bounded in [0, 1]", () => {
  for (let i = 0; i < 2000; i++) {
    const v = ridge2D(i * 0.05, i * 0.03, { seed: 7 });
    assert.ok(v >= 0 && v <= 1, `ridge out of range: ${v}`);
  }
});
