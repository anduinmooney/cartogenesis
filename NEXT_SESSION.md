# Next Session — Session 23

> Read `PROJECT_STATE.md` first, then this. Session 22 closed the truth-telling
> tail: the README finally matches the project, the Topo layer contours in real
> metres with index lines, and there is a performance budget. What remains is
> one deliberate heavy item and polish.

## Start-of-session checklist

1. `node --version` → ≥ 22.6. `npm test` green first (baseline: **214**).
2. Skim `CHANGELOG.md` (top, Session 22) and `DECISIONS.md` (D-025 before
   narrative work).
3. **Rebuild `build-web` LAST after any src/ edit**; new engine module →
   `MODULES`, new web helper → `WEB_MODULES`. Then `make-samples` if output
   changed.
4. **Preview transport:** ext-shaped Chrome cannot reach sandbox localhost.
   Verify content in Node; verify pixels on the deployed Pages site — with a
   cache-busting reload (`fetch("app.js",{cache:"reload"}); location.reload()`),
   or a stale bundle will impersonate a bug.
5. War/revolt/plague changes → 30-seed balance check (~55–62% mean top share).

## Invariants

- Exact arithmetic (D-022): `+ - * / sqrt` via `src/exact.ts`; lint-test
  enforced. Fingerprints pinned: content `86c5fef6`, exact `418ddfd2`, sim
  `15371f11` — note which move and why.
- Prose layers never perturb the sim (D-021/24/25). `CONCEPTS` append-only.
  Dated things derive from `meta.presentYear`. No test hard-codes a simulated
  outcome. Sidebar linkification runs AFTER innerHTML assignment.
- Run `node scripts/bench.ts` after heavy changes; budget in PROJECT_STATE.

**Priority note:** user feedback first, always.

---

# Option A — The islets merge (deliberate; moves fingerprints)

Single-cell islands become their own 1-cell "regions" and clutter every
gazetteer table. Merge sub-threshold islets (< ~12 cells): either into one
"Scattered Isles" bucket region (flagged `scattered: true`; centroid on the
largest islet so flyTo lands sanely) or into the nearest large region. Check
what the region full-partition test asserts before choosing. Downstream: region
count and names shift → settlements/sim → `simulationHash` moves (terrain
hashes should NOT — that split is your check). Regenerate fingerprints +
samples; 30-seed balance check; DECISIONS entry.

# Option B — Narrative polish (small, delightful)

- The traveller names crater lakes when the road passes one (facts are already
  computed; the phrase bank just never mentions the lake's name).
- The chronicle could close chapters with a one-line "state of the powers".
- Saga ↔ chronicle cross-reference ("the chronicle records otherwise").
All strictly downstream; fingerprints must not move.

# Option C — Whatever the world suggests

The engine is complete enough that the best next feature may be visible only
from inside a generated world. Generate three seeds, read their gazetteers end
to end, and fix whatever reads worst. (This is how the duplicate-rename bug and
the volcano clutter were found — reading, not planning.)

## Recommended order

**A → B**, unless C surfaces something better. A alone is a solid session; do
not start it without budget to finish, regenerate, and verify.

## Close out (do not skip)

1. `build-web` + `make-samples` LAST. Note which fingerprints moved.
2. CHANGELOG (Session 23), PROJECT_STATE, ROADMAP, DECISIONS if warranted;
   rewrite this file.
3. Commit per piece; push; CI green on CI's Node; verify deployed with a
   cache-busting reload.
