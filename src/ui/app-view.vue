<script setup lang="ts">
/**
 * Owns the application shell, canvas lifecycle and download presentation.
 * Receives framework-independent rendering and outfit controllers from the composition root.
 * @module ui/app-view
 */
import { onMounted, onUnmounted, ref } from "vue";
import type { Store } from "../core/state-store";
import type { Catalog, Item, OutfitPreset, Sprite } from "../types";
import type { createCanvasRenderer } from "../render/canvas-renderer";
import type { createOutfitController } from "./outfit-controller";
import type { createStatusController } from "./status-controller";
import WardrobePanel from "./wardrobe-panel.vue";
import StatusView from "./status-view.vue";
import ResetView from "./reset-view.vue";
import VueStoreSummary from "./vue-store-summary.vue";

const props = defineProps<{
  catalog: Catalog;
  presets: OutfitPreset[];
  store: Store;
  mobileWardrobe: MediaQueryList;
  getSprite: (item: Item) => Sprite | undefined;
  createPreview: (preview: HTMLCanvasElement) => {
    renderer: ReturnType<typeof createCanvasRenderer>;
    controller: ReturnType<typeof createOutfitController>;
  };
  statusController: ReturnType<typeof createStatusController>;
  onError: (error: unknown) => void;
}>();

const preview = ref<HTMLCanvasElement | null>(null);
const faviconUrl = "favicon.svg";
let renderer: ReturnType<typeof createCanvasRenderer> | undefined;
let controller: ReturnType<typeof createOutfitController> | undefined;
let resizeObserver: ResizeObserver | undefined;
let stopWatchingDevicePixelRatio: (() => void) | undefined;

function withController(action: (controller: ReturnType<typeof createOutfitController>) => void) {
  if (!controller) {
    props.onError(new Error("The outfit preview is not ready."));
    return;
  }
  action(controller);
}

async function downloadPreview() {
  if (!renderer) {
    props.onError(new Error("The outfit preview is not ready to save."));
    return;
  }
  if (props.store.state.downloadPending) return;
  props.store.setDownloadPending(true);
  try {
    props.statusController.setStatusMessage("Preparing your look...", { loading: true });
    const blob = await renderer.exportPreview();
    if (!blob) {
      props.statusController.setStatusMessage("The preview could not be saved.", { isError: true });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ranma-dress-up.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    props.statusController.setStatusMessage("Your look has been downloaded.");
  } catch (error) {
    props.onError(error);
  } finally {
    props.store.setDownloadPending(false);
  }
}

onMounted(() => {
  try {
    if (!preview.value) {
      throw new Error("The outfit preview canvas did not mount.");
    }
    const setup = props.createPreview(preview.value);
    renderer = setup.renderer;
    controller = setup.controller;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(renderer.resizePreview);
      resizeObserver.observe(preview.value);
    } else {
      window.addEventListener("resize", renderer.resizePreview);
    }
    stopWatchingDevicePixelRatio = renderer.watchDevicePixelRatio();
    renderer.resizePreview();
    controller.startApp().catch(props.onError);
  } catch (error) {
    props.onError(error);
  }
});
onUnmounted(() => {
  resizeObserver?.disconnect();
  if (renderer) window.removeEventListener("resize", renderer.resizePreview);
  stopWatchingDevicePixelRatio?.();
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
        <ResetView @reset="withController((controller) => controller.resetOutfit())" />
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
        @category-select="withController((controller) => void controller.selectCategory($event))"
        @item-select="withController((controller) => controller.selectItem($event))"
        @none-select="withController((controller) => controller.removeActiveCategoryItem())"
        @preset-select="withController((controller) => controller.selectOutfitById($event))"
        @adjacent-select="withController((controller) => controller.selectAdjacentOutfit($event))"
      />
    </main>
  </div>
</template>
