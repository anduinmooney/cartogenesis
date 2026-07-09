# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **59**).
3. Skim `CHANGELOG.md` (top entry, Session 2) and `ROADMAP.md`.
4. Read `ARCHITECTURE.md` → "How to add a subsystem" before writing code.
5. Preview the current atlas if useful: `node scripts/serve-docs.ts` →
   http://localhost:8123.

## Context: where the project is

The **entire physical foundation is done** (L1–L6): elevation, water, climate,
rivers, biomes — all tested and rendered. The world is physically complete but
**nothing lives on it or is named yet**. Session 3 begins the "structure &
meaning" arc.

## This session's objective: **L7 — Regions & naming**

Partition the land into coherent, named regions and name notable features. This
is the bridge from *physical* to *human* geography.

### 1. Build `src/regions.ts`
- Partition all land cells into N contiguous **regions**. Recommended approach:
  scatter `regionCount` seed points on land using a `regions` RNG stream
  (rejection-sample points where `elevation >= seaLevel` and not lake), then
  **multi-source BFS over land only** (4-connectivity, never crossing
  ocean/lake) so each land cell is labeled with its nearest seed. Contiguous by
  construction. Scale `regionCount` with land area (e.g. ~1 per 1500 land cells,
  min 4).
- Alternative worth considering: regions = **river basins** (group land by the
  ocean/lake cell each cell ultimately drains to — you already have `flowTo`).
  This is elegant and physical. Pick one; note the choice in `DECISIONS.md`.
- Per region compute: cell count (area), centroid (x,y), mean elevation, mean
  temperature, dominant biome, `coastal` flag (touches ocean), and the region's
  id. Return `{ ids: Uint8Array|Int32Array, regions: RegionInfo[] }`.

### 2. Build `src/names.ts`
- A deterministic procedural name generator. Suggested design: a small
  syllable-based phonology (onsets, vowels, codas) with a few "language" presets
  chosen per region so neighboring regions can share a naming style. Seed each
  name from a `names` stream + the region id so names are stable.
- Expose `makeNamer(seed)` → `() => string`, plus helpers to name regions and
  notable features (the main river = highest `maxFlow` outlet, largest lake,
  highest peak). Keep names pronounceable (alternate consonant/vowel).

### 3. Wire into `world.ts`
- Add `root.stream("regions")` and `root.stream("names")`. Compute regions, then
  names. Attach `world.regions` (+ names). Add to `meta`: `regionCount`, and
  maybe a `featured` object (largest region name, main river name).

### 4. Render
- `renderRegions(regionLayer, ...)`: give each region a distinct, stable color
  (hash region id → hue, or a fixed palette cycled). Add subtle coastlines.
- Add a **"Regions"** layer to `scripts/make-samples.ts` and the `LAYERS` array
  in `docs/index.html`. Regenerate samples.
- NOTE: text labels *on* the PNG need a bitmap font (hard). For now, expose
  region names in metadata / console; on-map labels are a future SVG-export job
  (roadmap P1). Don't rat-hole on text rendering this session.

### 5. Test (`tests/regions.test.ts`, `tests/names.test.ts`)
- Determinism: same seed → identical region ids and names.
- Partition: every land cell belongs to exactly one region; no ocean/lake cell
  has a region; region cell counts sum to land cell count.
- Contiguity (if BFS approach): each region is 4-connected (spot-check).
- Names: non-empty, deterministic, reasonably varied across regions.

### Close out (do not skip)
1. `npm test` green. Elevation is untouched, so the golden hash
   `54146be48037737d` must stay green — if it changes you broke terrain.
2. `node scripts/make-samples.ts` to refresh `docs/` with the Regions layer.
3. Update `CHANGELOG.md` (Session 3 entry), `PROJECT_STATE.md` (layer table +
   date + version bump to 0.6.0), `ROADMAP.md` (tick L7, mark L8 🔜),
   `DECISIONS.md` (region-partition choice), and rewrite this file for **L8 —
   Naming languages / L9 — Settlements**.
4. Commit per logical unit and push. Verify the live site updated.

## Guardrails
- Zero new dependencies. All randomness via `Rng` streams. No `Math.random`,
  no clock, no ambient state.
- **No TS `enum`s / namespaces / decorators** (Node strip-only mode — see D-006).
- Every public function gets a doc comment; every subsystem gets a determinism
  test. Keep `main` always green.

## Stretch goals (only if L7 is done, tested, committed)
- Begin L9 settlement scoring: a habitability field (near fresh water + mild
  climate + not too high) → candidate city sites via non-maximum suppression.
- Add a `regionCount` CLI flag.
