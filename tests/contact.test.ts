import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/rng.ts";
import { languageById } from "../src/names.ts";
import { composeLayered, lexiconOf } from "../src/language.ts";
import { generateWorld } from "../src/world.ts";

test("a layered name keeps the native land-word and takes the ruler's tongue", () => {
  const kesh = languageById("kesh");
  const auld = languageById("auld");
  const c = composeLayered(kesh, auld, ["stone", "gate"], new Rng("x"));
  assert.ok(c, "expected a layered name");
  // The Kesh root for "stone" survives at the front.
  assert.ok(c!.name.startsWith(lexiconOf(kesh).roots["stone"].replace(/^./, (m) => m.toUpperCase())) ||
    c!.name.toLowerCase().startsWith(lexiconOf(kesh).roots["stone"]),
    `${c!.name} does not open with the Kesh stone-root`);
  assert.equal(c!.languageId, "auld");
});

test("composeLayered is deterministic and bounded in length", () => {
  for (const [f, t] of [["kesh", "auld"], ["auld", "meridian"], ["sylvan", "kesh"]]) {
    const a = composeLayered(languageById(f), languageById(t), ["river", "fort"], new Rng("k"));
    const b = composeLayered(languageById(f), languageById(t), ["river", "fort"], new Rng("k"));
    assert.deepEqual(a, b);
    assert.ok(a && a.name.length >= 4 && a.name.length <= 15);
  }
});

function firstWorldWithContact() {
  for (let i = 0; i < 30; i++) {
    const w = generateWorld({ seed: `ct${i}`, width: 240, height: 240 });
    if (w.settlements.settlements.some((s) => s.formerNames?.length)) return w;
  }
  throw new Error("no seed produced language contact");
}

test("conquered towns wear a new name and remember the old one", () => {
  const w = firstWorldWithContact();
  const renamed = w.settlements.settlements.filter((s) => s.formerNames?.length);
  assert.ok(renamed.length > 0);
  for (const s of renamed) {
    const former = s.formerNames![0];
    assert.notEqual(s.name, former.name, "renamed but kept the same name");
    assert.ok(former.name.length > 0 && former.gloss.length > 0);
    assert.ok(former.untilYear >= w.simulation.startYear);
    assert.ok(former.untilYear <= w.meta.presentYear);
    // The land-word (the native modifier root) survives, so the two names share
    // a common prefix at least as long as the shortest possible root (2).
    const a = s.name.toLowerCase();
    const b = former.name.toLowerCase();
    let common = 0;
    while (common < a.length && common < b.length && a[common] === b[common]) common++;
    assert.ok(common >= 2, `${s.name} / ${former.name} share no root (prefix ${common})`);
  }
});

test("language contact never perturbs the simulation — it is pure overlay", () => {
  // The renaming reads deterministic control state and composes with a private
  // Rng, so the three fingerprints must be exactly what they were before the
  // feature existed (regenerated only by S17's terrain, not by this).
  const w = generateWorld({ seed: "cartogenesis", width: 256, height: 256 });
  assert.equal(w.meta.contentHash, "36d228224ba163d1");
  assert.equal(w.meta.exactHash, "3ea66d768a5354c0");
  assert.equal(w.meta.simulationHash, "ca00538568c389c4");
});

test("renamings are self-consistent with the settlements they name", () => {
  const w = firstWorldWithContact();
  const byId = new Map(w.settlements.settlements.map((s) => [s.id, s]));
  for (const rn of w.simulation.renamings) {
    const s = byId.get(rn.settlementId)!;
    assert.equal(s.name, rn.name, "settlement not carrying its renamed value");
    assert.equal(s.gloss, rn.gloss);
    assert.ok(rn.fromCulture !== rn.toCulture, "contact between one culture");
  }
});
