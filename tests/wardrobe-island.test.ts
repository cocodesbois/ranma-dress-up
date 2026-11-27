// @vitest-environment jsdom
import { createApp, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import { createStore } from "../src/core/state-store";
import WardrobeIsland from "../src/ui/wardrobe-island.vue";
import type { CategoryId, Item, Look } from "../src/types";
import { required } from "./fixtures";

const sprite = { image: document.createElement("img"), x: 0, y: 0, width: 1, height: 1, scale: 1 };
const itemsOf = (category: CategoryId) =>
  catalog.items.filter((item) => item.category === category);

function setup({
  activeCategory = "tops",
  failedCount = 0,
  loadedIds,
  outfit,
  loading = false,
}: {
  activeCategory?: CategoryId;
  failedCount?: number;
  loadedIds?: string[];
  outfit?: Look;
  loading?: boolean;
} = {}) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  const store = createStore({
    defaultOutfit: outfit ?? { [activeCategory]: null },
    initialActiveCategory: activeCategory,
  });
  const categoryItems = itemsOf(activeCategory);
  const loaded = new Set(loadedIds ?? categoryItems.map(({ id }) => id));
  store.setPreviewReady(true);
  if (loading) {
    store.startCategoryLoad(activeCategory);
  } else {
    store.setCategoryLoadResult(activeCategory, failedCount, [...loaded]);
  }
  const onCategorySelect = vi.fn();
  const onItemSelect = vi.fn<(item: Item) => void>();
  const onNoneSelect = vi.fn();
  const app = createApp(WardrobeIsland, {
    catalog,
    store,
    getSprite: (item: Item) => (loaded.has(item.id) ? sprite : undefined),
    onCategorySelect,
    onItemSelect,
    onNoneSelect,
  });
  app.mount(container);

  return {
    app,
    container,
    store,
    loaded,
    categoryItems,
    onCategorySelect,
    onItemSelect,
    onNoneSelect,
    categoryTab: (category: CategoryId) =>
      required(container.querySelector<HTMLButtonElement>(`#category-${category}`)),
    itemList: () => required(container.querySelector<HTMLElement>("#item-list")),
    cards: () => [...container.querySelectorAll<HTMLButtonElement>(".item-card:not(.none-card)")],
    notice: () => container.querySelector<HTMLElement>(".item-notice"),
    noneCard: () => container.querySelector<HTMLButtonElement>(".none-card"),
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wardrobe categories", () => {
  it("renders categories in catalog order with active and equipped accessible states", () => {
    const view = setup({
      outfit: { hair: itemsOf("hair")[0].id, dresses: itemsOf("dresses")[0].id, tops: null },
    });
    const tabs = [...view.container.querySelectorAll<HTMLButtonElement>(".category-tab")];

    expect(tabs.map((tab) => tab.id.replace("category-", ""))).toEqual(
      catalog.categories.map(({ id }) => id),
    );
    for (const category of ["hair", "dresses"] as const) {
      const tab = view.categoryTab(category);
      expect(tab.classList.contains("has-equipped-item")).toBe(true);
      expect(tab.getAttribute("aria-label")).toBe(
        `${catalog.categories.find(({ id }) => id === category)?.label}, item equipped`,
      );
      expect(tab.getAttribute("aria-pressed")).toBe("false");
      expect(tab.firstElementChild?.classList.contains("category-equipped-icon")).toBe(true);
    }
    expect(view.categoryTab("tops").getAttribute("aria-pressed")).toBe("true");
    expect(view.categoryTab("tops").getAttribute("aria-label")).toBe("Tops");
    view.categoryTab("dresses").click();
    expect(view.onCategorySelect).toHaveBeenCalledExactlyOnceWith(
      catalog.categories.find(({ id }) => id === "dresses"),
    );
    view.app.unmount();
  });

  it("shows loading state without stale cards, then resets item-list scroll on completion", async () => {
    const view = setup({ loading: true });
    view.itemList().scrollTop = 90;
    expect(view.itemList().getAttribute("aria-busy")).toBe("true");
    expect(view.cards()).toHaveLength(0);

    view.store.finishCategoryLoad(view.store.state.categoryLoad.request, 0, [...view.loaded]);
    await nextTick();

    expect(view.itemList().getAttribute("aria-busy")).toBe("false");
    expect(view.cards()).toHaveLength(view.categoryItems.length);
    expect(view.itemList().scrollTop).toBe(0);
    view.app.unmount();
  });
});

