const catalog = window.RanmaDressUpCatalog;
const preview = document.querySelector("#outfit-preview");
const previewContext = preview.getContext("2d");
const previewWidth = 960;
const previewHeight = 1080;
const categoryTabs = document.querySelector("#category-tabs");
const itemList = document.querySelector("#item-list");
const outfitSelect = document.querySelector("#outfit-select");
const statusMessage = document.querySelector("#status-message");
const wardrobePanel = document.querySelector("#wardrobe-panel");
const wardrobeToggle = document.querySelector("#wardrobe-toggle");
const wardrobeClose = document.querySelector("#wardrobe-close");
const wardrobeBackdrop = document.querySelector("#wardrobe-backdrop");
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const imageCache = new Map();

const outfitPresets = createOutfitPresets();
const defaultOutfit = outfitPresets.find((preset) => preset.id === "005")?.look
  ?? outfitPresets[0]?.look;

if (!defaultOutfit) {
  throw new Error("No complete outfits with a hairstyle are available.");
}

let outfit = { ...defaultOutfit };
let activeCategory = "tops";
let wardrobeOpen = false;
let outfitSelectionRequest = 0;
let previewReady = false;

if (!previewContext) {
  throw new Error("This browser does not support the canvas preview.");
}

function loadImage(source) {
  if (imageCache.has(source)) {
    return imageCache.get(source);
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image asset: ${source}`));
    image.src = source;
  }).then(
    (image) => {
      imageCache.set(source, image);
      return image;
    },
    (error) => {
      imageCache.delete(source);
      throw error;
    }
  );

  imageCache.set(source, promise);
  return promise;
}

function getImage(item) {
  return imageCache.get(item.source);
}

function createOutfitPresets() {
  const outfitCategories = new Set(catalog.categories.map((category) => category.id));
  const itemsById = new Map(catalog.items.map((item) => [item.id, item]));

  return catalog.outfits.map((outfit) => {
    if (!outfit.items || typeof outfit.items !== "object" || Array.isArray(outfit.items)) {
      throw new Error(`Outfit "${outfit.id}" must define items by category.`);
    }

    const look = Object.fromEntries([...outfitCategories].map((category) => [category, null]));
    const items = [];

    for (const [category, itemId] of Object.entries(outfit.items)) {
      if (!outfitCategories.has(category)) {
        throw new Error(`Unknown category "${category}" in outfit "${outfit.id}".`);
      }

      const item = itemsById.get(itemId);
      if (!item) {
        throw new Error(`Unknown item "${itemId}" in outfit "${outfit.id}".`);
      }

      if (item.category !== category) {
        throw new Error(
          `Item "${item.id}" belongs to "${item.category}", not "${category}" in outfit "${outfit.id}".`
        );
      }

      look[category] = item.id;
      items.push(item);
    }

    if (!look.hair || !items.some((item) =>
      ["bodysuits", "underwear", "slips", "tops", "dresses", "pants"].includes(item.category)
    )) {
      throw new Error(`Outfit "${outfit.id}" must include hair and a clothing item.`);
    }

    return { id: outfit.id, label: outfit.label, items, look };
  });
}

function getMatchingOutfit() {
  return outfitPresets.find((preset) =>
    catalog.categories.every((category) => outfit[category.id] === preset.look[category.id])
  );
}

function updateOutfitSelection() {
  outfitSelect.value = getMatchingOutfit()?.id ?? "";
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
    "bodysuits",
    "pants",
    "tops",
    "dresses",
    "shoes",
    "hair",
    "hats",
    "necklace",
    "bracelets"
  ];

  for (const category of layerOrder) {
    const selectedId = outfit[category];
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
  if (previewReady) {
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
  outfitSelectionRequest++;
  const mutuallyExclusiveCategories = {
    bodysuits: ["tops", "pants", "dresses"],
    tops: ["bodysuits"],
    pants: ["bodysuits", "dresses"],
    dresses: ["bodysuits", "pants"]
  };
  for (const category of mutuallyExclusiveCategories[activeCategory] ?? []) {
    outfit[category] = null;
  }

  outfit[activeCategory] = item.id;
  updateOutfitSelection();
  updateItemSelection();
  drawOutfit();
  statusMessage.textContent = `${item.label} selected.`;
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
    outfitSelectionRequest++;
    outfit[activeCategory] = null;
    updateOutfitSelection();
    updateItemSelection();
    drawOutfit();
    statusMessage.textContent = "Item removed.";
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
    const selected = button.dataset.category === activeCategory;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

async function selectCategory(category) {
  activeCategory = category.id;
  renderCategories();
  itemList.replaceChildren();
  statusMessage.textContent = `Loading ${category.label.toLowerCase()}...`;

  try {
    const items = catalog.items.filter((entry) => entry.category === category.id);
    await Promise.all(items.map((item) => loadImage(item.source)));
    if (activeCategory !== category.id) {
      return;
    }

    renderItems();
    statusMessage.textContent = `${category.label} selected.`;
  } catch (error) {
    showError(error);
  }
}

async function selectOutfit(preset) {
  const request = ++outfitSelectionRequest;
  statusMessage.textContent = `Loading ${preset.label.toLowerCase()}...`;

  try {
    await Promise.all(preset.items.map((item) => loadImage(item.source)));
    if (request !== outfitSelectionRequest) {
      return;
    }

    outfit = { ...preset.look };
    updateOutfitSelection();
    renderCategories();
    renderItems();
    drawOutfit();
    statusMessage.textContent = `${preset.label} selected.`;
  } catch (error) {
    showError(error);
  }
}

function renderItems() {
  itemList.replaceChildren();
  if (activeCategory !== "hair") {
    itemList.append(makeNoneButton());
  }

  for (const item of catalog.items.filter((entry) => entry.category === activeCategory)) {
    itemList.append(makeItemButton(item));
  }
  updateItemSelection();
}

function updateItemSelection() {
  for (const button of itemList.querySelectorAll(".item-card")) {
    const selected = button.dataset.none === "true"
      ? outfit[activeCategory] === null
      : outfit[activeCategory] === button.dataset.itemId;
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
  statusMessage.textContent = error.message;
  statusMessage.classList.add("is-error");
}

function syncWardrobeMode() {
  if (!mobileWardrobe.matches) {
    wardrobeOpen = false;
  }

  const hidden = mobileWardrobe.matches && !wardrobeOpen;
  wardrobePanel.inert = hidden;
  wardrobePanel.setAttribute("aria-hidden", String(hidden));
  wardrobeToggle.setAttribute("aria-expanded", String(wardrobeOpen));
  wardrobeBackdrop.inert = !wardrobeOpen;
  document.body.classList.toggle("wardrobe-open", wardrobeOpen);

  if (mobileWardrobe.matches) {
    wardrobePanel.setAttribute("role", "dialog");
    wardrobePanel.setAttribute("aria-modal", String(wardrobeOpen));
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

  wardrobeOpen = open;
  syncWardrobeMode();

  if (open) {
    wardrobeClose.focus();
  } else if (returnFocus) {
    wardrobeToggle.focus();
  }
}

function resetOutfit() {
  outfitSelectionRequest++;
  outfit = { ...defaultOutfit };
  activeCategory = "tops";
  updateOutfitSelection();
  renderCategories();
  renderItems();
  drawOutfit();
  statusMessage.textContent = "The original look has been restored.";
}

function downloadPreview() {
  preview.toBlob((blob) => {
    if (!blob) {
      statusMessage.textContent = "The preview could not be saved.";
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ranma-dress-up.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    statusMessage.textContent = "Your look has been downloaded.";
  }, "image/png");
}

async function startApp() {
  statusMessage.textContent = "Loading the wardrobe...";
  const initialSources = new Set([
    catalog.background.source,
    catalog.base.source,
    ...catalog.items
      .filter((item) => defaultOutfit[item.category] === item.id)
      .map((item) => item.source),
    ...catalog.items
      .filter((item) => item.category === activeCategory)
      .map((item) => item.source)
  ]);

  await Promise.all([...initialSources].map(loadImage));
  for (const preset of outfitPresets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    outfitSelect.append(option);
  }
  updateOutfitSelection();
  renderCategories();
  renderItems();
  previewReady = true;
  drawOutfit();
  statusMessage.textContent = "Choose an item to style the character.";
}

document.querySelector("#reset-look").addEventListener("click", resetOutfit);
document.querySelector("#download-look").addEventListener("click", downloadPreview);
outfitSelect.addEventListener("change", () => {
  const preset = outfitPresets.find((entry) => entry.id === outfitSelect.value);
  if (preset) {
    selectOutfit(preset);
  }
});
wardrobeToggle.addEventListener("click", () => setWardrobeOpen(true));
wardrobeClose.addEventListener("click", () => setWardrobeOpen(false));
wardrobeBackdrop.addEventListener("click", () => setWardrobeOpen(false));
mobileWardrobe.addEventListener("change", () => syncWardrobeMode());
document.addEventListener("keydown", (event) => {
  if (!wardrobeOpen) {
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
