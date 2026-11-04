const catalog = window.RanmaDressUpCatalog;
const catalogModel = window.RanmaDressUpCatalogModel;
const stateStore = window.RanmaDressUpStateStore;
const imageLoaderModel = window.RanmaDressUpImageLoader;
const canvasRendererModel = window.RanmaDressUpCanvasRenderer;
const wardrobeUiModel = window.RanmaDressUpWardrobeUi;
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

function setStatusMessage(text, { loading = false, isError = false } = {}) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle("is-loading", loading);
  statusMessage.classList.toggle("is-error", isError);
}

function setOutfitControlsDisabled(disabled) {
  outfitSelect.disabled = disabled;
  outfitPreviousButton.disabled = disabled;
  outfitNextButton.disabled = disabled;
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
  setStatusMessage(`${item.label} selected.`);
}

function removeActiveCategoryItem() {
  appState.nextOutfitSelectionRequest();
  appState.setOutfitItem(appState.getActiveCategory(), null);
  updateOutfitSelection();
  wardrobeUi.updateItemSelection();
  canvasRenderer.drawOutfit();
  setStatusMessage("Item removed.");
}

async function selectCategory(category) {
  appState.setActiveCategory(category.id);
  wardrobeUi.renderCategories();
  itemList.replaceChildren();
  setStatusMessage(`Loading ${category.label.toLowerCase()}...`, { loading: true });

  try {
    const items = catalog.items.filter((entry) => entry.category === category.id);
    await Promise.all(items.map((item) => imageLoader.loadImage(item.source)));
    if (appState.getActiveCategory() !== category.id) {
      return;
    }

    wardrobeUi.renderItems();
    setStatusMessage(`${category.label} selected.`);
  } catch (error) {
    showError(error);
  }
}

async function selectOutfit(preset) {
  const request = appState.nextOutfitSelectionRequest();
  const missingSources = imageLoader.getMissingSourcesForPreset(preset);

  try {
    if (missingSources.length) {
      setStatusMessage(`Loading ${preset.label.toLowerCase()}...`, { loading: true });
      setOutfitControlsDisabled(true);
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
    setStatusMessage(`${preset.label} selected.`);
    imageLoader.preloadAdjacentOutfits(preset);
  } catch (error) {
    showError(error);
  } finally {
    if (appState.isCurrentOutfitSelectionRequest(request)) {
      setOutfitControlsDisabled(false);
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
  setStatusMessage(error.message, { isError: true });
}

function syncWardrobeMode() {
  if (!mobileWardrobe.matches) {
    appState.setWardrobeOpen(false);
  }

  const hidden = mobileWardrobe.matches && !appState.isWardrobeOpen();
  wardrobePanel.inert = hidden;
  wardrobePanel.setAttribute("aria-hidden", String(hidden));
  wardrobeToggle.setAttribute("aria-expanded", String(appState.isWardrobeOpen()));
  wardrobeBackdrop.inert = !appState.isWardrobeOpen();
  document.body.classList.toggle("wardrobe-open", appState.isWardrobeOpen());

  if (mobileWardrobe.matches) {
    wardrobePanel.setAttribute("role", "dialog");
    wardrobePanel.setAttribute("aria-modal", String(appState.isWardrobeOpen()));
  } else {
    wardrobePanel.removeAttribute("role");
    wardrobePanel.removeAttribute("aria-modal");
    wardrobePanel.removeAttribute("aria-hidden");
  }
}

function setWardrobeOpen(open, returnFocus = true) {
  if (!mobileWardrobe.matches) {
    return;
  }

  appState.setWardrobeOpen(open);
  syncWardrobeMode();

  if (open) {
    wardrobeClose.focus();
  } else if (returnFocus) {
    wardrobeToggle.focus();
  }
}

function resetOutfit() {
  appState.nextOutfitSelectionRequest();
  appState.setOutfit(defaultOutfit);
  appState.setActiveCategory("tops");
  updateOutfitSelection();
  wardrobeUi.renderCategories();
  wardrobeUi.renderItems();
  canvasRenderer.drawOutfit();
  setStatusMessage("The original look has been restored.");
}

function downloadPreview() {
  preview.toBlob((blob) => {
    if (!blob) {
      setStatusMessage("The preview could not be saved.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ranma-dress-up.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMessage("Your look has been downloaded.");
  }, "image/png");
}

async function startApp() {
  setStatusMessage("Loading the wardrobe...", { loading: true });
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
  setStatusMessage("Choose an item to style the character.");
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
wardrobeToggle.addEventListener("click", () => setWardrobeOpen(true));
wardrobeClose.addEventListener("click", () => setWardrobeOpen(false));
wardrobeBackdrop.addEventListener("click", () => setWardrobeOpen(false));
mobileWardrobe.addEventListener("change", () => syncWardrobeMode());
document.addEventListener("keydown", (event) => {
  if (!appState.isWardrobeOpen()) {
    return;
  }

  if (event.key === "Escape") {
    setWardrobeOpen(false);
    return;
  }

  if (event.key === "Tab") {
    const focusable = wardrobePanel.querySelectorAll("button:not(:disabled)");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

syncWardrobeMode();
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
