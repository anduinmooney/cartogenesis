# For Fable — a briefing and a mandate

> This document was prepared by the outgoing model to hand the project to you,
> Fable, cleanly. Read `PROJECT_STATE.md`, then `CHANGELOG.md` (top), then
> `DECISIONS.md`, then this. Your mandate is broader than a normal session:
> **review the whole project, fix what's genuinely wrong, confirm everything
> works, then build one significant addition you are uniquely suited to.**

## What this project is (30 seconds)

**Cartogenesis** is a deterministic, zero-dependency procedural world generator
written in TypeScript that Node runs natively (type-stripping, no build step, no
npm deps). One integer/string seed → an entire world: eroded terrain with
volcanoes, calderas, crater lakes, lava fields and island arcs; climate, rivers,
16 biomes; named provinces with distinct cultures and real word-root languages;
cities, roads, an economy, faiths; and a **centuries-long simulated history**
(wars, conquests, revolts, ruins) that you can scrub through in a live browser
app. It runs identically in Node and the browser (`docs/app/`), and everything is
reproducible to the bit on any conforming JS engine.

It has been built over ~19 sessions, one compressed workday each, with rigorous
continuity files. It is healthy: **190 tests green, deterministic, deployed.**

## The mandate, in order

1. **Review the entire project.** Read broadly. Judge the architecture, the code
   quality, the tests, the docs, the live app. Form your own opinion — do not
   take the continuity files as gospel; verify.
2. **Fix issues that shouldn't be occurring.** There is a candidate-issues list
   below (scouted for you). Validate each — some may be non-issues — fix the real
   ones. Hunt for more; a fresh set of eyes is the point.
3. **Ensure everything works as expected.** Run the suite. Regenerate samples.
   Drive the live app on a fresh preview and actually exercise it. Confirm the
   determinism guarantees hold. Report honestly what you find.
4. **Build one significant addition you'd excel at.** See the recommendation
   below — but it's a recommendation, not an order. Pick something that plays to
   your strengths and genuinely deepens the world.

## Non-negotiable invariants (breaking these silently is the worst outcome)

1. **Determinism.** Generation is a pure function of seed + config. **No
   `Math.random`, no clock (`Date.now`, `new Date`), no I/O, no model calls** in
   `src/`. Randomness comes only from `root.stream("name")` sub-streams (keyed by
   `(seed, name)`, order-independent). This is why the engine can promise "same
   seed, same world, every time."
2. **Exact arithmetic (D-022).** The engine uses only `+ - * / Math.sqrt`, via
   `src/exact.ts` (`dist`, `dist2`, `powExact` for quarter-integer exponents,
   `cosQuarterTurn`). **No `Math.hypot/pow/cos/sin/exp/log` or the `**` operator
   anywhere in `src/` except `render.ts` and `exact.ts`** — a lint test
   (`tests/exact.test.ts`) greps for it and fails the build. World generation is
   chaotic in the last bit, so an approximated op can change history across
   engine versions. `render.ts` is exempt: pixels are not world state.
3. **Three golden fingerprints** (`tests/world.test.ts`): `contentHash`
   (quantized terrain), `exactHash` (bit-level terrain), `simulationHash` (realm
   arcs, events, settlement fates). A change that moves them must be intentional
   and documented in `DECISIONS.md`. **The split is diagnostic:** a change that
   moves only `simulationHash` but not the terrain hashes reached the sim but not
   the elevation — use that to check your change reached exactly as far as you
   intended. (Current values: content `61e751b300046ddc`, exact `c59c172694113c4e`,
   sim `c38f5de31cfff136`.)
4. **Names never perturb the simulation (D-021, D-024).** All naming — base names,
   and conquest "language contact" renaming — draws from *private* `Rng`s and
   stays out of the simulation's `events` array, so it can never change who
   conquers whom. If you add narrative that reads the world, keep it strictly
   downstream: it consumes the finished world, never feeds back.
5. **`CONCEPTS` in `src/language.ts` is append-only.** Inserting a concept
   re-rolls every later word-root and renames every world.
