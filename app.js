const catalog = window.RanmaDressUpCatalog;
const catalogModel = window.RanmaDressUpCatalogModel;
const stateStore = window.RanmaDressUpStateStore;
const imageLoaderModel = window.RanmaDressUpImageLoader;
const canvasRendererModel = window.RanmaDressUpCanvasRenderer;
const wardrobeUiModel = window.RanmaDressUpWardrobeUi;
const statusControllerModel = window.RanmaDressUpStatusController;
const wardrobePanelControllerModel = window.RanmaDressUpWardrobePanelController;
const outfitControllerModel = window.RanmaDressUpOutfitController;
const appBootstrapModel = window.RanmaDressUpAppBootstrap;

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

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = catalogModel.getDefaultOutfitLook(outfitPresets, "005");

if (!defaultOutfit) {
  throw new Error("No complete outfits with a hairstyle are available.");
}

const appState = stateStore.createStore({
  defaultOutfit,
  initialActiveCategory: "tops"
});

const statusController = statusControllerModel.createStatusController({
  statusMessage,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton
});

const imageLoader = imageLoaderModel.createImageLoader({
  outfitPresets,
  onError: (error) => {
    console.error(error);
  }
});

function getImage(item) {
  return imageLoader.getImage(item.source);
}

const canvasRenderer = canvasRendererModel.createCanvasRenderer({
  preview,
  catalog,
  getImage,
  getOutfit: () => appState.getOutfit(),
  isPreviewReady: () => appState.isPreviewReady()
});

const wardrobePanelController = wardrobePanelControllerModel.createWardrobePanelController({
  appState,
  wardrobePanel,
  wardrobeToggle,
  wardrobeClose,
  wardrobeBackdrop,
  mobileWardrobe
});

let outfitController;
const wardrobeUi = wardrobeUiModel.createWardrobeUi({
  categoryTabs,
  itemList,
  catalog,
  getActiveCategory: () => appState.getActiveCategory(),
  getOutfit: () => appState.getOutfit(),
  getImage,
  onCategorySelect: (category) => {
    outfitController.selectCategory(category);
  },
  onItemSelect: (item) => {
    outfitController.selectItem(item);
  },
  onNoneSelect: () => {
    outfitController.removeActiveCategoryItem();
  }
});

function showError(error) {
  console.error(error);
  statusController.setStatusMessage(error.message, { isError: true });
}

outfitController = outfitControllerModel.createOutfitController({
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
  onError: showError
});
const appBootstrap = appBootstrapModel.createAppBootstrap({
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
  onError: showError
});

appBootstrap.bindEvents();
appBootstrap.start();
