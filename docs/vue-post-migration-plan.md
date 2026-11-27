# Vue post-migration organization and optimization plan

## Goal

Finish the Vue migration cleanup with small, independent pull requests. Each step
must improve one concrete part of the application without changing catalog rules,
sprite geometry, PWA behavior, or browser rendering.

The application should remain a static Vue 3 + Vite client application. Do not
introduce SSR, SSG, Nuxt, a router, or a new state library. Pinia is optional
only if a later step proves it replaces duplicated state-management code; it
should not be adopted merely to follow a convention.

The migration has landed through PRs #78–#84. Implementation starts at current
`main`, not from an older migration worktree. The findings below are based on the
migrated code in `src/` and the existing tests.

## Separate-session rules

Run one session per step. Each session:

1. Starts from the latest merged `main`.
2. Implements one step only.
3. Reads `docs/architecture.md`, `.github/technical-constraints.md`, and
   `docs/vue-migration-baseline.md`.
4. Adds or adjusts the smallest useful tests.
5. Runs `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`,
   `npm run validate:catalog`, `python scripts/optimize-sprites.py --check`, and
   `npm run build` where applicable.
6. Opens a reviewable PR, with the relevant existing label, and reports browser
   checks that remain maintainer-owned.

Do not combine two cleanup steps in one PR unless one cannot be verified
independently. Merge and validate each PR before starting the next session.
Step 7 is also a separate session, starts only after Step 6 is merged, and must
not turn missing maintainer-owned browser evidence into agent-run or inferred
results. It records the evidence available in the baseline and identifies each
remaining check as pending until its result is actually collected.

### Reusable kickoff prompt

> Implement **Step N** in `docs/vue-post-migration-plan.md`, including its
> acceptance criteria and the separate-session rules. Start from the latest
> merged `main`; verify the prerequisite step is merged before editing. Work
> only on that step and preserve static GitHub Pages/PWA behavior, the canvas
> drawing path, catalog validation, and existing accessibility. Open a PR and
> report all validation results and remaining browser checks.

## Step 1 — Fix reactive item invalidation

**Problem:** A thumbnail is considered available by calling
`getSprite(item)` in a computed value. That lookup reads mutable image-loader
caches that Vue cannot observe. A category retry or preset load can therefore
change the actual available items without necessarily scheduling a component
update.

**Assignment:** Make available-item presentation depend on explicit reactive
state rather than an invisible cache lookup. Introduce the smallest store or
component state that represents item load revisions or loaded-item availability,
and use it for the computed wardrobe item list. Keep decoded sprites and
`HTMLImageElement` objects outside Vue reactivity.

Cover these races:

- Category load begins, finishes, and is retried.
- Retry loads a previously failed item.
- A preset loads an item in the active category.
- Reset restores the active category.
- A stale category load completes after another category was selected.

**Acceptance:**

- A newly loaded item appears after retry or preset loading without requiring
  an unrelated reactive update.
- Stale load completions do not change availability or failure counts.
- No sprite, canvas context, image cache, or `CanvasRenderingContext2D` is made
  deeply reactive.
- `tests/wardrobe-island.test.ts` and the relevant controller tests cover
  successful retry and preset/race behavior.

## Step 2 — Enforce store mutation boundaries

**Problem:** `state` is readonly for Vue, but `getOutfit()` exposes the current
reactive object as the single live look. The object may be mutated by future
controllers or presentation code without passing through a store action.

**Assignment:** Make the store contract unambiguously action-based. Choose one
safe representation:

- Return a readonly deep copy/snapshot from `getOutfit()`, while keeping
  framework-independent copy semantics, or
- Return a readonly reactive view and keep store actions as the only supported
  way to mutate it.

Do not use an unsafe cast to remove readonly type errors. Update renderer getters,
catalog matching, controllers, and tests to match the contract. Preserve:

- Look replacement copying.
- Item and exclusive-category mutations.
- Selection token invalidation.
- Async preset/category race rules.

**Acceptance:**

- Public look access cannot be mutated outside store actions.
- Type-checking rejects accidental look mutation.
- Existing state-store, outfit-controller, renderer, and matching tests pass.
- `docs/architecture.md` describes the chosen snapshot/read-only contract.

## Step 3 — Extract item thumbnail presentation

**Problem:** `drawThumbnail()` is invoked through a template-ref callback in
`wardrobe-island.vue`. Ref callbacks can run repeatedly during re-renders, and
thumbnail fallback/drawing logic currently shares responsibility with the whole
wardrobe grid.

**Assignment:** Add a focused `src/ui/item-thumbnail.vue` component. The component
owns:

- Normal thumbnail image rendering.
- Image load failure fallback.
- One canvas fallback draw after mount or a relevant reactive change.
- Correct cleanup or invalidation if its item/sprite changes.

Keep item filtering, selection, labels, and aria state in `wardrobe-island.vue`.
The component should receive only the item and a sprite lookup.

**Acceptance:**

- Thumbnail fallback is not redrawn for unrelated wardrobe renders.
- Component tests cover image success, image failure, missing sprites, and sprite
  changes.
- Existing wardrobe accessibility and item-card behavior remain unchanged.
- Canvas fallback geometry continues to use the existing item thumbnail crop
  and sprite offsets.

## Step 4 — Simplify AppView dependencies

