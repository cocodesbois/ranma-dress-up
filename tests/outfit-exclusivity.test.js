import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog.ts";
import * as catalogModel from "../src/core/catalog-model.ts";
import { createStore } from "../src/core/state-store.ts";
import { createOutfitController } from "../src/ui/outfit-controller.ts";

const exclusions = {
  bodysuits: ["tops", "pants", "dresses"],
  tops: ["bodysuits"],
  pants: ["bodysuits", "dresses"],
  dresses: ["bodysuits", "pants"],
};

function setup(activeCategory) {
  const defaultOutfit = Object.fromEntries(
    catalog.categories.map(({ id }) => [id, `existing-${id}`]),
  );
  const appState = createStore({ defaultOutfit, initialActiveCategory: activeCategory });
  const outfitSelect = { value: "005" };
  const wardrobeUi = {
    updateItemSelection: vi.fn(),
    renderCategories: vi.fn(),
    renderItems: vi.fn(),
  };
  const canvasRenderer = { drawOutfit: vi.fn() };
  const statusController = { setStatusMessage: vi.fn() };
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
    imageLoader: {},
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
    const item = { id: `selected-${category}`, category, label: "Selected item" };
    controller.selectItem(item);

    const expected = { ...defaultOutfit, [category]: item.id };
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
    controller.selectItem({ id: "dress", label: "Dress" });
    expect(appState.getOutfit()).toMatchObject({
      dresses: "dress",
      tops: "existing-tops",
      pants: null,
      bodysuits: null,
    });
    appState.setActiveCategory("bodysuits");
    controller.selectItem({ id: "bodysuit", label: "Bodysuit" });
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
    controller.selectItem({ id: "bodysuit", label: "Bodysuit" });
    controller.resetOutfit();
    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(appState.getOutfit()).not.toBe(defaultOutfit);
    expect(appState.getActiveCategory()).toBe("tops");
    expect(appState.getOutfitSelectionRequest()).toBe(2);
    expect(wardrobeUi.renderCategories).toHaveBeenCalledOnce();
    expect(wardrobeUi.renderItems).toHaveBeenCalledOnce();
  });
});
