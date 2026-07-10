# Next Session — Session 18

> Read `PROJECT_STATE.md` first, then this. Session 17 delivered the headline of
> Phase 3 (calderas, crater lakes, lava fields). What remains: **language
> contact** (the biggest authored-feel win left), two smaller terrain bits, and
> cleanup. Lead with language contact.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **183**).
3. Skim `CHANGELOG.md` (top, Session 17) and `DECISIONS.md` (D-022 resolved,
   D-023 on post-hoc water/lava injection).
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces
   it). New engine module → `MODULES`; new `web/` helper → `WEB_MODULES`.
6. **Preview discipline:** the headless viewport reports **0×0** — resize to
   `1280×860` before measuring layout. Screenshots frequently time out here;
   verify with `preview_eval` (read canvas pixels, DOM, tooltip text) — that is
   stronger evidence than a screenshot anyway. Never leak a `new Worker`.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share ~55–62%).

## Invariants — know these before you touch anything

- **Exact arithmetic (D-022).** Engine uses only `+ - * / sqrt` via `src/exact.ts`.
  No `Math.hypot/pow/cos/sin/exp/log` or `**` outside `render.ts` — a lint test
  greps for it. `powExact` takes only quarter-integer exponents; snap and note
  any new one. Three fingerprints pinned in `tests/world.test.ts`.
- **Post-hoc injection (D-023).** Crater lakes and lava are added by passes after
  classification (`fillCraterLakes`, `traceLavaFields`); ordering in `world.ts`
  is load-bearing and commented.
- **Timeline:** dated things derive from `meta.presentYear` (S14).
- **`CONCEPTS` in `src/language.ts` is append-only** (D-021).
- **Names never perturb the simulation** — private `Rng`s only.
- **No test may hard-code a *simulated* outcome for a seed** — discover at run
  time (`tests/coherence.test.ts`, `tests/calderas.test.ts` show the pattern).

**Priority note:** if the user gives new feedback, address that first.

---

# Phase 4 — Language contact: conquest layers the map (lead with this)

The lexicon (S15) makes this possible, and it is the single most authored-feeling
thing left. Real toponymy layers: *Istanbul* is Greek worn down by Turkish.

- When a realm holds a region of a **different culture** for long enough (≥ ~3
  turns), its settlements acquire a **layered name**: keep the original root, swap
  or append the conqueror's head. `Khaimghekh` (Kesh, *stone-gate*) under Auld
  rule → `Khaimdund` (Kesh root, Auld word for haven).
- Record both: `Settlement.name` (present) and `Settlement.formerNames:
  Array<{name, gloss, untilYear}>`. Gazetteer prints *"Khaimdund (formerly
  Khaimghekh)"*; the app detail card shows the name's history.
- Add `composeLayered(fromLang, toLang, originalConcepts, rng)` to `language.ts`.

**Trap (important):** this runs *inside* the simulation, so it must draw from a
**private `Rng` keyed by (settlementId, turn)** — never the sim's own stream, or
the balance distribution moves. Prove the simulation fingerprint is unchanged by
the *naming* itself (the `git stash` A/B from S15: rename logic must not alter
realm arcs), then re-run the 30-seed balance check.

**Commit:** `Language contact: conquered towns wear both names`

---

# Phase 3 leftovers — finish the terrain (optional, smaller)

- **Seamount arcs**: place some volcano *chains* along a curve (origin + tangent,
  walk with jitter, no trig — sample directions exactly) so island arcs look like
  arcs, not scatter. `addVolcanoes` currently places each independently.
- **Topo contour intervals**: `renderContours` uses a uniform interval; make it
  **per-region metre-accurate** and label a few isolines with their elevation.

Both touch terrain/rendering; the arc one changes elevation → regenerate the
three fingerprints and samples.

**Commit:** `Island arcs and metre-accurate contours`

---

# Phase 5 — Cleanup, honesty, and speed

- **Islets:** single-cell islands become their own 1-cell "regions" and clutter
  every gazetteer. Merge sub-threshold islets (< ~12 cells) into the nearest
  region across water, or bucket them as "the Scattered Isles".
- **Benchmark** (`scripts/bench.ts`): per-layer timings for 256²/384²/512², a
  table, a budget recorded in `PROJECT_STATE.md`. The two-pass roads/economy (S15)
  and the S17 volcano passes both add cost.
- **README**: last touched many sessions ago; it undersells the project badly (no
  languages, no temporal atlas, no exact determinism, no in-app gazetteer, no
  calderas/lava). One honest pass — this is the one time it earns a rewrite.

**Commit:** `Islets, a benchmark, and a README that tells the truth`

---

## Bail-out order

**4 → 3-leftovers → 5.** Language contact alone is a strong session. Do not start
a phase without budget to finish AND verify it. Carry untouched phases into the
next revision of this file verbatim.

## Close out (do not skip)

1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`. Update golden
   fingerprints if terrain/sim changed (note which moved — it tells you how far
   the change reached).
2. Update `CHANGELOG.md` (Session 18), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file.
3. Commit per phase and push; confirm CI green **on CI's Node** and verify the
   live app on a FRESH preview (resize to 1280×860 first).
