/**
 * Coordinates look changes, exclusivity, async asset loads and UI redraws.
 * Depends on the catalog model, store, image loader, renderer, wardrobe/status UI
 * and preset select; exports createOutfitController.
 * @module ui/outfit-controller
 */
import type { Catalog, Category, Item, Look, OutfitPreset } from "../types";
import type { Store } from "../core/state-store";
import type * as CatalogModel from "../core/catalog-model";
import type { createStatusController } from "./status-controller";
import type { createImageLoader } from "../render/image-loader";
import type { createCanvasRenderer } from "../render/canvas-renderer";
import type { createWardrobeUi } from "./wardrobe-ui";

/**
 * Connect state and presentation without binding browser events.
 * @param {object} options
 * @param {import("../types").Catalog} options.catalog
 * @param {typeof import("../core/catalog-model")} options.catalogModel
 * @param {import("../types").OutfitPreset[]} options.outfitPresets
 * @param {import("../types").Look} options.defaultOutfit
 * @param {import("../core/state-store").Store} options.appState
 * @param {HTMLSelectElement} options.outfitSelect
 * @param {ReturnType<import("./status-controller").createStatusController>} options.statusController
 * @param {ReturnType<import("../render/image-loader").createImageLoader>} options.imageLoader
 * @param {ReturnType<import("../render/canvas-renderer").createCanvasRenderer>} options.canvasRenderer
 * @param {ReturnType<import("./wardrobe-ui").createWardrobeUi>} options.wardrobeUi
 * @param {(error: unknown) => void} options.onError
 */
