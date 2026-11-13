/**
 * Renders wardrobe categories, item cards and accessible selection states.
 * Depends on injected catalog/state getters, sprite access and selection callbacks,
 * plus the DOM; exports createWardrobeUi without owning outfit mutations.
 * @module ui/wardrobe-ui
 */
import type { Catalog, Category, Item, Look, Sprite } from "../types";

/**
 * Bind wardrobe containers and delegate user actions to the outfit controller.
 * @param {object} options
 * @param {HTMLElement} options.categoryTabs
 * @param {HTMLElement} options.itemList
 * @param {import("../types").Catalog} options.catalog
 * @param {() => string} options.getActiveCategory
 * @param {() => import("../types").Look} options.getOutfit
 * @param {(item: import("../types").Item) => import("../types").Sprite | undefined} options.getSprite
 * @param {(category: import("../types").Category) => void} options.onCategorySelect
 * @param {(item: import("../types").Item) => void} options.onItemSelect
 * @param {() => void} options.onNoneSelect
 */
export function createWardrobeUi({
  categoryTabs,
  itemList,
  catalog,
  getActiveCategory,
  getOutfit,
  getSprite,
  onCategorySelect,
  onItemSelect,
  onNoneSelect,
}: {
  categoryTabs: HTMLElement;
  itemList: HTMLElement;
  catalog: Catalog;
  getActiveCategory: () => string;
  getOutfit: () => Look;
  getSprite: (item: Item) => Sprite | undefined;
  onCategorySelect: (category: Category) => void;
  onItemSelect: (item: Item) => void;
  onNoneSelect: () => void;
}) {
  function makeThumbnailCanvas(item: Item) {
    const canvas = document.createElement("canvas");
    canvas.className = "item-thumbnail";
    canvas.width = 112;
    canvas.height = 112;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser cannot create item thumbnails.");
    }

    // The thumbnail crop is in document pixels; the loaded sprite is cropped and downscaled.
    const sprite = getSprite(item);
    if (!sprite) {
      throw new Error(`Image is not loaded: ${item.source}`);
    }
    const { x, y, width: sourceWidth, height: sourceHeight } = item.thumbnail;
    const scale = Math.min(88 / sourceWidth, 88 / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    context.drawImage(
      sprite.image,
      (x - sprite.x) * sprite.scale,
      (y - sprite.y) * sprite.scale,
      sourceWidth * sprite.scale,
      sourceHeight * sprite.scale,
      (112 - width) / 2,
      (112 - height) / 2,
      width,
      height,
    );
    return canvas;
  }

  function makeThumbnail(item: Item) {
    const image = document.createElement("img");
    image.className = "item-thumbnail";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = item.thumbnailSource ?? `images/thumbnails/${item.id}.png`;
    image.addEventListener(
      "error",
      () => {
        const fallback = makeThumbnailCanvas(item);
        image.replaceWith(fallback);
      },
      { once: true },
    );
    return image;
  }

  function makeItemButton(item: Item) {
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
    button.addEventListener("click", () => onItemSelect(item));
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
    button.addEventListener("click", () => onNoneSelect());
    return button;
  }

  /**
   * Create category tabs once, then synchronize their active/pressed states.
   * @returns {void}
   */
  function renderCategories() {
    if (categoryTabs.childElementCount === 0) {
      for (const category of catalog.categories) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-tab";
        button.dataset.category = category.id;
        button.textContent = category.label;

        button.addEventListener("click", () => onCategorySelect(category));
        categoryTabs.append(button);
      }
    }

    for (const button of categoryTabs.querySelectorAll<HTMLButtonElement>(".category-tab")) {
      const selected = button.dataset.category === getActiveCategory();
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  /**
   * Synchronize existing cards with the active category's live selection.
   * @returns {void}
   */
  function updateItemSelection() {
    const activeCategory = getActiveCategory();
    const outfit = getOutfit();
    for (const button of itemList.querySelectorAll<HTMLButtonElement>(".item-card")) {
      const selected =
        button.dataset.none === "true"
          ? outfit[activeCategory] === null
          : outfit[activeCategory] === button.dataset.itemId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));

      if (button.dataset.none === "true") {
        button.setAttribute("aria-label", selected ? "No item selected" : "Remove selected item");
      } else if (selected) {
        const label = button.querySelector(".item-label");
        if (!label) throw new Error("Item card label is missing.");
        button.setAttribute("aria-label", `${label.textContent}, selected`);
      } else {
        const label = button.querySelector(".item-label");
        if (!label) throw new Error("Item card label is missing.");
        button.setAttribute("aria-label", label.textContent ?? "");
      }
    }
  }

  function makeLoadNotice(missingCount: number, category: Category) {
    const notice = document.createElement("div");
    notice.className = "item-notice";
    notice.setAttribute("role", "alert");

    const text = document.createElement("span");
    text.textContent =
      missingCount === 1
        ? "1 item could not be loaded."
        : `${missingCount} items could not be loaded.`;
    notice.append(text);

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => onCategorySelect(category));
    notice.append(retry);
    return notice;
  }

  /**
   * Rebuild active-category cards; hair deliberately has no None option. Only items whose
   * sprite is loaded are offered, since choosing another one could not be drawn; a notice
   * with a retry button stands in for the missing ones.
   * @returns {void}
   */
  function renderItems() {
    itemList.replaceChildren();
    const activeCategory = getActiveCategory();
    const categoryItems = catalog.items.filter((entry) => entry.category === activeCategory);
    const availableItems = categoryItems.filter((item) => getSprite(item));

    if (availableItems.length < categoryItems.length) {
      const category = catalog.categories.find((entry) => entry.id === activeCategory);
      if (!category) throw new Error(`Unknown category: ${activeCategory}`);
      itemList.append(makeLoadNotice(categoryItems.length - availableItems.length, category));
    }
    if (activeCategory !== "hair") {
      itemList.append(makeNoneButton());
    }

    for (const item of availableItems) {
      itemList.append(makeItemButton(item));
    }
    updateItemSelection();
  }

  /**
   * Remove stale cards while the next category's assets are loading.
   * @returns {void}
   */
  function clearItems() {
    itemList.replaceChildren();
  }

  return {
    renderCategories,
    renderItems,
    clearItems,
    updateItemSelection,
  };
}
