<script setup lang="ts">
/**
 * Owns the application shell and stable preview canvas, forwarding UI actions
 * while the composition root owns rendering and browser side effects.
 * @module ui/app-view
 */
import { onMounted, onUnmounted, ref } from "vue";
import type { Store } from "../core/state-store";
import type { Catalog, Category, Item, OutfitPreset, Sprite } from "../types";
import WardrobePanel from "./wardrobe-panel.vue";
import StatusView from "./status-view.vue";
import ResetView from "./reset-view.vue";
import VueStoreSummary from "./vue-store-summary.vue";

defineProps<{
  catalog: Catalog;
  presets: OutfitPreset[];
  store: Store;
  mobileWardrobe: MediaQueryList;
  getSprite: (item: Item) => Sprite | undefined;
}>();

const emit = defineEmits<{
  previewMounted: [preview: HTMLCanvasElement];
  appUnmounted: [];
  categorySelect: [category: Category];
  itemSelect: [item: Item];
  noneSelect: [];
  presetSelect: [id: string];
  adjacentSelect: [step: number];
  reset: [];
  download: [];
}>();

const preview = ref<HTMLCanvasElement | null>(null);
const faviconUrl = "favicon.svg";

onMounted(() => {
  if (!preview.value) {
    throw new Error("The outfit preview canvas did not mount.");
  }
  emit("previewMounted", preview.value);
});
onUnmounted(() => emit("appUnmounted"));
</script>

<template>
  <div class="page-shell">
    <header class="site-header">
      <a
        class="brand"
        href="./"
        aria-label="Ranma 1/2 Dress-up home"
      >
        <img
          class="brand-mark"
          :src="faviconUrl"
          alt=""
        />
        <h1 class="brand-copy">
          <span class="brand-kicker">RANMA 1/2</span>
          <span class="brand-name">Dress-up</span>
        </h1>
      </a>
      <StatusView :store="store" />
      <p class="vue-store-summary">
        <VueStoreSummary :store="store" />
      </p>
      <p
        id="offline-status"
        class="offline-status"
        :class="{ 'is-error': store.state.offlineStatus.isError }"
        role="status"
        aria-live="polite"
        :hidden="!store.state.offlineStatus.text"
      >
        {{ store.state.offlineStatus.text }}
      </p>
      <div class="action-buttons">
        <ResetView @reset="emit('reset')" />
        <button
          id="download-look"
          class="button button-primary"
          type="button"
          :disabled="store.state.downloadPending"
          @click="emit('download')"
        >
          <svg
            class="button-icon"
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
              d="M16 7v12m-4-4 4 4 4-4 M9 23h14"
              fill="none"
              stroke="var(--button-surface)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Save look
        </button>
      </div>
    </header>

    <main class="workspace">
      <section
        class="preview-panel"
        aria-label="Outfit preview"
      >
        <div class="stage-frame">
          <canvas
            id="outfit-preview"
            ref="preview"
            width="1196"
            height="1171"
            role="img"
            aria-label="Preview of the selected Ranma outfit"
          >
            Your browser does not support the outfit preview.
          </canvas>
        </div>
      </section>

      <WardrobePanel
        :catalog="catalog"
        :store="store"
        :presets="presets"
        :mobile-wardrobe="mobileWardrobe"
        :get-sprite="getSprite"
        @category-select="emit('categorySelect', $event)"
        @item-select="emit('itemSelect', $event)"
        @none-select="emit('noneSelect')"
        @preset-select="emit('presetSelect', $event)"
        @adjacent-select="emit('adjacentSelect', $event)"
      />
    </main>
  </div>
</template>
