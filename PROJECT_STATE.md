# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 2 · 2026-07-08
- **Engine version:** 0.5.0
- **Health:** 🟢 Green. 59 tests pass; engine produces valid, deterministic output.
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).

## What works today

- Seed → a full **physical world**: elevation, oceans/lakes/coasts, temperature,
  moisture, rivers (real drainage networks), and 16 biomes — all deterministic.
- Five rendered layers per world (terrain, biomes, temperature, moisture,
  relief) as PNGs + JSON metadata with a `contentHash` determinism fingerprint.
- CLI: `node src/cli.ts generate --seed <s> [--width --height --sea-level …]`
  writes `.map.png`, `.biome.png`, `.height.png`, `.json`.
- 59 passing tests, including a golden-hash guard and river mass-conservation.
- A 6-world **multi-layer atlas** + static viewer under `docs/`; local preview
  via `node scripts/serve-docs.ts`.

## Current layers (see ROADMAP.md for the full plan)

| Layer | Status |
|-------|--------|
| L0 RNG & noise | ✅ done |
| L1 Elevation | ✅ done |
| L2 Hydrology I (sea, coasts, lakes) | ✅ done |
| L3 Temperature | ✅ done |
| L4 Moisture | ✅ done |
| L5 Rivers (drainage) | ✅ done |
| L6 Biomes | ✅ done |
| L7 Regions & naming | 🔜 next |
| L8+ settlements, roads, history | ⬜ planned |

## How to run (cold start)

```bash
node --version            # need ≥ 22.6
npm test                  # 59 tests, all offline
node src/cli.ts generate --seed hello
node scripts/make-samples.ts   # rebuild docs/ atlas
node scripts/serve-docs.ts     # preview docs/ at http://localhost:8123
```

No `npm install` is required — there are zero dependencies.

## Key invariants (don't break these)

1. Generation is a pure function of seed + config. No `Math.random`, no clock.
2. Subsystems use `root.stream("name")` for randomness (order-independent).
3. The golden hash in `tests/world.test.ts` must stay green, or be updated with
   a `DECISIONS.md` entry explaining the intentional change.

## Known limitations / debt

- The physical world is complete, but nothing *lives* on it yet — no regions,
  settlements, roads, or history (that's L7+).
- Moisture runs a single west→east prevailing wind; latitude-varying wind belts
  (trade winds vs. westerlies) would be more realistic (future tuning).
- Rivers fill enclosed basins over lakes rather than modeling lake outflow/
  overflow explicitly — fine visually, revisit if lakes become important.
- The continent mask is a simple radial falloff; revisit when regions arrive.
- No CI yet (planned). Tests are run manually via `npm test`.
- Cross-platform float determinism is assumed (V8 is consistent in practice);
  guarded by the golden hash but not formally proven across architectures.
- No TS `enum` anywhere — Node strip-only mode rejects them; use const objects.

## Pointers

- Roadmap & success criteria → `ROADMAP.md`
- Why things are the way they are → `DECISIONS.md`
- Session history → `CHANGELOG.md`
- **The exact next task → `NEXT_SESSION.md`**
- How to extend safely → `ARCHITECTURE.md`
