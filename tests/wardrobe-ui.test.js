// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog.ts";
import { createWardrobeUi } from "../src/ui/wardrobe-ui.ts";

const sprite = { image: {}, x: 0, y: 0, width: 1, height: 1, scale: 1 };
const itemsOf = (category) => catalog.items.filter((item) => item.category === category);

/**
 * Build the wardrobe on a fresh DOM. `loadedIds` lists the items whose sprite is loaded
 * (all by default); `outfit` is the live look.
 */
function setup({ activeCategory = "tops", loadedIds, outfit = {} } = {}) {
  document.body.innerHTML = '<div id="category-tabs"></div><div id="item-list"></div>';
  const itemList = document.querySelector("#item-list");
  const items = itemsOf(activeCategory);
  const loaded = new Set(loadedIds ?? items.map(({ id }) => id));
  const onCategorySelect = vi.fn();
  const onItemSelect = vi.fn();
  const ui = createWardrobeUi({
    categoryTabs: document.querySelector("#category-tabs"),
    itemList,
    catalog,
    getActiveCategory: () => activeCategory,
    getOutfit: () => ({ [activeCategory]: null, ...outfit }),
    getSprite: (item) => (loaded.has(item.id) ? sprite : undefined),
    onCategorySelect,
    onItemSelect,
    onNoneSelect: vi.fn(),
  });
  ui.renderItems();
  return {
    itemList,
    items,
    onCategorySelect,
    onItemSelect,
    cards: () => [...itemList.querySelectorAll(".item-card:not(.none-card)")],
    notice: () => itemList.querySelector(".item-notice"),
    noneCard: () => itemList.querySelector(".none-card"),
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
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
    expect(notice().getAttribute("role")).toBe("alert");
    expect(notice().textContent).toContain("1 item could not be loaded.");
    expect(itemList.firstElementChild).toBe(notice());
  });

  it("uses the plural and offers nothing when no sprite is loaded", () => {
    const { cards, notice, items } = setup({ loadedIds: [] });
    expect(cards()).toHaveLength(0);
    expect(notice().textContent).toContain(`${items.length} items could not be loaded.`);
  });

  it("retries by selecting the active category again", () => {
    const { notice, onCategorySelect } = setup({ loadedIds: [] });
    const retry = notice().querySelector("button");
    expect(retry.textContent).toBe("Try again");
    retry.click();
    expect(onCategorySelect).toHaveBeenCalledExactlyOnceWith(
      catalog.categories.find(({ id }) => id === "tops"),
    );
  });

  it("does not offer a None card for hair", () => {
    expect(setup({ activeCategory: "hair" }).noneCard()).toBeNull();
  });

  it("delegates item clicks to the controller", () => {
    const { cards, items, onItemSelect } = setup();
    cards()[1].click();
    expect(onItemSelect).toHaveBeenCalledExactlyOnceWith(items[1]);
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
    expect(setup().noneCard().getAttribute("aria-label")).toBe("No item selected");
    const worn = setup({ outfit: { tops: itemsOf("tops")[0].id } });
    expect(worn.noneCard().getAttribute("aria-label")).toBe("Remove selected item");
  });
});
