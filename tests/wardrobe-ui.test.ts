// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import { createWardrobeUi } from "../src/ui/wardrobe-ui";
import type { CategoryId, Look } from "../src/types";
import { required } from "./fixtures";

const sprite = { image: document.createElement("img"), x: 0, y: 0, width: 1, height: 1, scale: 1 };
const itemsOf = (category: CategoryId) =>
  catalog.items.filter((item) => item.category === category);

/**
 * Build the wardrobe on a fresh DOM. `loadedIds` lists the items whose sprite is loaded
 * (all by default); `outfit` is the live look.
 */
function setup({
  activeCategory = "tops",
  loadedIds,
  outfit,
}: {
  activeCategory?: CategoryId;
  loadedIds?: string[];
  outfit?: Look;
} = {}) {
  document.body.innerHTML = '<div id="category-tabs"></div><div id="item-list"></div>';
  const itemList = required(document.querySelector<HTMLElement>("#item-list"));
  const items = itemsOf(activeCategory);
  const loaded = new Set(loadedIds ?? items.map(({ id }) => id));
  const liveOutfit = outfit ?? { [activeCategory]: null };
  const onCategorySelect = vi.fn();
  const onItemSelect = vi.fn();
  const onNoneSelect = vi.fn();
  const ui = createWardrobeUi({
    categoryTabs: required(document.querySelector<HTMLElement>("#category-tabs")),
    itemList,
    catalog,
    getActiveCategory: () => activeCategory,
    getOutfit: () => liveOutfit,
    getSprite: (item) => (loaded.has(item.id) ? sprite : undefined),
    onCategorySelect,
    onItemSelect,
    onNoneSelect,
  });
  ui.renderCategories();
  ui.renderItems();
  return {
    ui,
    categoryTab: (category: CategoryId) =>
      required(
        document.querySelector<HTMLButtonElement>(`.category-tab[data-category="${category}"]`),
      ),
    itemList,
    items,
    onCategorySelect,
    onItemSelect,
    onNoneSelect,
    cards: () => [...itemList.querySelectorAll<HTMLButtonElement>(".item-card:not(.none-card)")],
    notice: () => itemList.querySelector(".item-notice"),
    noneCard: () => itemList.querySelector(".none-card"),
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("equipped category indicators", () => {
  it("marks equipped categories independently of the browsed category", () => {
    const { categoryTab } = setup({
      outfit: { hair: itemsOf("hair")[0].id, dresses: itemsOf("dresses")[0].id, tops: null },
    });
    for (const category of ["hair", "dresses"] as const) {
      const tab = categoryTab(category);
      expect(tab.classList.contains("has-equipped-item")).toBe(true);
      expect(tab.getAttribute("aria-label")).toBe(
        `${catalog.categories.find(({ id }) => id === category)?.label}, item equipped`,
      );
      expect(tab.getAttribute("aria-pressed")).toBe("false");
      expect(tab.firstElementChild?.classList.contains("category-equipped-icon")).toBe(true);
      expect(tab.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(categoryTab("tops").classList.contains("has-equipped-item")).toBe(false);
    expect(categoryTab("tops").getAttribute("aria-pressed")).toBe("true");
    expect(categoryTab("tops").getAttribute("aria-label")).toBe("Tops");
    expect(categoryTab("hats").classList.contains("has-equipped-item")).toBe(false);
  });

  it("refreshes indicators without replacing buttons or losing focus and click handlers", () => {
    const outfit: Look = { tops: itemsOf("tops")[0].id };
    const { ui, categoryTab, onCategorySelect } = setup({ outfit });
    const tops = categoryTab("tops");
    tops.focus();
    outfit.tops = null;
    outfit.dresses = itemsOf("dresses")[0].id;
    ui.renderCategories();

    expect(categoryTab("tops")).toBe(tops);
    expect(document.activeElement).toBe(tops);
    expect(tops.classList.contains("has-equipped-item")).toBe(false);
    expect(tops.getAttribute("aria-label")).toBe("Tops");
    expect(categoryTab("dresses").classList.contains("has-equipped-item")).toBe(true);
    expect(tops.querySelectorAll(".category-equipped-icon")).toHaveLength(1);
    tops.click();
    expect(onCategorySelect).toHaveBeenCalledExactlyOnceWith(
      catalog.categories.find(({ id }) => id === "tops"),
    );
  });
});

describe("wardrobe items", () => {
  it("renders every item and no notice when all sprites are loaded", () => {
    const { cards, items, notice, noneCard } = setup();
    expect(cards()).toHaveLength(items.length);
    expect(notice()).toBeNull();
    expect(noneCard()).not.toBeNull();
  });

  it("offers only the loaded items and says how many are missing", () => {
    const items = itemsOf("tops");
    const { cards, notice, itemList } = setup({
      loadedIds: items.slice(1).map(({ id }) => id),
    });
    expect(cards().map((card) => card.dataset.itemId)).toEqual(items.slice(1).map(({ id }) => id));
    expect(required(notice()).getAttribute("role")).toBe("alert");
    expect(required(notice()).textContent).toContain("1 item could not be loaded.");
    expect(itemList.firstElementChild).toBe(notice());
  });

  it("uses the plural and offers nothing when no sprite is loaded", () => {
    const { cards, notice, items } = setup({ loadedIds: [] });
    expect(cards()).toHaveLength(0);
    expect(required(notice()).textContent).toContain(`${items.length} items could not be loaded.`);
  });

  it("retries by selecting the active category again", () => {
    const { notice, onCategorySelect } = setup({ loadedIds: [] });
    const retry = required(required(notice()).querySelector("button"));
    expect(retry.textContent).toBe("Try again");
    retry.click();
    expect(onCategorySelect).toHaveBeenCalledExactlyOnceWith(
      catalog.categories.find(({ id }) => id === "tops"),
    );
  });

  it("does not offer a None card for hair", () => {
    expect(setup({ activeCategory: "hair" }).noneCard()).toBeNull();
  });

  it("offers the migrated jumpsuits with their new labels", () => {
    const { cards, noneCard } = setup({ activeCategory: "jumpsuits" });
    expect(cards().map((card) => card.dataset.itemId)).toEqual([
      "jumpsuit006",
      "jumpsuit016",
      "jumpsuit021",
    ]);
    expect(cards().map((card) => card.getAttribute("aria-label"))).toEqual([
      "Jumpsuit 06",
      "Jumpsuit 16",
      "Jumpsuit 21",
    ]);
    expect(noneCard()).not.toBeNull();
  });

  it("offers apron sprites while keeping the category optional", () => {
    const { cards, noneCard, notice } = setup({ activeCategory: "aprons" });
    expect(cards().map((card) => card.dataset.itemId)).toEqual(["apron021", "apron023"]);
    expect(noneCard()).not.toBeNull();
    expect(notice()).toBeNull();
  });

  it("delegates item clicks to the controller", () => {
    const { cards, items, onItemSelect } = setup();
    cards()[1].click();
    expect(onItemSelect).toHaveBeenCalledExactlyOnceWith(items[1]);
  });

  it("uses a decorative icon for None and preserves the removal action", () => {
    const { noneCard, onNoneSelect } = setup({ outfit: { tops: itemsOf("tops")[0].id } });
    const button = required(noneCard());
    const symbol = required(button.querySelector(".none-symbol"));
    expect(symbol.getAttribute("aria-hidden")).toBe("true");
    expect(symbol.querySelector("svg")).not.toBeNull();
    expect(button.querySelector(".item-label")?.textContent).toBe("None");
    expect(button.getAttribute("aria-label")).toBe("Remove selected item");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onNoneSelect).toHaveBeenCalledExactlyOnceWith();
  });
});

describe("accessible names", () => {
  it("names the selected item by its label, not by its ID", () => {
    const [first, second] = itemsOf("tops");
    const { cards } = setup({ outfit: { tops: first.id } });
    const [firstCard, secondCard] = cards();
    expect(firstCard.getAttribute("aria-label")).toBe(`${first.label}, selected`);
    expect(firstCard.getAttribute("aria-label")).not.toContain(first.id);
    expect(firstCard.getAttribute("aria-pressed")).toBe("true");
    expect(secondCard.getAttribute("aria-label")).toBe(second.label);
    expect(secondCard.getAttribute("aria-pressed")).toBe("false");
  });

  it("labels the None card according to whether an item is worn", () => {
    expect(required(setup().noneCard()).getAttribute("aria-label")).toBe("No item selected");
    const omittedSelection = setup({ outfit: {} });
    expect(required(omittedSelection.noneCard()).getAttribute("aria-pressed")).toBe("true");
    const worn = setup({ outfit: { tops: itemsOf("tops")[0].id } });
    expect(required(worn.noneCard()).getAttribute("aria-label")).toBe("Remove selected item");
  });
});
