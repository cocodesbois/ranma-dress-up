/**
 * Owns synchronous look, panel and loading state without DOM dependencies.
 * Exports createStore; controllers coordinate side effects and rendering.
 * @module core/state-store
 */

import type { Look } from "../types";

/**
 * Create an isolated store, copying the initial look rather than mutating a preset.
 * @param {{defaultOutfit: Look, initialActiveCategory?: string}} options
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
    /** @returns {Look} The current live map; treat it as read-only outside the store. */
    getOutfit() {
      return outfit;
    },
    /** @param {Look} nextOutfit Replace the live map with a shallow copy. */
    setOutfit(nextOutfit: Look) {
      outfit = { ...nextOutfit };
    },
    /**
     * Set or clear one category without applying controller exclusivity rules.
     * @param {string} category
     * @param {string | null} itemId
     */
    setOutfitItem(category: string, itemId: string | null) {
      outfit[category] = itemId;
    },
    /** @param {string[]} categories Categories whose selections become null. */
    clearOutfitItems(categories: string[]) {
      for (const category of categories) {
        outfit[category] = null;
      }
    },
    /** @returns {string} The category currently displayed in the wardrobe. */
    getActiveCategory() {
      return activeCategory;
    },
    /** @param {string} category Category ID to display. */
    setActiveCategory(category: string) {
      activeCategory = category;
    },
    /** @returns {boolean} Whether the mobile wardrobe is open. */
    isWardrobeOpen() {
      return wardrobeOpen;
    },
    /** @param {boolean} open Desired mobile panel state. */
    setWardrobeOpen(open: boolean) {
      wardrobeOpen = open;
    },
    /** @returns {number} A new token invalidating pending preset selections. */
    nextOutfitSelectionRequest() {
      outfitSelectionRequest += 1;
      return outfitSelectionRequest;
    },
    /** @returns {number} The latest selection token. */
    getOutfitSelectionRequest() {
      return outfitSelectionRequest;
    },
    /**
     * Identify stale async preset loads before committing their look.
     * @param {number} request
     * @returns {boolean}
     */
    isCurrentOutfitSelectionRequest(request: number) {
      return request === outfitSelectionRequest;
    },
    /** @returns {boolean} Whether initial preview assets have loaded. */
    isPreviewReady() {
      return previewReady;
    },
    /** @param {boolean} ready Whether resize may redraw the preview. */
    setPreviewReady(ready: boolean) {
      previewReady = ready;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
