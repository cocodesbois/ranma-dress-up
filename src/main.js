import catalog from "./data/sprite-catalog.js";
import spriteManifest from "./data/sprite-manifest.js";
import * as catalogModel from "./core/catalog-model.js";
import { createStore } from "./core/state-store.js";
import { createImageLoader } from "./render/image-loader.js";
import { createCanvasRenderer } from "./render/canvas-renderer.js";
import { createWardrobeUi } from "./ui/wardrobe-ui.js";
import { createStatusController } from "./ui/status-controller.js";
import { createWardrobePanelController } from "./ui/wardrobe-panel-controller.js";
import { createOutfitController } from "./ui/outfit-controller.js";
import { createAppBootstrap } from "./app-bootstrap.js";

const preview = document.querySelector("#outfit-preview");
const categoryTabs = document.querySelector("#category-tabs");
const itemList = document.querySelector("#item-list");
const outfitSelect = document.querySelector("#outfit-select");
const outfitPreviousButton = document.querySelector("#outfit-previous");
const outfitNextButton = document.querySelector("#outfit-next");
const statusMessage = document.querySelector("#status-message");
const wardrobePanel = document.querySelector("#wardrobe-panel");
const wardrobeToggle = document.querySelector("#wardrobe-toggle");
const wardrobeClose = document.querySelector("#wardrobe-close");
const wardrobeBackdrop = document.querySelector("#wardrobe-backdrop");
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const resetButton = document.querySelector("#reset-look");
const downloadButton = document.querySelector("#download-look");

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

function getSprite(item) {
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

let outfitController;
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

function showError(error) {
  console.error(error);
  statusController.setStatusMessage(error.message, { isError: true });
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
