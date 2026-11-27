/**
 * Mounts the Vue-owned wardrobe island with the shared store and controller actions.
 * Depends on the island component and injected catalog/store/sprite access;
 * exports mountWardrobeIsland for the composition root.
 * @module ui/mount-wardrobe-island
 */

import { createApp } from "vue";
import type { Store } from "../core/state-store";
import type { Catalog, Category, Item, Sprite } from "../types";
import WardrobeIsland from "./wardrobe-island.vue";

/** Mount category and item presentation into its dedicated DOM host. */
export function mountWardrobeIsland({
  container,
  catalog,
  store,
  getSprite,
  onCategorySelect,
  onItemSelect,
  onNoneSelect,
}: {
  container: HTMLElement;
  catalog: Catalog;
  store: Store;
  getSprite: (item: Item) => Sprite | undefined;
  onCategorySelect: (category: Category) => void;
  onItemSelect: (item: Item) => void;
  onNoneSelect: () => void;
}) {
  createApp(WardrobeIsland, {
    catalog,
    store,
    getSprite,
    onCategorySelect,
    onItemSelect,
    onNoneSelect,
  }).mount(container);
}
