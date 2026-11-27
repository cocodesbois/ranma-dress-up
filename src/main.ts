/**
 * Browser composition root: queries controls and wires catalog, store, renderer
 * and controllers, then binds and starts the app bootstrap.
 * Depends on all runtime modules and the page DOM; exports no public values.
 * @module main
 */

import catalog from "./data/sprite-catalog";
import spriteManifest from "./data/sprite-manifest";
import { createApp } from "vue";
import * as catalogModel from "./core/catalog-model";
import { createStore } from "./core/state-store";
import { createImageLoader } from "./render/image-loader";
import { createCanvasRenderer } from "./render/canvas-renderer";
import { createStatusController } from "./ui/status-controller";
import { createOutfitController } from "./ui/outfit-controller";
import WardrobePanel from "./ui/wardrobe-panel.vue";
import StatusView from "./ui/status-view.vue";
import ResetView from "./ui/reset-view.vue";
import VueStoreSummary from "./ui/vue-store-summary.vue";
import { createAppBootstrap } from "./app-bootstrap";
import type { Category, Item, Sprite } from "./types";

function requireElement<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing or invalid element: ${selector}`);
  }
  return element;
}

const preview = requireElement("#outfit-preview", HTMLCanvasElement);
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const downloadButton = requireElement("#download-look", HTMLButtonElement);

if (!spriteManifest) {
  throw new Error("Sprite manifest is missing. Run: python scripts/optimize-sprites.py");
}

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = catalogModel.getDefaultOutfitLook(outfitPresets, "001");

if (!defaultOutfit) {
  throw new Error("No complete outfits with a hairstyle are available.");
}

const appState = createStore({
  defaultOutfit,
  initialActiveCategory: "tops",
});
createApp(VueStoreSummary, { store: appState }).mount(
  requireElement("#vue-store-summary", HTMLElement),
);

const statusController = createStatusController(appState);
createApp(StatusView, { store: appState }).mount(requireElement("#status-view", HTMLElement));

const imageLoader = createImageLoader({
  outfitPresets,
  manifest: spriteManifest,
  onError: (error) => {
    console.error(error);
  },
});

/** Adapt a catalog layer to the loader's stable PNG source key. */
function getSprite(item: { source: string }): Sprite | undefined {
  return imageLoader.getSprite(item.source);
}

const canvasRenderer = createCanvasRenderer({
  preview,
  catalog,
  manifest: spriteManifest,
  getSprite,
  getOutfit: () => appState.getOutfit(),
  isPreviewReady: () => appState.isPreviewReady(),
});

let outfitController: ReturnType<typeof createOutfitController>;

/** Report controller/startup failures both to developers and in the status area. */
function showError(error: unknown) {
  console.error(error);
  statusController.setStatusMessage(error instanceof Error ? error.message : String(error), {
    isError: true,
  });
}

outfitController = createOutfitController({
  catalog,
  catalogModel,
  outfitPresets,
  defaultOutfit,
  appState,
  statusController,
  imageLoader,
  canvasRenderer,
  onError: showError,
});
createApp(ResetView, { onReset: () => outfitController.resetOutfit() }).mount(
  requireElement("#reset-view", HTMLElement),
);
createApp(WardrobePanel, {
  catalog,
  store: appState,
  presets: outfitPresets,
  mobileWardrobe,
  getSprite,
  onCategorySelect: (category: Category) => outfitController.selectCategory(category),
  onItemSelect: (item: Item) => outfitController.selectItem(item),
  onNoneSelect: () => outfitController.removeActiveCategoryItem(),
  onPresetSelect: (id: string) => outfitController.selectOutfitById(id),
  onAdjacentSelect: (step: number) => outfitController.selectAdjacentOutfit(step),
}).mount(requireElement("#wardrobe-view", HTMLElement));
const appBootstrap = createAppBootstrap({
  preview,
  downloadButton,
  outfitController,
  statusController,
  canvasRenderer,
  onError: showError,
});

appBootstrap.bindEvents();
appBootstrap.start();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const offlineStatus = requireElement("#offline-status", HTMLElement);
  const showOfflineError = (error: unknown) => {
    console.error("Could not prepare the offline app:", error);
    offlineStatus.textContent = "Offline setup failed. Reconnect and reload to try again.";
    offlineStatus.classList.add("is-error");
    offlineStatus.hidden = false;
  };

  window.addEventListener("load", () => {
    offlineStatus.textContent = "Preparing offline access...";
    offlineStatus.hidden = false;
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        const worker = registration.installing;
        if (worker && !registration.active) {
          worker.addEventListener("statechange", () => {
            if (worker.state === "redundant" && !registration.active) {
              showOfflineError(new Error("Service worker installation failed."));
            }
          });
        }
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        offlineStatus.textContent = "Ready to use offline.";
        offlineStatus.classList.remove("is-error");
      })
      .catch(showOfflineError);
  });
}
