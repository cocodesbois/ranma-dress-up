/**
 * Browser composition root: queries controls and wires catalog, store, renderer
 * and controllers, then binds and starts the app bootstrap.
 * Depends on all runtime modules and the page DOM; exports no public values.
 * @module main
 */

import catalog from "./data/sprite-catalog";
import spriteManifest from "./data/sprite-manifest";
import * as catalogModel from "./core/catalog-model";
import { createStore } from "./core/state-store";
import { createImageLoader } from "./render/image-loader";
import { createCanvasRenderer } from "./render/canvas-renderer";
import { createWardrobeUi } from "./ui/wardrobe-ui";
import { createStatusController } from "./ui/status-controller";
import { createWardrobePanelController } from "./ui/wardrobe-panel-controller";
import { createOutfitController } from "./ui/outfit-controller";
import { createAppBootstrap } from "./app-bootstrap";
import type { Sprite } from "./types";

function requireElement<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing or invalid element: ${selector}`);
  }
  return element;
}

const preview = requireElement("#outfit-preview", HTMLCanvasElement);
const categoryTabs = requireElement("#category-tabs", HTMLElement);
const itemList = requireElement("#item-list", HTMLElement);
const outfitSelect = requireElement("#outfit-select", HTMLSelectElement);
const outfitPreviousButton = requireElement("#outfit-previous", HTMLButtonElement);
const outfitNextButton = requireElement("#outfit-next", HTMLButtonElement);
const statusMessage = requireElement("#status-message", HTMLElement);
const wardrobePanel = requireElement("#wardrobe-panel", HTMLElement);
const wardrobeToggle = requireElement("#wardrobe-toggle", HTMLButtonElement);
const wardrobeClose = requireElement("#wardrobe-close", HTMLButtonElement);
const wardrobeBackdrop = requireElement("#wardrobe-backdrop", HTMLElement);
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const resetButton = requireElement("#reset-look", HTMLButtonElement);
const downloadButton = requireElement("#download-look", HTMLButtonElement);

if (!spriteManifest) {
  throw new Error("Sprite manifest is missing. Run: python scripts/optimize-sprites.py");
}

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = catalogModel.getDefaultOutfitLook(outfitPresets, "005");

if (!defaultOutfit) {
  throw new Error("No complete outfits with a hairstyle are available.");
}

const appState = createStore({
  defaultOutfit,
  initialActiveCategory: "tops",
});

const statusController = createStatusController({
  statusMessage,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton,
});

const imageLoader = createImageLoader({
  outfitPresets,
  manifest: spriteManifest,
  onError: (error) => {
    console.error(error);
  },
});

/**
 * Adapt a catalog layer to the loader's stable PNG source key.
 * @param {{source: string}} item
 * @returns {import("./types").Sprite | undefined}
 */
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

const wardrobePanelController = createWardrobePanelController({
  appState,
  wardrobePanel,
  wardrobeToggle,
  wardrobeClose,
  wardrobeBackdrop,
  mobileWardrobe,
});

let outfitController: ReturnType<typeof createOutfitController>;
const wardrobeUi = createWardrobeUi({
  categoryTabs,
  itemList,
  catalog,
  getActiveCategory: () => appState.getActiveCategory(),
  getOutfit: () => appState.getOutfit(),
  getSprite,
  onCategorySelect: (category) => {
    outfitController.selectCategory(category);
  },
  onItemSelect: (item) => {
    outfitController.selectItem(item);
  },
  onNoneSelect: () => {
    outfitController.removeActiveCategoryItem();
  },
});

/**
 * Report controller/startup failures both to developers and in the status area.
 * @param {Error} error
 * @returns {void}
 */
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
  outfitSelect,
  statusController,
  imageLoader,
  canvasRenderer,
  wardrobeUi,
  onError: showError,
});
const appBootstrap = createAppBootstrap({
  preview,
  resetButton,
  downloadButton,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton,
  outfitController,
  statusController,
  wardrobePanelController,
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
