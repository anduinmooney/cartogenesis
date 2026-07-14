import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld, hashGrid, hashGridExact } from "../src/world.ts";

test("generateWorld is fully deterministic for a given seed", () => {
  const a = generateWorld({ seed: "atlas", width: 128, height: 128 });
  const b = generateWorld({ seed: "atlas", width: 128, height: 128 });
  assert.equal(a.meta.contentHash, b.meta.contentHash);
  assert.equal(a.meta.exactHash, b.meta.exactHash);
  assert.equal(a.meta.simulationHash, b.meta.simulationHash);
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

/** The next representable double above a finite positive x. */
function nextAfter(x: number): number {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  if (lo === 0xffffffff) {
    buf.setUint32(0, hi + 1);
    buf.setUint32(4, 0);
  } else {
    buf.setUint32(4, lo + 1);
  }
  return buf.getFloat64(0);
}

// GOLDEN determinism fingerprints for the canonical world. If any of these
// changes, the generation algorithm changed — update intentionally and note it
// in DECISIONS.md / CHANGELOG.md.
//
// Three guards, because one was not enough (D-022):
//   contentHash    quantized — catches visible terrain change, hides ulp drift
//   exactHash      every bit of the elevation field
//   simulationHash what history actually did; terrain can be bit-identical
//                  while realms, wars, and ruins drift
test("golden fingerprints for the canonical world are stable", () => {
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "5117e36895b43e29", "quantized terrain hash");
  assert.equal(w.meta.exactHash, "8ca93e852693aefd", "exact terrain hash");
  assert.equal(w.meta.simulationHash, "a3a0ce94d75568f4", "simulation fingerprint");
});

test("the exact hash sees a one-ulp change that the quantized hash misses", () => {
  // This is the entire argument for exactHash, so assert it rather than assume.
  const w = generateWorld({ seed: "cartogenesis", width: 64, height: 64 });
  const beforeExact = hashGridExact(w.elevation);
  const beforeQuant = hashGrid(w.elevation);

  const i = (w.elevation.height >> 1) * w.elevation.width + (w.elevation.width >> 1);
  const original = w.elevation.data[i];
  w.elevation.data[i] = nextAfter(original);
  assert.notEqual(w.elevation.data[i], original, "the perturbation must change the value");

  assert.equal(hashGrid(w.elevation), beforeQuant, "quantized hash should be blind to 1 ulp");
  assert.notEqual(hashGridExact(w.elevation), beforeExact, "exact hash must catch 1 ulp");
});
