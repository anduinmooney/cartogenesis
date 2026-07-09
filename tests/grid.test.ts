import { test } from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../src/grid.ts";

test("get/set round-trip", () => {
  const g = new Grid(4, 3);
  g.set(2, 1, 7);
  assert.equal(g.get(2, 1), 7);
  assert.equal(g.index(2, 1), 1 * 4 + 2);
});

test("getClamped reads nearest edge outside bounds", () => {
  const g = new Grid(3, 3);
  g.set(0, 0, 9);
  assert.equal(g.getClamped(-5, -5), 9);
  g.set(2, 2, 4);
  assert.equal(g.getClamped(100, 100), 4);
});

test("normalize maps to [0,1] and handles flat fields", () => {
  const g = new Grid(2, 2);
  g.data.set([10, 20, 30, 40]);
  g.normalize();
  assert.equal(g.data[0], 0);
  assert.equal(g.data[3], 1);

  const flat = new Grid(2, 2, 5).normalize();
  assert.ok(flat.data.every((v) => v === 0));
});

test("extent reports min and max", () => {
  const g = new Grid(2, 2);
  g.data.set([-3, 5, 0, 2]);
  assert.deepEqual(g.extent(), { min: -3, max: 5 });
});

test("clone is independent", () => {
  const g = new Grid(2, 2, 1);
  const c = g.clone();
  c.set(0, 0, 99);
  assert.equal(g.get(0, 0), 1);
  assert.equal(c.get(0, 0), 99);
});

test("fillFn and mapInPlace", () => {
  const g = new Grid(2, 2).fillFn((x, y) => x + y * 10);
  assert.deepEqual([...g.data], [0, 1, 10, 11]);
  g.mapInPlace((v) => v * 2);
  assert.deepEqual([...g.data], [0, 2, 20, 22]);
});
