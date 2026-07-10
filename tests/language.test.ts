import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/rng.ts";
import { LANGUAGES, languageById } from "../src/names.ts";
import {
  CONCEPTS,
  composeName,
  glossPhrase,
  glossary,
  hintsForBiome,
  joinRoots,
  lexiconOf,
  type NameKind,
} from "../src/language.ts";
import { generateWorld } from "../src/world.ts";

const KINDS: NameKind[] = [
  "city", "town", "village", "peak", "volcano", "river", "lake",
  "region", "realm", "house", "deity", "person",
];

test("every language has a root for every concept", () => {
  for (const lang of LANGUAGES) {
    const lex = lexiconOf(lang);
    for (const c of CONCEPTS) {
      assert.ok(lex.roots[c], `${lang.id} has no root for "${c}"`);
      assert.ok(lex.roots[c].length >= 2, `${lang.id}:${c} root too short`);
    }
    assert.equal(Object.keys(lex.roots).length, CONCEPTS.length);
  }
});

test("roots within a language are distinct and none is a prefix of another", () => {
  for (const lang of LANGUAGES) {
    const roots = Object.values(lexiconOf(lang).roots);
    assert.equal(new Set(roots).size, roots.length, `${lang.id} has duplicate roots`);
    for (const a of roots) {
      for (const b of roots) {
        if (a === b) continue;
        assert.ok(
          !a.startsWith(b),
          `${lang.id}: root "${b}" is a prefix of "${a}" — ambiguous once compounded`,
        );
      }
    }
  }
});

test("a lexicon is a property of the culture, not the world", () => {
  // "Vask" means sea in Auld in every world we ever generate. Two worlds, and
  // a re-derivation, must agree.
  const a = lexiconOf(languageById("auld"));
  const b = lexiconOf(languageById("auld"));
  assert.deepEqual(a.roots, b.roots);

  const w1 = generateWorld({ seed: "one", width: 140, height: 140 });
  const w2 = generateWorld({ seed: "two", width: 140, height: 140 });
  void w1;
  void w2;
  assert.deepEqual(lexiconOf(languageById("auld")).roots, a.roots);
});

test("names are deterministic given the same language, seed, and kind", () => {
  for (const lang of LANGUAGES) {
    for (const kind of KINDS) {
      const x = composeName(lang, new Rng("k"), { kind });
      const y = composeName(lang, new Rng("k"), { kind });
      assert.deepEqual(x, y);
    }
  }
});

test("a name's gloss names the concepts it was built from", () => {
  for (const lang of LANGUAGES) {
    const lex = lexiconOf(lang);
    for (const kind of KINDS) {
      for (let i = 0; i < 30; i++) {
        const c = composeName(lang, new Rng(`${kind}:${i}`), { kind });
        assert.ok(c.gloss.length > 0, "empty gloss");
        assert.equal(c.languageId, lang.id);
        // Every concept in the gloss must be a real word of the language.
        for (const concept of c.concepts) {
          assert.ok(
            lex.roots[concept],
            `${lang.id}/${kind}: gloss cites unknown concept "${concept}"`,
          );
        }
        // A thing is never named "stone-stone".
        assert.equal(new Set(c.concepts).size, c.concepts.length, c.gloss);
      }
    }
  }
});

test("names are short, capitalised, and pronounceable", () => {
  for (const lang of LANGUAGES) {
    for (const kind of KINDS) {
      for (let i = 0; i < 40; i++) {
        const { name } = composeName(lang, new Rng(`${kind}:${i}`), { kind });
        assert.ok(name.length >= 4 && name.length <= 13, `bad length: ${name}`);
        assert.equal(name[0], name[0].toUpperCase(), `not capitalised: ${name}`);
        assert.match(name, /^[A-Za-z]+$/, `non-letters: ${name}`);
        // No tripled letter, and every name has a vowel to hang a syllable on.
        assert.doesNotMatch(name, /(.)\1\1/, `tripled letter: ${name}`);
        assert.match(name.toLowerCase(), /[aeiouy]/, `no vowel: ${name}`);
      }
    }
  }
});

test("a usable hint steers the name toward the land it describes", () => {
  // Not every port is named for the sea — that would be mechanical — but the
  // hint must dominate. Over many draws it should win the clear majority.
  for (const lang of LANGUAGES) {
    let seaNamed = 0;
    const draws = 200;
    for (let i = 0; i < draws; i++) {
      const c = composeName(lang, new Rng(`port:${i}`), {
        kind: "town",
        hints: ["sea", "grass"],
      });
      if (c.concepts.includes("sea")) seaNamed++;
    }
    assert.ok(
      seaNamed > draws * 0.5,
      `${lang.id}: only ${seaNamed}/${draws} ports named for the sea`,
    );
  }
});

test("an unusable hint is ignored rather than corrupting the name", () => {
  // A peak is never a "sea peak": "sea" is not in the peak template's
  // modifiers, so the composer must fall back, not emit a bogus concept.
  const lang = languageById("auld");
  for (let i = 0; i < 40; i++) {
    const c = composeName(lang, new Rng(`peak:${i}`), {
      kind: "peak",
      hints: ["sea"],
    });
    assert.ok(!c.concepts.includes("sea"), `sea-peak: ${c.name} (${c.gloss})`);
  }
});

