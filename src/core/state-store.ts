/**
 * Owns synchronous look, panel and loading state without DOM dependencies.
 * Exports createStore; controllers coordinate side effects and rendering.
 * @module core/state-store
 */

import type { CategoryId, Look } from "../types";
import { reactive, readonly } from "vue";

/**
 * Create an isolated store, copying the initial look rather than mutating a preset.
 * @returns A store exposing synchronous state accessors and selection tokens.
 */
export function createStore({
  defaultOutfit,
  initialActiveCategory = "tops",
}: {
  defaultOutfit: Look;
  initialActiveCategory?: CategoryId;
}) {
  const state = reactive({
    outfit: { ...defaultOutfit },
    activeCategory: initialActiveCategory,
    categoryLoad: {
      categoryId: initialActiveCategory,
      status: "idle" as "idle" | "loading" | "ready",
      failedCount: 0,
      request: 0,
      availableItemIds: [] as string[],
    },
    wardrobeOpen: false,
    wardrobeExpanded: false,
    mobileWardrobe: false,
    outfitSelectionRequest: 0,
    pendingPresetId: null as string | null,
    outfitControlsDisabled: false,
    status: { text: "Loading the wardrobe...", loading: false, isError: false },
    offlineStatus: { text: "", isError: false },
    downloadPending: false,
    previewReady: false,
  });
  const readonlyState = readonly(state);

  return {
    /** Readonly reactive state for Vue-owned views and computed presentation. */
    state: readonlyState,
    /** @returns A readonly reactive view of the current look. Re-read after replacement. */
    getOutfit(): Readonly<Look> {
      return readonlyState.outfit;
    },
    /** @param nextOutfit - Replace the live map with a shallow copy. */
    setOutfit(nextOutfit: Look) {
      state.outfit = { ...nextOutfit };
    },
    /** Set or clear one category without applying controller exclusivity rules. */
    setOutfitItem(category: CategoryId, itemId: string | null) {
      state.outfit[category] = itemId;
    },
    /** @param categories - Categories whose selections become null. */
    clearOutfitItems(categories: CategoryId[]) {
      for (const category of categories) {
        state.outfit[category] = null;
      }
    },
    /** @returns The category currently displayed in the wardrobe. */
    getActiveCategory() {
      return state.activeCategory;
    },
    /** @param category - Category ID to display. */
    setActiveCategory(category: CategoryId) {
      state.activeCategory = category;
    },
    /** Start loading one category and return its stale-result token. */
    startCategoryLoad(category: CategoryId) {
      state.activeCategory = category;
      state.categoryLoad = {
        categoryId: category,
        status: "loading",
        failedCount: 0,
        request: state.categoryLoad.request + 1,
        availableItemIds: [],
      };
      return state.categoryLoad.request;
    },
    /** Commit loaded item IDs only while the category and request remain current. */
    finishCategoryLoad(request: number, failedCount: number, availableItemIds: string[]) {
      if (
        request !== state.categoryLoad.request ||
        state.activeCategory !== state.categoryLoad.categoryId
      ) {
        return false;
      }
      state.categoryLoad = {
        ...state.categoryLoad,
        status: "ready",
        failedCount,
        availableItemIds: [...availableItemIds],
      };
      return true;
    },
    /** Show the current category immediately and invalidate any pending category load. */
    setCategoryLoadResult(category: CategoryId, failedCount: number, availableItemIds: string[]) {
      state.activeCategory = category;
      state.categoryLoad = {
        categoryId: category,
        status: "ready",
        failedCount,
        request: state.categoryLoad.request + 1,
        availableItemIds: [...availableItemIds],
      };
    },
    /** @returns Whether the mobile wardrobe is open. */
    isWardrobeOpen() {
      return state.wardrobeOpen;
    },
    /** @param open - Desired mobile panel state. */
    setWardrobeOpen(open: boolean) {
      state.wardrobeOpen = open;
    },
    /** Set the responsive panel mode. */
    setMobileWardrobe(mobile: boolean) {
      state.mobileWardrobe = mobile;
    },
    /** Set the expanded wardrobe layout. */
    setWardrobeExpanded(expanded: boolean) {
      state.wardrobeExpanded = expanded;
    },
    /** Set the requested preset and whether its controls are waiting for assets. */
    setPendingPreset(id: string | null, disabled = false) {
      state.pendingPresetId = id;
      state.outfitControlsDisabled = disabled;
    },
    /** Publish status text and its presentation state. */
    setStatus(text: string, loading: boolean, isError: boolean) {
      state.status = { text, loading, isError };
    },
    /** Publish the offline preparation state. */
    setOfflineStatus(text: string, isError = false) {
      state.offlineStatus = { text, isError };
    },
    /** Disable repeated exports while a download is being prepared. */
    setDownloadPending(pending: boolean) {
      state.downloadPending = pending;
    },
    /** @returns A new token invalidating pending preset selections. */
    nextOutfitSelectionRequest() {
      state.outfitSelectionRequest += 1;
      return state.outfitSelectionRequest;
    },
    /** @returns The latest selection token. */
    getOutfitSelectionRequest() {
      return state.outfitSelectionRequest;
    },
    /** Identify stale async preset loads before committing their look. */
    isCurrentOutfitSelectionRequest(request: number) {
      return request === state.outfitSelectionRequest;
    },
    /** @returns Whether initial preview assets have loaded. */
    isPreviewReady() {
      return state.previewReady;
    },
    /** @param ready - Whether resize may redraw the preview. */
    setPreviewReady(ready: boolean) {
      state.previewReady = ready;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
