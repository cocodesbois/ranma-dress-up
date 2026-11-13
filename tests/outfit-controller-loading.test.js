import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog.js";
import * as catalogModel from "../src/core/catalog-model.js";
import { createStore } from "../src/core/state-store.js";
import { createOutfitController } from "../src/ui/outfit-controller.js";

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = catalogModel.getDefaultOutfitLook(outfitPresets, "005");
const topsCategory = catalog.categories.find(({ id }) => id === "tops");
const dressesCategory = catalog.categories.find(({ id }) => id === "dresses");
const topItems = catalog.items.filter(({ category }) => category === "tops");
// Items of the initial category that are not part of the default look.
const otherTops = topItems.filter(({ id }) => id !== defaultOutfit.tops);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup({ failing = new Set() } = {}) {
  const imageLoader = {
    loadImage: vi.fn((source) =>
      failing.has(source)
        ? Promise.reject(new Error(`Could not load image asset: ${source}`))
        : Promise.resolve({}),
    ),
    preloadAdjacentOutfits: vi.fn(),
    preloadAllOutfitsInBackground: vi.fn(),
  };
  const appState = createStore({ defaultOutfit, initialActiveCategory: "tops" });
  const wardrobeUi = {
    renderCategories: vi.fn(),
    renderItems: vi.fn(),
    clearItems: vi.fn(),
    updateItemSelection: vi.fn(),
  };
  const statusController = { setStatusMessage: vi.fn(), setOutfitControlsDisabled: vi.fn() };
  const canvasRenderer = { drawOutfit: vi.fn() };
  const onError = vi.fn();
  const controller = createOutfitController({
    catalog,
    catalogModel,
    outfitPresets,
    defaultOutfit,
    appState,
    outfitSelect: { value: "", append: vi.fn() },
    statusController,
    imageLoader,
    canvasRenderer,
    wardrobeUi,
    onError,
  });
  return {
    controller,
    imageLoader,
    appState,
    wardrobeUi,
    statusController,
    canvasRenderer,
    onError,
  };
}

const messages = (statusController) =>
  statusController.setStatusMessage.mock.calls.map(([text]) => text);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("document", { createElement: () => ({}) });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("selecting a category", () => {
  it("renders the grid and confirms the selection when every image loads", async () => {
    const { controller, wardrobeUi, statusController, onError } = setup();
    await controller.selectCategory(topsCategory);
    expect(wardrobeUi.renderItems).toHaveBeenCalledOnce();
    expect(messages(statusController).at(-1)).toBe("Tops selected.");
    expect(onError).not.toHaveBeenCalled();
  });

  it("still renders the grid when some images fail, and reports how many", async () => {
    const failing = new Set(topItems.slice(0, 2).map(({ source }) => source));
    const { controller, wardrobeUi, statusController, onError } = setup({ failing });
    await controller.selectCategory(topsCategory);

    expect(wardrobeUi.renderItems).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe(
      `2 of ${topItems.length} tops could not be loaded.`,
    );
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(messages(statusController)).not.toContain("Tops selected.");
  });

  it("loads every image of the category again when the category is selected again", async () => {
    const failing = new Set([topItems[0].source]);
    const { controller, imageLoader, wardrobeUi, onError } = setup({ failing });
    await controller.selectCategory(topsCategory);
    expect(onError).toHaveBeenCalledOnce();

    failing.clear();
    imageLoader.loadImage.mockClear();
    await controller.selectCategory(topsCategory);
    expect(imageLoader.loadImage).toHaveBeenCalledTimes(topItems.length);
    expect(imageLoader.loadImage).toHaveBeenCalledWith(topItems[0].source);
    expect(wardrobeUi.renderItems).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("ignores a response that arrives after another category was selected", async () => {
    const { controller, imageLoader, wardrobeUi, appState, onError } = setup();
    const slow = deferred();
    imageLoader.loadImage.mockImplementation(() => slow.promise);

    const pending = controller.selectCategory(topsCategory);
    appState.setActiveCategory(dressesCategory.id);
    slow.reject(new Error("late failure"));
    await pending;

    expect(wardrobeUi.renderItems).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("starting the app", () => {
  it("survives the failure of an optional image of the initial category", async () => {
    const failing = new Set([otherTops[0].source]);
    const { controller, appState, canvasRenderer, wardrobeUi, imageLoader } = setup({ failing });
    await expect(controller.startApp()).resolves.toBeUndefined();

    expect(appState.isPreviewReady()).toBe(true);
    expect(wardrobeUi.renderItems).toHaveBeenCalledOnce();
    expect(canvasRenderer.drawOutfit).toHaveBeenCalledOnce();
    expect(imageLoader.preloadAllOutfitsInBackground).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("loads the scene, the base and the current look before showing anything", async () => {
    const { controller, imageLoader } = setup();
    await controller.startApp();
    const loaded = imageLoader.loadImage.mock.calls.map(([source]) => source);
    const currentLook = catalog.items
      .filter(({ category, id }) => defaultOutfit[category] === id)
      .map(({ source }) => source);
    expect(loaded).toEqual(
      expect.arrayContaining([catalog.background.source, catalog.base.source, ...currentLook]),
    );
    expect(new Set(loaded).size).toBe(loaded.length);
  });

  it("fails when the scene or the current look cannot be loaded", async () => {
    const hair = catalog.items.find(({ id }) => id === defaultOutfit.hair);
    const { controller, appState, canvasRenderer } = setup({ failing: new Set([hair.source]) });
    await expect(controller.startApp()).rejects.toThrow(
      `Could not load image asset: ${hair.source}`,
    );
    expect(appState.isPreviewReady()).toBe(false);
    expect(canvasRenderer.drawOutfit).not.toHaveBeenCalled();
  });
});