**Problem:** `app-view.vue` currently receives catalog, presets, store,
responsive state, sprite lookup, preview factory, status controller, and error
reporter as separate props. It also owns controller/download/lifecycle state.

**Assignment:** Introduce a Vue composable or a small app-level dependency
interface that owns application orchestration, preview initialization, download,
and lifecycle cleanup. `AppView` should remain mostly declarative.

Preferred boundary:

- `main.ts` composes framework-independent services.
- A composable owns mounted canvas refs and lifecycle integration.
- `AppView` receives only catalog/UI props that are genuinely presentation
  inputs, or obtains already-created application services through typed
  dependency injection.

Do not move the Canvas 2D renderer or decoded-image cache into reactive state.
Do not add Pinia or a separate state library in this step.

**Acceptance:**

- AppView no longer contains the same mount/download/orchestration complexity
  in its template area.
- Component tests cover one-time preview initialization, download, duplicate
  download blocking, cleanup, and startup/export failures.
- No duplicate renderer/controller instances or ResizeObserver listeners.
- Existing public behavior remains unchanged.

## Step 5 — Move layout classes out of the panel

**Problem:** `wardrobe-panel.vue` directly toggles `document.body` classes for
responsive open and expanded layout state. This leaks layout ownership into a
panel component, although cleanup is currently implemented.

**Assignment:** Make layout presentation declarative in `AppView` or a dedicated
layout component. Bind body-equivalent classes to root markup or keep root
classes synchronized through an explicitly owned layout composable.

The responsive state remains in the store. Preserve desktop, mobile, backdrop,
escape, focus, inset, and expansion behavior. Remove direct body class mutation
from `wardrobe-panel.vue`.

**Acceptance:**

- Panel mounting/unmounting does not own global body class lifecycle.
- Open and expanded layout state remains reactive and synchronized.
- Wardrobe panel tests cover desktop/mobile transitions, open/close, Escape,
  focus, backdrop, and cleanup.
- Unmount in non-matching media-query states leaves no stale layout classes.

## Step 6 — Decide store scope or split presentation state

**Problem:** The store combines outfit state, loading state, status, download
and responsive panel state. Vue native reactivity is a good fit, but the
combined surface can become a UI god-store.

**Assignment:** First measure usage and actual coupling. If one reactive store
is sufficient, document the invariant and keep native Vue reactivity. If clear
domains are duplicated or tightly coupled, split presentation state into small
composables or typed modules:

- Outfit/look state and selection concurrency.
- Wardrobe loading and panel layout.
- Status/offline/download presentation.

Do not introduce Pinia unless the split would otherwise duplicate behavior or
cross-instance state management is genuinely required.

**Acceptance:**

- The store API is minimal and domain-coherent.
- Cross-domain actions are explicit and tested.
- The app has one authoritative look and one selection-request token.
- Documentation explains whether native Vue reactivity or Pinia was selected
  and why.
- No behavior, bundle, or PWA regression is introduced.

## Step 7 — Collect pending browser evidence

**Problem:** `docs/vue-migration-baseline.md` records a bundle-size increase but
explicitly leaves runtime browser timings and maintainer checks pending. Release
readiness cannot be concluded from bundle and unit-test evidence alone.

**Assignment:** In a separate session based on the latest merged `main`, first
verify that Step 6 is merged. Follow the browser protocol in
`docs/vue-migration-baseline.md`. Record Step 1 and final results only when they
were collected under the same conditions. Preserve missing measurements as
pending; do not infer timings, browser conditions, or maintainer-check results.

At the start of this step, the available evidence is the Step 0 and Step 6
production bundle comparison and the Step 6 automated validation recorded in
`docs/vue-migration-baseline.md`. These establish bundle size and automated
check results only. The baseline records no browser timing samples, redraw
counts, or browser/device/network/cache conditions. Its maintainer-owned
desktop/mobile, loading/race, PNG, Pages/service-worker, install, offline, and
update checks are still pending. Keep this evidence inventory current, linking
each measured result to its source and leaving unavailable results explicitly
pending.

Collect:

- 10 first-usable-preview samples.
- 10 selection-to-paint samples.
- Item selection/reset redraw counts.
- Desktop/mobile visual and keyboard parity.
- Partial loading/retry and async race behavior.
- PNG composition and dimensions.
- Pages subpath assets and service-worker scope.
- First install, offline reload, and update after deployment.

**Acceptance:**

- Results include the browser and version, device, viewport, DPR, network
  profile, cache policy, sample count, median, and range. Timing and redraw
  results use the baseline protocol and the same recorded conditions for Step 1
  and final runs.
- The baseline or a linked evidence artifact names the source and status of
  every result, clearly separating measurements and completed checks from
  pending maintainer-owned work. If evidence is unavailable, state what remains
  pending and do not fill in a value.
- No bundle-size or runtime performance claim goes beyond the data.
- Browser findings create follow-up fixes when they expose actual regressions;
  pending checks are not presented as release sign-off.

## Recommended result

After these steps, the codebase should have:

- One authoritative outfit store with an enforced mutation boundary.
- Explicit reactive invalidation for loaded wardrobe assets.
- Isolated thumbnail rendering.
- A declarative application shell.
- Layout state owned by the layout rather than a panel.
- A deliberately scoped store/composable structure.
- Recorded browser evidence for the final Vue migration decision.
