# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 4 · 2026-07-08
- **Engine version:** 0.8.0 (runs in Node **and** the browser)
- **Health:** 🟢 Green. 87 tests pass; engine produces valid, deterministic output.
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).
- **Live generator:** https://anduinmooney.github.io/cartogenesis/app/ (type a seed, generate in-browser).

## What works today

- Seed → a full **physical AND human world**: elevation, oceans/lakes/coasts,
  temperature, moisture, rivers, 16 biomes, named provinces with cultures,
  cities/ports with a capital, a road network, and a written history — all
  deterministic from the seed.
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
| L0 RNG & noise · L1 Elevation | ✅ done |
| L2 Hydrology · L3 Temp · L4 Moisture | ✅ done |
| L5 Rivers · L6 Biomes | ✅ done |
| L7 Regions · L8 Naming | ✅ done |
| L9 Settlements · L10 Roads · L11 History | ✅ done |
| P1 SVG poster · P3 World report | ✅ done |
| P2 Browser build (live generation) | ✅ done |
| P4 interactive atlas (pan/zoom, hover) | 🔜 next |
| erosion · CI · latitude wind belts | ⬜ planned |

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
- The browser app generates synchronously (~300 ms), briefly freezing the UI
  thread. A Web Worker would keep it responsive (future).
- Tiny single-cell islands become their own 1-cell "regions" (coverage pass),
  cluttering gazetteers. Consider merging sub-threshold islets.
- History wars need adjacent realms; small worlds (few cities) get few/no wars.
- Moisture runs a single west→east prevailing wind; latitude wind belts would be
  more realistic (future tuning).
- No CI yet (planned). Tests are run manually via `npm test`.
- Cross-platform float determinism is assumed (V8 is consistent in practice);
  guarded by the golden hash but not formally proven across architectures.
- No TS `enum`/namespaces/decorators — Node strip-only mode rejects them.

## Pointers

- Roadmap & success criteria → `ROADMAP.md`
- Why things are the way they are → `DECISIONS.md`
- Session history → `CHANGELOG.md`
- **The exact next task → `NEXT_SESSION.md`**
- How to extend safely → `ARCHITECTURE.md`
