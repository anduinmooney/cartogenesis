import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes } from "../src/biomes.ts";
import { generateRegions } from "../src/regions.ts";
import { generateSettlements } from "../src/settlements.ts";
import { generateRoads } from "../src/roads.ts";

function build(seed: string, size = 160) {
  const w = generateWorld({ seed, width: size, height: size });
  const biomes = classifyBiomes(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.meta.seaLevel,
  );
  const regions = generateRegions(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    biomes,
    { seed: 1 },
  );
  const s = generateSettlements(
    w.elevation,
    w.temperature,
    w.moisture,
    w.water,
    w.rivers,
    regions,
    w.meta.seaLevel,
    { seed: 2 },
  );
  const roads = generateRoads(
    w.elevation,
    w.water,
    w.rivers,
    s.settlements,
    {},
  );
  return { w, s, roads };
}

test("road generation is deterministic", () => {
  const a = build("roadseed", 128);
  const b = build("roadseed", 128);
  assert.deepEqual([...a.roads.roadMask], [...b.roads.roadMask]);
  assert.equal(a.roads.edges.length, b.roads.edges.length);
});

test("road network is a forest (no cycles among settlements)", () => {
  const { s, roads } = build("forest", 160);
  assert.ok(
    roads.edges.length <= s.settlements.length - 1,
    `edges ${roads.edges.length} exceed tree bound`,
  );
  // Union-find: no edge should connect already-connected settlements.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  for (const e of roads.edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    assert.notEqual(ra, rb, "cycle detected in road network");
    parent.set(ra, rb);
  }
});

test("roads never run through the open ocean", () => {
  const { w, roads } = build("noocean", 160);
  for (let i = 0; i < roads.roadMask.length; i++) {
    if (roads.roadMask[i]) assert.equal(w.water.oceanMask[i], 0);
  }
});

test("connected settlements' cells lie on the road network", () => {
  const { w, s, roads } = build("connect", 160);
  const width = w.elevation.width;
  const linked = new Set<number>();
  for (const e of roads.edges) {
    linked.add(e.a);
    linked.add(e.b);
  }
  for (const st of s.settlements) {
    if (linked.has(st.id)) {
      assert.equal(
        roads.roadMask[st.y * width + st.x],
        1,
        `settlement ${st.id} not on its road`,
      );
    }
  }
});

test("a single-continent world links most settlements", () => {
  const { s, roads } = build("continent", 200);
  // At least half the settlements participate in the network.
  const linked = new Set<number>();
  for (const e of roads.edges) {
    linked.add(e.a);
    linked.add(e.b);
  }
  assert.ok(
    linked.size >= s.settlements.length * 0.5,
    `only ${linked.size}/${s.settlements.length} linked`,
  );
});
