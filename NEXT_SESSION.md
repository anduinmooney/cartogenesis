# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **117**).
3. Skim `CHANGELOG.md` (top, Session 8) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces it;
   it also fails if any browser module — engine/app/worker — imports a module
   you forgot to add to the MODULES list).

## Context: where the project is

The world is *simulated forward* — L16 produces emergent history and a final
"Powers" map. Session 9 closed four UX gaps from user feedback: features are now
labeled on the map, resources have a legend + hover-ID (and are evenly
distributed), Relief/Rainfall are shaded and readable, and the chronicle is
clickable (flies the map to each event).

**Priority note:** if the user gives new feedback, address that first — it beats
any queued plan. Otherwise, the queued objective below still stands.

The remaining big step on the simulation is to make history **watchable**: scrub
through the centuries and see borders shift, realms rise and fall.

## This session's objective: **A temporal atlas (watch history unfold)**

Turn the simulation from a single end-state into an animated timeline the user
can play and scrub. Big, visible payoff built directly on L16.

### 1. Record the timeline (`src/simulation.ts`)
- Keep a **per-turn snapshot** of region→realm control (and optionally
  population). Add to `SimulationLayer`:
  `snapshots: Array<{ year: number; control: Record<number, number> }>`
  (or a compact `Int32Array` per turn indexed by a stable region order).
- This is tiny (turns × regions). Add a test: snapshots.length === turns (+1 for
  the initial state), and the last snapshot equals `finalControl`.

### 2. Render frames by year (`src/render.ts`)
- Generalize `renderPowers` (or add `renderPowersAt(regions, controlMap, water,
  elevation)`) so it colors cells from an arbitrary control map, not just the
  final one. The current `renderPowers` becomes "render the last snapshot".

### 3. The scrubber UI (`web/main.ts` + app HTML)
- The worker already posts the whole world (incl. `simulation.snapshots`) to the
  main thread. Add a **timeline slider** + **play/pause** button under the map.
- When the Powers layer is active, dragging the slider (or playing) renders the
  Powers frame for that year **on the main thread** from
  `simulation.snapshots[i].control` — you already have `regions.ids` and the
  water masks in the cloned world, so import a light `renderPowersAt` and blit it
  (≈5–10 ms/frame, smooth). Show the current year; highlight chronicle events at
  or before it. Playing steps through snapshots on a timer.
- Keep it clean: the slider only shows for the Powers layer (or repurpose it as a
  general "history year" control).

### 4. Surface + regenerate
- Rebuild the worker/app bundle and regenerate samples. (The static Powers
  sample image can stay as the final frame.)

### Test
- Engine: snapshot invariants above; determinism unchanged; golden hash stays
  `fb232cd94fe0face` (simulation is downstream of elevation).
- In-browser (`preview_eval`): generate, switch to Powers, move the slider to an
  early year and assert the canvas differs from the final year; play advances the
  year; no console errors.

### Guardrails
- Deterministic engine; all randomness via streams; no clock in the engine (the
  UI supplies any real-time timing for playback only).
- Zero deps. No TS `enum`/namespaces/decorators. Keep `main` green + CI passing.

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`.
2. Update `CHANGELOG.md` (Session 9), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file for the next big theme.
3. Commit per logical unit and push; confirm CI green and the live app works.

## Companion / alternative big directions
- **Dynamic settlements**: let the simulation found/abandon cities over time and
  show them appearing/disappearing as you scrub (ties L16 to the map).
- **Per-culture languages**: turn the naming phonologies into small lexicons so
  places, people, and faiths share a coherent vocabulary per culture.
- **In-app gazetteer & client-side exports**: render the full report in the app;
  "Download poster (SVG)" / "Download report (MD)" generated in the browser.
