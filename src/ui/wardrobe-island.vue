<script setup lang="ts">
/**
 * Renders the wardrobe categories and item cards from the shared reactive store.
 * User actions are delegated to the outfit controller; sprite access stays outside
 * Vue reactivity.
 * @module ui/wardrobe-island
 */

import { computed, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import type { Catalog, Category, Item, Sprite } from "../types";
import type { Store } from "../core/state-store";

const props = defineProps<{
  catalog: Catalog;
  store: Store;
  getSprite: (item: Item) => Sprite | undefined;
}>();
const emit = defineEmits<{
  categorySelect: [category: Category];
  itemSelect: [item: Item];
  noneSelect: [];
}>();

const fallbackItemIds = ref(new Set<string>());
const itemList = ref<HTMLDivElement | null>(null);
const activeCategory = computed(() => props.store.state.activeCategory);
const categoryLoad = computed(() => props.store.state.categoryLoad);
const categoryItems = computed(() =>
  props.catalog.items.filter((item) => item.category === activeCategory.value),
);
const availableItems = computed(() => categoryItems.value.filter((item) => props.getSprite(item)));
const isLoading = computed(
  () =>
    categoryLoad.value.categoryId === activeCategory.value &&
    categoryLoad.value.status === "loading",
);
const isSelected = (item: Item) => props.store.state.outfit[activeCategory.value] === item.id;
const isEquipped = (category: Category["id"]) => props.store.state.outfit[category] != null;
const missingCount = computed(() =>
  categoryLoad.value.categoryId === activeCategory.value ? categoryLoad.value.failedCount : 0,
);
const activeCategoryDetails = computed(() =>
  props.catalog.categories.find((category) => category.id === activeCategory.value),
);

watch(
  () => [categoryLoad.value.request, categoryLoad.value.status] as const,
  ([, status]) => {
    if (status === "ready" && itemList.value) {
      itemList.value.scrollLeft = 0;
      itemList.value.scrollTop = 0;
    }
  },
  { flush: "post" },
);

function markThumbnailMissing(itemId: string) {
  fallbackItemIds.value = new Set(fallbackItemIds.value).add(itemId);
}

function drawThumbnail(element: Element | ComponentPublicInstance | null, item: Item) {
  if (!(element instanceof HTMLCanvasElement)) return;
  const context = element.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create item thumbnails.");
  }
  const sprite = props.getSprite(item);
  if (!sprite) {
    throw new Error(`Image is not loaded: ${item.source}`);
  }

  const { x, y, width: sourceWidth, height: sourceHeight } = item.thumbnail;
  const scale = Math.min(88 / sourceWidth, 88 / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(
    sprite.image,
    (x - sprite.x) * sprite.scale,
    (y - sprite.y) * sprite.scale,
    sourceWidth * sprite.scale,
    sourceHeight * sprite.scale,
    (112 - width) / 2,
    (112 - height) / 2,
    width,
    height,
  );
}

function retryCategoryLoad() {
  const category = activeCategoryDetails.value;
  if (!category) {
    throw new Error(`Unknown category: ${activeCategory.value}`);
  }
  emit("categorySelect", category);
}
</script>

<template>
  <template v-if="props.store.state.previewReady">
    <nav
      id="category-tabs"
      class="category-tabs"
      aria-label="Wardrobe categories"
    >
      <button
        v-for="category in catalog.categories"
        :id="`category-${category.id}`"
        :key="category.id"
        type="button"
        class="category-tab"
        :class="{
          'is-active': category.id === activeCategory,
          'has-equipped-item': isEquipped(category.id),
        }"
        :aria-pressed="category.id === activeCategory"
        :aria-label="isEquipped(category.id) ? `${category.label}, item equipped` : category.label"
        @click="emit('categorySelect', category)"
      >
        <svg
          class="category-equipped-icon"
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="currentColor"
          />
          <path
            d="m9 16 5 5 9-10"
            fill="none"
            stroke="var(--category-surface)"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ category.label }}
      </button>
    </nav>

    <div
      id="item-list"
      ref="itemList"
      class="item-grid"
      aria-label="Items in the selected category"
      :aria-busy="isLoading"
    >
      <template v-if="!isLoading">
        <div
          v-if="missingCount > 0"
          class="item-notice"
          role="alert"
        >
          <span>
            {{
              missingCount === 1
                ? "1 item could not be loaded."
                : `${missingCount} items could not be loaded.`
            }}
          </span>
          <button
            type="button"
            class="button button-secondary"
            @click="retryCategoryLoad"
          >
            Try again
          </button>
        </div>

        <button
          v-if="activeCategory !== 'hair'"
          type="button"
          class="item-card none-card"
          :class="{ 'is-selected': props.store.state.outfit[activeCategory] == null }"
          :aria-pressed="props.store.state.outfit[activeCategory] == null"
          :aria-label="
            props.store.state.outfit[activeCategory] == null
              ? 'No item selected'
              : 'Remove selected item'
          "
          @click="emit('noneSelect')"
        >
          <span
            class="none-symbol"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 32 32"
              focusable="false"
            >
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="currentColor"
              />
              <path
                d="M16 8v8 M10.3 10.3a8 8 0 1 0 11.4 0"
                fill="none"
                stroke="var(--surface-soft)"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="item-label">None</span>
        </button>

        <button
          v-for="item in availableItems"
          :id="`item-${item.id}`"
          :key="item.id"
          type="button"
          class="item-card"
          :class="{ 'is-selected': isSelected(item) }"
          :aria-pressed="isSelected(item)"
          :aria-label="isSelected(item) ? `${item.label}, selected` : item.label"
          @click="emit('itemSelect', item)"
        >
          <img
            v-if="!fallbackItemIds.has(item.id)"
            class="item-thumbnail"
            :src="item.thumbnailSource ?? `images/thumbnails/${item.id}.png`"
            alt=""
            loading="lazy"
            decoding="async"
            @error="markThumbnailMissing(item.id)"
          />
          <canvas
            v-else
            :ref="(element) => drawThumbnail(element, item)"
            class="item-thumbnail"
            width="112"
            height="112"
          />
          <span class="item-label">{{ item.label }}</span>
        </button>
      </template>
    </div>
  </template>
</template>