export function createOutfitController({
  catalog,
  catalogModel,
  outfitPresets,
  defaultOutfit,
  appState,
  outfitSelect,
  statusController,
  imageLoader,
  canvasRenderer,
  wardrobeUi,
  onError,
}: {
  catalog: Catalog;
  catalogModel: typeof CatalogModel;
  outfitPresets: OutfitPreset[];
  defaultOutfit: Look;
  appState: Store;
  outfitSelect: HTMLSelectElement;
  statusController: ReturnType<typeof createStatusController>;
  imageLoader: ReturnType<typeof createImageLoader>;
  canvasRenderer: ReturnType<typeof createCanvasRenderer>;
  wardrobeUi: ReturnType<typeof createWardrobeUi>;
  onError: (error: unknown) => void;
}) {
  function updateOutfitSelection() {
    const matchingOutfit = catalogModel.getMatchingOutfit(
      catalog,
      outfitPresets,
      appState.getOutfit(),
    );
    outfitSelect.value = matchingOutfit ? String(matchingOutfit.id) : "";
  }

  /**
   * Select a loaded item in the active category and clear exclusive selections.
   * @param {import("../types").Item} item
   * @returns {void}
   */
  function selectItem(item: Item) {
    appState.nextOutfitSelectionRequest();
    appState.clearOutfitItems(
      catalogModel.getExcludedCategories(catalog, appState.getActiveCategory()),
    );
    appState.setOutfitItem(appState.getActiveCategory(), item.id);
    updateOutfitSelection();
    wardrobeUi.updateItemSelection();
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage(`${item.label} selected.`);
  }

  /**
   * Clear the active category; the wardrobe UI does not offer this for hair.
   * @returns {void}
   */
  function removeActiveCategoryItem() {
    appState.nextOutfitSelectionRequest();
    appState.setOutfitItem(appState.getActiveCategory(), null);
    updateOutfitSelection();
    wardrobeUi.updateItemSelection();
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage("Item removed.");
  }

  /**
   * Log every rejected result of Promise.allSettled.
   * @param {PromiseSettledResult<unknown>[]} results
   * @returns {number} How many loads failed.
   */
  function logRejections(results: PromiseSettledResult<unknown>[]) {
    const failures = results.filter((result) => result.status === "rejected");
    for (const failure of failures) {
      console.error(failure.reason);
    }
    return failures.length;
  }

  /**
   * Load category images, then render only if that category is still active. Images that
   * fail to load do not empty the grid: the loaded items are shown, and the wardrobe offers
   * a retry for the others.
   * @param {import("../types").Category} category
   * @returns {Promise<void>} Load errors are forwarded to onError.
   */
  async function selectCategory(category: Category) {
    appState.setActiveCategory(category.id);
    wardrobeUi.renderCategories();
    wardrobeUi.clearItems();
    statusController.setStatusMessage(`Loading ${category.label.toLowerCase()}...`, {
      loading: true,
    });

    try {
      const items = catalog.items.filter((entry) => entry.category === category.id);
      const results = await Promise.allSettled(
        items.map((item) => imageLoader.loadImage(item.source)),
      );
      if (appState.getActiveCategory() !== category.id) {
        return;
      }

      wardrobeUi.renderItems();
      const failedCount = logRejections(results);
      if (failedCount) {
        onError(
          new Error(
            `${failedCount} of ${items.length} ${category.label.toLowerCase()} could not be loaded.`,
          ),
        );
        return;
      }
      statusController.setStatusMessage(`${category.label} selected.`);
    } catch (error) {
      onError(error);
    }
  }

  async function selectOutfit(preset: OutfitPreset) {
    const request = appState.nextOutfitSelectionRequest();
    const missingSources = imageLoader.getMissingSourcesForPreset(preset);

    try {
      if (missingSources.length) {
        statusController.setStatusMessage(`Loading ${preset.label.toLowerCase()}...`, {
          loading: true,
        });
        statusController.setOutfitControlsDisabled(true);
        await Promise.all(missingSources.map((source) => imageLoader.loadImage(source)));
      }

      if (!appState.isCurrentOutfitSelectionRequest(request)) {
        return;
      }

      appState.setOutfit(preset.look);
      updateOutfitSelection();
      wardrobeUi.renderCategories();
      wardrobeUi.renderItems();
      canvasRenderer.drawOutfit();
      statusController.setStatusMessage(`${preset.label} selected.`);
      imageLoader.preloadAdjacentOutfits(preset);
    } catch (error) {
      onError(error);
    } finally {
      if (appState.isCurrentOutfitSelectionRequest(request)) {
        statusController.setOutfitControlsDisabled(false);
      }
    }
  }

  function getPresetIndexByCurrentSelection() {
    if (outfitSelect.value) {
      const selectedIndex = outfitPresets.findIndex(
        (preset) => String(preset.id) === outfitSelect.value,
      );
      if (selectedIndex >= 0) {
        return selectedIndex;
      }
    }

    const matchingPreset = catalogModel.getMatchingOutfit(
      catalog,
      outfitPresets,
      appState.getOutfit(),
    );
    if (matchingPreset) {
      return outfitPresets.findIndex((preset) => String(preset.id) === String(matchingPreset.id));
    }

    return -1;
  }

  /**
   * Start a neighboring preset load, wrapping at either end of the list.
   * @param {number} step Navigation offset, normally -1 or 1.
   * @returns {void}
   */
  function selectAdjacentOutfit(step: number) {
    if (!outfitPresets.length) {
      return;
    }

    const currentIndex = getPresetIndexByCurrentSelection();
    const nextIndex =
      currentIndex < 0
        ? step > 0
          ? 0
          : outfitPresets.length - 1
        : (currentIndex + step + outfitPresets.length) % outfitPresets.length;
    const preset = outfitPresets[nextIndex];
    if (preset) {
      selectOutfit(preset);
    }
  }

  /**
   * Restore the default look and tops category, invalidating pending selections.
   * @returns {void}
   */
  function resetOutfit() {
    appState.nextOutfitSelectionRequest();
    appState.setOutfit(defaultOutfit);
    appState.setActiveCategory("tops");
    updateOutfitSelection();
    wardrobeUi.renderCategories();
    wardrobeUi.renderItems();
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage("The original look has been restored.");
  }

  /**
   * Load the initial scene and look, build the UI and warm remaining presets. Items of the
   * initial category that fail to load are not fatal: the wardrobe offers a retry for them.
   * @returns {Promise<void>}
   * @throws {Error} Failures to load the scene or the initial look reject for bootstrap to report.
   */
  async function startApp() {
    statusController.setStatusMessage("Loading the wardrobe...", { loading: true });
    const requiredSources = new Set([
      catalog.background.source,
      catalog.base.source,
      ...catalog.items
        .filter((item) => appState.getOutfit()[item.category] === item.id)
        .map((item) => item.source),
    ]);
    const optionalSources = catalog.items
      .filter((item) => item.category === appState.getActiveCategory())
      .map((item) => item.source)
      .filter((source) => !requiredSources.has(source));

    await Promise.all([...requiredSources].map((source) => imageLoader.loadImage(source)));
    logRejections(
      await Promise.allSettled(optionalSources.map((source) => imageLoader.loadImage(source))),
    );
    for (const preset of outfitPresets) {
      const option = document.createElement("option");
      option.value = String(preset.id);
      option.textContent = preset.label;
      outfitSelect.append(option);
    }
    updateOutfitSelection();
    wardrobeUi.renderCategories();
    wardrobeUi.renderItems();
    appState.setPreviewReady(true);
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage("Choose an item to style the character.");
    const selectedPreset = catalogModel.getMatchingOutfit(
      catalog,
      outfitPresets,
      appState.getOutfit(),
    );
    if (selectedPreset) {
      imageLoader.preloadAdjacentOutfits(selectedPreset);
    }
    imageLoader.preloadAllOutfitsInBackground();
  }

  /**
   * Start selecting a known preset; ignore an ID not found in the preset list.
   * @param {string | number} outfitId
   * @returns {void}
   */
  function selectOutfitById(outfitId: string | number) {
    const preset = catalogModel.findPresetById(outfitPresets, outfitId);
    if (preset) {
      selectOutfit(preset);
    }
  }

  return {
    selectItem,
    removeActiveCategoryItem,
    selectCategory,
    selectAdjacentOutfit,
    selectOutfitById,
    resetOutfit,
    startApp,
  };
}
