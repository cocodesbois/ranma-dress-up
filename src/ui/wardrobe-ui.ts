/**
 * Renders wardrobe categories, item cards and accessible selection states.
 * Depends on injected catalog/state getters, sprite access and selection callbacks,
 * plus the DOM; exports createWardrobeUi without owning outfit mutations.
 * @module ui/wardrobe-ui
 */
import type { Catalog, Category, CategoryId, Item, Look, Sprite } from "../types";

/** Bind wardrobe containers and delegate user actions to the outfit controller. */
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
  getActiveCategory: () => CategoryId;
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

    const svgNamespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(svgNamespace, "svg");
    icon.setAttribute("viewBox", "0 0 32 32");
    icon.setAttribute("focusable", "false");

    const circle = document.createElementNS(svgNamespace, "circle");
    circle.setAttribute("cx", "16");
    circle.setAttribute("cy", "16");
    circle.setAttribute("r", "14");
    circle.setAttribute("fill", "currentColor");

    const power = document.createElementNS(svgNamespace, "path");
    power.setAttribute("d", "M16 8v8 M10.3 10.3a8 8 0 1 0 11.4 0");
    power.setAttribute("fill", "none");
    power.setAttribute("stroke", "var(--surface-soft)");
    power.setAttribute("stroke-width", "3");
    power.setAttribute("stroke-linecap", "round");
    icon.append(circle, power);
    symbol.append(icon);
    button.append(symbol);

    const label = document.createElement("span");
    label.className = "item-label";
    label.textContent = "None";
    button.append(label);
    button.addEventListener("click", () => onNoneSelect());
    return button;
  }

  /** Create category tabs once, then synchronize browsed and equipped states. */
  function renderCategories() {
    if (categoryTabs.childElementCount === 0) {
      for (const category of catalog.categories) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-tab";
        button.dataset.category = category.id;
        const svgNamespace = "http://www.w3.org/2000/svg";
        const icon = document.createElementNS(svgNamespace, "svg");
        icon.classList.add("category-equipped-icon");
        icon.setAttribute("viewBox", "0 0 32 32");
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("focusable", "false");

        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", "16");
        circle.setAttribute("cy", "16");
        circle.setAttribute("r", "14");
        circle.setAttribute("fill", "currentColor");

        const check = document.createElementNS(svgNamespace, "path");
        check.setAttribute("d", "m9 16 5 5 9-10");
        check.setAttribute("fill", "none");
        check.setAttribute("stroke", "var(--category-surface)");
        check.setAttribute("stroke-width", "3");
        check.setAttribute("stroke-linecap", "round");
        check.setAttribute("stroke-linejoin", "round");
        icon.append(circle, check);
        button.append(icon, document.createTextNode(category.label));

        button.addEventListener("click", () => onCategorySelect(category));
        categoryTabs.append(button);
      }
    }

    const outfit = getOutfit();
    for (const category of catalog.categories) {
      const button = categoryTabs.querySelector<HTMLButtonElement>(
        `.category-tab[data-category="${category.id}"]`,
      );
      if (!button) throw new Error(`Category tab is missing: ${category.id}`);
      const selected = category.id === getActiveCategory();
      const equipped = outfit[category.id] != null;
      button.classList.toggle("is-active", selected);
      button.classList.toggle("has-equipped-item", equipped);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-label",
        equipped ? `${category.label}, item equipped` : category.label,
      );
    }
  }

  /** Synchronize existing cards with the active category's live selection. */
  function updateItemSelection() {
    const activeCategory = getActiveCategory();
    const outfit = getOutfit();
    for (const button of itemList.querySelectorAll<HTMLButtonElement>(".item-card")) {
      const selected =
        button.dataset.none === "true"
          ? (outfit[activeCategory] ?? null) === null
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
   */
  function renderItems() {
    itemList.replaceChildren();
    itemList.scrollLeft = 0;
    itemList.scrollTop = 0;
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

  /** Remove stale cards while the next category's assets are loading. */
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
