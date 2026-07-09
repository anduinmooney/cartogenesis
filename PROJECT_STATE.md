# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 10 · 2026-07-09
- **Engine version:** 0.12.0 (runs in Node **and** the browser)
- **Health:** 🟢 Green. 126 tests pass (CI enforced); deterministic output.
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).
- **Live generator:** https://anduinmooney.github.io/cartogenesis/app/ (type a seed, generate in-browser).

## What works today

- Seed → a full **physical AND human world**: elevation (hydraulically eroded),
  oceans/lakes/coasts, temperature, moisture, rivers, 16 biomes, named provinces
  with cultures, cities/ports with a capital, a road network, a written history,
  lore (houses, rulers, figures, prose), natural resources, an economy with
  wealth & trade, faiths with myths, and a **dynamic simulated history** (the
  world run forward over centuries — emergent wars, conquests, and rising and
  falling realms) — all deterministic from the seed.
- Ten rendered map layers (terrain, **topographic**, biomes, political, powers,
  faiths, resources, temperature, rainfall, relief) + a labeled SVG poster + a
  Markdown gazetteer with an emergent chronicle.
- **Real volcanoes** (with craters, named, active/dormant/extinct) and **real
  16-bit heightmap exports** (PNG + raw `.r16`) for 3D tools; elevation in metres.
- An **interactive** in-browser generator (`docs/app/`) that generates in a **Web
  Worker** (no UI freeze): pan, zoom, hover to inspect (incl. resource deposits),
  click for details (economy, faith, prose), **feature + city labels on the map**,
  a **per-layer legend**, a **clickable chronicle that flies to each event**,
  instant layer switching, `?seed=` links, and a "Today's world" button.
- Per world the CLI emits **7 artifacts**: terrain / biome / political map PNGs,
  a grayscale heightmap, a **labeled SVG poster**, a **Markdown gazetteer**, and
  JSON metadata with a `contentHash` fingerprint.
- CLI: `node src/cli.ts generate --seed <s> [--width --height --sea-level …]`.
- 87 passing tests, incl. golden-hash guard, river mass-conservation, road
  no-cycle, region full-partition.
- A 6-world **multi-layer atlas** (6 layers + posters + gazetteers) + viewer
  under `docs/`; local preview via `node scripts/serve-docs.ts`.

## Current layers (see ROADMAP.md for the full plan)

| Layer | Status |
|-------|--------|
| L0 RNG & noise · L1 Elevation · L1.5 Erosion · L1.6 Volcanoes | ✅ done |
| L2 Hydrology · L3 Temp · L4 Moisture | ✅ done |
| L5 Rivers · L6 Biomes | ✅ done |
| L7 Regions · L8 Naming | ✅ done |
| L9 Settlements · L10 Roads · L11 History | ✅ done |
| L12 Lore (houses, rulers, figures, prose) | ✅ done |
| L13 Resources · L14 Economy · L15 Religion | ✅ done |
| L16 Dynamic history (world simulation) | ✅ done |
| P1 SVG poster · P3 World report | ✅ done |
| P2 Browser build · P4 interactive atlas | ✅ done |
| Web Worker (responsive app) · CI | ✅ done |
| time scrubber · languages · in-app atlas | 🔜 the world keeps deepening |

## How to run (cold start)

```bash
node --version            # need ≥ 22.6
npm test                  # 87 tests, all offline
node src/cli.ts generate --seed hello   # writes 7 artifacts to ./output
node scripts/make-samples.ts   # rebuild docs/ atlas (maps + posters + reports)
node scripts/build-web.ts      # rebuild docs/app/ browser bundle (after src/ edits!)
node scripts/serve-docs.ts     # preview docs/ + docs/app/ at http://localhost:8123
```

No `npm install` is required — there are zero dependencies.

## Key invariants (don't break these)

1. Generation is a pure function of seed + config. No `Math.random`, no clock.
2. Subsystems use `root.stream("name")` for randomness (order-independent).
3. The golden hash in `tests/world.test.ts` must stay green, or be updated with
   a `DECISIONS.md` entry explaining the intentional change.

## Known limitations / debt

- `docs/app/*.js` are **build artifacts** (type-stripped from `src/`). After any
  `src/` change, rerun `node scripts/build-web.ts` or the live app goes stale.
- **Terrain is plausible, not geologically accurate** — fractal noise + hydraulic
  erosion + procedural volcanoes; no tectonics/real volcanism. The heightmap
  exports are real 16-bit files, but the *shapes* are invented, not Earth data.
- The preview browser's module worker got wedged in Session 10 (leaked test
  workers via eval). Verify the live app in a fresh browser next session — and
  don't leak `new Worker` instances in `preview_eval` (call `.terminate()`).
- The simulation records emergent events + final borders but doesn't keep every
  turn's snapshot, so the app can't yet *scrub* through history (store per-turn
  control to animate the Powers map — a natural next step).
- Simulation doesn't feed back into the settlement list (cities founded/lost in
  the sim are events, not new markers on the map).
- Tiny single-cell islands become their own 1-cell "regions" (coverage pass),
  cluttering gazetteers. Consider merging sub-threshold islets.
- Moisture runs a single west→east prevailing wind; latitude wind belts would be
  more realistic (future tuning).
- Cross-platform float determinism is assumed (V8 is consistent in practice);
  guarded by the golden hash + CI, but not formally proven across architectures.
- No TS `enum`/namespaces/decorators — Node strip-only mode rejects them.
- Remember: after any `src/` change, rerun `build:web` (CI now enforces this).

## Pointers

- Roadmap & success criteria → `ROADMAP.md`
- Why things are the way they are → `DECISIONS.md`
- Session history → `CHANGELOG.md`
- **The exact next task → `NEXT_SESSION.md`**
- How to extend safely → `ARCHITECTURE.md`
