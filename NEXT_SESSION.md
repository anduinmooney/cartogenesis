# Next Session — Session 17: finish the overhaul (deeper terrain + language contact)

> Read `PROJECT_STATE.md` first, then this. Session 16 was a large multi-phase
> overhaul and landed **three of five** planned phases (exact arithmetic, the
> in-app gazetteer, client-side exports). Two remain, plus cleanup. This file
> carries them forward verbatim — they did not expire.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **176**).
3. Skim `CHANGELOG.md` (top, Session 16) and `DECISIONS.md` (D-022 is now
   RESOLVED).
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces
   it). If a NEW web-side module appears (like `web/markdown.ts` did), add it to
   `WEB_MODULES` in `scripts/build-web.ts`; new engine modules go in `MODULES`.
6. **Preview discipline:** never create `new Worker` in `preview_eval` without
   `.terminate()`. Also: the headless preview reports a **0-size viewport**,
   which collapses height-based CSS — resize to explicit `1280×860` before
   measuring layout, and give overlays explicit heights.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share ~55–62%). The regression test only
   catches gross failures, not drift.

## Invariants — know these before you touch anything

- **Exact arithmetic (D-022).** The engine uses only `+ - * / sqrt`, via
  `src/exact.ts` (`dist`, `dist2`, `powExact`, `cosQuarterTurn`). No `Math.hypot/
  pow/cos/…` or `**` outside `render.ts` — `tests/exact.test.ts` greps for it and
  fails the build. `powExact` only takes **quarter-integer exponents**; snap any
  new exponent and note it. Three fingerprints are pinned in `tests/world.test.ts`
  (`contentHash`, `exactHash`, `simulationHash`); changing terrain or the sim
  updates them intentionally, with a DECISIONS note.
- **Timeline:** anything dated derives from `meta.presentYear` (S14).
- **`CONCEPTS` in `src/language.ts` is append-only** (D-021).
- **Lexicons are per-culture, not per-world.**
- **Names never perturb the simulation** — they draw from private `Rng`s. If you
  change that, the balance distribution moves.
- **No test may hard-code a *simulated* outcome for a seed** — discover at run
  time (`tests/coherence.test.ts` shows the pattern).

**Priority note:** if the user gives new feedback, address that first.

---

# Phase 3 — Deeper terrain (for the friend who loves mountains and volcanoes)

Queued since Session 10. Volcanoes get a cone and a crater today; give them
geology. **This changes elevation → the exact + quantized hashes change → do it
in its own commit and regenerate samples + golden fingerprints.**

- **Calderas**: a large volcano that has blown its top gets a wide shallow
  depression instead of a peak; if it sits below the local water table, **fill it
  with a crater lake** — mark those cells in `water.lakeMask` so hydrology,
  biomes and rendering all agree (do it where volcanoes feed into hydrology, or
  add a post-pass). Crater Lake is the reference.
- **Lava fields**: from an *active* volcano, trace 2–5 downhill flow paths (reuse
  the steepest-descent walk from `erosion.ts`) and mark a `lavaMask` or a new
  biome. Render dark and barren; suppress settlements on them.
- **Seamount arcs**: place some volcano chains along a curve (origin + tangent,
  walk with jitter) so island arcs look like arcs, not scatter.
- **Topo layer**: per-region metre-accurate contour intervals (currently
  uniform); label a few isolines with their elevation.

**Tests:** caldera summit cell lower than its rim; crater-lake cells all in
`lakeMask`; lava cells carry no settlements; an arc's volcanoes fit a line with
low residual. Any new `powExact` exponent is a quarter-multiple.

**Commit:** `Calderas, crater lakes, lava fields, and island arcs`

---

# Phase 4 — Language contact: conquest layers the map

The lexicon (S15) makes this possible for the first time, and it is the single
most "authored"-feeling thing left. Real toponymy layers: *Istanbul* is Greek
worn down by Turkish.

- When a realm holds a region of a **different culture** for long enough (≥ ~3
  turns), its settlements acquire a **layered name**: keep the original root,
  swap/append the conqueror's head. `Khaimghekh` (Kesh, *stone-gate*) under Auld
  rule → `Khaimdund` (Kesh root, Auld word for haven).
- Record both: `Settlement.name` (present) and `Settlement.formerNames:
  Array<{name, gloss, untilYear}>`. Gazetteer prints *"Khaimdund (formerly
  Khaimghekh)"*; the app detail card shows the name's history.
- Add `composeLayered(fromLang, toLang, originalConcepts, rng)` to `language.ts`.

**Trap:** this runs *inside* the simulation, so it must draw from a **private
`Rng` keyed by (settlementId, turn)** — never the sim's own stream, or the
balance distribution moves. Prove the simulation fingerprint is unchanged by the
naming (the `git stash` A/B from S15), then re-run the 30-seed check.

**Commit:** `Language contact: conquered towns wear both names`

---

# Phase 5 — Cleanup, honesty, and speed

- **Islets:** single-cell islands become their own 1-cell "regions" and clutter
  every gazetteer. Merge sub-threshold islets (< ~12 cells) into the nearest
  region across water, or bucket them into one "the Scattered Isles".
- **Benchmark** (`scripts/bench.ts`): per-layer timings for 256²/384²/512², a
  table, a budget recorded in `PROJECT_STATE.md`. The two-pass roads/economy
  (S15) and Phase 3 both add cost.
- **README**: last touched many sessions ago; it undersells the project (no
  languages, no temporal atlas, no exact determinism, no in-app gazetteer). One
  honest pass. Do NOT rewrite it every session — this is the one time it earns it.

**Commit:** `Islets, a benchmark, and a README that tells the truth`

---

## Bail-out order

**3 → 4 → 5.** Phase 3 and 4 are independent; either alone is a solid session.
Do not start one without budget to finish AND verify it — a half-built caldera or
a half-renamed map is worse than neither. If you stop early, carry the untouched
phases into the next revision of this file verbatim.

## Close out (do not skip)

1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`. Update golden
   fingerprints if terrain/sim changed.
2. Update `CHANGELOG.md` (Session 17), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` (new entries for crater-lakes-touch-lakeMask, layered naming).
3. Commit per phase and push; confirm CI green **on CI's Node** and verify the
   live app on a FRESH preview (resize to 1280×860 first).
