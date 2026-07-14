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

test("every world counts its years from its own year-zero event", () => {
  // The calendar is chosen from the world's own facts on a private stream, so
  // it varies across worlds without perturbing anything the simulation reads.
  const seen = new Set<string>();
  for (const seed of ["atlas", "borea", "s10", "mistral", "vahalia", "ct0"]) {
    const w = generateWorld({ seed, width: 160, height: 160 });
    const c = w.history.calendar;
    assert.match(c.suffix, /^A\.[A-Z]\.$/, `${seed}: odd suffix ${c.suffix}`);
    assert.match(c.era, /^after the /, `${seed}: odd era ${c.era}`);
    assert.equal(w.history.epoch, c.era, `${seed}: epoch must be the era`);
    // The origin is the FIRST legend, at year zero, and says why the count began.
    const first = w.history.events[0];
    assert.equal(first.year, 0, `${seed}: origin not at year 0`);
    assert.equal(first.title, c.origin.title);
    assert.ok(
      first.text.includes("count their days"),
      `${seed}: origin does not explain the reckoning`,
    );
    seen.add(c.suffix);
  }
  assert.ok(seen.size >= 3, `calendars not varied: only ${[...seen].join(", ")}`);
});

test("a fiery calendar names a real mountain", () => {
  // Find a world whose reckoning is the Great Burning; the mountain named in
  // its origin must be one of that world's actual volcanoes.
  let found = false;
  for (const seed of ["atlas", "ct0", "borea", "s10", "cald0", "cald4"]) {
    const w = generateWorld({ seed, width: 160, height: 160 });
    const c = w.history.calendar;
    if (!c.origin.title.includes("Great Burning")) continue;
    found = true;
    const named = c.origin.title.replace("The Great Burning of Mount ", "");
    assert.ok(
      w.volcanoes.some((v) => v.name === named),
      `${seed}: origin names ${named}, not a real volcano`,
    );
  }
  assert.ok(found, "no seed produced a fiery calendar — widen the search");
});

test("the calendar never perturbs the world: fingerprints byte-identical", () => {
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "86c5fef61d7a567b");
  assert.equal(w.meta.exactHash, "418ddfd224e6f31c");
  assert.equal(w.meta.simulationHash, "146934d0ec2014cd");
});
