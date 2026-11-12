import { describe, expect, it } from "vitest";
import { createStore } from "../src/core/state-store.js";

describe("state store", () => {
  it("initializes the look and UI state without mutating the default outfit", () => {
    const defaultOutfit = { hair: "hair", tops: "top", pants: null };
    const store = createStore({ defaultOutfit });
    expect(store.getOutfit()).toEqual(defaultOutfit);
    expect(store.getOutfit()).not.toBe(defaultOutfit);
    expect(store.getActiveCategory()).toBe("tops");
    expect(store.isWardrobeOpen()).toBe(false);
    expect(store.isPreviewReady()).toBe(false);
    expect(store.getOutfitSelectionRequest()).toBe(0);
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
    store.setActiveCategory("dresses");
    store.setWardrobeOpen(true);
    store.setPreviewReady(true);
    expect(store.getActiveCategory()).toBe("dresses");
    expect(store.isWardrobeOpen()).toBe(true);
    expect(store.isPreviewReady()).toBe(true);
    store.setWardrobeOpen(false);
    store.setPreviewReady(false);
    expect(store.getActiveCategory()).toBe("dresses");
    expect(store.isWardrobeOpen()).toBe(false);
    expect(store.isPreviewReady()).toBe(false);
  });

  it("increments selection requests and invalidates stale requests", () => {
    const store = createStore({ defaultOutfit: {} });
    const first = store.nextOutfitSelectionRequest();
    expect(first).toBe(1);
    expect(store.isCurrentOutfitSelectionRequest(first)).toBe(true);
    const second = store.nextOutfitSelectionRequest();
    expect(second).toBe(2);
    expect(store.getOutfitSelectionRequest()).toBe(second);
    expect(store.isCurrentOutfitSelectionRequest(first)).toBe(false);
    expect(store.isCurrentOutfitSelectionRequest(second)).toBe(true);
    expect(store.isCurrentOutfitSelectionRequest(second + 1)).toBe(false);
  });

  it("keeps store instances isolated", () => {
    const defaultOutfit = { hair: "hair", tops: "top" };
    const first = createStore({ defaultOutfit });
    const second = createStore({ defaultOutfit });
    first.setOutfitItem("tops", null);
    first.setActiveCategory("hair");
    first.setWardrobeOpen(true);
    first.setPreviewReady(true);
    first.nextOutfitSelectionRequest();
    expect(second.getOutfit()).toEqual(defaultOutfit);
    expect(second.getActiveCategory()).toBe("tops");
    expect(second.isWardrobeOpen()).toBe(false);
    expect(second.isPreviewReady()).toBe(false);
    expect(second.getOutfitSelectionRequest()).toBe(0);
  });
});
