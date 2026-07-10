# Next Session — Session 19

> Read `PROJECT_STATE.md` first, then this. The multi-session overhaul (Sessions
> 16–18) has landed exact arithmetic, the in-app gazetteer, client exports,
> deeper volcanic terrain, and language contact. What remains is the tail:
> two small terrain touches and a cleanup pass. Pick the one that appeals; each
> stands alone.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **188**).
3. Skim `CHANGELOG.md` (top, Session 18) and `DECISIONS.md` (D-022 resolved,
   D-023 post-hoc injection, D-024 language-contact-is-overlay).
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`.** New engine
   module → `MODULES`; new `web/` helper → `WEB_MODULES`.
6. **Preview discipline:** headless viewport reports **0×0** — resize to
   `1280×860` before measuring layout. Screenshots frequently time out; verify
   with `preview_eval` (read canvas pixels / DOM / tooltip text), which is
   stronger evidence anyway. Never leak a `new Worker`.
7. **If you touch `src/simulation.ts` war/revolt/plague logic**, re-run a ~30-seed
   distribution check (mean top-power share ~55–62%).

## Invariants — know these before you touch anything

- **Exact arithmetic (D-022):** engine uses only `+ - * / sqrt` via `src/exact.ts`.
  No `Math.hypot/pow/cos/sin/exp/log` or `**` outside `render.ts` — a lint test
  greps for it. `powExact` takes only quarter-integer exponents.
- **Post-hoc injection (D-023):** crater lakes / lava added after classification;
  ordering in `world.ts` is load-bearing.
- **Names never perturb the simulation (D-021, D-024):** naming and language
  contact use private `Rng`s and stay out of `events`. Three fingerprints pinned
  in `tests/world.test.ts` — a change that moves them must be intentional and
  documented.
- **`CONCEPTS` in `src/language.ts` is append-only.** Dated things derive from
  `meta.presentYear`.
- **No test may hard-code a *simulated* outcome for a seed** — discover at run
  time (`tests/coherence.test.ts`, `tests/contact.test.ts` show the pattern).

**Priority note:** if the user gives new feedback, address that first.

---

# Option A — Seamount arcs (terrain; changes fingerprints)

`addVolcanoes` places each volcano independently. Real volcanism clusters along
plate boundaries into **island arcs**. Add: with some probability, place a
*chain* — pick an origin and a tangent direction, walk it with jitter, drop 3–6
cones along the line (reuse the existing cone/caldera builder per cone).
- **No trig** — sample the direction as a unit-ish vector by rejection (see
  `traceLavaFields`'s `rimPoint`), so the arithmetic stays exact.
- Changes elevation → regenerate the three fingerprints + samples.
- **Test:** an arc's cones are roughly collinear (fit a line, assert low
  residual); arcs don't overlap the map edge.

**Commit:** `Seamount arcs: volcanoes that chain like island arcs`

---

# Option B — Metre-accurate contour intervals (rendering only; no fingerprints)

`renderContours` uses a uniform interval. Make it **metre-aware**: choose a
round interval (e.g. 100/250/500 m) from the world's actual relief, and label a
few isolines with their elevation in metres. Pure `render.ts` change, so **no
world-state change and no fingerprint move** — easy to verify and safe.
- **Test:** contour lines appear at the expected elevations; labels read plausible
  metre values. Verify live by reading canvas pixels on the Topo layer.

**Commit:** `Metre-accurate, labelled topographic contours`

---

# Option C — Cleanup: islets, a benchmark, an honest README

- **Islets** (changes fingerprints — it alters the region set): single-cell
  islands become their own 1-cell "regions" and clutter every gazetteer. Merge
  sub-threshold islets (< ~12 cells) into the nearest region across water, or
  bucket them as "the Scattered Isles". This regenerates every world — treat it
  as a deliberate, fingerprint-updating change, not a quick fix.
- **Benchmark** (`scripts/bench.ts`, no fingerprints): per-layer timings for
  256²/384²/512², a table, a budget in `PROJECT_STATE.md`.
- **README** (no fingerprints): last touched many sessions ago; it undersells the
  project badly (no languages, temporal atlas, exact determinism, in-app
  gazetteer, calderas/lava, language contact). One honest pass — this is the one
  time it earns a rewrite.

**Commit(s):** one per piece.

---

## Recommended order

**B → A → C.** B is safe and quick (rendering only). A is a satisfying terrain
win. C's README and benchmark are safe; the islets merge is the one heavy item
(regenerates everything) — do it deliberately or leave it. Do not start a piece
without budget to finish AND verify it.

## Close out (do not skip)

1. `node scripts/build-web.ts`; `node scripts/make-samples.ts`. Update golden
   fingerprints only if terrain/sim changed — and note *which* moved, it tells
   you how far the change reached.
2. Update `CHANGELOG.md` (Session 19), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` if warranted, and rewrite this file.
3. Commit per piece and push; confirm CI green **on CI's Node** and verify the
   live app on a FRESH preview (resize to 1280×860 first).
