# Changelog

One entry per work session. Each entry records what was actually produced,
verified, and left for next time. Newest first.

The format is loosely [Keep a Changelog](https://keepachangelog.com); this
project's "releases" are work sessions.

---

## Session 6 — 2026-07-09 — Peoples & lore (L12)

**Theme:** Give the world a human voice — dynasties, rulers, notable figures, and
prose for every region — all downstream of geography, so the physical golden
hash is untouched.

### Added
- **L12 — Lore** (`src/lore.ts`): per-realm **ruling houses** and **ruler
  successions** (reign years + epithets like "the Navigator", "the Cursed"),
  a handful of **notable figures** tied to real places (an explorer of the main
  river, a heretic exiled from the capital, the architect of the great road…),
  and a one-line **prose description for every region** from its climate, coast,
  culture, and towns. Deterministic on a dedicated `lore` stream.
- **Gazetteer** (`report.ts`): new "Ruling houses" and "Notable figures"
  sections, region prose, and the capital's house in the overview.
- **Live app**: a "Ruling house" stat, and region prose in the click detail card.
- Added `lore` to the browser build (18 modules); rebuilt bundle + samples.

### Verified
- `npm test` → **98 passing** (6 new lore tests: determinism, houses+rulers per
  realm, reign chronology, region prose, figures, capital house).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser (live preview): app loads with lore, "Ruling house" stat shows,
  clicking a region reveals its prose, no console errors.

### Metrics
- Source modules: 23 (+lore). Tests: 98. Runtime + build deps: 0. Engine v0.9.0.

### Left for next session
- Improve the flagship app's UX with a **Web Worker** (responsive generation +
  progress), or deepen climate with **latitude wind belts**. See `NEXT_SESSION.md`.

---

## Session 5 — 2026-07-09 — Interactive atlas, CI, and erosion

**Theme:** Make the live map explorable, protect the project with CI, and deepen
the simulation with hydraulic erosion. Three milestones in one session.

### Added
- **P4 — Interactive atlas** (`web/main.ts`): the live generator now supports
  scroll-to-zoom (toward the cursor), drag-to-pan (clamped to the world),
  double-click / "Reset view", a hover tooltip (region + culture, biome,
  elevation, nearest settlement), click-to-pin a detail card, a "Copy link"
  button, and DPR-aware crisp rendering — built on an offscreen buffer + view
  transform.
- **CI** (`.github/workflows/ci.yml`): runs `node --test` on Node 24 and rebuilds
  the browser bundle, failing if the committed `docs/app` is stale. No install
  (zero deps). First run green in 17 s.
- **L1.5 — Hydraulic erosion** (`src/erosion.ts`): deterministic droplet
  simulation carving dendritic valleys, run before hydrology so rivers follow
  them. On by default (`erosion: false` to skip).

### Verified
- `npm test` → **92 passing** (added 5 erosion tests; golden hash → `fb232cd94fe0face`).
- In-browser (live preview eval): zoom/pan redraw correctly, drag suppresses the
  click-pin, hover + click show correct region/settlement data, no console errors.
- CI first run: success (17 s). Regenerated samples + web bundle with eroded terrain.

### Decided
- D-014 (hydraulic erosion on by default; intentional golden-hash change).

### Metrics
- Source modules: 22 (+erosion). Tests: 92. Runtime + build deps: 0. Engine v0.8.0.

