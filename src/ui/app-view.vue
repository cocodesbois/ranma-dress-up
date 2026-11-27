<script setup lang="ts">
/**
 * Presents the application shell using services from the composition root.
 * Delegates preview lifecycle and user actions to the app preview composable.
 * @module ui/app-view
 */
import { onUnmounted, watch } from "vue";
import { useAppPreview } from "./use-app-preview";
import type { AppServices } from "./use-app-preview";
import WardrobePanel from "./wardrobe-panel.vue";
import StatusView from "./status-view.vue";
import ResetView from "./reset-view.vue";

const props = defineProps<{ services: AppServices }>();
const { catalog, presets, store, mobileWardrobe, getSprite } = props.services;
const {
  downloadPreview,
  resetOutfit,
  selectCategory,
  selectItem,
  removeActiveCategoryItem,
  selectOutfitById,
  selectAdjacentOutfit,
} = useAppPreview(props.services);
const faviconUrl = "favicon.svg";

watch(
  () => [store.state.wardrobeOpen, store.state.wardrobeExpanded] as const,
  ([open, expanded]) => {
    document.body.classList.toggle("wardrobe-open", open);
    document.body.classList.toggle("wardrobe-expanded", expanded);
  },
  { immediate: true, flush: "sync" },
);
onUnmounted(() => {
  document.body.classList.remove("wardrobe-open", "wardrobe-expanded");
});
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
        <ResetView @reset="resetOutfit" />
        <button
          id="download-look"
          class="button button-primary"
          type="button"
          :disabled="store.state.downloadPending"
          @click="downloadPreview"
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
        @category-select="selectCategory"
        @item-select="selectItem"
        @none-select="removeActiveCategoryItem"
        @preset-select="selectOutfitById"
        @adjacent-select="selectAdjacentOutfit"
      />
    </main>
  </div>
</template>