test("every biome hint is a real concept", () => {
  for (let b = 0; b <= 15; b++) {
    for (const h of hintsForBiome(b)) {
      assert.ok(
        (CONCEPTS as readonly string[]).includes(h),
        `biome ${b} hints unknown concept "${h}"`,
      );
    }
  }
});

test("avoid-sets prevent duplicate names", () => {
  const lang = languageById("kesh");
  const used = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < 25; i++) {
    names.push(composeName(lang, new Rng(`t:${i}`), { kind: "town", avoid: used }).name);
  }
  assert.equal(new Set(names).size, names.length, `duplicates: ${names.join(", ")}`);
});

test("compounding applies elision, degemination, and epenthesis", () => {
  assert.equal(joinRoots("vaska", "erd", "a"), "vaskerd"); // vowel + vowel
  assert.equal(joinRoots("hold", "dun", "a"), "holdun"); // d + d
  assert.equal(joinRoots("vaskr", "stan", "a"), "vaskrastan"); // thick cluster
  assert.equal(joinRoots("vask", "hold", "a"), "vaskhold"); // 3 is sayable
  assert.equal(joinRoots("", "hold", "a"), "hold");
});

test("glossary covers the concept list, and glossPhrase reads as prose", () => {
  for (const lang of LANGUAGES) {
    const g = glossary(lang);
    assert.equal(g.length, CONCEPTS.length);
    for (const { root, gloss } of g) {
      assert.ok(root.length >= 2 && gloss.length > 0);
    }
  }
  assert.equal(glossPhrase("sea-fort"), "the sea fort");
  assert.equal(glossPhrase("storm-king"), "the storm king");
});

test("a generated world glosses every name it shows the reader", () => {
  const w = generateWorld({ seed: "glossy", width: 200, height: 200 });
  for (const r of w.regions.regions) assert.ok(r.gloss.length > 0, `region ${r.name}`);
  for (const s of w.settlements.settlements) assert.ok(s.gloss.length > 0, `town ${s.name}`);
  for (const f of w.history.features) assert.ok(f.gloss.length > 0, `feature ${f.name}`);
  for (const v of w.volcanoes) assert.ok(v.gloss.length > 0, `volcano ${v.name}`);
  for (const r of w.history.realms) assert.ok(r.gloss.length > 0, `realm ${r.name}`);
  for (const h of w.lore.houses) assert.ok(h.gloss.length > 0, `house ${h.name}`);
  for (const f of w.religion.faiths) assert.ok(f.deity.gloss.length > 0, `god ${f.deity.name}`);
});

test("settlement names reflect the site: watery places carry water-words", () => {
  // Ports should carry water-words at a high rate, and the honest CONTROL
  // group is inland towns NOT on a river — riverside towns are rightly named
  // for their rivers, so lumping them in made this test a coin flip on small
  // samples (it once failed purely by re-rolling terrain, S21).
  let portWater = 0;
  let portTotal = 0;
  let dryWater = 0;
  let dryTotal = 0;
  const water = new Set(["sea", "river", "water"]);
  for (const seed of ["harbour", "atlas", "vahalia", "borea", "aurelia", "kesh"]) {
    const w = generateWorld({ seed, width: 240, height: 240 });
    const width = w.elevation.width;
    for (const s of w.settlements.settlements) {
      const wet = s.gloss.split("-").some((c) => water.has(c));
      const onRiver = w.rivers.riverMask[s.y * width + s.x] === 1;
      if (s.isPort) {
        portTotal++;
        if (wet) portWater++;
      } else if (!onRiver) {
        dryTotal++;
        if (wet) dryWater++;
      }
    }
  }
  assert.ok(portTotal > 5, "need a real sample of ports");
  const portRate = portWater / portTotal;
  // The absolute claim is the strong one: water-words are ~3 of 20+ modifiers,
  // so random naming would land near 0.15 — ports must sit far above that.
  assert.ok(portRate > 0.4, `only ${(portRate * 100).toFixed(0)}% of ports named for water`);
  // The directional claim needs a control group that actually exists —
  // habitability favours water so strongly that dry inland towns can be rare.
  if (dryTotal >= 5) {
    const dryRate = dryWater / dryTotal;
    assert.ok(
      portRate > dryRate,
      `ports (${portRate.toFixed(2)}) should out-water dry inland towns (${dryRate.toFixed(2)})`,
    );
  }
});

test("a world never names two volcanoes the same", () => {
  // Three Mt. Brogravras once stood on one island: the volcano template was
  // narrow and nothing stopped it repeating.
  for (const seed of ["s10", "atlas", "borea", "vahalia", "kesh"]) {
    const w = generateWorld({ seed, width: 240, height: 240 });
    const names = w.volcanoes.map((v) => v.name);
    assert.equal(
      new Set(names).size,
      names.length,
      `${seed}: duplicate volcano names — ${names.join(", ")}`,
    );
  }
});

test("a world never names two settlements or two regions the same", () => {
  for (const seed of ["s10", "atlas", "borea"]) {
    const w = generateWorld({ seed, width: 240, height: 240 });
    const towns = w.settlements.settlements.map((s) => s.name);
    assert.equal(new Set(towns).size, towns.length, `${seed}: duplicate towns`);
    const regions = w.regions.regions.map((r) => r.name);
    assert.equal(new Set(regions).size, regions.length, `${seed}: duplicate regions`);
  }
});
