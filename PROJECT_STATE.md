# Project State

> The single-glance status of Cartogenesis. Update this at the end of every
> session. If you read only one file, read this one, then `NEXT_SESSION.md`.

- **Project:** Cartogenesis — a deterministic procedural world generation engine.
- **As of:** Session 1 · 2026-07-08
- **Engine version:** 0.1.0
- **Health:** 🟢 Green. All tests pass; engine produces valid, deterministic output.
- **Repo:** https://github.com/anduinmooney/cartogenesis (public, `main`).
- **Live gallery:** https://anduinmooney.github.io/cartogenesis/ (GitHub Pages, from `/docs`).

## What works today

- Seed → deterministic elevation field → rendered PNG map (hypsometric + relief)
  and grayscale heightmap, plus JSON metadata with a determinism `contentHash`.
- CLI: `node src/cli.ts generate --seed <s> [--width --height --sea-level …]`.
- 34 passing tests, including a golden-hash determinism guard.
- A 6-world sample gallery + static viewer under `docs/` (GitHub Pages ready).

## Current layers (see ROADMAP.md for the full plan)

| Layer | Status |
|-------|--------|
| L0 RNG & noise | ✅ done |
| L1 Elevation | ✅ done |
| L2 Hydrology I (sea & coasts) | 🔜 next |
| L3+ climate, rivers, biomes, society | ⬜ planned |

## How to run (cold start)

```bash
node --version            # need ≥ 22.6
npm test                  # 34 tests, all offline
node src/cli.ts generate --seed hello
node scripts/make-samples.ts   # rebuild docs/ gallery
```

No `npm install` is required — there are zero dependencies.

## Key invariants (don't break these)

1. Generation is a pure function of seed + config. No `Math.random`, no clock.
2. Subsystems use `root.stream("name")` for randomness (order-independent).
3. The golden hash in `tests/world.test.ts` must stay green, or be updated with
   a `DECISIONS.md` entry explaining the intentional change.

## Known limitations / debt

- Only elevation exists; no water simulation, climate, or biomes yet.
- The continent mask is a simple radial falloff — fine for now, will be revisited
  when coastlines/regions arrive.
- No CI yet (planned). Tests are run manually via `npm test`.
- Cross-platform float determinism is assumed (V8 is consistent in practice);
  guarded by the golden hash but not formally proven across architectures.

## Pointers

- Roadmap & success criteria → `ROADMAP.md`
- Why things are the way they are → `DECISIONS.md`
- Session history → `CHANGELOG.md`
- **The exact next task → `NEXT_SESSION.md`**
- How to extend safely → `ARCHITECTURE.md`
