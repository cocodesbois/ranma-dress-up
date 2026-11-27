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
import { createPreview } from "./render/create-preview";
import { createStatusController } from "./ui/status-controller";
import { registerOfflineSupport } from "./pwa/register-offline-support";
import AppView from "./ui/app-view.vue";
import type { Sprite } from "./types";

const appRoot = document.querySelector("#app");
if (!(appRoot instanceof HTMLElement)) {
  throw new Error("Missing or invalid element: #app");
}

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

/** Report controller/startup failures both to developers and in the status area. */
function showError(error: unknown) {
  console.error(error);
  statusController.setStatusMessage(error instanceof Error ? error.message : String(error), {
    isError: true,
  });
}

const app = createApp(AppView, {
  catalog,
  store: appState,
  presets: outfitPresets,
  mobileWardrobe,
  getSprite,
  createPreview: (preview: HTMLCanvasElement) =>
    createPreview({
      preview,
      catalog,
      manifest: spriteManifest,
      outfitPresets,
      defaultOutfit,
      appState,
      statusController,
      imageLoader,
      getSprite,
      onError: showError,
    }),
  statusController,
  onError: showError,
});
app.mount(appRoot);
app.onUnmount(registerOfflineSupport(appState));
