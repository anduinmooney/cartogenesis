# Next Session — Session 27

> Read `PROJECT_STATE.md` first, then this. Session 26 was a user course
> correction, delivered in full: expeditions REMOVED (D-027 — the world is
> what was generated; never append fiction at click time), history dated
> year-by-year (D-028), L19 city plans for every town and ruin, and a second
> design pass (labels read functionally, boxes became sentences and margins).
> Internalize D-027 before proposing features: interactivity must REVEAL
> pregenerated fact, never author new story.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **232**).
2. Skim `CHANGELOG.md` (top, Session 26) and `DECISIONS.md` (D-027/D-028
   before feature work; D-026 before region work; D-025 before narrative).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES`, new web helper → `WEB_MODULES`. Then `make-samples` if output
   changed.
4. **Preview transport:** Browser pane reaches localhost via `preview_start`
   ("docs" → serve-docs on 8123), but its screenshotter wedges — verify by
   canvas `getImageData` sampling via `javascript_tool`, and use
   `window.__cartogenesis` = {world, view} to compute exact click coords.
   Visual proof: push, then screenshot the DEPLOYED site in the user's
   Chrome (cache-bust first). PowerShell corrupts UTF-8 and inline quotes —
   do file text-edits in Node, commit messages via `git commit -F file`,
   and ESCAPE BACKTICKS in .mjs template literals (bit three sessions
   running).
5. War/revolt/plague changes → 30-seed balance check. Post-merge bands:
   384² mean top share ~36% (sd 12), 256² ~55% (sd 17).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` via `src/exact.ts`; lint-test
  enforced (atan2/cos/sin also banned — cityplan.ts shows octant-by-
  comparison). Fingerprints pinned: content `86c5fef6`, exact `418ddfd2`,
  sim `09995e24` (moved in S26 by D-028) — note which move and why.
- Prose layers never perturb the sim (D-021/24/25). City plans and all
  renderers are pure functions of the world (tested). `CONCEPTS`
  append-only. Dated things derive from `meta.presentYear`. No test
  hard-codes a simulated outcome. Sidebar linkification runs AFTER
  innerHTML assignment.
- New event types or prose must join the voice/frame system and its tests.
- Run `node scripts/bench.ts` after heavy changes; budget in PROJECT_STATE.

**Priority note:** user feedback first, always.

---

# Option A — City plans, deeper (builds straight on L19)

- **Plans in the gazetteer:** a "The capital, drawn" section — the capital's
  plan facts + district list in the report .md (pure prose; fingerprints
  still).
- **Plan of any era?** A plan already knows its wars; a "before the sack"
  view of a ruin (same generator, ruined=false) is one boolean away.
- **Hover the plan:** landmark hit-testing on the plan canvas → the chit
  tooltip explains districts in place.

# Option B — Reading pass (overdue since S24)

Generate three seeds, read their gazetteers end to end, and fix whatever
reads worst. The last three reading passes each found a real bug.

# Option C — Marker & scrubber polish (queued since S24)

- Hoverable map markers (faith/realm/ruin) via the entity index.
- The Powers scrubber pausing briefly on eventful eras.

## Recommended order

**B first** (two structural sessions since the last read), then A.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved (none
   should, unless a new deliberate D-entry says so).
2. CHANGELOG (Session 27), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green; verify deployed with a cache-busting
   reload; screenshot via the user's Chrome for visual work.
