const catalog = window.RanmaDressUpCatalog;
const catalogModel = window.RanmaDressUpCatalogModel;
const stateStore = window.RanmaDressUpStateStore;
const imageLoaderModel = window.RanmaDressUpImageLoader;
const canvasRendererModel = window.RanmaDressUpCanvasRenderer;
const wardrobeUiModel = window.RanmaDressUpWardrobeUi;
const statusControllerModel = window.RanmaDressUpStatusController;
const wardrobePanelControllerModel = window.RanmaDressUpWardrobePanelController;
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
const wardrobeUi = wardrobeUiModel.createWardrobeUi({
  categoryTabs,
  itemList,
  catalog,
  getActiveCategory: () => appState.getActiveCategory(),
  getOutfit: () => appState.getOutfit(),
  getImage,
  onCategorySelect: (category) => {
    selectCategory(category);
  },
  onItemSelect: (item) => {
    selectItem(item);
  },
  onNoneSelect: () => {
    removeActiveCategoryItem();
  }
});

function getImage(item) {
  return imageLoader.getImage(item.source);
}

function updateOutfitSelection() {
  const matchingOutfit = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
  outfitSelect.value = matchingOutfit ? String(matchingOutfit.id) : "";
}

function selectItem(item) {
  appState.nextOutfitSelectionRequest();
  const mutuallyExclusiveCategories = {
    bodysuits: ["tops", "pants", "dresses"],
    tops: ["bodysuits"],
    pants: ["bodysuits", "dresses"],
    dresses: ["bodysuits", "pants"]
  };
  appState.clearOutfitItems(mutuallyExclusiveCategories[appState.getActiveCategory()] ?? []);
  appState.setOutfitItem(appState.getActiveCategory(), item.id);
  updateOutfitSelection();
  wardrobeUi.updateItemSelection();
  canvasRenderer.drawOutfit();
  statusController.setStatusMessage(`${item.label} selected.`);
}

function removeActiveCategoryItem() {
  appState.nextOutfitSelectionRequest();
  appState.setOutfitItem(appState.getActiveCategory(), null);
  updateOutfitSelection();
  wardrobeUi.updateItemSelection();
  canvasRenderer.drawOutfit();
  statusController.setStatusMessage("Item removed.");
}

async function selectCategory(category) {
  appState.setActiveCategory(category.id);
  wardrobeUi.renderCategories();
  itemList.replaceChildren();
  statusController.setStatusMessage(`Loading ${category.label.toLowerCase()}...`, { loading: true });

  try {
    const items = catalog.items.filter((entry) => entry.category === category.id);
    await Promise.all(items.map((item) => imageLoader.loadImage(item.source)));
    if (appState.getActiveCategory() !== category.id) {
      return;
    }

    wardrobeUi.renderItems();
    statusController.setStatusMessage(`${category.label} selected.`);
  } catch (error) {
    showError(error);
  }
}

async function selectOutfit(preset) {
  const request = appState.nextOutfitSelectionRequest();
  const missingSources = imageLoader.getMissingSourcesForPreset(preset);

  try {
    if (missingSources.length) {
      statusController.setStatusMessage(`Loading ${preset.label.toLowerCase()}...`, { loading: true });
      statusController.setOutfitControlsDisabled(true);
      await Promise.all(missingSources.map((source) => imageLoader.loadImage(source)));
    }

    if (!appState.isCurrentOutfitSelectionRequest(request)) {
      return;
    }

    appState.setOutfit(preset.look);
    updateOutfitSelection();
    wardrobeUi.renderCategories();
    wardrobeUi.renderItems();
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage(`${preset.label} selected.`);
    imageLoader.preloadAdjacentOutfits(preset);
  } catch (error) {
    showError(error);
  } finally {
    if (appState.isCurrentOutfitSelectionRequest(request)) {
      statusController.setOutfitControlsDisabled(false);
    }
  }
}

function getPresetIndexByCurrentSelection() {
  if (outfitSelect.value) {
    const selectedIndex = outfitPresets.findIndex((preset) =>
      String(preset.id) === outfitSelect.value
    );
    if (selectedIndex >= 0) {
      return selectedIndex;
    }
  }

  const matchingPreset = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
  if (matchingPreset) {
    return outfitPresets.findIndex((preset) => String(preset.id) === String(matchingPreset.id));
  }

  return -1;
}

function selectAdjacentOutfit(step) {
  if (!outfitPresets.length) {
    return;
  }

  const currentIndex = getPresetIndexByCurrentSelection();
  const nextIndex = currentIndex < 0
    ? (step > 0 ? 0 : outfitPresets.length - 1)
    : (currentIndex + step + outfitPresets.length) % outfitPresets.length;
  const preset = outfitPresets[nextIndex];
  if (preset) {
    selectOutfit(preset);
  }
}

function showError(error) {
  console.error(error);
  statusController.setStatusMessage(error.message, { isError: true });
}

function resetOutfit() {
  appState.nextOutfitSelectionRequest();
  appState.setOutfit(defaultOutfit);
  appState.setActiveCategory("tops");
  updateOutfitSelection();
  wardrobeUi.renderCategories();
  wardrobeUi.renderItems();
  canvasRenderer.drawOutfit();
  statusController.setStatusMessage("The original look has been restored.");
}

function downloadPreview() {
  preview.toBlob((blob) => {
    if (!blob) {
      statusController.setStatusMessage("The preview could not be saved.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ranma-dress-up.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    statusController.setStatusMessage("Your look has been downloaded.");
  }, "image/png");
}

async function startApp() {
  statusController.setStatusMessage("Loading the wardrobe...", { loading: true });
  const initialSources = new Set([
    catalog.background.source,
    catalog.base.source,
    ...catalog.items
      .filter((item) => appState.getOutfit()[item.category] === item.id)
      .map((item) => item.source),
    ...catalog.items
      .filter((item) => item.category === appState.getActiveCategory())
      .map((item) => item.source)
  ]);

  await Promise.all([...initialSources].map((source) => imageLoader.loadImage(source)));
  for (const preset of outfitPresets) {
    const option = document.createElement("option");
    option.value = String(preset.id);
    option.textContent = preset.label;
    outfitSelect.append(option);
  }
  updateOutfitSelection();
  wardrobeUi.renderCategories();
  wardrobeUi.renderItems();
  appState.setPreviewReady(true);
  canvasRenderer.drawOutfit();
  statusController.setStatusMessage("Choose an item to style the character.");
  const selectedPreset = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
  if (selectedPreset) {
    imageLoader.preloadAdjacentOutfits(selectedPreset);
  }
  imageLoader.preloadAllOutfitsInBackground();
}

document.querySelector("#reset-look").addEventListener("click", resetOutfit);
document.querySelector("#download-look").addEventListener("click", downloadPreview);
outfitSelect.addEventListener("change", () => {
  const preset = catalogModel.findPresetById(outfitPresets, outfitSelect.value);
  if (preset) {
    selectOutfit(preset);
  }
});
outfitPreviousButton.addEventListener("click", () => selectAdjacentOutfit(-1));
outfitNextButton.addEventListener("click", () => selectAdjacentOutfit(1));
wardrobePanelController.bindEvents();

wardrobePanelController.syncWardrobeMode();
if ("ResizeObserver" in window) {
  new ResizeObserver(canvasRenderer.resizePreview).observe(preview);
} else {
  window.addEventListener("resize", canvasRenderer.resizePreview);
}
canvasRenderer.watchDevicePixelRatio();
canvasRenderer.resizePreview();
startApp().catch((error) => {
  showError(error);
});
