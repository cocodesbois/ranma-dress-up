// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import catalog from "../src/data/sprite-catalog";
import type { CategoryId, Look } from "../src/types";
import { createOutfitController } from "../src/ui/outfit-controller";
import { item } from "./fixtures";

const exclusions: Partial<Record<CategoryId, CategoryId[]>> = {
  bodysuits: ["tops", "pants", "dresses", "slips", "jumpsuits"],
  slips: ["bodysuits"],
  tops: ["bodysuits"],
  pants: ["bodysuits", "dresses", "jumpsuits"],
  dresses: ["bodysuits", "pants", "jumpsuits"],
  jumpsuits: ["pants", "dresses", "bodysuits"],
  gloves: ["bracelets"],
  bracelets: ["gloves"],
};

function setup(activeCategory: CategoryId) {
  const defaultOutfit: Look = Object.fromEntries(
    catalog.categories.map(({ id }) => [id, `existing-${id}`]),
  );
  const appState = createStore({ defaultOutfit, initialActiveCategory: activeCategory });
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
    canvasRenderer,
    statusController,
  };
}

describe("manual selection exclusivity", () => {
  it.each(catalog.categories)("applies exactly the exclusions for $id", ({ id: category }) => {
    const { controller, appState, defaultOutfit, canvasRenderer, statusController } =
      setup(category);
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

  it("preserves a jumpsuit and its underlayers when adding or removing an apron", () => {
    const { controller, appState } = setup("jumpsuits");
    controller.selectItem(item("jumpsuit", "jumpsuits"));
    expect(appState.getOutfit()).toMatchObject({
      jumpsuits: "jumpsuit",
      tops: "existing-tops",
      slips: "existing-slips",
      tights: "existing-tights",
      bras: "existing-bras",
      aprons: "existing-aprons",
      pants: null,
      dresses: null,
      bodysuits: null,
    });
    appState.setActiveCategory("aprons");
    controller.selectItem(item("apron", "aprons"));
    const withApron = { ...appState.getOutfit() };
    expect(withApron.jumpsuits).toBe("jumpsuit");
    expect(withApron.aprons).toBe("apron");
    controller.removeActiveCategoryItem();
    expect(appState.getOutfit()).toEqual({ ...withApron, aprons: null });
  });

  it("restores the default look without applying manual selection exclusions", () => {
    const { controller, appState, defaultOutfit } = setup("bodysuits");
    controller.selectItem(item("bodysuit", "bodysuits", "Bodysuit"));
    controller.resetOutfit();
    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(appState.getOutfit()).not.toBe(defaultOutfit);
    expect(appState.getActiveCategory()).toBe("tops");
    expect(appState.getOutfitSelectionRequest()).toBe(2);
    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
    });
  });
});
