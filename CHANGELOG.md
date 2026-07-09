# Changelog

One entry per work session. Each entry records what was actually produced,
verified, and left for next time. Newest first.

The format is loosely [Keep a Changelog](https://keepachangelog.com); this
project's "releases" are work sessions.

---

## Session 2 — 2026-07-08 — The physical world (L2–L6)

**Theme:** Turn a bare elevation field into a living physical world — water,
climate, rivers, and biomes — in one deep session. Five new layers, each
tested, rendered, and committed.

### Added
- **L2 — Hydrology I** (`src/hydrology.ts`): flood-fill separating connected
  ocean from enclosed lakes, coastline extraction, multi-source BFS
  distance-to-ocean, connected-component counting. Lakes render distinctly.
- **L3 — Temperature** (`src/climate.ts`): latitude cosine curve + elevation
  lapse rate + maritime moderation + regional noise.
- **L4 — Moisture** (`src/climate.ts`): prevailing-wind rain-shadow model
  blended with maritime proximity; orographic rain on windward slopes.
- **L5 — Rivers** (`src/rivers.ts`): Priority-Flood+ε depression filling with an
  inline binary min-heap, building a drainage tree in one pass (every land cell
  drains to the sea, no flats, no cycles); flow accumulation carves rivers.
- **L6 — Biomes** (`src/biomes.ts`): 16-biome Whittaker classifier
  (temperature × moisture) with alpine/snow elevation overrides.
- **Rendering:** temperature/moisture/biome thematic maps, river overlays
  (width by log-flow), lake tinting.
- **Atlas viewer:** `docs/index.html` rebuilt as a cartographic multi-layer
  gallery (5 layers per world, stats, biome legend, light/dark). Samples now
  render all layers; new `scripts/serve-docs.ts` for local preview.

### Verified
- `npm test` → **59 passing, 0 failing** (was 34). New invariants: ocean/lake
  classification, no border lakes, equator > poles, altitude lapse, windward >
  leeward drying, river **mass conservation** (rain in = flow out), drainage
  termination without cycles, biome classification matrix.
- Elevation generation untouched → golden hash `54146be48037737d` still green.
- Visual review of terrain, temperature, moisture, river, and biome maps: all
  coherent (dendritic rivers from highlands to sea, plausible climate bands).

### Decided
- D-006 (no TS `enum` under Node strip-only mode → const objects).
- D-007 (Priority-Flood+ε for drainage; drainage tree from the flood itself).
- D-008 (fixed physical pipeline order elevation→water→temp→moisture→rivers→biomes).

### Metrics
- Source modules: 12. Tests: 59. Runtime deps: 0. Engine: v0.5.0.

### Left for next session
- Begin **L7 — Regions & naming** (segment landmasses, generate place names).
  See `NEXT_SESSION.md`.

---

## Session 1 — 2026-07-08 — Foundation & first light

**Theme:** Stand up a deterministic engine that turns a seed into a rendered map.

### Added
- **Core engine (zero dependencies, TypeScript on Node):**
  - `src/rng.ts` — deterministic mulberry32 PRNG with named, order-independent
    sub-streams (`hashString`, `Rng`, `normalizeSeed`).
  - `src/noise.ts` — value noise, fBm, ridged multifractal.
  - `src/grid.ts` — shared 2D scalar-field type (`Grid`).
  - `src/terrain.ts` — elevation generation (fBm + ridged + continent mask).
  - `src/render.ts` — grayscale + hypsometric (hill-shaded) renderers.
  - `src/png.ts` — dependency-free PNG encoder (zlib + hand-rolled CRC-32).
  - `src/world.ts` — orchestration, metadata, content-hash fingerprint.
  - `src/cli.ts` — `generate` command; `src/index.ts` — public API barrel.
- **Tests:** 34 tests across `tests/` (rng, noise, grid, png, world) — all pass.
  Includes a **golden content-hash** determinism test.
- **Sample gallery:** `scripts/make-samples.ts` generates 6 curated worlds;
  `docs/index.html` is a self-contained GitHub Pages viewer with a map/relief
  toggle.
- **Docs:** README, ARCHITECTURE, ROADMAP, DECISIONS, PROJECT_STATE,
  NEXT_SESSION, CHANGELOG, MIT LICENSE.

### Verified
- `npm test` → 34 passing, 0 failing.
- `node src/cli.ts generate` produces valid PNGs + JSON; canonical world
  (256×256) content hash `54146be48037737d` is locked by test.
- Generation of a 256² world runs in well under 100 ms.
- Visual check: the canonical map renders as a coherent island continent with
  hypsometric tint and hillshaded relief.

### Decided
- D-000…D-005 (see `DECISIONS.md`): project identity, Node/zero-dep stack,
  named RNG streams, golden-hash test, docs-based gallery.

### Metrics
- Files: ~20. Tests: 34. Runtime deps: 0. Golden hash: `54146be48037737d`.

### Shipped / live
- Repo published: https://github.com/anduinmooney/cartogenesis (public, `main`).
- GitHub Pages enabled from `/docs`; gallery live and verified (HTTP 200 on
  page, manifest, and images): https://anduinmooney.github.io/cartogenesis/

### Left for next session
- Begin **L2 — Hydrology I (sea & coasts)**. See `NEXT_SESSION.md`.
