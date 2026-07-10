# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **155**).
3. Skim `CHANGELOG.md` (top, Session 15) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces
   it; it also fails if a browser module — engine/app/worker — imports one you
   forgot to add to the MODULES list).
6. **Preview discipline:** never create `new Worker` in `preview_eval` without
   `.terminate()` — a leaked worker wedges the whole Browser pane.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share should stay ~55–60%, with a few
   worlds unified and several fragmented). The regression test only catches gross
   failures, not drift.

## Context: where the project is

The simulation is alive: balanced rival powers (S12) whose borders you can scrub
through the centuries (S11), with cities founded, sacked, and abandoned as you
watch (S13), all on one authoritative timeline (S14).

S15 gave the world **language**. Every culture has a lexicon of 59 word-roots
coined in its own phonology; every name is a compound of two of them and carries
a gloss, so `Deoliria` is *the sea haven*. The terrain steers the naming. The
gazetteer and the app both print the glossary. S15 also made roads and the
economy **present-day**: they are rebuilt on the survivors after the simulation,
so no highway runs to a dead city.

### Invariants worth knowing before you touch anything
- **Timeline:** anything dated derives its years from `meta.presentYear`. Never
  invent a second "present". (3 tests.)
- **`CONCEPTS` in `src/language.ts` is append-only.** Inserting a concept
  re-rolls every root after it and renames every world. (D-021.)
- **Lexicons are per-culture, not per-world.** `vyvask` is water in Auld
  everywhere. Don't "improve" this by seeding it from the world.
- **Names never perturb the simulation.** They draw from private `Rng`s keyed by
  a string. If you change that, the balance-of-power distribution moves.

**Priority note:** if the user gives new feedback, address that first — it beats
any queued plan.

## This session's objective: **Make determinism real (D-022)**

The project's headline promise is "same seed, same world, every time." Session 15
proved that is **false across Node builds**: CI (v24.18.0) and the dev box
(v24.16.0) disagree on whether seed `s10` produces ruins. Fix the promise, or
stop making it. Read **D-022 in `DECISIONS.md` first** — it has the evidence.

### Why it happens
- ECMAScript pins `+ - * /` and `Math.sqrt` to exact IEEE-754 results. It leaves
  `Math.hypot`, `Math.pow`, `Math.cos`, `Math.log`, `Math.exp` **implementation-
  approximated** — any V8 build may return a different last bit.
- The simulation is **chaotic in the last bit**. Swap `Math.hypot(x, y)` for the
  mathematically identical `Math.sqrt(x*x + y*y)` (they differ in the final ulp
  on ~44% of calls) and ruin counts across five seeds go `2,2,3,2,2` →
  `1,0,1,0,0`. Borderline comparisons amplify it.
- The golden hash never caught it: `hashGrid` is `hashQuantized`, which rounds
  before hashing — explicitly "to survive trivial float noise".

### 1. Purge implementation-approximated math from the pipeline
Sites (grep `Math.hypot|Math.pow|Math.cos|Math.log|Math.exp` under `src/`):
- `erosion.ts` `Math.hypot(dirX, dirY)` → `Math.sqrt(dirX*dirX + dirY*dirY)`.
- `simulation.ts` two `Math.hypot` calls → same treatment.
- `simulation.ts` `Math.pow(aggression, 1.6)` → use exponent **1.5**:
  `a * Math.sqrt(a)` is exact. It is a tuning knob; 1.5 is as good as 1.6.
- `terrain.ts` `Math.pow(d, islandPower)` and `volcanoes.ts`
  `Math.pow(t, flankExp)` → write `powExact(x, k)` supporting integer and
  half-integer exponents via squaring + `sqrt`, and constrain the configs to
  those. Assert the constraint in a test.
- `climate.ts` `Math.cos((lat * Math.PI) / 2)` → a minimax polynomial in
  `+ - * /` over [0, 1]. Six terms is plenty; assert max error < 1e-7 against
  `Math.cos` in a test (the test may use `Math.cos`; the *engine* may not).
- `render.ts` `Math.log1p` may stay — it is display, not world state. Say so in
  a comment so nobody "fixes" it.

### 2. Make the guard exact
- `hashGrid` currently quantizes. Add an **exact** hash over the raw `Float64`
  bits of the elevation field (`new Uint32Array(grid.data.buffer)`), and a
  **simulation fingerprint** (realm founded/peak/final years + sizes + fates +
  event types). Guard both in `tests/world.test.ts`.
- Keep the quantized hash too if you like, but the *exact* one is the real guard.
  A guard that rounds away the failure mode is not a guard.

### 3. Then say something true
- Update `README.md` / `PROJECT_STATE.md`: reproducible across Node builds and
  platforms, guarded by an exact hash. Not before.

### Expected blast radius
Every world changes (last bits move; the simulation is chaotic). That is fine and
expected — regenerate `docs/samples`, update the golden hash, and cite D-022 in
the commit. Re-run the ~30-seed balance check afterwards: mean top-power share
should still land ~55–60%.

### Test
- `powExact` agrees with `Math.pow` to within 1 ulp on its supported exponents.
- The cosine polynomial's max error vs `Math.cos` on [0, 1] is < 1e-7.
- `grep` guard: a test that reads `src/*.ts` and **fails if any of
  `Math.hypot|Math.pow|Math.cos|Math.exp|Math.log(`** appears outside `render.ts`.
  This is the test that keeps the fix from rotting.
- Exact elevation hash + simulation fingerprint are stable across two runs.

### Guardrails
- Deterministic; randomness via streams; zero deps; no TS enums/namespaces.
- `CONCEPTS` in `src/language.ts` stays append-only (D-021).
- Anything dated derives from `meta.presentYear` (S14).

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`.
2. Update `CHANGELOG.md` (Session 16), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` (resolve D-022), and rewrite this file for the next theme.
3. Commit per logical unit and push; confirm CI green and verify the live app on
   a FRESH preview.

## Alternative big directions
- **The gazetteer in the browser** (was this session's plan before D-022 landed):
  `src/report.ts` already builds the full dossier as Markdown from a `World` and
  runs unchanged in the browser — add `report` to the MODULES list in
  `scripts/build-web.ts`, write a ~80-line dependency-free Markdown renderer
  (escape HTML first), and add a scrollable Gazetteer view with a table of
  contents. Make place-names in it clickable, reusing `flyTo`. Then client-side
  exports: **report (.md)**, **poster (.svg)** via `svgmap.ts`, **map (.png)** via
  `canvas.toBlob()` on the *offscreen* canvas — grouped with ↓ Heightmap into one
  Export row.
- **Deeper terrain** (the mountain-and-volcano friend): lava fields and flow
  paths, calderas that hold crater lakes, island-arc seamount chains,
  metre-accurate per-region contour intervals on the Topo layer.
- **Language contact:** when a realm conquers a region of another culture, the
  place-names should *layer* — a Kesh town under Auld rule keeps its Kesh root
  and gains an Auld suffix. This is how real toponymy works and the lexicon
  makes it possible for the first time.
- **Islets:** tiny single-cell islands become their own 1-cell "regions",
  cluttering gazetteers. Merge sub-threshold islets into their nearest neighbour.
