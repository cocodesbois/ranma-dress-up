import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createStore } from "../src/core/state-store";
import type { Look } from "../src/types";

describe("state store", () => {
  it("initializes the look and UI state without mutating the default outfit", () => {
    const defaultOutfit = { hair: "hair", tops: "top", pants: null };
    const store = createStore({ defaultOutfit });
    expect(store.getOutfit()).toEqual(defaultOutfit);
    expect(store.getOutfit()).not.toBe(defaultOutfit);
    expect(store.getActiveCategory()).toBe("tops");
    expect(store.state.wardrobeOpen).toBe(false);
    expect(store.isPreviewReady()).toBe(false);
    expect(store.state.outfitSelectionRequest).toBe(0);
    store.setOutfitItem("tops", "other-top");
    expect(defaultOutfit.tops).toBe("top");
  });

  it("replaces rather than merges a look and copies its input", () => {
    const store = createStore({ defaultOutfit: { hair: "hair", tops: "top" } });
    const nextOutfit = { hair: "other-hair", dresses: "dress" };
    store.setOutfit(nextOutfit);
    expect(store.getOutfit()).toEqual(nextOutfit);
    expect(store.getOutfit()).not.toBe(nextOutfit);
    nextOutfit.hair = "changed";
    store.setOutfitItem("dresses", null);
    expect(store.getOutfit()).toEqual({ hair: "other-hair", dresses: null });
    expect(nextOutfit.dresses).toBe("dress");
  });

  it("exposes a readonly reactive look that follows actions but not replacements", () => {
    const store = createStore({ defaultOutfit: { hair: "hair", tops: "top" } });
    const look = store.getOutfit();
    expectTypeOf(look).toEqualTypeOf<Readonly<Look>>();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      Reflect.set(look, "tops", "external");
      Reflect.deleteProperty(look, "hair");
      expect(store.getOutfit()).toEqual({ hair: "hair", tops: "top" });

      store.setOutfitItem("tops", "other-top");
      expect(look.tops).toBe("other-top");
      store.setOutfit({ hair: "other-hair" });
      expect(look).toEqual({ hair: "hair", tops: "other-top" });
      expect(store.getOutfit()).toEqual({ hair: "other-hair" });
    } finally {
      warn.mockRestore();
    }
  });

  it("sets and clears only the requested categories", () => {
    const store = createStore({
      defaultOutfit: { hair: "hair", tops: "top", pants: "pants", dresses: null },
    });
    store.setOutfitItem("dresses", "dress");
    store.clearOutfitItems(["tops", "pants"]);
    expect(store.getOutfit()).toEqual({ hair: "hair", tops: null, pants: null, dresses: "dress" });
    store.clearOutfitItems([]);
    expect(store.getOutfit().dresses).toBe("dress");
  });

  it("updates category, wardrobe and preview state independently", () => {
    const store = createStore({ defaultOutfit: {}, initialActiveCategory: "hair" });
    expect(store.getActiveCategory()).toBe("hair");
    store.setCategoryLoadResult("dresses", 0, []);
    store.setWardrobeOpen(true);
    store.setPreviewReady(true);
    expect(store.getActiveCategory()).toBe("dresses");
    expect(store.state.wardrobeOpen).toBe(true);
    expect(store.isPreviewReady()).toBe(true);
    store.setWardrobeOpen(false);
    store.setPreviewReady(false);
    expect(store.getActiveCategory()).toBe("dresses");
    expect(store.state.wardrobeOpen).toBe(false);
    expect(store.isPreviewReady()).toBe(false);
  });

  it("increments selection requests and invalidates stale requests", () => {
    const store = createStore({ defaultOutfit: {} });
    const first = store.nextOutfitSelectionRequest();
    expect(first).toBe(1);
    expect(store.isCurrentOutfitSelectionRequest(first)).toBe(true);
    const second = store.nextOutfitSelectionRequest();
    expect(second).toBe(2);
    expect(store.state.outfitSelectionRequest).toBe(second);
    expect(store.isCurrentOutfitSelectionRequest(first)).toBe(false);
    expect(store.isCurrentOutfitSelectionRequest(second)).toBe(true);
    expect(store.isCurrentOutfitSelectionRequest(second + 1)).toBe(false);
  });

  it("tracks category loading results and ignores stale completions", () => {
    const store = createStore({ defaultOutfit: {}, initialActiveCategory: "tops" });
    const first = store.startCategoryLoad("tops");
    const retry = store.startCategoryLoad("tops");

    expect(store.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "loading",
      failedCount: 0,
    });
    expect(store.finishCategoryLoad(first, 2, ["stale"])).toBe(false);
    expect(store.finishCategoryLoad(retry, 1, ["loaded"])).toBe(true);
    expect(store.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 1,
      availableItemIds: ["loaded"],
    });
  });

  it("invalidates category loads when a non-loading result is published", () => {
    const store = createStore({ defaultOutfit: {}, initialActiveCategory: "tops" });
    const request = store.startCategoryLoad("dresses");
    store.setCategoryLoadResult("tops", 0, ["top"]);

    expect(store.getActiveCategory()).toBe("tops");
    expect(store.finishCategoryLoad(request, 3, ["stale"])).toBe(false);
    expect(store.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 0,
      availableItemIds: ["top"],
    });
  });

  it("keeps store instances isolated", () => {
    const defaultOutfit = { hair: "hair", tops: "top" };
    const first = createStore({ defaultOutfit });
    const second = createStore({ defaultOutfit });
    first.setOutfitItem("tops", null);
    first.setCategoryLoadResult("hair", 0, []);
    first.setWardrobeOpen(true);
    first.setPreviewReady(true);
    first.nextOutfitSelectionRequest();
    expect(second.getOutfit()).toEqual(defaultOutfit);
    expect(second.getActiveCategory()).toBe("tops");
    expect(second.state.wardrobeOpen).toBe(false);
    expect(second.isPreviewReady()).toBe(false);
    expect(second.state.outfitSelectionRequest).toBe(0);
  });
});