6. **Anything dated derives from `meta.presentYear`** (one authoritative
   timeline; D-014-era).
7. **No test may hard-code a *simulated* outcome for a seed** (which seed
   produces ruins/arcs/contact is not stable across algorithm tweaks). Discover
   at run time; fail loudly if none does. See `tests/coherence.test.ts`,
   `tests/contact.test.ts`, `tests/calderas.test.ts` for the pattern.

## How to work it (operational)

```bash
node --version                 # need ≥ 22.6
npm test                       # 190 tests, all offline; run BEFORE changing anything
node src/cli.ts generate --seed hello    # writes 10 artifacts to ./output
node scripts/make-samples.ts   # rebuild docs/ atlas (maps + posters + reports)
node scripts/build-web.ts      # rebuild docs/app/ browser bundle — AFTER any src/ edit
node scripts/serve-docs.ts     # preview docs/ + docs/app/ at localhost:8123
```

- **After any `src/` change, rerun `build-web.ts`** or CI fails (it checks the
  committed `docs/app` bundle is fresh). A NEW engine module goes in `MODULES` in
  `scripts/build-web.ts`; a new `web/` helper goes in `WEB_MODULES`.
- **Process discipline** (this project lives or dies by it): commit per logical
  unit with a real message; regenerate samples + golden fingerprints when terrain
  or the sim changes (and note *which* fingerprints moved); update `CHANGELOG.md`,
  `PROJECT_STATE.md`, `ROADMAP.md`, `DECISIONS.md` when warranted; push; **confirm
  CI is green on CI's Node** (it runs 24.x — a determinism bug can pass locally
  and fail there, which is exactly how D-022 was caught); verify the live app on a
  fresh preview. Never leave the repo broken or the docs claiming something untrue.
- **Preview gotchas:** the headless preview reports a **0×0 viewport** — resize to
  1280×860 before measuring layout. Screenshots frequently time out; verify with
  `preview_eval` (read canvas pixels, DOM, tooltip text) — stronger evidence than
  a screenshot anyway. Never create a `new Worker` in `preview_eval` without
  `.terminate()` (it wedges the whole pane).

## Verified baseline (handoff state, end of Session 19)

- Clean working tree; **190 tests pass**; determinism confirmed; `docs/app`
  bundle fresh; CI green; Pages deployed.
- If any of this is not true when you start, something changed under you — find
  out what before building.

## Candidate issues to investigate (leads, not verdicts)

*(A scout pass seeded this list; the outgoing model appended its results below.
Validate each yourself — some may be fine. This is a running start, not a
substitute for your own review.)*

<!-- FABLE_ISSUES_START -->
Ranked most-likely-real first. A scout read the code; **validate each yourself**
before acting.

**1. Confirmed real bug — some gazetteer place-links silently don't work.**
`web/main.ts` `linkifyPlaces` (~line 944–950). `re` is a global (`/g`) regex; the
node-collection loop does `if (re.test(t.data)) targets.push(t)` without resetting
`re.lastIndex` between text nodes. A stateful `/g` regex resumes from the previous
`lastIndex` into each *new* string, so some text nodes are skipped and their place
names never become clickable — and which ones depends on node order/length. (The
second loop resets `lastIndex` per target, so only the *collection* phase is
buggy.) Fix: reset `re.lastIndex = 0` before each `.test()`, or use
`.some()`/`String.prototype.includes`-style matching that isn't stateful. This is
the one worth fixing first, and easy to regression-test (assert every known place
name in a report becomes a `.place` span).

**2. Not a bug, but know it — `Date.now()` in `src/cli.ts` (~lines 97, 171).**
Only used to time the CLI status line ("generated in N ms"); never fed into
generation, so not a determinism leak. Left as-is deliberately. Don't "fix" it
into the engine's generation path.

**3. Cleanliness — `src/economy.ts` (~132–134) `richest` via `indexOf` in a
`reduce`.** Correct but O(n²) and identity-fragile (breaks if the array is ever
cloned/mapped). A plain indexed loop is clearer. Low priority.

