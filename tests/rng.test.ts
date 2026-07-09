import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, hashString, normalizeSeed } from "../src/rng.ts";

test("hashString is deterministic and unsigned 32-bit", () => {
  assert.equal(hashString("hello"), hashString("hello"));
  const h = hashString("hello");
  assert.ok(h >= 0 && h <= 0xffffffff);
  assert.notEqual(hashString("hello"), hashString("hellp"));
});

test("hashString salt decorrelates", () => {
  assert.notEqual(hashString("terrain", 1), hashString("terrain", 2));
});

test("normalizeSeed folds strings and numbers into 32-bit", () => {
  assert.equal(normalizeSeed(42), 42);
  assert.equal(normalizeSeed(-42), 42);
  assert.equal(typeof normalizeSeed("abc"), "number");
});

test("same seed produces identical sequences", () => {
  const a = new Rng(1234);
  const b = new Rng(1234);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.next(), b.next());
  }
});

test("different seeds diverge", () => {
  const a = new Rng(1);
  const b = new Rng(2);
  let differences = 0;
  for (let i = 0; i < 50; i++) {
    if (a.next() !== b.next()) differences++;
  }
  assert.ok(differences > 45, `expected divergence, got ${differences}`);
});

test("next() stays within [0, 1)", () => {
  const r = new Rng("range-check");
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`);
  }
});

test("int() respects bounds", () => {
  const r = new Rng("int-check");
  for (let i = 0; i < 10000; i++) {
    const v = r.int(5, 10);
    assert.ok(v >= 5 && v < 10 && Number.isInteger(v));
  }
});

test("mean of next() is near 0.5", () => {
  const r = new Rng("mean-check");
  let sum = 0;
  const n = 100000;
  for (let i = 0; i < n; i++) sum += r.next();
  const mean = sum / n;
  assert.ok(Math.abs(mean - 0.5) < 0.01, `mean was ${mean}`);
});

test("named streams are independent and reproducible", () => {
  const root1 = new Rng("world-seed");
  const root2 = new Rng("world-seed");
  const a1 = root1.stream("terrain");
  const a2 = root2.stream("terrain");
  assert.equal(a1.next(), a2.next());

  const rivers = root1.stream("rivers");
  assert.notEqual(rivers.seed, a1.seed);
});

test("stream is order-independent (non-perturbing)", () => {
  // Drawing from one stream must not change another stream's output.
  const root = new Rng("order");
  const terrainSeedFirst = root.stream("terrain").seed;
  root.stream("rivers").next(); // draw from a sibling
  const terrainSeedAgain = root.stream("terrain").seed;
  assert.equal(terrainSeedFirst, terrainSeedAgain);
});

test("shuffle is a deterministic permutation", () => {
  const base = Array.from({ length: 20 }, (_, i) => i);
  const s1 = new Rng(7).shuffle([...base]);
  const s2 = new Rng(7).shuffle([...base]);
  assert.deepEqual(s1, s2);
  assert.deepEqual([...s1].sort((a, b) => a - b), base);
});
