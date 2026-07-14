# Next Session — Session 28

> Read `PROJECT_STATE.md` first, then this. Session 27 ran the second reading
> pass — five defects found by reading, all fixed (D-029: unique realm names,
> geography-aware region prose, founding jitter, per-volcano summits and
> per-world vertical scale, regnal numbers) — then deepened the plans (the
> capital drawn in the gazetteer; ruins viewable "as it stood").
> D-027 still governs feature ideas: interactivity REVEALS pregenerated fact,
> never authors new story.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **238**).
2. Skim `CHANGELOG.md` (top, Session 27) and `DECISIONS.md` (D-027/28/29).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES`, new web helper → `WEB_MODULES`. Then `make-samples` if output
   changed.
4. **Preview transport:** Browser pane reaches localhost via `preview_start`
   ("docs"); its screenshotter wedges — verify by canvas `getImageData`
   sampling via `javascript_tool` + `window.__cartogenesis` for exact click
   coords. Visual proof: push, then screenshot the DEPLOYED site in the
   user's Chrome (cache-bust). **PowerShell corrupts UTF-8 and complex
   quoting — Node for file edits, `git commit -F file`, Write-a-file-then-
   append for test additions. Escape backticks in .mjs template literals.**
5. War/revolt/plague changes → 30-seed balance check (256²: mean ~61%,
   sd ~18 after D-029).

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

# Option A — Hover the world (marker & plan interactivity, queued since S24)

- Hit-test faith/realm/ruin markers and plan landmarks in the existing
  mousemove handlers → the chit tooltip explains them in place (the entity
  index already knows every name).
- The Powers scrubber pausing briefly on eventful eras.

# Option B — Third reading pass, different organs

S27 read gazetteers. Read what it did NOT: three CITY PLANS end to end at
several tiers, three full chronicles aloud for voice drift, the app's hover
chits and detail cards for stale phrasing. Fix the worst.

# Option C — The atlas index page

docs/index.html (the sample gallery) predates the folio — it still wears the
old design. Bring the landing page into the Cartographer's Folio so the
first impression matches the app.

## Recommended order

**C first** (the landing page is the only pre-folio surface left), then A.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved (none
   should, unless a new deliberate D-entry says so).
2. CHANGELOG (Session 28), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green; verify deployed with a cache-busting
   reload; screenshot via the user's Chrome for visual work.
