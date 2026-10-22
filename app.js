const catalog = window.RanmaDressUpCatalog;
const preview = document.querySelector("#outfit-preview");
const previewContext = preview.getContext("2d");
const categoryTabs = document.querySelector("#category-tabs");
const itemList = document.querySelector("#item-list");
const statusMessage = document.querySelector("#status-message");
const wardrobePanel = document.querySelector("#wardrobe-panel");
const wardrobeToggle = document.querySelector("#wardrobe-toggle");
const wardrobeClose = document.querySelector("#wardrobe-close");
const wardrobeBackdrop = document.querySelector("#wardrobe-backdrop");
const mobileWardrobe = window.matchMedia("(max-width: 720px)");
const imageCache = new Map();

const defaultOutfit = {
  bodysuits: null,
  underwear: null,
  tops: null,
  dresses: "dress005",
  hair: null,
  hats: null,
  shoes: null,
  necklace: null,
  bracelets: null
};

let outfit = { ...defaultOutfit };
let activeCategory = "dresses";
let wardrobeOpen = false;

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

function drawItem(context, item, offsetX = 0) {
  const image = getImage(item);
  const { x, y, scale, regX, regY } = item.placement;
  const left = x - regX * scale + offsetX;
  const top = y - regY * scale;

  context.drawImage(image, left, top, image.naturalWidth * scale, image.naturalHeight * scale);
}

function drawOutfit() {
  const context = previewContext;
  context.clearRect(0, 0, preview.width, preview.height);
  context.fillStyle = "#eee2d2";
  context.fillRect(0, 0, preview.width, preview.height);
  drawItem(context, catalog.background, -300);

  const roomFade = context.createLinearGradient(760, 0, 960, 0);
  roomFade.addColorStop(0, "rgba(238, 226, 210, 0)");
  roomFade.addColorStop(1, "#eee2d2");
  context.fillStyle = roomFade;
  context.fillRect(760, 0, 200, preview.height);

  context.fillStyle = "rgba(65, 47, 39, 0.14)";
  context.beginPath();
  context.ellipse(480, 969, 145, 17, 0, 0, Math.PI * 2);
  context.fill();

  drawItem(context, catalog.base, -480);

  const layerOrder = [
    "underwear",
    "bodysuits",
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
  const scale = Math.min(88 / image.naturalWidth, 88 / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (112 - width) / 2, (112 - height) / 2, width, height);
  return canvas;
}

function selectItem(item) {
  if (["bodysuits", "tops", "dresses"].includes(activeCategory)) {
    for (const category of ["bodysuits", "tops", "dresses"]) {
      if (category !== activeCategory) {
        outfit[category] = null;
      }
    }
  }

  outfit[activeCategory] = item.id;
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

function makeNoneButton(selected) {
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
    outfit[activeCategory] = null;
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

function renderItems() {
  itemList.replaceChildren();
  itemList.append(makeNoneButton());

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
  outfit = { ...defaultOutfit };
  activeCategory = "dresses";
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
    catalog.items.find((item) => item.id === defaultOutfit.dresses).source,
    ...catalog.items
      .filter((item) => item.category === activeCategory)
      .map((item) => item.source)
  ]);

  await Promise.all([...initialSources].map(loadImage));
  renderCategories();
  renderItems();
  drawOutfit();
  statusMessage.textContent = "Choose an item to style the character.";
}

document.querySelector("#reset-look").addEventListener("click", resetOutfit);
document.querySelector("#download-look").addEventListener("click", downloadPreview);
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
startApp().catch((error) => {
  showError(error);
});
