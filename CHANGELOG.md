# Changelog

One entry per work session. Each entry records what was actually produced,
verified, and left for next time. Newest first.

The format is loosely [Keep a Changelog](https://keepachangelog.com); this
project's "releases" are work sessions.

---

## Session 12 — 2026-07-09 — Balance of power (user feedback)

**Theme:** "Powers and regions always nail down to one power by the end." True,
and measured: mean top-power share **94%**, with **75% of worlds >90% unified**.
Every history read the same. Fixed.

### The cause
A realm's strength was the raw **sum** of its regions, so every conquest made the
next one easier — a pure snowball with nothing pushing back.

### Counter-forces added (`src/simulation.ts`)
- **Overextension** — a sprawling realm projects less force per front.
- **Distance** — armies weaken far from their capital (a *free radius* keeps
  border wars unpenalised).
- **Home ground** — defenders fight harder on their own soil.
- **War exhaustion** — a cooldown after every conquest, longer after a defeat.
- **Unrest & revolt** — freshly conquered land seethes and can rise; the more
  overextended the empire, the likelier the province revolts.
- **Cluster secession** — breakaways take a contiguous group of provinces, so
  they're viable rivals instead of one-region snacks that get re-eaten.

### Variety & character
- **Per-realm `aggression`** (0.6 timid … 1.8 warlike): bold realms march on poor
  odds. Every world is guaranteed at least one would-be conqueror.
- **Per-world `cohesion`** (unruly … cohesive) scales overextension/revolt/
  secession — so some worlds fragment and some genuinely unify.
- **Invasions can be repulsed** (new `repulsed` event). Realms relocate their
  seat when their capital falls.

### Measured over 30 seeds
| Metric | Before | After |
|---|---|---|
| Mean top-power share | 94% | **59%** (sd 19) |
| Worlds >90% unified | 75% | **10%** |
| Worlds fragmented (<45%) | 0% | **27%** |
| Avg powers at end | ~1.5 | **2.6** |
| Wars per world | — | 11 conquests vs **16 repulsed** |

### Verified
- `npm test` → **128 passing**, incl. a new **regression guard** asserting
  histories stay varied (not all unified, *and* conquest still possible).
- Golden hash unchanged (`74c67102ff7abf98`). Samples + bundle regenerated: the
  Powers map now shows rival realms; reports carry rise/fall arcs (a realm peaks
  at 10 provinces then goes extinct) and repeated failed campaigns.
- In-browser: 6 surviving realms, 120 events (36 conquests / 18 repulsed / 15
  revolts); scrubber shows borders shifting between real powers.

### Decided
- D-019 (balance-of-power model: projected strength, not raw sum).

---

## Session 11 — 2026-07-09 — Temporal atlas (watch history unfold)

**Theme:** First verified Session 10's work live (the preview browser was fine on
a fresh start — it was just wedged last session by leaked test workers), then
built the queued time scrubber.

### Verified (Session 10, live)
- Volcanoes render and are labeled on the map, the Topo layer shows contours,
  hover shows elevation in metres ("Snow · 4,500 m"), and the **"↓ Heightmap"**
  button downloads a real 16-bit PNG in-browser. All confirmed with a screenshot.

### Added — the time scrubber
- **`src/simulation.ts`**: records a per-turn `ControlSnapshot` (region→realm
  borders) after every turn plus the initial state (turns + 1 total); the last
  equals `finalControl`.
- **`src/render.ts`**: `renderPowersAt(regions, control, …)` renders any control
  map; `renderPowers` now wraps it with the final one.
- **App**: on the **Powers** layer, a timeline **slider + play/pause** appears
  under the map. Dragging or playing renders that year's borders on the main
  thread (~5–10 ms/frame) and shows the year (100 → 1,100 AR); hidden on other
  layers. You can watch realms rise, conquer, and fall across the centuries.

### Verified
- `npm test` → **127 passing** (new: snapshot count/order, last == final, borders
  change). Golden hash unchanged (`74c67102ff7abf98`; simulation is downstream).
- In-browser: scrubber shows only on Powers, 41 frames, scrubbing to 100 AR
  changes the borders vs. 1,100 AR, play advances the timeline; screenshot at
  450 AR shows two rival realms mid-consolidation. No leaked workers this time.

### Metrics
- Source modules: 28. Tests: 127. Deps: 0. Engine v0.12.0. 10 map layers.

### Left for next session
- Dynamic settlements (found/abandon over time, animated with the scrubber);
  per-culture languages/lexicons; or in-app gazetteer + client-side exports.

---

## Session 10 — 2026-07-09 — Volcanoes & real heightmaps (user request)

**Theme:** For a friend whose special interest is mountains and volcanoes. Honest
answer up front: the terrain is *plausible*, not geologically simulated — so
instead of faking accuracy, this adds the things that genuinely serve that
interest: real volcanoes, real heightmap exports, and elevation in metres.

