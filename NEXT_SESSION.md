# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **87**).
3. Skim `CHANGELOG.md` (top, Session 3) and `ROADMAP.md`.
4. Preview the current atlas: `node scripts/serve-docs.ts` → http://localhost:8123.

## Context: where the project is

The world is **complete end to end** — physical (L1–L6) and human (L7–L11) —
plus labeled SVG posters and Markdown gazetteers. But it only runs in Node. The
single biggest remaining milestone is making it **run live in the browser** so
anyone can type a seed on the Pages site and watch a world generate.

## This session's objective: **P2 — Browser build (live generation)**

Get the engine generating and rendering worlds in the browser, published on the
Pages site.

### Key facts that make this feasible
- Almost every module is pure TS with **no Node dependencies**. The only two
  Node touchpoints are:
  - `src/png.ts` → `node:zlib` (the browser won't need PNG — draw to a Canvas).
  - `src/world.ts` `hashGrid()` → `node:crypto` (needs a pure-JS replacement).
- **The render functions already return `Uint8Array` RGBA** — that is exactly
  `ImageData.data`. So `ctx.putImageData(new ImageData(rgba, w, h), 0, 0)` draws
  any layer with zero new rendering code. The overlays (`overlayRivers`, etc.)
  mutate RGBA in place and work as-is.

### Decisions to make first (record in DECISIONS.md)
1. **Bundler.** Browsers can't run `.ts` (type-stripping is Node-only). Recommend
   adding **esbuild as a dev-only dependency** to bundle `web/main.ts` →
   `docs/app/bundle.js`. This keeps the *runtime* zero-dependency (esbuild is
   build-time only, and the committed bundle means Pages needs no build). This is
   a deliberate, documented exception to "no build step" — for the web target only;
   Node dev stays build-free. (Alternative: hand-write a tiny concatenator — not
   worth it. Decide and note it as D-012.)
2. **Pure hash.** Replace `node:crypto` in `hashGrid` with a small pure-JS hash
   (e.g. FNV-1a or cyrb over the quantized grid) so the engine is universal.
   **This changes the golden `contentHash`** — regenerate it, update
   `tests/world.test.ts`, and record the intentional change in DECISIONS (D-013).
   Alternatively keep `node:crypto` for Node and branch — but a single universal
   pure hash is cleaner.

### Build steps
1. Make the engine browser-safe: add `src/hash.ts` (pure), refactor `hashGrid`
   to use it. Confirm `npm test` still green (with the updated golden hash).
2. Add `web/main.ts`: a small app that reads a seed from an `<input>`, calls
   `generateWorld`, and draws the selected layer to a `<canvas>` via `ImageData`.
   Wire buttons for layers (terrain/biome/political/temp/rain) reusing the
   existing renderers + overlays. Show the meta (capital, regions, etc.) and the
   chronicle text beside it. Keep it dependency-free browser code.
3. Add `scripts/build-web.ts` (or an npm script) that invokes esbuild to bundle
   `web/main.ts` to `docs/app/bundle.js` (format=esm or iife, minify). Add
   `esbuild` to `devDependencies` and an npm `build:web` script.
4. Add `docs/app/index.html` (seed box, generate button, canvas, layer tabs,
   info panel). Link to it from the main gallery (`docs/index.html`) — a "Generate
   your own →" call to action in the masthead.
5. **Commit the built `docs/app/bundle.js`** so Pages serves it with no build.
6. Verify locally with `scripts/serve-docs.ts` and the browser preview; confirm
   generating a couple of seeds renders on the canvas and layer switching works.

### Test / verify
- `npm test` stays green (87, adjusted golden hash).
- A tiny node smoke test that `generateWorld` works without importing `png.ts`
  (i.e. no `node:crypto`/`node:zlib` on the generation+meta path).
- Manual: load `docs/app/` locally, generate seeds, switch layers.

### Close out (do not skip)
1. Update `CHANGELOG.md` (Session 4), `PROJECT_STATE.md` (P2 done, version bump),
   `ROADMAP.md` (tick P2, mark P4 🔜), `DECISIONS.md` (D-012/D-013), and rewrite
   this file for **P4 — interactive atlas** (pan/zoom, clickable regions) or
   deeper simulation (hydraulic erosion).
2. Commit per logical unit and push. Verify the live site's new `/app/` page.

## Guardrails
- Runtime stays **zero-dependency**; esbuild is dev-only. All randomness via
  `Rng` streams. No `Math.random`, no clock. No TS enums/namespaces/decorators.
- Keep `main` green. Every new module gets a doc comment + determinism test.

## Stretch goals (only if P2 is done, tested, committed)
- Layer cross-fade animation as generation completes.
- A "randomize seed" button; shareable `?seed=` URL param.
- Begin P4: pan/zoom on the canvas; hover a region to show its name/stats.
