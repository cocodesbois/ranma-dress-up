(function registerWardrobeUi(windowObject) {
  function createWardrobeUi({
    categoryTabs,
    itemList,
    catalog,
    getActiveCategory,
    getOutfit,
    getSprite,
    onCategorySelect,
    onItemSelect,
    onNoneSelect
  }) {
    function makeThumbnailCanvas(item) {
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
        height
      );
      return canvas;
    }

    function makeThumbnail(item) {
      const image = document.createElement("img");
      image.className = "item-thumbnail";
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = item.thumbnailSource ?? `images/thumbnails/${item.id}.png`;
      image.addEventListener("error", () => {
        const fallback = makeThumbnailCanvas(item);
        image.replaceWith(fallback);
      }, { once: true });
      return image;
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

      for (const button of categoryTabs.querySelectorAll(".category-tab")) {
        const selected = button.dataset.category === getActiveCategory();
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    }

    function updateItemSelection() {
      const activeCategory = getActiveCategory();
      const outfit = getOutfit();
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

    function renderItems() {
      itemList.replaceChildren();
      const activeCategory = getActiveCategory();
      if (activeCategory !== "hair") {
        itemList.append(makeNoneButton());
      }

      for (const item of catalog.items.filter((entry) => entry.category === activeCategory)) {
        itemList.append(makeItemButton(item));
      }
      updateItemSelection();
    }

    function clearItems() {
      itemList.replaceChildren();
    }

    return {
      renderCategories,
      renderItems,
      clearItems,
      updateItemSelection
    };
  }

  windowObject.RanmaDressUpWardrobeUi = { createWardrobeUi };
}(window));
