# Roadmap

Cartogenesis grows one **layer** at a time. Each layer is a self-contained
subsystem that builds on the ones beneath it. The ordering is roughly physical:
you can't have rivers before elevation, or forests before rainfall.

## What "success" means

There is **no finish line**. Cartogenesis is an open-ended world: every session
should make it meaningfully deeper — a new subsystem, a richer simulation, or a
better way to explore it — and each session's work should be *larger and more
ambitious than the last*. The measure is never a calendar or a line count; it is:

> *Is the world more alive, more coherent, and more explorable than it was — and
> is the new work tested and reproducible?*

The layers below are a **living backlog**, not a countdown. Finishing one opens
three more. The world can always be deeper: more simulation (climate, ecology,
population dynamics over time), more meaning (economy, faith, language, myth),
and better ways to see and share it (worker-driven UI, in-app atlas, exports).

Foundations reached so far: a deterministic engine (S1); the physical world —
water, climate, rivers, biomes, erosion (S2, S5); the human world — regions,
naming, settlements, roads, history, lore (S3, S6); and the platform — live
in-browser generation, an interactive atlas, and CI (S4, S5). Each of those was
a base to build higher on, not a box to check off.

## Layer backlog (ordered)

Legend: ✅ done · 🔜 next · ⬜ planned

### Physical foundation ✅ COMPLETE (Sessions 1–2)
- ✅ **L0 — RNG & noise.** Deterministic streams, value/fBm/ridged noise.
- ✅ **L1 — Elevation.** fBm + ridged + continent mask; hypsometric render.
- ✅ **L2 — Hydrology I: sea & coasts.** Ocean vs. lake flood-fill, coastlines,
  distance-to-ocean field.
- ✅ **L3 — Climate: temperature.** Latitude + elevation lapse + maritime + noise.
- ✅ **L4 — Climate: moisture.** Prevailing-wind rain shadow + orographic +
  maritime proximity.
- ✅ **L5 — Hydrology II: rivers.** Priority-Flood+ε drainage tree + flow
  accumulation → river networks. (Hydraulic erosion pass still optional/future.)
- ✅ **L6 — Biomes.** 16-biome Whittaker classification (temperature × moisture)
  + alpine/snow overrides; biome atlas renderer.

### Structure & meaning ✅ COMPLETE (Session 3)
- ✅ **L7 — Regions.** Land partitioned into named provinces (spaced-seed BFS).
- ✅ **L8 — Naming languages.** Four phonologies → coherent place names; culture
  follows climate.
- ✅ **L8.5 — Lexicons.** Each culture has 59 word-roots coined in its own
  phonology; names are glossed compounds steered by the terrain, and the
  gazetteer prints the glossary (Session 15).
- ✅ **In-app gazetteer + exports.** The full dossier renders in the app with a
  clickable table of contents and place-names that fly the map; download the map
  (PNG), poster (SVG), report (MD), or heightmap, all in-browser (Session 16).
- ✅ **Exact cross-engine determinism.** The pipeline uses only exactly-specified
  arithmetic (`src/exact.ts`), guarded by a bit-level hash and a simulation
  fingerprint — same seed, same world, on any conforming engine (Session 16, D-022).
- ✅ **Deeper volcanic terrain.** Calderas that cradle crater lakes, and lava
  fields that active volcanoes bleed down their flanks (Session 17), and island
  arcs — volcano chains along a curved line (Session 19). Still open: per-region
  metre-accurate contour intervals.
- ✅ **L17b/c — Sagas & the traveller.** Verse founding-sagas per culture and a
  first-person road journey, both under the narrator's three laws (Session 21).
- ✅ **Course correction & city plans.** Expeditions removed (D-027: the
  world is what was generated); history dated year-by-year (D-028); L19 city
  plans for every town and ruin; the folio's second design pass (Session 26,
  user direction).
- ↩ **Expeditions & the Folio.** L18 chartered expeditions (later removed, D-027) (point at two
  towns; a deterministic route is walked and journalled) and the full
  Cartographer's Folio redesign of the app (Session 25, user direction).
- ✅ **Story markers & islets merge.** Layer-scoped map markers (faiths named
  on their ground, realm labels that follow the scrubber, era-event glyphs,
  region names, ruins) and the sub-12-cell islet merge, D-026 (Session 24,
  user direction).
- ✅ **Calendars & voices.** Per-world reckonings anchored to year-zero origin
  events, and per-world chronicler temperaments with varied sentence frames
  (Session 23, user direction).
