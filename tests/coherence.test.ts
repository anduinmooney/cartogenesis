import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { generateRoads } from "../src/roads.ts";
import { generateEconomy } from "../src/economy.ts";
import { ruinedSettlementIds } from "../src/simulation.ts";

// The world the simulation ran on had every settlement standing. The world we
// draw and describe does not. These tests guard the seam between the two.

// Seeds chosen because they actually produce ruins at this size — the tests
// below assert non-vacuity, so a change to the simulation that stops producing
// ruins will fail here loudly rather than passing on an empty set.
const SEEDS = ["s1", "s3", "s10", "s14", "s15"];
const SIZE = 260;

test("the present-day economy never trades with a ruin", () => {
  let sawRuins = false;
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size) sawRuins = true;
    for (const e of w.economy.economies) {
      assert.ok(
        !ruined.has(e.settlementId),
        `${seed}: economy lists settlement ${e.settlementId}, which is a ruin`,
      );
    }
    const standing = w.settlements.settlements.filter((s) => !ruined.has(s.id));
    assert.equal(
      w.economy.economies.length,
      standing.length,
      `${seed}: economy should cover exactly the standing settlements`,
    );
  }
  assert.ok(sawRuins, "test is vacuous — no seed produced any ruins");
});

test("no trade hub is a dead city", () => {
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    const standingIds = new Set(
      w.settlements.settlements.filter((s) => !ruined.has(s.id)).map((s) => s.id),
    );
    for (const e of w.economy.economies) {
      if (!e.isTradeHub) continue;
      assert.ok(standingIds.has(e.settlementId), `${seed}: hub ${e.settlementId} is ruined`);
    }
  }
});

test("roads are rebuilt on the survivors, not on the founding-age towns", () => {
  // A world with ruins must have a road network that differs from the one you
  // would get by connecting every settlement ever founded. (It is not always
  // *shorter*: removing a well-placed hub can force longer detours.)
  const w = generateWorld({ seed: "s10", width: SIZE, height: SIZE });
  const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
  assert.ok(ruined.size >= 2, "seed no longer produces ruins — pick another");

  const naive = generateRoads(
    w.elevation,
    w.water,
    w.rivers,
    w.settlements.settlements,
    {},
  );
  assert.notEqual(
    w.roads.length,
    naive.length,
    "present-day roads are identical to the all-towns network",
  );

  // And the survivors' network is exactly what you'd get from the survivors.
  const standing = w.settlements.settlements.filter((s) => !ruined.has(s.id));
  const rebuilt = generateRoads(w.elevation, w.water, w.rivers, standing, {});
  assert.equal(w.roads.length, rebuilt.length);
});

test("a world without ruins keeps its original roads and economy", () => {
  // The two-pass rebuild must be a no-op when nothing fell — otherwise it is a
  // silent source of drift.
  let sawIntact = false;
  for (const seed of ["s0", "s4", "s6", "s8", "s11"]) {
    const w = generateWorld({ seed, width: SIZE, height: SIZE });
    const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
    if (ruined.size) continue;
    sawIntact = true;
    const roads = generateRoads(
      w.elevation,
      w.water,
      w.rivers,
      w.settlements.settlements,
      {},
    );
    assert.equal(w.roads.length, roads.length, `${seed}: roads drifted`);
    assert.equal(
      w.economy.economies.length,
      w.settlements.settlements.length,
      `${seed}: economy drifted`,
    );
  }
  assert.ok(sawIntact, "test is vacuous — every seed produced ruins");
});

test("the gazetteer's exports come from towns that still stand", () => {
  const w = generateWorld({ seed: "s10", width: SIZE, height: SIZE });
  const ruined = ruinedSettlementIds(w.simulation.settlementTimeline);
  assert.ok(ruined.size > 0);
  // meta.majorExports is derived from the present-day economy.
  assert.ok(w.meta.majorExports.length > 0);
  const rebuilt = generateEconomy(
    w.settlements.settlements.filter((s) => !ruined.has(s.id)),
    w.roads,
    w.resources,
    { seed: 0 },
  );
  assert.equal(rebuilt.economies.length, w.economy.economies.length);
});
