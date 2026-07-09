# Roadmap

Cartogenesis grows one **layer** at a time. Each layer is a self-contained
subsystem that builds on the ones beneath it. The ordering is roughly physical:
you can't have rivers before elevation, or forests before rainfall.

## Definition of success

| Horizon | What "success" looks like |
|--------|----------------------------|
| **1 day** (Session 1) | A working, tested, deterministic engine that turns a seed into a rendered elevation map. Continuity docs in place. On GitHub. ✅ |
| **1 week** | Water and climate: coastlines, temperature, moisture, and rivers by flow accumulation. Maps look like *places*. ✅ **Reached in Session 2 — ahead of schedule.** |
| **1 month** | A full physical world + named regions + labeled SVG posters. ✅ **All reached by Session 3.** |
| **6 months** | A living world: settlements ✅, history ✅, languages ✅, trade routes ✅, world reports ✅, **and a live in-browser generator ✅ (Session 4)**. Essentially the entire original vision, reached in 4 sessions. Remaining polish: an *interactive* atlas (P4 pan/zoom/hover) and deeper simulation. |

Success is **not** measured by lines of code but by: *does the latest layer make
the world more coherent, and is it tested and reproducible?*

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
- ✅ **L9 — Settlements.** Habitability scoring → cities/towns/ports + a capital.
- ✅ **L10 — Roads & trade.** Least-cost Dijkstra + Kruskal MST road network.
- ✅ **L11 — History.** Realms, wars, disasters, golden ages — a dated chronicle.

### Presentation & platform
- ✅ **P1 — SVG poster export.** Labeled maps with region/city/feature names.
- ✅ **P2 — Browser engine.** The core runs live in the Pages app
  (`/app/`) — type a seed, generate on a Canvas. Zero-dependency build via Node
  type-stripping; pure-JS hash replaced `node:crypto`.
- ✅ **P3 — World report.** Markdown gazetteer describing each world.
- 🔜 **P4 — Interactive atlas.** Pan/zoom the canvas, hover a region for its
  name/stats, click for detail; layer cross-fades; shareable seed links.

### Deeper simulation (optional polish)
- ⬜ Hydraulic erosion pass on elevation (carve valleys along rivers).
- ⬜ Latitude-varying wind belts for moisture (trade winds vs. westerlies).
- ⬜ Lake outflow / river-into-lake-into-river continuity.
- ⬜ Merge sub-threshold islet "regions".

### Engineering hygiene (ongoing)
- ⬜ CI via GitHub Actions (run `npm test` on push).
- ⬜ Performance budget + a `benchmark` script per layer.

## Guiding principles

1. **Every session ships a concrete artifact**, not just a plan.
2. **Plausible and pretty beats physically correct.**
3. **Determinism is sacred** — protected by golden tests.
4. **Zero dependencies** unless a hard blocker forces the discussion.
5. **The world should feel more alive after every layer.**
