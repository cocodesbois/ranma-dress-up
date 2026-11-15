/**
 * Owns synchronous look, panel and loading state without DOM dependencies.
 * Exports createStore; controllers coordinate side effects and rendering.
 * @module core/state-store
 */

import type { Look } from "../types";

/**
 * Create an isolated store, copying the initial look rather than mutating a preset.
 * @returns A store exposing synchronous state accessors and selection tokens.
 */
export function createStore({
  defaultOutfit,
  initialActiveCategory = "tops",
}: {
  defaultOutfit: Look;
  initialActiveCategory?: string;
}) {
  let outfit = { ...defaultOutfit };
  let activeCategory = initialActiveCategory;
  let wardrobeOpen = false;
  let outfitSelectionRequest = 0;
  let previewReady = false;

  return {
    /** @returns The current live map; treat it as read-only outside the store. */
    getOutfit() {
      return outfit;
    },
    /** @param nextOutfit - Replace the live map with a shallow copy. */
    setOutfit(nextOutfit: Look) {
      outfit = { ...nextOutfit };
    },
    /** Set or clear one category without applying controller exclusivity rules. */
    setOutfitItem(category: string, itemId: string | null) {
      outfit[category] = itemId;
    },
    /** @param categories - Categories whose selections become null. */
    clearOutfitItems(categories: string[]) {
      for (const category of categories) {
        outfit[category] = null;
      }
    },
    /** @returns The category currently displayed in the wardrobe. */
    getActiveCategory() {
      return activeCategory;
    },
    /** @param category - Category ID to display. */
    setActiveCategory(category: string) {
      activeCategory = category;
    },
    /** @returns Whether the mobile wardrobe is open. */
    isWardrobeOpen() {
      return wardrobeOpen;
    },
    /** @param open - Desired mobile panel state. */
    setWardrobeOpen(open: boolean) {
      wardrobeOpen = open;
    },
    /** @returns A new token invalidating pending preset selections. */
    nextOutfitSelectionRequest() {
      outfitSelectionRequest += 1;
      return outfitSelectionRequest;
    },
    /** @returns The latest selection token. */
    getOutfitSelectionRequest() {
      return outfitSelectionRequest;
    },
    /** Identify stale async preset loads before committing their look. */
    isCurrentOutfitSelectionRequest(request: number) {
      return request === outfitSelectionRequest;
    },
    /** @returns Whether initial preview assets have loaded. */
    isPreviewReady() {
      return previewReady;
    },
    /** @param ready - Whether resize may redraw the preview. */
    setPreviewReady(ready: boolean) {
      previewReady = ready;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
