# Next Session — Session 29

> Read `PROJECT_STATE.md` first, then this. Session 28 finished the folio's
> visual reach — the landing page is now the folio's frontispiece (the last
> pre-folio surface), and the map markers + plan landmarks explain themselves
> on hover. The whole product now reads as one design. D-027 still governs
> features: interactivity REVEALS pregenerated fact, never authors new story.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **238**).
2. Skim `CHANGELOG.md` (top, Session 28) and `DECISIONS.md` (D-027/28/29).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES`, new web helper → `WEB_MODULES`. Then `make-samples` if output
   changed (it also refreshes the landing page's manifest).
4. **Preview transport:** Browser pane reaches localhost via `preview_start`
   ("docs"); the screenshotter now often works but can wedge — fall back to
   canvas `getImageData` sampling + `window.__cartogenesis` {world, view} for
   exact click coords. Visual proof: push, then screenshot the DEPLOYED site
   in the user's Chrome (cache-bust). **PowerShell corrupts UTF-8 and complex
   quoting — Node for file edits, `git commit -F file`, Write-a-file-then-
   append for test additions. Escape backticks in .mjs template literals.**
5. War/revolt/plague changes → 30-seed balance check (256²: mean ~61%, sd ~18).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` via `src/exact.ts`; lint-test
  enforced (cos/sin/atan2 banned — octants by comparison, see cityplan.ts).
  Fingerprints pinned: content `1a70fd39`, exact `1835f622`, sim `4767346f`
  (all moved in S27 by D-029) — note which move and why.
- Prose layers never perturb the sim (D-021/24/25); plans and renderers are
  pure functions of the world (tested). `CONCEPTS` append-only. Dated things
  derive from `meta.presentYear`. No test hard-codes a simulated outcome.
  Sidebar linkification runs AFTER innerHTML assignment.
- New event types or prose must join the voice/frame system and its tests.
- Run `node scripts/bench.ts` after heavy changes; budget in PROJECT_STATE.

**Priority note:** user feedback first, always.

---

# Option A — The third reading pass, unread organs

S27 read gazetteers; S24/S25/S26 read the app. Read what nothing has: three
CITY PLANS end to end at several tiers (do the districts/gates/walls always
make sense? do landlocked capitals ever look wrong?), and three full
CHRONICLES aloud for voice drift and repeated phrasing. Fix the worst. The
reading pass is 3-for-3 at finding real bugs — keep it in rotation.

# Option B — A genuinely new PREGENERATED layer (think big, D-027-safe)

The world already has terrain, climate, cities, faiths, economy, history,
and street plans. What is still latent in the data but never surfaced?
Candidates that are pure functions of what exists: trade routes (the roads +
economy already imply them), a climate/wind map with real prevailing belts,
dynasty family trees (the rulers exist; the descent is inventable
deterministically), or per-region folk costume/heraldry derived from culture
+ resources. Pick one, design it as a reader of decided fact, build + test.

# Option C — Deposits & resources hover/legibility

The Resources layer shows deposits but the economy story (trade hubs, what
flows where) is thin in the app. A reading of the existing economy layer.

## Recommended order

**A first** (a reading pass is overdue on the unread organs), then B if a
strong pregenerated layer suggests itself from the reading.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved (none
   should, unless a new deliberate D-entry says so).
2. CHANGELOG (Session 29), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green; verify deployed with a cache-busting
   reload; screenshot via the user's Chrome for visual work.
