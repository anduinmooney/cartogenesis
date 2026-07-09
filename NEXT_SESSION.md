# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **87**).
3. Skim `CHANGELOG.md` (top, Session 4) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → http://localhost:8123 (gallery) and
   http://localhost:8123/app/ (live generator).
5. **If you change any `src/` module, rerun `node scripts/build-web.ts`** or the
   live app serves stale code. (Committed `docs/app/*.js` are build artifacts.)

## Context: where the project is

Essentially the whole original vision is done — physical world (L1–L6), human
world (L7–L11), posters + gazetteers, and a **live in-browser generator**
(`docs/app/`). The engine runs identically in Node and the browser, zero deps.

## This session's objective: **P4 — Interactive atlas**

Make the live generator explorable, not just viewable. Turn the static canvas
into something you can pan, zoom, and interrogate.

### Suggested build (pick the highest-value subset; commit per feature)
1. **Pan & zoom** the canvas. Track a `{scale, offsetX, offsetY}` view; draw the
   world to an *offscreen* canvas once per generation/layer, then blit it
   transformed. Wheel to zoom (toward cursor), drag to pan, double-click to
   reset. Respect device pixel ratio for crispness.
2. **Hover to inspect.** On mousemove, map cursor → cell (invert the view
   transform). Show a tooltip with: region name + culture, biome, elevation,
   and — if over/near a settlement — its name/tier. You have `regions.ids`,
   `biomes.ids`, and settlement coords in the `World` already; expose the world
   globally in the app module so the handler can read them.
3. **Click a settlement/region** → pin a detail card (region stats, or the
   settlement's tier/port/capital flags). Use a small hit radius for towns.
4. **Nice-to-haves:** a subtle cross-fade when switching layers; a "copy link"
   button (URL already carries `?seed=`); keyboard `+`/`-`/arrows.
5. Consider moving generation into a **Web Worker** so the UI never freezes
   (the engine is pure and importable; post the seed in, post layer RGBA out).
   Only do this if it stays clean — otherwise leave the ~300 ms sync generate.

### Constraints specific to this session
- All new code is browser code under `web/` (rebuild with `build:web`). Keep it
  dependency-free and framework-free (vanilla DOM/Canvas), matching the app.
- Don't regress determinism or the engine tests. The interactive layer is pure
  presentation on top of the existing `World`.

### Verify (screenshots can be flaky — prefer `preview_eval`)
- Load `/app/`, generate, then via eval: simulate a wheel event and assert the
  view scale changed; dispatch a mousemove and assert the tooltip populated;
  confirm no console errors.
- `npm test` stays green (engine untouched → golden hash `1b8c816c890e866c`).

### Close out (do not skip)
1. `node scripts/build-web.ts` so the committed bundle is current.
2. Update `CHANGELOG.md` (Session 5), `PROJECT_STATE.md`, `ROADMAP.md` (tick P4),
   `DECISIONS.md` if you make a notable call, and rewrite this file for the next
   target (deeper simulation: **hydraulic erosion**, or **CI via GitHub Actions**,
   or latitude wind belts — all in ROADMAP).
3. Commit per feature and push; verify the live `/app/` behaves.

## Guardrails
- Runtime + build stay **zero-dependency**. All randomness via `Rng` streams.
- No TS `enum`/namespaces/decorators (Node strip-only). Keep `main` green.
- After `src/` edits: **rebuild the web bundle** before committing.

## Backlog (good alternatives if P4 feels done or you want variety)
- **Hydraulic erosion**: a droplet/stream-power pass on elevation to carve
  valleys along rivers (would change the golden hash — document it).
- **CI**: `.github/workflows/ci.yml` running `npm test` + `build:web` on push.
- **Merge sub-threshold islets** so 1-cell "regions" stop cluttering gazetteers.
- **Latitude wind belts** in moisture (trade winds vs. westerlies).
