# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm the suite is green **before** you change anything
   (baseline: 34 passing).
3. Skim `CHANGELOG.md` (top entry) and `ROADMAP.md` (layer backlog).
4. Read `ARCHITECTURE.md` → "How to add a subsystem" before writing code.

## This session's objective: **L2 — Hydrology I (sea & coasts)**

Give the world real water structure. Elevation already exists; now interpret it.

### Build `src/hydrology.ts` with:

1. **Ocean fill.** A boolean/int `Grid` (or `Uint8Array` mask) marking cells as
   ocean vs land at `seaLevel`. Distinguish **connected ocean** (flood-fill from
   the map border through sub-sea-level cells) from **inland basins** (sub-sea-
   level cells NOT reachable from the border) — those become **lakes**.
   - Use a flood fill (BFS/DFS or scanline) starting from all border cells that
     are below sea level. Everything filled = ocean. Sub-sea-level and unfilled =
     lake.

2. **Coastline extraction.** Mark land cells that are 4-neighbor-adjacent to
   ocean as coast. Useful later for beaches, ports, labels.

3. **Distance-to-coast field.** A `Grid` of (approximate) distance from each land
   cell to the nearest ocean. A multi-source BFS from all coast cells is simplest
   and deterministic. This feeds temperature/moisture later (maritime climate).

### Wire it into `world.ts`
- Add `const hydroRng = root.stream("hydrology");` (even if unused now — reserve
  the stream so later hydrology randomness stays isolated).
- Compute the ocean/lake mask and distance field; attach to the `World` object
  (e.g. `world.water = { oceanMask, lakeMask, coast, distToCoast }`).
- Add useful metrics to `meta`: `lakeCount`, `oceanFraction`.

### Render it
- Add `renderWater()` or extend `renderHypsometric` so **lakes render distinctly**
  from ocean (e.g. a lighter, greener blue), and coastlines optionally get a thin
  outline. Regenerate the sample gallery so the improvement is visible.

### Test it (`tests/hydrology.test.ts`)
- Determinism: same seed → identical masks.
- Invariant: every border ocean cell is connected ocean (no border lakes).
- Invariant: `oceanFraction + landFraction ≈ 1` (minus lakes).
- Invariant: `distToCoast` is 0 on coast cells and > 0 inland.
- Sanity: at least one seed produces ≥ 1 lake (search a few seeds; pick a fixed
  one that does and assert it, to keep the test deterministic).

### Close out (do not skip — this is what makes the study work)
1. Run `npm test`; keep everything green. If you changed elevation output,
   update the golden hash **and** add a `DECISIONS.md` entry.
2. `node scripts/make-samples.ts` to refresh `docs/` with water rendering.
3. Update `CHANGELOG.md` (new session entry), `PROJECT_STATE.md` (layer table +
   date), `ROADMAP.md` (tick L2, mark L3 as 🔜), and rewrite this file for L3.
4. Commit with a clear message and push. If GitHub Pages isn't enabled yet, see
   "Handoff notes" below.

## Guardrails
- Zero new dependencies.
- All randomness via `Rng` streams; no `Math.random`, no clock, no ambient state.
- Prefer clarity over cleverness; every public function gets a doc comment.
- Ship something that runs and is tested — don't leave half-built code on main.

## Handoff notes / possible blockers
- **GitHub Pages:** To make the gallery public, the repo owner may need to enable
  Pages (Settings → Pages → deploy from `main` / `/docs`). This is optional and
  doesn't block engine work. If `gh` is authenticated you can try enabling it via
  the API; otherwise leave a note for the user. The site URL will be
  `https://anduinmooney.github.io/cartogenesis/`.
- If `npm test`'s directory glob misbehaves on a shell, run
  `node --test "tests/*.test.ts"` directly.

## Stretch goals (only if time remains after L2 is done, tested, committed)
- Add a `--layer water` option to the CLI to export the water mask as its own PNG.
- Start L3 (temperature) scaffolding: latitude + elevation lapse rate.
