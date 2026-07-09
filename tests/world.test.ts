import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld, hashGrid } from "../src/world.ts";

test("generateWorld is fully deterministic for a given seed", () => {
  const a = generateWorld({ seed: "atlas", width: 128, height: 128 });
  const b = generateWorld({ seed: "atlas", width: 128, height: 128 });
  assert.equal(a.meta.contentHash, b.meta.contentHash);
  assert.deepEqual([...a.elevation.data], [...b.elevation.data]);
});

test("different seeds produce different worlds", () => {
  const a = generateWorld({ seed: "atlas", width: 128, height: 128 });
  const b = generateWorld({ seed: "borea", width: 128, height: 128 });
  assert.notEqual(a.meta.contentHash, b.meta.contentHash);
});

test("elevation is normalized to [0,1]", () => {
  const w = generateWorld({ seed: 1, width: 96, height: 96 });
  const { min, max } = w.elevation.extent();
  assert.ok(min >= 0 && max <= 1);
  assert.ok(max > 0.9, "a generated world should reach high elevations");
});

test("meta reports a plausible land fraction", () => {
  const w = generateWorld({ seed: "continent", width: 128, height: 128 });
  assert.ok(w.meta.landFraction > 0 && w.meta.landFraction < 1);
});

test("island worlds have less land than non-island worlds", () => {
  const island = generateWorld({
    seed: "same",
    width: 128,
    height: 128,
    island: true,
  });
  const full = generateWorld({
    seed: "same",
    width: 128,
    height: 128,
    island: false,
  });
  assert.ok(island.meta.landFraction < full.meta.landFraction);
});

// GOLDEN determinism fingerprint. If this changes, the generation algorithm
// changed — update intentionally and note it in DECISIONS.md / CHANGELOG.md.
test("golden content hash for the canonical world is stable", () => {
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "fb232cd94fe0face");
});
