# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **128**).
3. Skim `CHANGELOG.md` (top, Session 12) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces
   it; it also fails if a browser module — engine/app/worker — imports one you
   forgot to add to the MODULES list).
6. **Preview discipline:** never create `new Worker` in `preview_eval` without
   `.terminate()` — a leaked worker wedges the whole preview browser.

## Context: where the project is

Session 11 shipped the **time scrubber** (play/scrub 100→1,100 AR on the Powers
layer). Session 12 fixed a serious balance flaw the user spotted — every world
used to collapse into a single hegemon; now overextension, distance, revolts,
ambition and per-world cohesion make outcomes **vary** (mean top-power share
94% → 59%). A regression test guards both failure modes.

The *cities* on the map are still static — present-day settlements, unchanged as
you scrub. The simulation narrates foundings and falls in the chronicle; the next
step makes them **show on the map**.

**Balance note:** if you touch `src/simulation.ts` war/revolt logic, re-run the
distribution check (generate ~30 seeds, measure top-power share) — the regression
test only catches gross failures, not drift.

**Priority note:** if the user gives new feedback, address that first.

## This session's objective: **Dynamic settlements over time**

Make cities appear and disappear as history unfolds, so the scrubber shows not
just borders but the growth and collapse of urban life.

### Design
1. **`src/simulation.ts`**: give each settlement a *founding year* and possibly a
   *fall year*. Simplest first cut: seed each existing settlement with a founding
   year (capitals/cities early, villages later — reuse the pattern from
   `history.ts`), and let the simulation *found new settlements* in high-
   population regions and *abandon* ones whose region population collapses (tie to
   the famine/plague/conquest logic already there). Record per-settlement
   `{ x, y, name, tier, foundedYear, fellYear? }` in a `settlementTimeline` on the
   `SimulationLayer` (keep the static `settlements` layer as "present day").
   - Keep it deterministic (the `simulation` stream) and bounded.
2. **App**: when scrubbing, draw only settlements that exist at the current year
   (`foundedYear <= year && (fellYear == null || year < fellYear)`). The overlay
   already draws settlement markers/labels in `drawOverlays` — filter by the
   scrubber's current year when on the Powers layer. Show founded/abandoned
   moments (a brief marker pulse is a nice touch).
3. Optionally surface founding/fall years in the click-detail and gazetteer.

### Test
- Determinism unchanged; golden hash stays `74c67102ff7abf98`.
- Timeline invariants: every settlement has a foundingYear within the sim span;
  `fellYear` (if set) > `foundedYear`; present-day settlements are those alive at
  `endYear`.
- In-browser (`preview_eval`, no worker leaks): on Powers, scrub to an early year
  and assert fewer settlement markers than at the end; play advances; no errors.

### Guardrails
- Deterministic engine; randomness via streams; no clock in the engine. Zero
  deps. No TS `enum`/namespaces/decorators. Keep `main` green + CI passing.

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts` if needed.
2. Update `CHANGELOG.md` (Session 12), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file for the next theme.
3. Commit per logical unit and push; confirm CI green and the live app works
   (verify on a FRESH preview; terminate any test workers).

## Alternative big directions (if you'd rather)
- **Per-culture languages**: turn the naming phonologies into small lexicons so
  places, people, and faiths share a coherent vocabulary per culture (a "Sea"
  root recurring in Auld coastal names, etc.).
- **In-app gazetteer & client-side exports**: render the full report in a
  readable in-app panel; "Download poster (SVG)" / "Download report (MD)"
  generated in the browser.
- **Deeper terrain**: lava fields / calderas / island-arc seamounts around the
  volcanoes; per-region metre-accurate contour intervals on the Topo layer.
