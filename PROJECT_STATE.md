# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 7 · 2026-07-09
- **Engine version:** 0.10.0 (runs in Node **and** the browser)
- **Health:** 🟢 Green. 112 tests pass (CI enforced); deterministic output.
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).
- **Live generator:** https://anduinmooney.github.io/cartogenesis/app/ (type a seed, generate in-browser).

## What works today

- Seed → a full **physical AND human world**: elevation (hydraulically eroded),
  oceans/lakes/coasts, temperature, moisture, rivers, 16 biomes, named provinces
  with cultures, cities/ports with a capital, a road network, a written history,
  lore (houses, rulers, figures, prose), **natural resources, an economy with
  wealth & trade, and faiths with myths** — all deterministic from the seed.
- Eight rendered map layers (terrain, biomes, political, faiths, resources,
  temperature, rainfall, relief) + a labeled SVG poster + a Markdown gazetteer.
- An **interactive** in-browser generator (`docs/app/`) that generates in a **Web
  Worker** (no UI freeze): pan, zoom, hover to inspect, click for details
  (economy, faith, prose), instant layer switching, `?seed=` links, a "Today's
  world" button.
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
| L0 RNG & noise · L1 Elevation · L1.5 Erosion | ✅ done |
| L2 Hydrology · L3 Temp · L4 Moisture | ✅ done |
| L5 Rivers · L6 Biomes | ✅ done |
| L7 Regions · L8 Naming | ✅ done |
| L9 Settlements · L10 Roads · L11 History | ✅ done |
| L12 Lore (houses, rulers, figures, prose) | ✅ done |
| L13 Resources · L14 Economy · L15 Religion | ✅ done |
| P1 SVG poster · P3 World report | ✅ done |
| P2 Browser build · P4 interactive atlas | ✅ done |
| Web Worker (responsive app) · CI | ✅ done |
| dynamic simulated history · in-app atlas · more | 🔜 the world keeps deepening |

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
- Generation is a static snapshot: history/lore/economy are generated, not
  *simulated* turn by turn. A dynamic model (populations, shifting borders,
  resolving wars over time) is a natural next big axis.
- Tiny single-cell islands become their own 1-cell "regions" (coverage pass),
  cluttering gazetteers. Consider merging sub-threshold islets.
- History wars need adjacent realms; small worlds (few cities) get few/no wars.
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