describe("wardrobe items", () => {
  it("shows a newly loaded item after retrying the active category", async () => {
    const items = itemsOf("tops");
    const missing = items[0];
    const view = setup({ loadedIds: items.slice(1).map(({ id }) => id), failedCount: 1 });
    expect(view.cards()).toHaveLength(items.length - 1);

    const request = view.store.startCategoryLoad("tops");
    await nextTick();
    view.loaded.add(missing.id);
    view.store.finishCategoryLoad(request, 0, [...view.loaded]);
    await nextTick();

    expect(view.container.querySelector(`#item-${missing.id}`)).not.toBeNull();
    expect(view.notice()).toBeNull();
    view.app.unmount();
  });

  it("updates the active list when a preset publishes a newly loaded item", async () => {
    const items = itemsOf("tops");
    const missing = items[0];
    const view = setup({ loadedIds: items.slice(1).map(({ id }) => id), failedCount: 1 });
    expect(view.container.querySelector(`#item-${missing.id}`)).toBeNull();

    view.loaded.add(missing.id);
    view.store.setCategoryLoadResult("tops", 0, [...view.loaded]);
    await nextTick();

    expect(view.container.querySelector(`#item-${missing.id}`)).not.toBeNull();
    expect(view.notice()).toBeNull();
    view.app.unmount();
  });

  it("does not show stale results after switching categories", async () => {
    const view = setup();
    const stale = view.store.startCategoryLoad("tops");
    const dresses = itemsOf("dresses");
    const current = view.store.startCategoryLoad("dresses");
    view.store.finishCategoryLoad(
      current,
      1,
      dresses.slice(1).map(({ id }) => id),
    );
    await nextTick();

    view.store.finishCategoryLoad(
      stale,
      0,
      dresses.map(({ id }) => id),
    );
    await nextTick();
    expect(view.cards().map((card) => card.id.replace("item-", ""))).toEqual(
      dresses.slice(1).map(({ id }) => id),
    );
    expect(view.notice()?.textContent).toContain("1 item could not be loaded.");
    view.app.unmount();
  });

  it("shows only loaded items and the matching partial-failure retry notice", () => {
    const items = itemsOf("tops");
    const view = setup({
      loadedIds: items.slice(1).map(({ id }) => id),
      failedCount: 1,
    });
    expect(view.cards().map((card) => card.id.replace("item-", ""))).toEqual(
      items.slice(1).map(({ id }) => id),
    );
    expect(view.notice()?.getAttribute("role")).toBe("alert");
    expect(view.notice()?.textContent).toContain("1 item could not be loaded.");
    const retry = required(view.notice()?.querySelector("button"));
    retry.click();
    expect(retry.textContent?.trim()).toBe("Try again");
    expect(view.onCategorySelect).toHaveBeenCalledExactlyOnceWith(
      catalog.categories.find(({ id }) => id === "tops"),
    );
    view.app.unmount();
  });

  it("keeps hair mandatory and retains None selection semantics for other categories", () => {
    const hair = setup({ activeCategory: "hair" });
    expect(hair.noneCard()).toBeNull();
    hair.app.unmount();

    const tops = setup({ outfit: { tops: itemsOf("tops")[0].id } });
    const none = required(tops.noneCard());
    expect(none.getAttribute("aria-label")).toBe("Remove selected item");
    expect(none.getAttribute("aria-pressed")).toBe("false");
    none.click();
    expect(tops.onNoneSelect).toHaveBeenCalledOnce();
    tops.app.unmount();
  });

  it("reactively updates selected state and delegates the selected catalog item", async () => {
    const [item] = itemsOf("tops");
    const view = setup();
    view.store.setOutfitItem("tops", item.id);
    await nextTick();

    const card = required(view.container.querySelector<HTMLButtonElement>(`#item-${item.id}`));
    expect(card.getAttribute("aria-label")).toBe(`${item.label}, selected`);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    card.click();
    expect(view.onItemSelect).toHaveBeenCalledExactlyOnceWith(item);
    view.app.unmount();
  });

  it("uses the canvas sprite fallback when a thumbnail image fails", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const view = setup();
    const thumbnail = required(view.container.querySelector<HTMLImageElement>(".item-thumbnail"));
    thumbnail.dispatchEvent(new Event("error"));
    await nextTick();

    expect(view.container.querySelector("canvas.item-thumbnail")).not.toBeNull();
    expect(drawImage).toHaveBeenCalledOnce();
    view.app.unmount();
  });
});