### Added
- **L1.6 — Volcanoes** (`src/volcanoes.ts`): stratovolcanoes, shield volcanoes,
  and cinder cones with summit craters, built onto the terrain **before**
  erosion so it carves realistic radial gullies down their flanks. Each is
  placed, sized, named, and flagged active / dormant / extinct.
- **Real 16-bit heightmap exports** (`encodePNGGray16`): the CLI writes a true
  16-bit grayscale heightmap PNG (importable into Blender / Unity / Godot /
  World Machine) plus a raw `.r16`. The app has a **"↓ Heightmap"** button that
  encodes a 16-bit PNG in-browser (via `CompressionStream`).
- **Topographic contour layer** (`renderContours`): hypsometric bands + isolines;
  volcanoes read as concentric rings. New "Topo" layer in the gallery and app.
- **Elevation in metres**: `elevationToMetres`; the meta carries
  `highestPeakMetres` and volcano counts; hover/info/report show heights in m and
  a note on scaling the heightmap.
- **Readability (carried from S9 method):** rainfall/temperature are now
  contrast-stretched *and* terrain-shaded (`renderThematic`).

### Fixed (critical)
- A **latent infinite loop** in `generateReligion`'s origin backfill (it used
  `origins.length` as the loop index, so it could spin forever when that element
  was already an origin). It hung 360px worlds. Now index-based; regression test
  added. This bug predated this session and could have bitten other seeds.

### Verified
- `npm test` → **126 passing** (volcano determinism/placement/crater, 16-bit PNG
  round-trip, religion-loop regression). Golden hash → `74c67102ff7abf98`
  (intentional — terrain changed; samples + bundle regenerated).
- The worker's full 10-layer render pipeline verified in Node (402 ms at 384px).
  *Caveat:* the preview browser's module worker was wedged this session (leaked
  diagnostic workers + tooling flakiness), so end-to-end app confirmation is via
  Node + the unchanged S7–S9 worker architecture, not a live screenshot.

### Decided
- D-018 (volcanoes before erosion; real 16-bit heightmap exports).

### Metrics
- Source modules: 28 (+volcanoes). Tests: 126. Deps: 0. Engine v0.12.0. 10 layers.

### Left for next session
- Confirm the live app in a fresh browser; the queued time scrubber; or more
  volcano/terrain depth (lava fields, calderas, seamount island-arcs).

---

## Session 9 — 2026-07-09 — Closing UX gaps (user feedback)

**Theme:** Not a new layer — a focused pass on four real usability gaps the user
called out. The world had all this depth but you couldn't *find* or *read* much
of it.

### Fixed
1. **Findable features.** The app now draws feature markers + labels
   (Mt. / Lake / R.) directly on the map canvas (view-transformed, always
   visible), plus city/capital labels when zoomed in. Named features were in the
   info panel but nowhere on the map.
2. **Legible resources + a real bug.** Added a per-layer **legend**
   (resources / biomes / faiths) under the map, and hovering the Resources layer
   now **identifies the deposit** (kind + richness). Fixed a placement bug:
   deposits were 63–85% in the north (score/index-ordered greedy placement hit
   the count cap before reaching the south) — now candidates are shuffled before
   greedy spacing, so deposits track the land distribution.
3. **Readable Rainfall & Relief.** Relief is now **hillshaded** grayscale so
   ridges, valleys, and the eroded drainage read clearly (was a flat gradient).
   Rainfall is **contrast-stretched** to the land range **and terrain-shaded**
   (new `renderThematic`) so it's a map, not a flat tan wash. Temperature shares
   the same shading.
