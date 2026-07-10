# Next Session — Session 16: **The Great Overhaul**

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

**The user asked, explicitly, for this to be the biggest overhaul yet with the
most features.** Take that seriously. This is not a one-feature session: it is a
foundation fix plus five features, sequenced so each one lands green. Land them
in order and commit after each. Do not skip Phase 0 — everything else regenerates
the samples, and you want to regenerate them exactly once, on correct arithmetic.

If you run short of budget, the honest bail-out order is at the bottom. **Never
leave the repo broken or the docs claiming something untrue.**

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **155**).
3. Skim `CHANGELOG.md` (top, Session 15), `DECISIONS.md` (D-020/D-021/**D-022**),
   and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces it;
   it also fails if a browser module — engine/app/worker — imports one you forgot
   to add to the MODULES list).
6. **Preview discipline:** never create `new Worker` in `preview_eval` without
   `.terminate()` — a leaked worker wedges the whole Browser pane.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share ~55–60%, a few worlds unified, several
   fragmented). The regression test only catches gross failures, not drift.

## Context: where the project is

Balanced rival powers (S12) whose borders you scrub through the centuries (S11),
cities founded, sacked and abandoned as you watch (S13), all on one authoritative
timeline (S14). S15 gave the world **language**: every culture has a lexicon of 59
word-roots coined in its own phonology, every name is a glossed compound
(`Deoliria` = *the sea haven*), and the terrain steers the naming. S15 also made
roads and the economy **present-day** — rebuilt on the survivors, so no highway
runs to a dead city.

### Invariants — know these before you touch anything
- **Timeline:** anything dated derives from `meta.presentYear`. Never invent a
  second "present". (3 tests.)
- **`CONCEPTS` in `src/language.ts` is append-only.** Inserting a concept re-rolls
  every root after it and renames every world. (D-021.)
- **Lexicons are per-culture, not per-world.** Don't "improve" this by seeding
  them from the world.
- **Names never perturb the simulation.** They draw from private `Rng`s keyed by a
  string. If you change that, the balance-of-power distribution moves.
- **No test may hard-code a *simulated* outcome for a seed** (which seed has ruins
  is not stable — see D-022). Discover at run time; fail loudly if none does.
  `tests/coherence.test.ts` shows the pattern.

**Priority note:** if the user gives new feedback, address that first — it beats
any queued plan.

---

# Phase 0 — Make determinism real (D-022). **Do this first.**

The headline promise is "same seed, same world, every time." It is **false across
Node builds**: CI (v24.18.0) and the dev box (v24.16.0) disagree on whether a seed
produces ruins. Read D-022 for the evidence. Everything below regenerates samples;
do this first so you regenerate them once, on correct arithmetic.

### Why
ECMAScript pins `+ - * /` and `Math.sqrt` to exact IEEE-754 results. It leaves
`Math.hypot`, `Math.pow`, `Math.cos`, `Math.log`, `Math.exp` **implementation-
approximated** — any V8 build may return a different last bit. And the simulation
is **chaotic in the last bit**: swap `Math.hypot(x, y)` for the mathematically
identical `Math.sqrt(x*x + y*y)` (they differ in the final ulp on 926k of 2.1M
calls) and ruin counts across five seeds go `2,2,3,2,2` → `1,0,1,0,0`.

The golden hash never caught it because `hashGrid` is `hashQuantized` — it rounds
before hashing, explicitly "to survive trivial float noise".

### 0a. New `src/exact.ts` — arithmetic you can trust
```ts
/** sqrt is exact per IEEE-754; hypot is not. */
export function dist(dx: number, dy: number): number { return Math.sqrt(dx*dx + dy*dy); }

/**
 * x^k for k a multiple of 1/4, using only exact ops. x^(n/4) = (x^(1/4))^n,
 * and x^(1/4) = sqrt(sqrt(x)). Integer powers by repeated multiplication.
 * Rounding still occurs — but identically on every conforming engine.
 */
export function powExact(x: number, k: number): number;  // throws if k*4 is not an integer
```
Test `powExact` against `Math.pow` to within a few ulp on its supported exponents
(the *test* may call `Math.pow`; the engine may not).

### 0b. Replace every approximated call in the pipeline
- `erosion.ts:124` `Math.hypot(dirX, dirY)` → `dist(...)`.
- `simulation.ts` (two sites, ~354 and ~363) `Math.hypot` → `dist(...)`.
- `simulation.ts:486` `Math.pow(ownerRealm.aggression, 1.6)` → **exponent 1.5**:
  `a * Math.sqrt(a)`. It is a tuning knob; 1.5 is as good as 1.6.
- `volcanoes.ts:142` `Math.pow(t, shape.flankExp)` → `powExact`. **The current
  exponents are 1.7 / 1.05 / 1.5 — not quarter-multiples.** Snap them to
  `1.75 / 1.0 / 1.5` and say so in the commit; the silhouettes barely move.
- `terrain.ts:63` `Math.pow(d, islandPower)` → `powExact`; snap default
  `islandPower` **1.2 → 1.25**.
- `climate.ts:55` `Math.cos((lat * Math.PI) / 2)` → a polynomial in `+ - * /`
  over `lat ∈ [0,1]`. A 6-term minimax (or plain Taylor about 0 with enough
  terms) is ample; assert max error < 1e-7 against `Math.cos` in a test.
- `render.ts:188,192` `Math.log1p` **stays** — it is display, not world state.
  Leave a comment saying so, or someone will "fix" it.

### 0c. Make the guard exact
- Add an **exact** elevation hash over the raw float bits:
  `new Uint32Array(grid.data.buffer)` → hash every word. Keep the quantized hash
  if you like, but the exact one is the real guard.
- Add a **simulation fingerprint**: realm `foundedYear/peakSize/peakYear/
  finalSize/status` + event `year+type` + settlement `foundedYear/fellYear`,
  hashed. This is what actually drifted; guard it directly.
- Both in `tests/world.test.ts`.

### 0d. The test that keeps it from rotting
A test that reads every `src/*.ts` and **fails if `Math.hypot|Math.pow|Math.cos|
Math.sin|Math.exp|Math.log` appears outside `src/render.ts` and `src/exact.ts`**.
Without this, the next session silently reintroduces one.

### Blast radius
Every world changes (last bits move; the simulation is chaotic). Expected. Update
the golden hash, regenerate `docs/samples`, cite D-022, re-run the ~30-seed
balance check (mean top-power share should still land ~55–60%). Then **resolve
D-022** with a new entry and correct `PROJECT_STATE.md` + `README.md` to claim
cross-build reproducibility — *only now is that true*.

**Commit:** `Exact arithmetic: same seed, same world, on every engine (D-022)`

---

# Phase 1 — The gazetteer in the browser

The engine knows far more about a world than the app shows: languages, ruling
houses with thousand-year king-lists, ruins, faiths and myths, region prose,
resources and trade. None of it is reachable from `docs/app/`, which is where
almost everyone will meet this project.

- `src/report.ts` already builds the whole dossier as Markdown from a `World` and
  runs unchanged in the browser. Add `report` **and** `svgmap` to the `MODULES`
  list in `scripts/build-web.ts`. (`report.ts` imports `world`, `biomes`,
  `resources`, `language`, `names` — all already bundled.)
- Write a **dependency-free Markdown renderer** (`web/markdown.ts`, ~80 lines) for
  the exact subset `report.ts` emits: `#`/`##`/`###`, `**bold**`, `*italic*`,
  `- lists`, and tables. **Escape HTML first, then format** — a world name is
  attacker-controlled only in the sense that it comes from a seed, but escape it
  anyway and test it.
- Add a **Gazetteer view**: a full-height scrollable pane (a tab beside the map,
  or a slide-over). Give it a **table of contents** built from the `##` headings.
- Make place-names in it **clickable**: reuse the existing `flyTo` so clicking
  *Deoliria* flies the map to it. Settlements, regions, volcanoes and the notable
  features all carry `x`/`y` or can be looked up by name.
- The report is *long* (thousand-year king-lists). Render sections lazily or
  collapse them — don't drop 4,000 DOM nodes into the page on every generate.

**Test:** the Markdown renderer (headings, tables, lists, emphasis, and that
`<script>` in a title does not survive as a tag); `build-web.ts` emits `report.js`;
same seed → identical report string.

**Commit:** `The gazetteer, in the browser`

---

# Phase 2 — Take the world with you (client-side exports)

All pure functions already; nothing needs a server.
- **Download report (`.md`)** — `worldReportMarkdown(world)` → Blob → anchor.
- **Download poster (`.svg`)** — `worldPosterSVG(world, opts)` from `src/svgmap.ts`
  (note the name — it is *not* `posterSvg`).
- **Download map (`.png`)** — the active layer at world resolution, via
  `canvas.toBlob()` on the **offscreen** canvas, not the zoomed view canvas.
- Group these with the existing **↓ Heightmap** button into one **Export** row so
  the toolbar stops sprawling.

**Test:** each export function returns non-empty content for a small world; the
SVG parses as XML; the report round-trips deterministically.

**Commit:** `Client-side exports: report, poster, map, heightmap`

---

# Phase 3 — Deeper terrain (for the friend who loves mountains and volcanoes)

The user asked for this back in Session 10 and it has been queued since. Volcanoes
currently get a cone and a crater. Give them geology.

- **Calderas**: a large volcano that has blown its top gets a wide, shallow
  depression instead of a peaked summit — and if it sits below the local water
  table, **fill it with a crater lake** (mark those cells in `water.lakeMask` so
  hydrology, biomes and rendering all agree). Crater Lake is the reference.
- **Lava fields**: from an *active* volcano, trace 2–5 downhill flow paths (reuse
  the steepest-descent walk from `erosion.ts`), and mark cells as a new biome or a
  `lavaMask`. Render them dark and barren; suppress settlements on them.
- **Seamount arcs**: place volcano chains along a curve rather than independently,
  so island arcs look like island arcs. A simple approach: pick an origin and a
  tangent direction, walk it with jitter, drop cones along it.
- **Topo layer**: per-region **metre-accurate contour intervals** (currently the
  interval is uniform); label a few isolines with their elevation.

**Careful:** this changes elevation → the exact hash changes. That is fine, but do
it in *its own commit* after Phase 0, so the two changes never mix.

**Test:** a caldera volcano's summit cell is lower than its rim; a crater lake's
cells are all in `lakeMask`; lava cells carry no settlements; a seamount arc's
volcanoes are collinear-ish (fit a line, assert low residual).

**Commit:** `Calderas, crater lakes, lava fields, and island arcs`

---

# Phase 4 — Language contact: conquest layers the map

The lexicon (S15) makes this possible for the first time, and it is the single
most "authored"-feeling thing left. Real toponymy layers: *Wales* is what the
Saxons called the Britons; *Istanbul* is Greek worn down by Turkish.

- When a realm holds a region of a **different culture** for long enough (say ≥ 3
  turns), the settlements there acquire a **layered name**: keep the original
  root, swap or append the conqueror's head/suffix. `Khaimghekh` (Kesh,
  *stone-gate*) under Auld rule becomes `Khaimdund` — the Kesh root, the Auld word
  for haven.
- Record both: `Settlement.name` (present day) and `Settlement.formerNames:
  Array<{name, gloss, untilYear}>`. The gazetteer prints *"Khaimdund (formerly
  Khaimghekh)"*; the app's detail card shows the history of the name.
- Add `composeLayered(fromLang, toLang, originalConcepts, rng)` to
  `src/language.ts`.

**Watch out:** this runs *inside* the simulation, so it must draw from a private
`Rng` keyed by `(settlementId, turn)` — **never** from the simulation's own
stream, or the balance distribution moves. Re-run the 30-seed check regardless.

**Test:** a conquered cross-culture town has ≥1 former name and shares a root with
it; a never-conquered town has none; the simulation fingerprint is unchanged by
naming (prove it, the way S15 did with `git stash`).

**Commit:** `Language contact: conquered towns wear both names`

---

# Phase 5 — Cleanup, honesty, and speed

- **Islets:** single-cell islands become their own 1-cell "regions" and clutter
  every gazetteer. Merge sub-threshold islets (< ~12 cells) into the nearest
  region across water, or bucket them into one "the Scattered Isles" region.
- **Benchmark script** (`scripts/bench.ts`): per-layer timings for 256²/384²/512²,
  printed as a table. Establish a budget and record it in `PROJECT_STATE.md`. The
  two-pass roads/economy (S15) and Phase 3 both add cost; know what it costs.
- **README**: it has not been touched in many sessions and now undersells the
  project badly. One honest pass — languages, the temporal atlas, exact
  determinism. *Do not* rewrite it every session; this is the one time it earns it.

**Commit:** `Islets, a benchmark, and a README that tells the truth`

---

## Verification for the whole session (do not skip)

1. `npm test` green at every commit; expect **~190+ tests** by the end.
2. `node scripts/build-web.ts` and `node scripts/make-samples.ts` — **once**,
   after Phase 0, and again after Phase 3 (both change terrain).
3. ~30-seed balance check after Phases 0 and 4.
4. Verify the live app on a **fresh** preview: gazetteer renders and its links fly
   the map; exports download; Topo shows contours; no console errors.
5. Push, confirm CI green **on CI's Node, not just yours** — that is the whole
   point of Phase 0.

## Close out (do not skip)

1. Update `CHANGELOG.md` (Session 16), `PROJECT_STATE.md` (version, test count,
   retire debt, new limitations), `ROADMAP.md`.
2. `DECISIONS.md`: **resolve D-022**, and add entries for the exponent snapping,
   crater lakes touching `lakeMask`, and layered naming.
3. Rewrite this file for the next theme.
4. Commit per phase and push.

## If you run short of budget

Land in this order and stop cleanly wherever you are — **each phase is a complete,
committable unit**:

**Phase 0 (non-negotiable — it is a correctness bug) → 1 → 2 → 4 → 3 → 5.**

Phase 0 alone is a good session. Phases 0–2 are a great one. Do not start Phase 3
or 4 without the budget to finish and verify them; a half-built caldera or a
half-renamed map is worse than neither. If you stop early, move the untouched
phases into this file's next revision verbatim — they do not expire.