### Left for next session
- Deeper simulation or polish — see `NEXT_SESSION.md` (options: latitude wind
  belts, merge islet regions, world-history depth, or a shareable "world of the
  day"). CI + interactivity + erosion are done.

---

## Session 4 — 2026-07-08 — Live in the browser (P2)

**Theme:** Make the engine run in the browser so anyone can type a seed and
watch a world generate live — with **zero dependencies**, even at build time.

### Added
- **`src/hash.ts`** — pure-JS content hash; `world.ts` drops `node:crypto`, so
  the whole generation path is browser-safe. Golden hash → `1b8c816c890e866c`.
- **`scripts/build-web.ts`** — zero-dependency browser build using Node's
  built-in `module.stripTypeScriptTypes` (no esbuild/tsc). Emits browser-safe
  engine modules + app to `docs/app/` (committed; Pages needs no build).
- **`web/main.ts` + `docs/app/index.html`** — the live generator: seed input,
  Random button, 6 layer tabs, Canvas rendering via `putImageData` (renderers
  already return RGBA), an info panel with stats / notable features / chronicle,
  and `?seed=` URL sync. Fully client-side; nothing leaves the browser.
- `docs/index.html`: a "Generate your own" call-to-action to the live app.
- npm scripts `build:web` and `serve`; `serve-docs.ts` now serves directory
  index pages.

### Verified
- `npm test` → **87 passing** (golden hash updated, all else unchanged).
- In-browser (via the live preview): seeds generate in ~270–300 ms, all six
  layers switch correctly, `?seed=` URL updates, zero console errors. Confirmed
  the emitted bundle has **no `node:` imports**.

### Decided
- D-012 (zero-dep browser build via Node type-stripping, not esbuild).
- D-013 (pure-JS content hash; intentional golden-hash change).

### Metrics
- Source modules: 21 (+hash). Tests: 87. Runtime deps: 0 (build deps: 0 too).
  Engine: v0.8.0 (browser + Node).

### Left for next session
- **P4 — Interactive atlas**: pan/zoom the canvas, hover a region for its
  name/stats, click for details. Or deeper simulation (hydraulic erosion).
  See `NEXT_SESSION.md`.

---

## Session 3 — 2026-07-08 — The human world (L7–L11 + presentation)

**Theme:** Populate and narrate the world. In one session: provinces, cultures,
cities, roads, and a written history — plus two presentation firsts (labeled
map posters and world-report gazetteers). The entire "structure & meaning" arc.

### Added
- **L7 — Regions** (`src/regions.ts`): partition land into contiguous provinces
  via spaced seeds + water-respecting multi-source BFS + a coverage pass so
  isolated islands become their own regions. Per-region stats + symmetric
  adjacency. Each region's naming culture is chosen from its climate.
- **L8 — Naming** (`src/names.ts`): syllable-based phonology engine with four
  distinct cultures (Auld / Meridian / Kesh / Sylvan); deterministic per-key namer.
- **L9 — Settlements** (`src/settlements.ts`): a habitability field (climate +
  fresh-water access + low, flat land) drives placement via non-max suppression;
  village/town/city tiers, a capital, port detection, culture-appropriate names.
- **L10 — Roads** (`src/roads.ts`): single multi-source Dijkstra over terrain
  (slope cost, ocean impassable, river bridges) → territory boundaries →
  Kruskal MST → a connected road network with reconstructed paths.
- **L11 — History** (`src/history.ts`): names notable features (peak, main
  river, largest lake), forms realms around cities, and generates a
  chronological chronicle — foundings, realm proclamations, wars between
  neighbours, geography-tied disasters, academies, golden ages.
- **Presentation:** `src/report.ts` (Markdown gazetteer per world) and
  `src/svgmap.ts` (self-contained labeled **SVG poster** — first named-on-map
  output). CLI now emits 7 artifacts; the atlas gallery gained a Political
  layer plus per-world poster + gazetteer links.

### Verified
- `npm test` → **87 passing, 0 failing** (was 59). New invariants: region full-
  partition & area-sum, symmetric adjacency, settlement spacing & capital
  uniqueness, road forest/no-cycle & ocean-avoidance, chronological history,
  SVG well-formedness/escaping, report determinism.
- Elevation untouched → golden hash `54146be48037737d` still green.
- Live gallery verified serving political maps, posters (30 vector labels), and
  gazetteers (HTTP 200 end-to-end).

### Decided
- D-009 (region partition = spaced-seed BFS provinces, not river basins).
- D-010 (roads via territory-boundary Dijkstra + Kruskal MST).
- D-011 (SVG for labels; PNG can't carry text).

### Metrics
- Source modules: 19. Tests: 87. Runtime deps: 0. Engine: v0.8.0.

### Left for next session
- **P2 — Browser build**: run the engine live on the Pages site (type a seed,
  watch a world generate). See `NEXT_SESSION.md` for the bundler decision.

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
