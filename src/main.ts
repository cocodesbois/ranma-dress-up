/**
 * Browser composition root: creates shared state and collaborators, then wires
 * the Vue-owned application shell to controllers and mounted canvas lifecycle.
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
import AppView from "./ui/app-view.vue";
import { createAppBootstrap } from "./app-bootstrap";
import type { Category, Item, Sprite } from "./types";

function requireElement<T extends HTMLElement>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing or invalid element: ${selector}`);
  }
  return element;
}

const appRoot = requireElement("#app", HTMLElement);

if (!spriteManifest) {
  throw new Error("Sprite manifest is missing. Run: python scripts/optimize-sprites.py");
}

const outfitPresets = catalogModel.createOutfitPresets(catalog);
function getDefaultOutfit() {
  const defaultLook = catalogModel.getDefaultOutfitLook(outfitPresets, "001");
  if (!defaultLook) {
    throw new Error("No complete outfits with a hairstyle are available.");
  }
  return defaultLook;
}
const defaultOutfit = getDefaultOutfit();

const appState = createStore({
  defaultOutfit,
  initialActiveCategory: "tops",
});
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const statusController = createStatusController(appState);
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

let outfitController: ReturnType<typeof createOutfitController>;
let appBootstrap: ReturnType<typeof createAppBootstrap> | undefined;
let disposeOfflineSupport: (() => void) | undefined;
let previewInitialized = false;

/** Report controller/startup failures both to developers and in the status area. */
function showError(error: unknown) {
  console.error(error);
  statusController.setStatusMessage(error instanceof Error ? error.message : String(error), {
    isError: true,
  });
}

/** Initialize drawing only after Vue has mounted its stable preview canvas. */
function initializePreview(preview: HTMLCanvasElement) {
  if (previewInitialized) {
    showError(new Error("The outfit preview canvas was initialized more than once."));
    return;
  }
  previewInitialized = true;

  try {
    const canvasRenderer = createCanvasRenderer({
      preview,
      catalog,
      manifest: spriteManifest,
      getSprite,
      getOutfit: () => appState.getOutfit(),
      isPreviewReady: () => appState.isPreviewReady(),
    });

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

    appBootstrap = createAppBootstrap({
      preview,
      outfitController,
      statusController,
      canvasRenderer,
      onError: showError,
      isDownloadPending: () => appState.state.downloadPending,
      setDownloadPending: appState.setDownloadPending,
    });
    appBootstrap.start();
  } catch (error) {
    showError(error);
  }
}

/** Run an action only after the mounted preview has completed controller setup. */
function withOutfitController(
  action: (controller: ReturnType<typeof createOutfitController>) => void,
) {
  if (!outfitController) {
    showError(new Error("The outfit preview is not ready."));
    return;
  }
  action(outfitController);
}

/** Register offline support and report its progress in Vue-owned state. */
function registerOfflineSupport() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return () => {};
  }

  let disposed = false;
  let worker: ServiceWorker | undefined;
  let workerStateListener: (() => void) | undefined;

  function clearWorkerListener() {
    if (worker && workerStateListener) {
      worker.removeEventListener("statechange", workerStateListener);
    }
    worker = undefined;
    workerStateListener = undefined;
  }

  function showOfflineError(error: unknown) {
    console.error("Could not prepare the offline app:", error);
    if (!disposed) {
      appState.setOfflineStatus("Offline setup failed. Reconnect and reload to try again.", true);
    }
  }

  function prepareOfflineAccess() {
    if (disposed) return;
    appState.setOfflineStatus("Preparing offline access...");
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        worker = registration.installing ?? undefined;
        if (worker && !registration.active) {
          workerStateListener = () => {
            if (worker?.state === "redundant" && !registration.active) {
              showOfflineError(new Error("Service worker installation failed."));
            }
          };
          worker.addEventListener("statechange", workerStateListener);
        }
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        clearWorkerListener();
        if (!disposed) appState.setOfflineStatus("Ready to use offline.");
      })
      .catch((error: unknown) => {
        clearWorkerListener();
        showOfflineError(error);
      });
  }

  window.addEventListener("load", prepareOfflineAccess, { once: true });
  return () => {
    disposed = true;
    window.removeEventListener("load", prepareOfflineAccess);
    clearWorkerListener();
  };
}

const app = createApp(AppView, {
  catalog,
  store: appState,
  presets: outfitPresets,
  mobileWardrobe,
  getSprite,
  onPreviewMounted: initializePreview,
  onAppUnmounted: () => {
    appBootstrap?.dispose();
    appBootstrap = undefined;
    disposeOfflineSupport?.();
    disposeOfflineSupport = undefined;
  },
  onCategorySelect: (category: Category) =>
    withOutfitController((controller) => void controller.selectCategory(category)),
  onItemSelect: (item: Item) => withOutfitController((controller) => controller.selectItem(item)),
  onNoneSelect: () => withOutfitController((controller) => controller.removeActiveCategoryItem()),
  onPresetSelect: (id: string) =>
    withOutfitController((controller) => controller.selectOutfitById(id)),
  onAdjacentSelect: (step: number) =>
    withOutfitController((controller) => controller.selectAdjacentOutfit(step)),
  onReset: () => withOutfitController((controller) => controller.resetOutfit()),
  onDownload: () => {
    if (!appBootstrap) {
      showError(new Error("The outfit preview is not ready to save."));
      return;
    }
    void appBootstrap.downloadPreview();
  },
});
app.mount(appRoot);
disposeOfflineSupport = registerOfflineSupport();
