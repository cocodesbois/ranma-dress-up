const catalog = window.RanmaDressUpCatalog;
const catalogModel = window.RanmaDressUpCatalogModel;
const stateStore = window.RanmaDressUpStateStore;
const imageLoaderModel = window.RanmaDressUpImageLoader;
const preview = document.querySelector("#outfit-preview");
const previewContext = preview.getContext("2d");
const previewWidth = 960;
const previewHeight = 1080;
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

if (!previewContext) {
  throw new Error("This browser does not support the canvas preview.");
}

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

function drawItem(context, item, offsetX = 0) {
  const image = getImage(item);
  const { x, y, scale, regX, regY } = item.placement;
  const left = x - regX * scale + offsetX;
  const top = y - regY * scale;

  context.drawImage(image, left, top, image.naturalWidth * scale, image.naturalHeight * scale);
}

function drawBackground(context) {
  const image = getImage(catalog.background);
  const scale = Math.max(previewWidth / image.naturalWidth, previewHeight / image.naturalHeight);
  const sourceWidth = previewWidth / scale;
  const sourceHeight = previewHeight / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    previewWidth,
    previewHeight
  );
}

function drawOutfit() {
  const context = previewContext;
  context.clearRect(0, 0, previewWidth, previewHeight);
  drawBackground(context);

  context.fillStyle = "rgba(65, 47, 39, 0.14)";
  context.beginPath();
  context.ellipse(480, 969, 145, 17, 0, 0, Math.PI * 2);
  context.fill();

  drawItem(context, catalog.base, -480);

  const layerOrder = [
    "underwear",
    "slips",
    "tights",
    "bodysuits",
    "pants",
    "tops",
    "shoes",
    "dresses",
    "hair",
    "hats",
    "necklace",
    "bracelets",
    "accessories"
  ];

  for (const category of layerOrder) {
    const selectedId = appState.getOutfit()[category];
    if (!selectedId) {
      continue;
    }

    const item = catalog.items.find((entry) => entry.id === selectedId);
    if (!item) {
      throw new Error(`Unknown outfit item: ${selectedId}.`);
    }

    drawItem(context, item, -480);
  }
}

function resizePreview() {
  const bounds = preview.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(bounds.width * pixelRatio));
  const height = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (preview.width !== width || preview.height !== height) {
    preview.width = width;
    preview.height = height;
  }

  previewContext.setTransform(width / previewWidth, 0, 0, height / previewHeight, 0, 0);
  if (appState.isPreviewReady()) {
    drawOutfit();
  }
}

function watchDevicePixelRatio() {
  const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mediaQuery.addEventListener("change", () => {
    resizePreview();
    watchDevicePixelRatio();
  }, { once: true });
}

function makeThumbnail(item) {
  const canvas = document.createElement("canvas");
  canvas.className = "item-thumbnail";
  canvas.width = 112;
  canvas.height = 112;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create item thumbnails.");
  }

  const image = getImage(item);
  const { x, y, width: sourceWidth, height: sourceHeight } = item.thumbnail;
  const scale = Math.min(88 / sourceWidth, 88 / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(
    image,
    x,
    y,
    sourceWidth,
    sourceHeight,
    (112 - width) / 2,
    (112 - height) / 2,
    width,
    height
  );
  return canvas;
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
  updateItemSelection();
  drawOutfit();
  setStatusMessage(`${item.label} selected.`);
}

function makeItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item-card";
  button.dataset.itemId = item.id;
  button.setAttribute("aria-label", item.label);

  button.append(makeThumbnail(item));
  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent = item.label;
  button.append(label);
  button.addEventListener("click", () => selectItem(item));
  return button;
}

function makeNoneButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item-card none-card";
  button.dataset.none = "true";
  button.setAttribute("aria-label", "No item selected");

  const symbol = document.createElement("span");
  symbol.className = "none-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = "x";
  button.append(symbol);

  const label = document.createElement("span");
  label.className = "item-label";
  label.textContent = "None";
  button.append(label);
  button.addEventListener("click", () => {
    appState.nextOutfitSelectionRequest();
    appState.setOutfitItem(appState.getActiveCategory(), null);
    updateOutfitSelection();
    updateItemSelection();
    drawOutfit();
    setStatusMessage("Item removed.");
  });
  return button;
}

function renderCategories() {
  if (categoryTabs.childElementCount === 0) {
    for (const category of catalog.categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.dataset.category = category.id;
      button.textContent = category.label;

      button.addEventListener("click", () => {
        selectCategory(category);
      });
      categoryTabs.append(button);
    }
  }

  for (const button of categoryTabs.querySelectorAll(".category-tab")) {
    const selected = button.dataset.category === appState.getActiveCategory();
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

async function selectCategory(category) {
  appState.setActiveCategory(category.id);
  renderCategories();
  itemList.replaceChildren();
  setStatusMessage(`Loading ${category.label.toLowerCase()}...`, { loading: true });

  try {
    const items = catalog.items.filter((entry) => entry.category === category.id);
    await Promise.all(items.map((item) => imageLoader.loadImage(item.source)));
    if (appState.getActiveCategory() !== category.id) {
      return;
    }

    renderItems();
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
    renderCategories();
    renderItems();
    drawOutfit();
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

function renderItems() {
  itemList.replaceChildren();
  if (appState.getActiveCategory() !== "hair") {
    itemList.append(makeNoneButton());
  }

  for (const item of catalog.items.filter((entry) => entry.category === appState.getActiveCategory())) {
    itemList.append(makeItemButton(item));
  }
  updateItemSelection();
}

function updateItemSelection() {
  for (const button of itemList.querySelectorAll(".item-card")) {
    const selected = button.dataset.none === "true"
      ? appState.getOutfit()[appState.getActiveCategory()] === null
      : appState.getOutfit()[appState.getActiveCategory()] === button.dataset.itemId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));

    if (button.dataset.none === "true") {
      button.setAttribute("aria-label", selected ? "No item selected" : "Remove selected item");
    } else if (selected) {
      button.setAttribute("aria-label", `${button.dataset.itemId}, selected`);
    } else {
      button.setAttribute("aria-label", button.querySelector(".item-label").textContent);
    }
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
  renderCategories();
  renderItems();
  drawOutfit();
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
  renderCategories();
  renderItems();
  appState.setPreviewReady(true);
  drawOutfit();
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
  new ResizeObserver(resizePreview).observe(preview);
} else {
  window.addEventListener("resize", resizePreview);
}
watchDevicePixelRatio();
resizePreview();
startApp().catch((error) => {
  showError(error);
});
