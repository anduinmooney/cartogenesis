# Next Session — Session 26

> Read `PROJECT_STATE.md` first, then this. Session 25 added L18 chartered
> expeditions (interactive A* routes + journals, pure overlay) and the
> Cartographer's Folio (full app redesign — paper/ink/oxblood, no AI
> palette; one committed look, all CSS). The app now has a verification
> handle: `window.__cartogenesis` = {world, view}. Expedition polish ideas:
> weather along the march, a "share this crossing" link (?from=&to= in the
> URL), expeditions in the exported gazetteer, hoverable route waypoints.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **229**).
2. Skim `CHANGELOG.md` (top, Session 25) and `DECISIONS.md` (D-026 before
   region work, D-025 before narrative work).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES`, new web helper → `WEB_MODULES`. Then `make-samples` if output
   changed.
4. **Preview transport:** the Browser pane CAN reach localhost via
   `preview_start` + launch.json ("docs" → serve-docs on 8123) — but its
   screenshotter can wedge; verify pixels by canvas `getImageData` sampling
   from `javascript_tool` (Session 24 did exactly this). Cache-bust reloads:
   `fetch("app.js",{cache:"reload"}); location.reload()`.
5. War/revolt/plague changes → 30-seed balance check. Post-merge bands:
   384² mean top share ~36% (sd 12), 256² ~55% (sd 17).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` via `src/exact.ts`; lint-test
  enforced. Fingerprints pinned: content `86c5fef6`, exact `418ddfd2`, sim
  `146934d0` (moved in S24 by D-026) — note which move and why.
- Prose layers never perturb the sim (D-021/24/25). `CONCEPTS` append-only.
  Dated things derive from `meta.presentYear`. No test hard-codes a simulated
  outcome. Sidebar linkification runs AFTER innerHTML assignment.
- New event types or prose must join the voice/frame system and its tests.
- Run `node scripts/bench.ts` after heavy changes; budget in PROJECT_STATE.

**Priority note:** user feedback first, always.

---

# Option B — Narrative polish (small, delightful)

- The traveller names crater lakes when the road passes one (facts are already
  computed; the phrase bank just never mentions the lake's name).
- The chronicle could close chapters with a one-line "state of the powers".
- Saga ↔ chronicle cross-reference ("the chronicle records otherwise").
All strictly downstream; fingerprints must not move.

# Option C — Whatever the world suggests

Generate three seeds, read their gazetteers end to end, and fix whatever reads
worst. (This is how the duplicate-rename bug, the volcano clutter, and the
"Realms 3 / Surviving 13" contradiction were found — reading, not planning.)

# Option D — Expedition & marker polish (builds on Sessions 24–25)

- Shareable crossings: read ?from=&to= from the URL and charter on load;
  write them when an expedition completes.
- The journal in the gazetteer: a chartered crossing could be appended to
  the exported .md (still on-demand; never in generateWorld).
- Make canvas markers hoverable: hit-test faith/realm/ruin markers in the
  existing mousemove handler and show the entity tooltip (the entity index
  already has every one of these names).
- The Powers scrubber could pause briefly on eventful eras.
- A "story mode": auto-play the scrubber while the sidebar highlights the
  era's chronicle entries.

## Recommended order

**C first** (a reading pass after two structural sessions will surface truth),
then B or D with what remains.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved (none
   should, unless a new deliberate D-entry says so).
2. CHANGELOG (Session 25), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green on CI's Node; verify deployed with a
   cache-busting reload.
