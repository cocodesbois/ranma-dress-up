# Vue 3 migration: independent agent sessions

## How to run this plan

This is a sequence, not parallel work. Each session starts from the latest merged
`main`, implements exactly one step, and hands off a working, reviewable PR.
Merge and validate that PR before starting the next step. Verify the actual current `main` and
working-tree status at the start; never switch or modify a shared checkout.

**Step 0** persists this plan in the repository so subsequent sessions need no
access to this conversation or its session files. Review and merge that
documentation-only PR first.

### Common instruction for every implementation session

Read this plan, `docs/architecture.md`, `.github/technical-constraints.md`, and
the current code before editing. Treat current `main` as authoritative if details
have changed; flag a conflict instead of silently changing the intended scope.
Follow repository PR, documentation, type-safety, and validation conventions.
Do not redesign the app, add unrelated functionality, or change sprite assets.

The target is Vue 3, Vite, TypeScript, client-side rendering, and static GitHub
Pages hosting: no SSR, SSG, Nuxt, or server runtime. Use Vue's own reactive
store as the single source of truth; no store subscription adapter or second
authoritative look. A separate state library or router is not part of this plan.
Keep the catalog model and canvas/image code framework-independent. Preserve
`base: "./"`, the PWA precache pipeline, and generated asset paths.

Each PR must leave the app functional. For each changed DOM region there must be
exactly one owner and one set of event handlers, including during transition.
Keep the renderer's explicit drawing path and existing image caches; don't put
canvas contexts, decoded images, or caches into deep Vue reactivity.

Run the relevant existing automated checks, including `npm run lint`,
`npm run format:check`, `npm run typecheck`, and `npm test`; CI also checks the
catalog, optimized sprites, and Vite build. Follow the repository's existing
maintainer-owned browser validation convention. Each handoff must identify
changes, automated results, browser checks still needed, and blockers. Do not
describe unperformed browser checks as passed.

### Session kickoff template

> Implement **Step N** in `docs/vue-migration-plan.md`, including its acceptance
> criteria. Read the common instructions and current code first. Work only on
> this step, preserve the app's existing behavior, and provide the requested
> handoff. The preceding step has been merged into `main`.

Replace `N` with the step number. If its prerequisites are not actually merged
or a required decision is unresolved, stop and report the blocker.

## Step 0 — Persist this plan

**Prerequisite:** None.

**Assignment:** Persist this plan in `docs/vue-migration-plan.md` as a
documentation-only change. Open a PR using the existing `documentation` label.

**Accept:** Plan exists on the PR branch, covers the common instructions and
all steps below, and is readable by later sessions after merge. No application,
dependency, or asset changes.

## Step 1 — Establish the baseline

**Prerequisite:** Step 0 merged.

**Assignment:** Record the pre-migration production bundle size and a repeatable
measurement procedure for first usable preview, selection-to-paint latency, and
canvas redraw counts. Include device/browser, viewport, network and cache
conditions, sample count and median/range; do not invent measurements. Add
focused regression tests only where missing for async selection/Reset races,
image loading failure and retry, canvas redraws and PNG export. Do not introduce
Vue or change behavior.

**Accept:** The baseline and conditions are available in the repository or PR
handoff for comparison in Step 6. Automated tests pass. If maintainer-owned
browser measurements cannot be collected, explicitly request and record them
before the final performance comparison; do not treat them as complete. See
[the Step 1 baseline](vue-migration-baseline.md) for the recorded bundle size,
measurement protocol, and pending browser results.

## Step 2 — Vue tooling and reactive store

**Prerequisite:** Step 1 merged.

**Assignment:** Add Vue 3 and the Vite Vue plugin with compatible versions.
Extend lint, formatting, strict application/template type checking and tests to
cover `.vue` files, while preserving the existing validator and test checks.
Convert `src/core/state-store.ts` to use Vue-reactive state directly as the
single source of truth. Retain typed actions/getters needed by existing
controllers and the renderer, adjusting call sites if necessary. Track both look
replacement and item mutations; preserve copied presets and selection tokens.

