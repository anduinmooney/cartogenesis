# Roadmap

Cartogenesis grows one **layer** at a time. Each layer is a self-contained
subsystem that builds on the ones beneath it. The ordering is roughly physical:
you can't have rivers before elevation, or forests before rainfall.

## Definition of success

| Horizon | What "success" looks like |
|--------|----------------------------|
| **1 day** (Session 1) | A working, tested, deterministic engine that turns a seed into a rendered elevation map. Continuity docs in place. On GitHub. ✅ |
| **1 week** | Water and climate: coastlines, temperature, moisture, and rivers by flow accumulation. Maps look like *places*. ✅ **Reached in Session 2 — ahead of schedule.** |
| **1 month** | A full physical world: biome classification ✅ (Session 2). Still ahead: named regions, a labeled poster-quality SVG export, and a browser build so worlds render live on the Pages site. |
| **6 months** | A living world: settlements placed by habitability, a procedural history/timeline, cultures and place-name languages, trade routes, and an explorable web atlas. Reproducible "world reports." |

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

### Structure & meaning
- 🔜 **L7 — Regions.** Segment the world into named landmasses/regions; a
  distance/flood partition of the land into provinces.
- ⬜ **L8 — Naming languages.** Per-culture phonologies → coherent place names.
- ⬜ **L9 — Settlements.** Habitability scoring → cities/towns near water & good land.
- ⬜ **L10 — Roads & trade.** Least-cost paths between settlements over terrain.
- ⬜ **L11 — History.** A timeline of events (founding, wars, migrations) seeded
  from geography.

### Presentation & platform
- ⬜ **P1 — SVG poster export.** Labeled, print-quality maps with a legend.
- ⬜ **P2 — Browser engine.** Compile/port the core to run in the Pages viewer so
  users can type a seed and watch a world generate live.
- ⬜ **P3 — World report.** A generated Markdown/HTML "atlas" describing a world.
- ⬜ **P4 — Interactive atlas.** Pan/zoom, layer toggles, clickable regions.

### Engineering hygiene (ongoing)
- ⬜ CI via GitHub Actions (run `npm test` on push).
- ⬜ Performance budget: keep 512² generation under ~1s.
- ⬜ A `benchmark` script tracking generation time per layer.

## Guiding principles

1. **Every session ships a concrete artifact**, not just a plan.
2. **Plausible and pretty beats physically correct.**
3. **Determinism is sacred** — protected by golden tests.
4. **Zero dependencies** unless a hard blocker forces the discussion.
5. **The world should feel more alive after every layer.**
