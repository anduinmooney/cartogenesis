# Changelog

One entry per work session. Each entry records what was actually produced,
verified, and left for next time. Newest first.

The format is loosely [Keep a Changelog](https://keepachangelog.com); this
project's "releases" are work sessions.

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

### Left for next session
- Begin **L2 — Hydrology I (sea & coasts)**. See `NEXT_SESSION.md`.
