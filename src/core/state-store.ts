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
    wardrobeOpen: false,
    outfitSelectionRequest: 0,
    previewReady: false,
  });

  return {
    /** Readonly reactive state for Vue-owned views and computed presentation. */
    state: readonly(state),
    /** @returns The current live map; treat it as read-only outside the store. */
    getOutfit() {
      return state.outfit;
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
    /** @returns Whether the mobile wardrobe is open. */
    isWardrobeOpen() {
      return state.wardrobeOpen;
    },
    /** @param open - Desired mobile panel state. */
    setWardrobeOpen(open: boolean) {
      state.wardrobeOpen = open;
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
