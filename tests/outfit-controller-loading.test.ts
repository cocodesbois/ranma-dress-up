// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import { createOutfitController } from "../src/ui/outfit-controller";
import { required } from "./fixtures";

const outfitPresets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = required(catalogModel.getDefaultOutfitLook(outfitPresets, "001"));
const topsCategory = required(catalog.categories.find(({ id }) => id === "tops"));
const dressesCategory = required(catalog.categories.find(({ id }) => id === "dresses"));
const topItems = catalog.items.filter(({ category }) => category === "tops");
// Items of the initial category that are not part of the default look.
const otherTops = topItems.filter(({ id }) => id !== defaultOutfit.tops);

function deferred() {
  let resolve!: (value: HTMLImageElement) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<HTMLImageElement>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup({ failing = new Set<string>() } = {}) {
  const loaded = new Set<string>();
  const sprite = {
    image: document.createElement("img"),
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    scale: 1,
  };
  const imageLoader = {
    loadImage: vi.fn(async (source: string) => {
      if (failing.has(source)) throw new Error(`Could not load image asset: ${source}`);
      loaded.add(source);
      return document.createElement("img");
    }),
    getSprite: vi.fn((source: string) => (loaded.has(source) ? sprite : undefined)),
    getMissingSourcesForPreset: vi.fn((): string[] => []),
    preloadAdjacentOutfits: vi.fn(),
    preloadAllOutfitsInBackground: vi.fn(),
  };
  const appState = createStore({ defaultOutfit, initialActiveCategory: "tops" });
  const statusController = {
    setStatusMessage:
      vi.fn<(text: string, options?: { loading?: boolean; isError?: boolean }) => void>(),
    setOutfitControlsDisabled: vi.fn(),
  };
  const canvasRenderer = {
    drawOutfit: vi.fn(),
    exportPreview: vi.fn(async () => null),
    resizePreview: vi.fn(),
    watchDevicePixelRatio: vi.fn(),
  };
  const onError = vi.fn<(error: unknown) => void>();
  const controller = createOutfitController({
    catalog,
    catalogModel,
    outfitPresets,
    defaultOutfit,
    appState,
    statusController,
    imageLoader,
    canvasRenderer,
    onError,
  });
  return {
    controller,
    imageLoader,
    appState,
    statusController,
    canvasRenderer,
    onError,
    loaded,
  };
}

const messages = (statusController: ReturnType<typeof setup>["statusController"]) =>
  statusController.setStatusMessage.mock.calls.map(([text]) => text);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("selecting a category", () => {
  it("publishes a successful category load and confirms the selection", async () => {
    const { controller, appState, statusController, onError } = setup();
    await controller.selectCategory(topsCategory);
    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 0,
      availableItemIds: topItems.map(({ id }) => id),
    });
    expect(messages(statusController).at(-1)).toBe("Tops selected.");
    expect(onError).not.toHaveBeenCalled();
  });

  it("publishes partial failures and reports how many", async () => {
    const failing = new Set(topItems.slice(0, 2).map(({ source }) => source));
    const { controller, appState, statusController, onError } = setup({ failing });
    await controller.selectCategory(topsCategory);

    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 2,
      availableItemIds: topItems.slice(2).map(({ id }) => id),
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toEqual(
      new Error(`2 of ${topItems.length} tops could not be loaded.`),
    );
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(messages(statusController)).not.toContain("Tops selected.");
  });

  it("loads every image of the category again when the category is selected again", async () => {
    const failing = new Set([topItems[0].source]);
    const { controller, imageLoader, appState, onError } = setup({ failing });
    await controller.selectCategory(topsCategory);
    expect(onError).toHaveBeenCalledOnce();

    failing.clear();
    imageLoader.loadImage.mockClear();
    await controller.selectCategory(topsCategory);
    expect(imageLoader.loadImage).toHaveBeenCalledTimes(topItems.length);
    expect(imageLoader.loadImage).toHaveBeenCalledWith(topItems[0].source);
    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 0,
      availableItemIds: topItems.map(({ id }) => id),
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("ignores a response that arrives after another category was selected", async () => {
    const { controller, imageLoader, appState, onError } = setup();
    const slow = deferred();
    imageLoader.loadImage.mockImplementationOnce(() => slow.promise);

    const pending = controller.selectCategory(topsCategory);
    await controller.selectCategory(dressesCategory);
    const result = appState.state.categoryLoad;
    slow.reject(new Error("late failure"));
    await pending;

    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "dresses",
      status: "ready",
      failedCount: 0,
    });
    expect(onError).not.toHaveBeenCalled();
    expect(appState.state.categoryLoad).toEqual(result);
  });

  it("does not publish a stale successful load after Reset restores tops", async () => {
    const { controller, imageLoader, appState, loaded } = setup();
    const slow = deferred();
    imageLoader.loadImage.mockImplementationOnce(() => slow.promise);
    const pending = controller.selectCategory(dressesCategory);
    loaded.add(topItems[0].source);
    controller.resetOutfit();
    const result = appState.state.categoryLoad;

    slow.resolve(document.createElement("img"));
    await pending;

    expect(appState.state.categoryLoad).toEqual(result);
    expect(result.categoryId).toBe("tops");
    expect(result.availableItemIds).toEqual([topItems[0].id]);
    expect(result.failedCount).toBe(topItems.length - 1);
  });

  it("ignores an earlier load when the same category is retried", async () => {
    const { controller, imageLoader, appState, onError } = setup();
    const slow = deferred();
    imageLoader.loadImage.mockImplementationOnce(() => slow.promise);

    const stale = controller.selectCategory(topsCategory);
    await controller.selectCategory(topsCategory);
    slow.reject(new Error("late failure"));
    await stale;

    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 0,
    });
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("starting the app", () => {
  it("survives the failure of an optional image of the initial category", async () => {
    const failing = new Set([otherTops[0].source]);
    const { controller, appState, canvasRenderer, imageLoader } = setup({ failing });
    await expect(controller.startApp()).resolves.toBeUndefined();

    expect(appState.isPreviewReady()).toBe(true);
    expect(appState.state.categoryLoad).toMatchObject({
      categoryId: "tops",
      status: "ready",
      failedCount: 1,
    });
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
    const hair = required(catalog.items.find(({ id }) => id === defaultOutfit.hair));
    const { controller, appState, canvasRenderer } = setup({ failing: new Set([hair.source]) });
    await expect(controller.startApp()).rejects.toThrow(
      `Could not load image asset: ${hair.source}`,
    );
    expect(appState.isPreviewReady()).toBe(false);
    expect(canvasRenderer.drawOutfit).not.toHaveBeenCalled();
  });
});

describe("preset selection and redraws", () => {
  it("publishes newly loaded active-category items when a preset completes", async () => {
    const preset = required(
      outfitPresets.find((entry) => entry.items.some((item) => item.category === "tops")),
    );
    const top = required(preset.items.find((item) => item.category === "tops"));
    const failing = new Set([top.source]);
    const { controller, imageLoader, appState } = setup({ failing });
    await controller.selectCategory(topsCategory);
    expect(appState.state.categoryLoad.availableItemIds).not.toContain(top.id);
    failing.clear();
    imageLoader.getMissingSourcesForPreset.mockReturnValue([top.source]);
    controller.selectOutfitById(preset.id);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appState.state.categoryLoad.availableItemIds).toEqual(topItems.map(({ id }) => id));
    expect(appState.state.categoryLoad.failedCount).toBe(0);
  });

  it("draws once after a preset finishes loading", async () => {
    const preset = required(outfitPresets.find(({ id }) => String(id) !== "001"));
    const source = required(preset.items[0]).source;
    const slow = deferred();
    const { controller, imageLoader, canvasRenderer, appState } = setup();
    imageLoader.getMissingSourcesForPreset.mockReturnValue([source]);
    imageLoader.loadImage.mockImplementation(() => slow.promise);

    controller.selectOutfitById(preset.id);

    expect(canvasRenderer.drawOutfit).not.toHaveBeenCalled();
    slow.resolve(document.createElement("img"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(appState.getOutfit()).toEqual(preset.look);
    expect(canvasRenderer.drawOutfit).toHaveBeenCalledOnce();
  });

  it("does not apply or redraw a preset load invalidated by Reset", async () => {
    const preset = required(outfitPresets.find(({ id }) => String(id) !== "001"));
    const source = required(preset.items[0]).source;
    const slow = deferred();
    const { controller, imageLoader, canvasRenderer, appState, onError } = setup();
    imageLoader.getMissingSourcesForPreset.mockReturnValue([source]);
    imageLoader.loadImage.mockImplementation(() => slow.promise);

    controller.selectOutfitById(preset.id);
    expect(appState.state.outfitControlsDisabled).toBe(true);
    controller.resetOutfit();

    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(appState.state.outfitControlsDisabled).toBe(false);
    expect(appState.state.pendingPresetId).toBeNull();
    expect(canvasRenderer.drawOutfit).toHaveBeenCalledOnce();
    slow.reject(new Error("stale failure"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(canvasRenderer.drawOutfit).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("releases controls and reports a current preset load failure", async () => {
    const preset = required(outfitPresets.find(({ id }) => id !== "001"));
    const slow = deferred();
    const { controller, imageLoader, appState, onError } = setup();
    imageLoader.getMissingSourcesForPreset.mockReturnValue([preset.items[0].source]);
    imageLoader.loadImage.mockImplementation(() => slow.promise);
    controller.selectOutfitById(preset.id);
    expect(appState.state.pendingPresetId).toBe(preset.id);
    slow.reject(new Error("load failed"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appState.getOutfit()).toEqual(defaultOutfit);
    expect(appState.state.pendingPresetId).toBeNull();
    expect(appState.state.outfitControlsDisabled).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("keeps a newer preset pending when an older load finishes", async () => {
    const first = outfitPresets[1];
    const second = outfitPresets[2];
    const old = deferred();
    const current = deferred();
    const { controller, imageLoader, appState } = setup();
    imageLoader.getMissingSourcesForPreset.mockReturnValue(["missing"]);
    imageLoader.loadImage.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    controller.selectOutfitById(first.id);
    controller.selectOutfitById(second.id);
    old.resolve(document.createElement("img"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appState.state.pendingPresetId).toBe(second.id);
    expect(appState.state.outfitControlsDisabled).toBe(true);
    current.resolve(document.createElement("img"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appState.getOutfit()).toEqual(second.look);
    expect(appState.state.outfitControlsDisabled).toBe(false);
  });

  it("navigates from a custom look and wraps around matching presets", () => {
    const { controller, appState } = setup();
    appState.setOutfitItem("tops", "custom");
    controller.selectAdjacentOutfit(-1);
    expect(appState.getOutfit()).toEqual(outfitPresets.at(-1)?.look);
    controller.selectAdjacentOutfit(1);
    expect(appState.getOutfit()).toEqual(outfitPresets[0].look);
  });

  it("reenables controls when a manual item invalidates a pending preset", async () => {
    const preset = outfitPresets[1];
    const slow = deferred();
    const { controller, imageLoader, appState, onError } = setup();
    imageLoader.getMissingSourcesForPreset.mockReturnValue(["missing"]);
    imageLoader.loadImage.mockImplementation(() => slow.promise);
    controller.selectOutfitById(preset.id);
    controller.selectItem(topItems[0]);
    expect(appState.state.outfitControlsDisabled).toBe(false);
    slow.reject(new Error("stale failure"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(appState.getOutfit().tops).toBe(topItems[0].id);
    expect(onError).not.toHaveBeenCalled();
  });
});
