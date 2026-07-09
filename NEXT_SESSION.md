# Next Session

> Read `PROJECT_STATE.md` first, then this. This file tells you exactly what to
> build next and how to verify it. Keep it concrete.

## Start-of-session checklist

1. `node --version` → confirm ≥ 22.6.
2. `npm test` → confirm green **before** changing anything (baseline: **98**).
3. Skim `CHANGELOG.md` (top, Session 6) and `ROADMAP.md`.
4. Preview: `node scripts/serve-docs.ts` → `/` (atlas) and `/app/` (live).
5. **After any `src/` change, rerun `node scripts/build-web.ts`** (CI enforces it;
   the build also fails if a browser module imports one you forgot to emit).

## Context: where the project is

The world is content-complete: physical + human geography, history, and lore,
with a live interactive browser generator. The one rough edge is that generation
now takes ~1–2 s (erosion + all layers) and **freezes the UI thread** while it
runs. That's the highest-value fix.

## This session's objective: **Responsive generation via a Web Worker**

Move world generation off the main thread so the app stays smooth, with a real
progress/loading state — then a couple of UX wins on top.

### Design (clean split)
1. **`web/worker.ts`** — a module worker (`new Worker(url, { type: "module" })`).
   It imports the engine, receives `{ seed, size }`, runs `generateWorld`, then
   **renders all six layers to RGBA once** and posts back a payload:
   - the six layer `Uint8Array`s (transfer their buffers — zero-copy),
   - an "interactive" slice the main thread needs for hover/click:
     `regions.ids`, `biomes.ids`, `elevation.data`, `water.oceanMask/lakeMask`,
     the `settlements` array, region metadata, `lore.regionDescriptions`, and
     `meta` + `history` for the info panel.
   Build it into `docs/app/worker.js` (extend `scripts/build-web.ts` to emit a
   second entry; keep the engine modules shared).
2. **`web/main.ts`** — replace the inline `generateWorld` call with a worker
   round-trip. Show a "Generating…" overlay / progress affordance while waiting.
   Keep the received interactive slice for hover/click; layer switch just swaps
   the pre-rendered buffer (no re-render, no engine on the main thread).
3. Because the worker pre-renders every layer, the main thread no longer imports
   the renderers for generation — but hover/click still read the interactive
   slice. Make sure the slice has everything `inspect()` needs.

### UX wins to add (if the worker lands cleanly)
- A progress bar or spinner during generation (the freeze is gone, so this is
  honest feedback, not a lie).
- **"World of the day"** button: seed from today's date (pass the date in — the
  engine can't read the clock). Deterministic per day.
- A tiny "generating…" → fade-in of the map.

### Alternative objective (if you'd rather deepen simulation)
**Latitude wind belts** in `src/climate.ts`: replace the single west→east wind
with banded prevailing winds (polar easterlies / mid-latitude westerlies / trade
winds) so rain shadows flip by latitude. Visible in the rainfall + biome layers.
**Changes the golden hash** — regenerate it, update `tests/world.test.ts`,
regenerate samples + web bundle, and document as a new DECISIONS entry.

### Test / verify
- Engine tests stay green (98). If you did wind belts, update the golden hash.
- Worker path: via `preview_eval`, generate a seed and assert the canvas fills +
  the info panel populates + hover/click still work (the interactive slice is
  wired) + no console errors. Confirm the main thread didn't freeze (the status
  updates before the map appears).

### Close out (do not skip)
1. `node scripts/build-web.ts` (now emits app.js **and** worker.js) so the
   committed bundle is current; `node scripts/make-samples.ts` if engine changed.
2. Update `CHANGELOG.md` (Session 7), `PROJECT_STATE.md`, `ROADMAP.md`,
   `DECISIONS.md` (worker architecture, or wind-belt golden change), and rewrite
   this file for the next theme.
3. Commit per logical unit and push; confirm CI green and the live `/app/` works.

## Guardrails
- Runtime + build stay **zero-dependency**. All randomness via `Rng` streams.
- No TS `enum`/namespaces/decorators. Keep `main` green and CI passing.
- The engine must not read the clock — pass dates in (world-of-the-day).

## Backlog (good alternatives / stretch)
- Merge sub-threshold islet regions (1-cell "regions" clutter gazetteers).
- Lake outflow / river-into-lake continuity.
- Benchmark script tracking per-layer generation time.
- Religions/myths as another lore layer (deterministic, downstream).
