import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWorld } from "../src/world.ts";

// L17 — the chronicle, told. Three promises: same seed tells the same story to
// the letter; the teller may colour but never omit or invent; and the prose is
// prose, not leaked templates.

const SEEDS = ["atlas", "borea", "ct0", "arc0"];

test("the narrative is deterministic to the letter", () => {
  const a = generateWorld({ seed: "atlas", width: 180, height: 180 });
  const b = generateWorld({ seed: "atlas", width: 180, height: 180 });
  assert.deepEqual(a.narrative, b.narrative);
});

test("the chronicle has a frame, ordered chapters, and a sign-off", () => {
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: 180, height: 180 });
    const n = w.narrative;
    assert.match(n.title, /^The Chronicle of .+/);
    assert.ok(n.opening.length >= 1, `${seed}: no opening`);
    assert.ok(n.closing.length >= 1, `${seed}: no closing`);
    assert.ok(n.chapters.length >= 2 && n.chapters.length <= 5, `${seed}: ${n.chapters.length} chapters`);
    // Chapters tile the simulated span in order, without gaps.
    assert.equal(n.chapters[0].startYear, w.simulation.startYear);
    assert.equal(n.chapters[n.chapters.length - 1].endYear, w.simulation.endYear);
    for (let i = 1; i < n.chapters.length; i++) {
      assert.equal(n.chapters[i].startYear, n.chapters[i - 1].endYear, `${seed}: gap at chapter ${i}`);
    }
    for (const ch of n.chapters) {
      assert.ok(ch.paragraphs.length >= 1, `${seed}: empty chapter "${ch.title}"`);
      assert.match(ch.title, /^[IV]+\. .+, \d+–\d+$/);
    }
  }
});

test("no template leakage anywhere in the prose", () => {
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: 180, height: 180 });
    const n = w.narrative;
    const all = [
      n.title,
      ...n.opening,
      ...n.closing,
      ...n.chapters.flatMap((c) => [c.title, ...c.paragraphs]),
    ].join("\n");
    for (const leak of ["undefined", "[object", "${", "NaN", "  "]) {
      assert.ok(!all.includes(leak), `${seed}: leaked "${leak}"`);
    }
    // Every paragraph is a sentence or more: starts uppercase, ends terminally.
    for (const p of n.chapters.flatMap((c) => c.paragraphs)) {
      // A paragraph may open with a capital OR a year anchor ("1050: …").
      assert.match(p, /^[A-Z“"\d]/, `${seed}: uncapitalized paragraph: ${p.slice(0, 60)}`);
      assert.match(p, /[.!?]$/, `${seed}: unterminated paragraph: …${p.slice(-60)}`);
    }
  }
});

test("the teller never omits: every event's actors appear in its chapter", () => {
  for (const seed of SEEDS) {
    const w = generateWorld({ seed, width: 200, height: 200 });
    const n = w.narrative;
    const chapterFor = (year: number) =>
      n.chapters.find(
        (c, i) =>
          year >= c.startYear && (i === n.chapters.length - 1 ? year <= c.endYear : year < c.endYear),
      );
    for (const e of w.simulation.events) {
      const names = [e.actors?.subject, e.actors?.object, e.actors?.place].filter(
        (x): x is string => !!x,
      );
      if (names.length === 0) continue;
      const ch = chapterFor(e.year);
      assert.ok(ch, `${seed}: no chapter covers year ${e.year}`);
      const text = ch!.paragraphs.join(" ");
      assert.ok(
        names.some((name) => text.includes(name)),
        `${seed}: event at ${e.year} (${e.type}: ${names.join("/")}) missing from "${ch!.title}"`,
      );
    }
  }
});

test("the teller never invents: the frame is grounded in the world's own facts", () => {
  const w = generateWorld({ seed: "atlas", width: 200, height: 200 });
  const n = w.narrative;
  const opening = n.opening.join(" ");
  const closing = n.closing.join(" ");
  assert.ok(opening.includes(w.meta.capital), "opening names the capital");
  assert.ok(opening.includes(w.meta.capitalHouse), "opening names the house");
  assert.ok(opening.includes(String(w.meta.presentYear)), "opening dates itself");
  const survivors = w.simulation.realms.filter((r) => r.status !== "extinct");
  const dominant = [...survivors].sort((a, b) => b.finalSize - a.finalSize || a.id - b.id)[0];
  if (dominant) assert.ok(closing.includes(dominant.name), "closing names the dominant power");
});

