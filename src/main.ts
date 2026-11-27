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
import { createImageLoader, createSpriteLookup } from "./render/image-loader";
import { createPreviewFactory } from "./render/create-preview";
import { createErrorReporter, createStatusController } from "./ui/status-controller";
import { registerOfflineSupport } from "./pwa/register-offline-support";
import AppView from "./ui/app-view.vue";

const appRoot = document.querySelector("#app");
if (!(appRoot instanceof HTMLElement)) {
  throw new Error("Missing or invalid element: #app");
}

if (!spriteManifest) {
  throw new Error("Sprite manifest is missing. Run: python scripts/optimize-sprites.py");
}

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = catalogModel.requireDefaultOutfitLook(outfitPresets, "001");

const appState = createStore({
  defaultOutfit,
  initialActiveCategory: "tops",
});
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const statusController = createStatusController(appState);
const imageLoader = createImageLoader({
  outfitPresets,
  manifest: spriteManifest,
});
const getSprite = createSpriteLookup(imageLoader);
const showError = createErrorReporter(statusController);

const app = createApp(AppView, {
  catalog,
  store: appState,
  presets: outfitPresets,
  mobileWardrobe,
  getSprite,
  createPreview: createPreviewFactory({
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
