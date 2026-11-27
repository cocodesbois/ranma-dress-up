/**
 * Coordinates look changes, exclusivity, async asset loads and UI redraws.
 * Depends on the catalog model, store, image loader, renderer, status UI and
 * reactive presentation state; exports createOutfitController.
 * @module ui/outfit-controller
 */
import type { Catalog, Category, Item, Look, OutfitPreset } from "../types";
import type { Store } from "../core/state-store";
import type * as CatalogModel from "../core/catalog-model";
import type { createStatusController } from "./status-controller";
import type { createImageLoader } from "../render/image-loader";
import type { createCanvasRenderer } from "../render/canvas-renderer";

/** Connect state and presentation without binding browser events. */
export function createOutfitController({
  catalog,
  catalogModel,
  outfitPresets,
  defaultOutfit,
  appState,
  statusController,
  imageLoader,
  canvasRenderer,
  onError,
}: {
  catalog: Catalog;
  catalogModel: typeof CatalogModel;
  outfitPresets: OutfitPreset[];
  defaultOutfit: Look;
  appState: Store;
  statusController: ReturnType<typeof createStatusController>;
  imageLoader: ReturnType<typeof createImageLoader>;
  canvasRenderer: ReturnType<typeof createCanvasRenderer>;
  onError: (error: unknown) => void;
}) {
  /** Select a loaded item in the active category and clear exclusive selections. */
  function selectItem(item: Item) {
    appState.nextOutfitSelectionRequest();
    appState.setPendingPreset(null);
    appState.clearOutfitItems(
      catalogModel.getExcludedCategories(catalog, appState.getActiveCategory()),
    );
    appState.setOutfitItem(appState.getActiveCategory(), item.id);
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage(`${item.label} selected.`);
  }

  /** Clear the active category; the wardrobe UI does not offer this for hair. */
  function removeActiveCategoryItem() {
    appState.nextOutfitSelectionRequest();
    appState.setPendingPreset(null);
    appState.setOutfitItem(appState.getActiveCategory(), null);
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage("Item removed.");
  }

  /**
   * Log every rejected result of Promise.allSettled.
   * @returns How many loads failed.
   */
  function logRejections(results: PromiseSettledResult<unknown>[]) {
    const failures = results.filter((result) => result.status === "rejected");
    for (const failure of failures) {
      console.error(failure.reason);
    }
    return failures.length;
  }

  /**
   * Load category images, then publish the result only if that request is still current.
   * The reactive wardrobe shows loaded items and offers a retry for failed images.
   * @returns Load errors are forwarded to onError.
   */
  async function selectCategory(category: Category) {
    const request = appState.startCategoryLoad(category.id);
    statusController.setStatusMessage(`Loading ${category.label.toLowerCase()}...`, {
      loading: true,
    });

    try {
      const items = catalog.items.filter((entry) => entry.category === category.id);
      const results = await Promise.allSettled(
        items.map((item) => imageLoader.loadImage(item.source)),
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;
      if (!appState.finishCategoryLoad(request, failedCount)) {
        return;
      }

      logRejections(results);
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
    appState.setPendingPreset(String(preset.id), missingSources.length > 0);

    try {
      if (missingSources.length) {
        statusController.setStatusMessage(`Loading ${preset.label.toLowerCase()}...`, {
          loading: true,
        });
        await Promise.all(missingSources.map((source) => imageLoader.loadImage(source)));
      }

      if (!appState.isCurrentOutfitSelectionRequest(request)) {
        return;
      }

      appState.setOutfit(preset.look);
      appState.setCategoryLoadResult(
        appState.getActiveCategory(),
        catalog.items.filter(
          (item) =>
            item.category === appState.getActiveCategory() && !imageLoader.getSprite(item.source),
        ).length,
      );
      canvasRenderer.drawOutfit();
      statusController.setStatusMessage(`${preset.label} selected.`);
      imageLoader.preloadAdjacentOutfits(preset);
    } catch (error) {
      if (appState.isCurrentOutfitSelectionRequest(request)) {
        onError(error);
      }
    } finally {
      if (appState.isCurrentOutfitSelectionRequest(request)) {
        appState.setPendingPreset(null);
      }
    }
  }

  function getPresetIndexByCurrentSelection() {
    if (appState.state.pendingPresetId) {
      const selectedIndex = outfitPresets.findIndex(
        (preset) => String(preset.id) === appState.state.pendingPresetId,
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
   * @param step - Navigation offset, normally -1 or 1.
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

  /** Restore the default look and tops category, invalidating pending selections. */
  function resetOutfit() {
    appState.nextOutfitSelectionRequest();
    appState.setPendingPreset(null);
    appState.setOutfit(defaultOutfit);
    appState.setCategoryLoadResult(
      "tops",
      catalog.items.filter(
        (item) => item.category === "tops" && !imageLoader.getSprite(item.source),
      ).length,
    );
    canvasRenderer.drawOutfit();
    statusController.setStatusMessage("The original look has been restored.");
  }

  /**
   * Load the initial scene and look, build the UI and warm remaining presets. Items of the
   * initial category that fail to load are not fatal: the wardrobe offers a retry for them.
   * @throws Failures to load the scene or the initial look reject for the caller to report.
   */
  async function startApp() {
    statusController.setStatusMessage("Loading the wardrobe...", { loading: true });
    const categoryRequest = appState.startCategoryLoad(appState.getActiveCategory());
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
    const optionalResults = await Promise.allSettled(
      optionalSources.map((source) => imageLoader.loadImage(source)),
    );
    const failedOptionalCount = optionalResults.filter(
      (result) => result.status === "rejected",
    ).length;
    appState.finishCategoryLoad(categoryRequest, failedOptionalCount);
    logRejections(optionalResults);
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

  /** Start selecting a known preset; ignore an ID not found in the preset list. */
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