Mount a small, isolated Vue-owned UI region alongside the legacy DOM to prove
the tooling and direct reactive state access. Do not mount over a subtree that
the legacy code still updates. Do not add a store adapter, watcher-driven canvas
redraw, a separate state library, or migrate the whole UI in this step.

**Accept:** The Vue region observes the same store mutated by existing actions;
focused tests cover reactivity, look replacement/item mutations and token
invalidation. Existing controls, drawing, and PWA behavior remain intact. The
build produces static assets and `sw.js` precaches the new assets.

## Step 3 — Wardrobe categories and items

**Prerequisite:** Step 2 merged.

**Assignment:** Transfer `#category-tabs` and `#item-list` to Vue as a coherent
island. Move category/card rendering and event handling, and remove legacy
writers/listeners for those regions. Keep outfit orchestration, image loading,
and explicit canvas drawing. Expose any necessary category loading/result state
through the reactive store without proxying the image cache or introducing a
store subscription adapter. Adapt the controller's presentation interface so it
does not imperatively mutate Vue-owned nodes.

**Accept:** Category order, active/equipped indicators, accessible names,
selection/exclusions, mandatory hair, thumbnails and fallback, partial failures
and retry, stale category loads, presets and Reset match the existing behavior.
Focused component/controller tests cover the transferred behavior. Other regions
remain legacy-owned and functional.

## Step 4 — Presets, status, and mobile panel

**Prerequisite:** Step 3 merged.

**Assignment:** Transfer preset selection/navigation, Reset, status messages,
and mobile wardrobe controls to Vue-owned regions, removing their old DOM
writers/listeners as each region changes ownership. Refactor
`outfit-controller.ts`, `status-controller.ts`, and
`wardrobe-panel-controller.ts` as needed so the controller no longer depends
on a Vue-owned `<select>` or directly writes into Vue-owned regions. Keep
current outfit orchestration, explicit canvas redraw and download behavior.
Maintain the existing desktop expansion behavior as well as mobile behavior.

**Accept:** Preset matching, adjacent navigation, async invalidation, disabled
and error states, Reset, desktop expansion, responsive panel semantics, focus,
Escape, keyboard interaction, and ARIA behavior remain intact. Focused tests
cover transitions and async races. The remaining preview and download paths
continue to work.

## Step 5 — Canvas lifecycle and final UI ownership

**Prerequisite:** Step 4 merged.

**Assignment:** Move remaining application shell, preview, download and offline
status presentation to Vue ownership as needed, retaining a stable canvas element
and the existing canvas renderer and image loader. Initialize the renderer once
after the canvas mounts; preserve the explicit redraw path for committed look
changes and resize/DPR changes. Do not combine old and new redraw triggers.
Move and clean up observers and event listeners on unmount, including a
disposable, re-arming device-pixel-ratio listener. Remove superseded bootstrap
and DOM wiring only when all their responsibilities have moved. Preserve
service-worker registration and explicit error reporting.

Prefer typed Vue component emits and parent listeners for user actions throughout
the migrated UI, including the existing wardrobe and Reset components, wherever
practical. Keep function props for operations that return values, such as sprite
lookup, and retain the existing controller orchestration.

**Accept:** Tests demonstrate one stable canvas, no duplicate observers/listeners
or redraws from unrelated UI updates, correct disposal, and unchanged drawing
order and fixed-size export. Startup errors, save failures, offline status,
resize and DPR changes remain handled. No legacy writer controls Vue-owned DOM.
Component action events use typed emits wherever practical.

## Step 6 — Parity and release readiness

**Prerequisite:** Step 5 merged.

**Assignment:** Remove migration-only scaffolding, update architecture and
technical constraints to reflect actual ownership and the Vue-reactive store,
and run all applicable automated checks. Compare production bundle size and
measurements with Step 1 using the same conditions. Coordinate maintainer browser
checks of desktop/mobile visuals and keyboard behavior, selection races,
loading/retry, PNG composition and dimensions, Pages subpath assets and
service-worker scope, first install, offline reload and update after a new build.

**Accept:** CI is green; checks and actual measurements are recorded, not
assumed. Explain any regressions and agree acceptable performance thresholds
with the maintainer; don't claim no performance loss without evidence. If browser
checks or measurements are pending, identify them explicitly and do not mark
release readiness complete.
