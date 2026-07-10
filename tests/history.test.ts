import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";
import { classifyBiomes } from "../src/biomes.ts";
import { generateRegions } from "../src/regions.ts";
import { generateSettlements } from "../src/settlements.ts";
import { generateHistory } from "../src/history.ts";

function build(seed: string, size = 180) {
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
  const history = generateHistory(
    w.elevation,
    w.water,
    w.rivers,
    regions,
    s.settlements,
    { seed: 3 },
  );
  return { w, history };
}

test("history is deterministic", () => {
  const a = build("chronicle", 160);
  const b = build("chronicle", 160);
  assert.deepEqual(
    a.history.events.map((e) => [e.year, e.title]),
    b.history.events.map((e) => [e.year, e.title]),
  );
});

test("events are in chronological order", () => {
  const { history } = build("timeline", 180);
  for (let i = 1; i < history.events.length; i++) {
    assert.ok(
      history.events[i].year >= history.events[i - 1].year,
      "events out of order",
    );
  }
});

test("history references real named features and yields realms", () => {
  const { history } = build("realms", 200);
  assert.ok(history.features.length >= 1, "expected named features");
  assert.ok(history.realms.length >= 1, "expected at least one realm");
  assert.ok(history.events.length >= 3, "expected a few events");
  assert.ok(history.presentYear > 0);
});

test("no founding legend is dated after the present year", () => {
  // A legend once landed at 1112 in a world whose present was 1100.
  for (const seed of ["vahalia", "atlas", "borea", "chronicle"]) {
    const w = generateWorld({ seed, width: 180, height: 180 });
    for (const e of w.history.events) {
      assert.ok(
        e.year <= w.meta.presentYear,
        `${seed}: legend at ${e.year} > present ${w.meta.presentYear}`,
      );
    }
  }
});

test("every event has a non-empty title and text", () => {
  const { history } = build("prose", 180);
  for (const e of history.events) {
    assert.ok(e.title.length > 0);
    assert.ok(e.text.length > 10);
    assert.ok(Number.isFinite(e.year));
  }
});
