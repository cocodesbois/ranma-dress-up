// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import { createOutfitController } from "../src/ui/outfit-controller";
import type { Look } from "../src/types";
import { item } from "./fixtures";

const exclusions: Record<string, string[]> = {
  bodysuits: ["tops", "pants", "dresses"],
  tops: ["bodysuits"],
  pants: ["bodysuits", "dresses"],
  dresses: ["bodysuits", "pants"],
};

function setup(activeCategory: string) {
  const defaultOutfit: Look = Object.fromEntries(
    catalog.categories.map(({ id }) => [id, `existing-${id}`]),
  );
  const appState = createStore({ defaultOutfit, initialActiveCategory: activeCategory });
  const outfitSelect = document.createElement("select");
  outfitSelect.append(new Option("Default", "005"));
  outfitSelect.value = "005";
  const wardrobeUi = {
    updateItemSelection: vi.fn(),
    renderCategories: vi.fn(),
    renderItems: vi.fn(),
    clearItems: vi.fn(),
  };
  const canvasRenderer = {
    drawOutfit: vi.fn(),
    exportPreview: vi.fn(async () => null),
    resizePreview: vi.fn(),
    watchDevicePixelRatio: vi.fn(),
  };
  const statusController = { setStatusMessage: vi.fn(), setOutfitControlsDisabled: vi.fn() };
  const controller = createOutfitController({
    catalog,
    catalogModel,
    outfitPresets: [],
    defaultOutfit,
    appState,
    outfitSelect,
    wardrobeUi,
    canvasRenderer,
    statusController,
    imageLoader: {
      loadImage: vi.fn(async () => document.createElement("img")),
      getSprite: vi.fn(() => undefined),
      getMissingSourcesForPreset: vi.fn((): string[] => []),
      preloadAdjacentOutfits: vi.fn(),
      preloadAllOutfitsInBackground: vi.fn(),
    },
    onError: vi.fn(),
  });
  return {
    controller,
    appState,
    defaultOutfit,
    outfitSelect,
    wardrobeUi,
    canvasRenderer,
    statusController,
  };
}

describe("manual selection exclusivity", () => {
  it.each(catalog.categories)("applies exactly the exclusions for $id", ({ id: category }) => {
    const {
      controller,
      appState,
      defaultOutfit,
      outfitSelect,
      wardrobeUi,
      canvasRenderer,
      statusController,
    } = setup(category);
    const selected = item(`selected-${category}`, category, "Selected item");
    controller.selectItem(selected);

    const expected: Look = { ...defaultOutfit, [category]: selected.id };
    for (const excluded of exclusions[category] ?? []) {
      expected[excluded] = null;
    }
    expect(appState.getOutfit()).toEqual(expected);
    expect(appState.getActiveCategory()).toBe(category);
    expect(appState.getOutfitSelectionRequest()).toBe(1);
    expect(defaultOutfit[category]).toBe(`existing-${category}`);
    expect(outfitSelect.value).toBe("");
    expect(wardrobeUi.updateItemSelection).toHaveBeenCalledOnce();
    expect(canvasRenderer.drawOutfit).toHaveBeenCalledOnce();
    expect(statusController.setStatusMessage).toHaveBeenCalledWith("Selected item selected.");
  });

  it("preserves tops when selecting a dress, then replaces it with a bodysuit", () => {
    const { controller, appState } = setup("dresses");
    controller.selectItem(item("dress", "dresses", "Dress"));
    expect(appState.getOutfit()).toMatchObject({
      dresses: "dress",
      tops: "existing-tops",
      pants: null,
      bodysuits: null,
    });
    appState.setActiveCategory("bodysuits");
    controller.selectItem(item("bodysuit", "bodysuits", "Bodysuit"));
    expect(appState.getOutfit()).toMatchObject({
      dresses: null,
      tops: null,
      pants: null,
      bodysuits: "bodysuit",
      hair: "existing-hair",
    });
  });

  it("removes only the active item without applying selection exclusions", () => {
    const { controller, appState, defaultOutfit, statusController } = setup("bodysuits");
    controller.removeActiveCategoryItem();
    expect(appState.getOutfit()).toEqual({ ...defaultOutfit, bodysuits: null });
    expect(appState.getOutfitSelectionRequest()).toBe(1);
    expect(statusController.setStatusMessage).toHaveBeenCalledWith("Item removed.");
  });

  it("restores the default look without applying manual selection exclusions", () => {
    const { controller, appState, defaultOutfit, wardrobeUi } = setup("bodysuits");
    controller.selectItem(item("bodysuit", "bodysuits", "Bodysuit"));
    controller.resetOutfit();
    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(appState.getOutfit()).not.toBe(defaultOutfit);
    expect(appState.getActiveCategory()).toBe("tops");
    expect(appState.getOutfitSelectionRequest()).toBe(2);
    expect(wardrobeUi.renderCategories).toHaveBeenCalledOnce();
    expect(wardrobeUi.renderItems).toHaveBeenCalledOnce();
  });
});
