# Next Session — Session 22

> Read `PROJECT_STATE.md` first, then this. Session 21 delivered sagas, the
> traveller's account, and a user-driven legibility pass (entity tooltips
> everywhere, chronicle event pins, calmer volcanoes). The cleanup tail remains.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **211**).
2. Skim `CHANGELOG.md` (top, Session 21) and `DECISIONS.md` (D-025 before any
   narrative work).
3. **After any `src/` change, rerun `node scripts/build-web.ts` LAST** (a src
   edit after the build cost a CI red once). New engine module → `MODULES`;
   new `web/` helper → `WEB_MODULES`.
4. **Preview transport:** the ext-shaped Chrome cannot reach sandbox-bound
   localhost (ERR_CONNECTION_REFUSED; curl works). Verify content in Node;
   verify pixels on the DEPLOYED Pages site after push — and force a fresh
   bundle with `fetch("app.js", {cache:"reload"}); location.reload()` or you
   will debug a stale cache (it happened; it looked exactly like a real bug).
5. **If you touch war/revolt/plague logic**, run the ~30-seed balance check
   (mean top-power share ~55–62%).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` only via `src/exact.ts`; lint test
  enforces. Three fingerprints pinned (content `86c5fef6`, exact `418ddfd2`,
  sim `15371f11`) — note which move and why.
- Names/narrative/sagas/journey never perturb the sim (D-021/24/25): private
  streams, out of `events`; the pinned fingerprints are the proof.
- `CONCEPTS` append-only. Dated things derive from `meta.presentYear`. No test
  hard-codes a simulated outcome for a seed.
- **Sidebar lists:** linkification must run AFTER innerHTML assignment (a
  comment in `renderInfo` marks the spot).

**Priority note:** user feedback first, always.

---

# Option A — Metre-accurate contour intervals (rendering only; no fingerprints)

`renderContours` uses a uniform interval. Choose a round metre interval
(100/250/500) from the world's real relief; label a few isolines. Pure
`render.ts` — safe, quick, satisfying on the Topo layer.

# Option B — Cleanup: islets, a benchmark, an honest README

- **Islets** (moves fingerprints — deliberate): merge sub-threshold islands
  (< ~12 cells) into a neighbour or a "Scattered Isles" bucket region.
- **Benchmark** (`scripts/bench.ts`): per-layer timings 256²/384²/512²; record
  a budget in PROJECT_STATE. The narrative layers and two-pass roads add cost.
- **README**: one honest rewrite — it predates languages, the temporal atlas,
  exact determinism, the gazetteer, the chronicle, sagas, the traveller, and
  the entity tooltips. It has more than earned it.

# Option C — Narrative polish (only if it calls to you)

The traveller could notice crater lakes by name; the chronicle could
cross-reference the traveller ("the road I walked in 1100 crosses the field of
that battle"). Small, delightful, strictly downstream.

## Recommended order

**B-README → A → B-rest.** The README is the project's face and is years of
sessions out of date. Do not start a piece without budget to finish AND verify.

## Close out (do not skip)

1. `build-web` + `make-samples` (in that order, LAST). Fingerprints only move
   for terrain/sim changes — note which.
2. Update CHANGELOG (Session 22), PROJECT_STATE, ROADMAP, DECISIONS if
   warranted; rewrite this file.
3. Commit per piece; push; CI green on CI's Node; verify the deployed app with
   a cache-busting reload.