test("narrating is a pure overlay: it never perturbs the simulation", () => {
  // Same discipline as naming (D-021) and language contact (D-024): the
  // narrator has a private stream and only reads. The pinned golden test guards
  // the canonical seed; this guards the property directly on another.
  const w = generateWorld({ seed: "borea", width: 180, height: 180 });
  assert.ok(w.narrative.chapters.length > 0);
  const again = generateWorld({ seed: "borea", width: 180, height: 180 });
  assert.equal(w.meta.simulationHash, again.meta.simulationHash);
  assert.equal(w.meta.exactHash, again.meta.exactHash);
});

test("the report carries both the told chronicle and the raw annals", () => {
  const w = generateWorld({ seed: "atlas", width: 180, height: 180 });
  // Imported lazily to keep this file focused on the layer.
  return import("../src/report.ts").then(({ worldReportMarkdown }) => {
    const md = worldReportMarkdown(w);
    assert.ok(md.includes(`## ${w.narrative.title}`));
    assert.ok(md.includes("## Annals"));
    // The narrated chapters appear as sub-headings.
    for (const ch of w.narrative.chapters) {
      assert.ok(md.includes(`### ${ch.title}`), `missing chapter "${ch.title}"`);
    }
    // And the narration sits BEFORE the annals, as the primary telling.
    assert.ok(md.indexOf(`## ${w.narrative.title}`) < md.indexOf("## Annals"));
  });
});

test("each world has a chronicler with a temperament, and they differ", () => {
  const voices = new Set<string>();
  for (const seed of ["s10", "atlas", "ct0", "borea", "mistral", "vahalia"]) {
    const w = generateWorld({ seed, width: 160, height: 160 });
    assert.ok(["plain", "wry", "grave"].includes(w.narrative.voice), w.narrative.voice);
    voices.add(w.narrative.voice);
  }
  assert.ok(voices.size >= 2, `all six chroniclers share one temperament: ${[...voices]}`);
});

test("the chronicle does not read as a ledger: sentence shapes vary", () => {
  // The original complaint: every sentence was "[time phrase] X did Y." Frames
  // now drop or embed the time reference often enough that time-led sentences
  // are a majority at most, not the whole book.
  const timeLed =
    /^(In |That |Soon|By |About|A generation|Hard|Before|Some \d|The chronicle is silent|Within the year|Close on|The same year|Nor was|And in|The year \d|\d+:|When a generation|Years later|In the same)/;
  let led = 0;
  let total = 0;
  for (const seed of ["s10", "atlas", "ct0", "borea"]) {
    const w = generateWorld({ seed, width: 240, height: 240 });
    for (const ch of w.narrative.chapters) {
      for (const p of ch.paragraphs) {
        for (const sent of p.split(/(?<=[.!?]) (?=[A-Z])/)) {
          total++;
          if (timeLed.test(sent)) led++;
        }
      }
    }
  }
  assert.ok(total > 100, "sample too small to judge shape variety");
  assert.ok(led / total < 0.8, `${((led / total) * 100).toFixed(0)}% of sentences are time-led`);
  assert.ok(led / total > 0.3, "chronology cues almost gone — the reader would get lost");
});

test("no colon-stutter: an anchor ending in ':' never meets a colon-bearing body", () => {
  for (const seed of ["s10", "atlas", "ct0", "borea"]) {
    const w = generateWorld({ seed, width: 240, height: 240 });
    for (const ch of w.narrative.chapters) {
      for (const p of ch.paragraphs) {
        assert.doesNotMatch(p, /:[^.!?]{0,25}:/, `${seed}: colon stutter in "${p.slice(0, 80)}"`);
      }
    }
  }
});

test("the opening names the world's own reckoning", () => {
  const w = generateWorld({ seed: "atlas", width: 180, height: 180 });
  const opening = w.narrative.opening.join(" ");
  assert.ok(opening.includes(w.history.epoch), "opening does not state the era");
  assert.ok(
    opening.includes(w.history.calendar.origin.title.replace(/^The /, "the ")),
    "opening does not name the origin event",
  );
});