- ✅ **Truth-telling pass.** README rewritten to match the project; Topo layer
  contours in round metres with index lines; a benchmark + performance budget
  (Session 22).
- ✅ **A legible map.** Entity tooltips for everything referenced, chronicle
  event pins, town-anchored events, a calmer volcano field (Session 21).
- ✅ **L17 — The chronicle, told.** A deterministic in-world narrator turns the
  simulation into chaptered prose — total, grounded, strictly downstream
  (Session 20, D-025).
- ✅ **Language contact.** Conquest layers place-names — the conquered land keeps
  its old land-word, the ruler renames the fort (Session 18). A pure overlay:
  the simulation fingerprint is unchanged (D-024).
- ✅ **L9 — Settlements.** Habitability scoring → cities/towns/ports + a capital.
- ✅ **L10 — Roads & trade.** Least-cost Dijkstra + Kruskal MST road network.
- ✅ **L11 — History.** Realms, wars, disasters, golden ages — a dated chronicle.
- ✅ **L12 — Lore.** Ruling houses, ruler successions with epithets, notable
  figures tied to places, and prose for every region.
- ✅ **L13 — Resources.** ~15 resource kinds placed by terrain and biome.
- ✅ **L14 — Economy.** Production, wealth, trade hubs, major exports.
- ✅ **L15 — Religion.** Faiths, deities, myths, spread across regions.
- ✅ **L16 — Dynamic history.** The world simulated forward over centuries:
  emergent wars, conquests, famines, secessions, and rising/falling realms.

### Presentation & platform
- ✅ **P1 — SVG poster export.** Labeled maps with region/city/feature names.
- ✅ **P2 — Browser engine.** The core runs live in the Pages app
  (`/app/`) — type a seed, generate on a Canvas. Zero-dependency build via Node
  type-stripping; pure-JS hash replaced `node:crypto`.
- ✅ **P3 — World report.** Markdown gazetteer describing each world.
- ✅ **P4 — Interactive atlas.** Pan/zoom, hover-to-inspect, click-to-pin,
  shareable seed links in the live app.

### Terrain & export
- ✅ **Volcanoes** — stratovolcano/shield/cinder cones with craters (L1.6).
- ✅ **Real 16-bit heightmap exports** (PNG + raw `.r16`) for 3D tools; a
  topographic contour layer; elevation in metres.
- ⬜ Lava fields, calderas, seamount island-arcs; per-region metre-accurate
  contour intervals.

### Deeper simulation (the world keeps getting more alive)
- ✅ Hydraulic erosion pass on elevation (droplet sim; carves valleys).
- ✅ Web Worker so browser generation never freezes the UI.
- ✅ **Dynamic history** — the world simulated over turns (L16).
- ✅ **Time scrubber** — per-turn snapshots animate the Powers map; play/scrub
  the centuries and watch borders shift (Session 11).
- ✅ **Balance of power** — overextension, distance, home ground, war exhaustion,
  revolts, cluster secessions, per-realm ambition + per-world cohesion, and
  repulsed invasions. Histories now vary instead of always ending in one empire
  (Session 12).
- ✅ **Dynamic settlements** — founding years, sacked/abandoned ruins; cities
  appear and vanish as you scrub (Session 13).
- ✅ **One timeline** — legends, dynasties and the chronicle all answer to
  `meta.presentYear` (Session 14).
- ✅ **Present-day roads & economy** — rebuilt on the survivors, so no highway
  runs to a dead city (Session 15).
- ⬜ **Language contact** — conquered towns keep their root and take the
  conqueror's suffix, the way real toponymy layers.
- ⬜ Latitude-varying wind belts for moisture (trade winds vs. westerlies).
- ⬜ Lake outflow / river-into-lake-into-river continuity.
- ⬜ Merge sub-threshold islet "regions".

### Engineering hygiene (ongoing)
- ✅ CI via GitHub Actions (`node --test` + web-bundle freshness on push).
- ✅ Exact-arithmetic lint: a test fails the build if implementation-approximated
  math (`Math.hypot/pow/cos`, `**`) appears in the engine (Session 16).
- ⬜ Performance budget + a `benchmark` script per layer.

## Guiding principles

1. **Every session ships a concrete artifact**, not just a plan.
2. **Plausible and pretty beats physically correct.**
3. **Determinism is sacred** — protected by golden tests.
4. **Zero dependencies** unless a hard blocker forces the discussion.
5. **The world should feel more alive after every layer.**
