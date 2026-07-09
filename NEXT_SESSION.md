# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **112**).
3. Skim `CHANGELOG.md` (top, Session 7) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces it;
   it also fails if a browser module — engine, app, or worker — imports one you
   forgot to add to the MODULES list).

## Context: where the project is

The world is a rich static *snapshot*: geography, peoples, lore, resources,
economy, and faith — 8 map layers, a gazetteer, and a responsive worker-driven
app. Every layer so far describes the world *as it is at one moment*. The next
big axis is **time**.

## This session's objective: **L16 — Dynamic history (world simulation)**

Make the world *evolve*. Instead of generating a single frozen present, simulate
it forward over many turns so that history becomes **emergent** — borders shift,
populations rise and crash, realms conquer and fragment, faiths spread, cities
are founded and abandoned. This is the biggest architectural step since the
human world: from generation to simulation. Aim high.

### Design (a deterministic tick loop; new `src/simulation.ts`)
Run T turns (each ~a generation/decade) over a mutable sim state seeded from the
static world. Suggested state and rules:
- **Per region:** population, controlling realm, prosperity, dominant faith.
  Seed population from carrying capacity (biome + resources + economy wealth).
- **Each turn (all deterministic, from a `simulation` stream):**
  - *Growth*: population moves toward carrying capacity; over-capacity → famine
    (population loss + a recorded event).
  - *Expansion/war*: a strong realm may attack a weaker neighbor (compare
    military = f(population, prosperity)); winner annexes the region, borders
    change, an event is recorded. Realms can fragment when overextended.
  - *Faith spread*: a region's faith can flip toward a wealthier/stronger
    neighbor's faith with some probability.
  - *Shocks*: plague/drought as occasional events reducing population, tied to
    density or climate.
  - *Cities*: high-population regions found or grow settlements; abandoned when
    population collapses.
- **Output** `SimulationLayer`: the emergent `events[]` (dated, referencing real
  named realms/regions/features), the **final** political map (region→realm),
  population by region, and a per-realm rise/peak/fall summary.

### Integrate & surface
- Wire into `world.ts` after lore (a `simulation` stream). It reads the static
  layers; it must **not** alter elevation (golden hash stays `fb232cd94fe0face`).
- Merge (or replace) the static chronicle in the gazetteer with the emergent
  timeline; add a "Rise and fall of realms" section.
- App: a **Final political** layer (realms after simulation) and/or a small
  timeline scrubber; the info panel shows the surviving powers.
- Regenerate samples + rebuild the worker/app bundle.

### Test (`tests/simulation.test.ts`)
- Determinism (same seed → identical event sequence + final borders).
- Conservation-ish sanity: population never negative; every region always has a
  controlling realm.
- Emergence: over a run, at least some borders change and some events fire.
- Chronology: events are ordered; years within the simulated span.

### Guardrails
- Deterministic: all randomness via the `simulation` stream; no `Math.random`,
  no clock. No TS `enum`/namespaces/decorators. Keep `main` green + CI passing.
- This is a *big* module — keep the tick rules readable and each one tested.

### Close out (do not skip)
1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`.
2. Update `CHANGELOG.md` (Session 8), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md`, and rewrite this file for the next (even bigger) theme.
3. Commit per logical unit and push; confirm CI green and the live app works.

## Companion / alternative directions (if you want a second big win)
- **In-app atlas & client-side exports**: render the full gazetteer in a
  readable in-app panel; a "Download poster (SVG)" and "Download report (MD)"
  button generated in the browser (svgmap needs a Buffer-free base64 path).
- **Languages**: turn the naming phonologies into small lexicons so places,
  people, and faiths share a coherent vocabulary per culture.