4. **Clickable chronicle.** Every simulation event now carries a location; each
   chronicle entry is clickable and **flies the map** to where it happened with a
   highlight pulse. (Fixed a negative-radius `arc` crash in the pulse; the
   animation is `setTimeout`-driven so it runs even when the tab isn't painting.)

### Verified
- `npm test` → **117 passing**; golden hash unchanged (`fb232cd94fe0face`).
- In-browser: deposits spread evenly N/S; legends populate (15 resources / 13
  biomes / 4 faiths); Relief 103 / Rainfall 291 distinct colors (were near-flat);
  clicking a chronicle entry zooms the map to the event; no console errors.

### Decided
- D-017 (spatially-shuffled resource placement to avoid directional bias).

### Metrics
- Tests: 117. Deps: 0. Engine v0.11.0. (No engine version bump — presentation +
  a placement fix.)

### Left for next session
- The queued **time scrubber** (watch borders shift through the centuries), or
  more feedback-driven polish. See `NEXT_SESSION.md`.

---

## Session 8 — 2026-07-09 — Dynamic history: the world simulated forward (L16)

**Theme:** The biggest architectural step since the human world. History stops
being a template and becomes **emergent** — the world is simulated forward over
centuries, and the chronicle, the borders, and each realm's fate all fall out of
the run.

### Added
- **L16 — Simulation** (`src/simulation.ts`): a deterministic tick loop
  (40 turns × 25 years by default). Every region holding a city/town begins as
  a petty realm; across the run:
  - populations grow toward carrying capacity (biome + resources + economy) and
    crash in **famines**;
  - stronger realms **conquer** weaker neighbours — borders shift, realms **fall**;
  - overgrown empires shed **breakaway** states;
  - **plagues/droughts** strike; **faiths spread**; **golden ages** dawn.
  Outputs: the emergent event log, final region→realm control, populations, and
  each realm's rise/peak/fall summary.
- **Powers map** (`renderPowers`): the final political landscape after the
  simulation — a new 9th layer in the gallery, app, and worker.
- **Gazetteer**: static founding events reframed as "Legends of the founding
  age"; a "Rise and fall of realms" table; the emergent chronicle; dominant
  power in the overview.
- **App**: a Powers tab, a "Dominant power" + "Surviving realms" stat, and the
  chronicle now shows the emergent history.

### Verified
- `npm test` → **117 passing** (5 new: determinism, full control coverage,
  emergence, chronology, consistent realm summaries).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser: Powers layer renders, chronicle shows 70+ emergent events
  (conquests, falls, secessions), dominant power + surviving realms shown, no
  console errors. Example: one seed's Masemi consolidated a 26-region empire
  while rivals rose and fell.

### Decided
- D-016 (petty-realm seeding: initial polities from cities *and* towns so the
  simulation consolidates from many states, producing emergent wars).

### Metrics
- Source modules: 27 (+simulation). Tests: 117. Deps: 0. Engine v0.11.0.
  9 map layers.

### Left for next session
- Keep going bigger — see `NEXT_SESSION.md` (a time scrubber to watch history
  unfold; or per-culture languages/lexicons; or in-app gazetteer + exports).

---

## Session 7 — 2026-07-09 — Civilization: resources, economy, faith + a Web Worker

**Theme:** The biggest session yet — three new engine layers that turn the map
into a *civilization*, all surfaced everywhere, plus a platform upgrade so the
live app generates without freezing.

### Added — engine (all downstream of geography; golden hash unchanged)
- **L13 — Resources** (`src/resources.ts`): ~15 resource kinds placed by
  terrain and biome (ore & gems in mountains, timber in forests, grain on
  lowlands, fish on coasts, furs in taiga, spices in jungle, salt in deserts…)
  via per-kind suitability scoring and spaced placement.
- **L14 — Economy** (`src/economy.ts`): each settlement gathers its hinterland's
  deposits to decide what it produces; wealth from production + road
  connectivity + port + capital; trade hubs and the world's major exports.
- **L15 — Religion** (`src/religion.ts`): faiths born in large regions, each with
  a deity, a domain, and a creation myth naming real features; spread across the
  region-adjacency graph so every region has a dominant faith.

### Added — presentation & platform
- **Maps:** two new layers — a **Faiths** map (regions tinted by faith) and a
  **Resources** map (deposit markers) — in the gallery (8 layers/world) and app.
- **Gazetteer:** "Faiths" (deity, domain, myth) and "Resources & trade" (exports,
  wealthiest town, trade hubs, deposit tallies) sections; settlements list wealth
  tier + products.
- **App:** Faiths + Resources tabs; info panel adds Faiths + Exports; click
  detail shows a settlement's wealth/products and a region's faith.
- **Web Worker** (`web/worker.ts`): generation + all-layer rendering run off the
  main thread; the UI never freezes. Layer switching is now an instant buffer
  blit (~2 ms). Added a **"Today's world"** button (date-seeded) and a busy state.

### Verified
- `npm test` → **112 passing** (14 new: resources, economy, religion — placement
  realism, wealth bounds, faith coverage, determinism).
- Elevation untouched → golden hash `fb232cd94fe0face` still green.
- In-browser: worker generates off-thread (status updates immediately), hover/
  click/chronicle work on the structured-cloned world, layer switch instant,
  "Today's world" seeds from the date, no console errors.

### Decided
- D-015 (Web Worker: pre-render layers + structured-clone the world for
  interaction; the engine stays clock-free, the UI supplies dates).

### Metrics
- Source modules: 26 (+resources, economy, religion). Tests: 112. Deps: 0.
  Engine v0.10.0. Live app now 8 map layers.

### Left for next session
- Keep going bigger — see `NEXT_SESSION.md` (a dynamic *simulated* history over
  turns, or an in-app atlas/gazetteer + client-side poster download).

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