**4. Low-confidence UX mismatch — hover ignores the scrubbed year.**
`web/main.ts` `nearestSettlement` (~344–398) always searches present-day
settlements minus present-day ruins, even while the Powers timeline is scrubbed to
a past year — so hover can name a town not yet founded, or miss one later ruined,
inconsistent with the year-filtered *markers* in `drawOverlays`
(`settlementsAt(shownYear)`). A comment says hover reflects "present day", so it
may be intentional. Your call whether to make hover time-aware on the Powers layer.

**Came back clean** (scout verified, so you can deprioritise these): no remaining
CSS `[hidden]` bugs (all `.hidden`-toggled elements are either guarded or set no
`display`); no determinism leaks in `src/` (the `web/` uses of `Math.pow`/random/
`Date` are UI-only — easing, seed, animation — never in the engine); `rng.pick`
and `.find()` sites are guarded; no division-by-zero; no TODO/FIXME/HACK markers.
<!-- FABLE_ISSUES_END -->

## The significant addition — a recommendation

The world is astonishingly complete *structurally* but thin *narratively*. Its
history is real — a deterministic simulation of centuries — but it is **told in
single-sentence templates**: `"${attacker} seized ${city} from ${defender}."`,
`"Famine struck ${region}."` Region descriptions are one-liners; myths are small
template fills. The world has a story and no storyteller.

**That gap is yours to close, and it is exactly what you excel at:** author a
**deterministic narrative-prose engine** that turns the structured world +
simulation into genuinely *readable* literature. The craft is in the generator,
not in runtime inference — you design the grammar, the sentence variety, the
narrative structure, the in-world voice; the engine expands it deterministically
from the seed (respecting every invariant above — no model calls at generation
time, pure functions, private streams).

Concretely, any of these would be a landmark addition; pick what inspires you:

- **A narrated Chronicle.** Weave the simulation's event list into flowing,
  causal history in the voice of an in-world chronicler — dramatic arcs, named
  actors carried across events, cause and consequence ("Emboldened by the fall of
  X, the young realm of Y turned north…"). Replace/augment the bulleted chronicle
  in `report.ts` and the app.
- **Founding sagas / epic fragments**, one per culture, in that culture's
  cadence, built from its lexicon and its realm's real history.
- **A traveller's account** — a first-person prose journey stitched along the
  road network, describing regions, towns (with their layered conquest-names),
  crater lakes and lava fields, faiths, as the traveller passes through.
- **Myth cycles with structure** — creation, catastrophe, and hero myths that
  reference the world's real geography and gods, with recurring motifs per
  culture.

Design notes so it stays in bounds:
- **Determinism:** build prose from the world data with a dedicated `Rng`
  sub-stream (e.g. `root.stream("narrative")`). Grammar-driven expansion (weighted
  template grammars, phrase banks, sentence combinators) gives variety without
  randomness-from-a-clock. Prove determinism with a test (same seed → same prose).
- **Zero deps, no `enum`/namespaces**, exact-arithmetic rule (unlikely to bite
  prose, but the lint will catch a stray `Math.pow`).
- **Surface it** in the gazetteer (`report.ts`) and the in-app gazetteer overlay
  (`web/`), and add it to the CLI artifacts if it's a document.
- **Test it:** determinism; every generated text is non-empty, bounded, and
  references only real world entities (no dangling names); reads as prose (basic
  sanity — sentence count, no template leakage like stray `${...}` or `undefined`).

This is not the only option — if your review turns up something you'd rather
build, build that. But the world is waiting for its voice, and that voice is you.

## When you're done

Update the continuity files (`CHANGELOG` Session 20, `PROJECT_STATE`, `ROADMAP`,
`DECISIONS`, rewrite `NEXT_SESSION.md`), commit per unit, push, confirm CI green
on CI's Node, verify the live app. Then this file has served its purpose — delete
it or leave a short note that the handoff is complete.

Welcome to the world. Make it speak.
