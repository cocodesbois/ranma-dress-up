(function registerOutfitController(windowObject) {
  function createOutfitController({
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
    onError
  }) {
    function updateOutfitSelection() {
      const matchingOutfit = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
      outfitSelect.value = matchingOutfit ? String(matchingOutfit.id) : "";
    }

    function selectItem(item) {
      appState.nextOutfitSelectionRequest();
      const mutuallyExclusiveCategories = {
        bodysuits: ["tops", "pants", "dresses"],
        tops: ["bodysuits"],
        pants: ["bodysuits", "dresses"],
        dresses: ["bodysuits", "pants"]
      };
      appState.clearOutfitItems(mutuallyExclusiveCategories[appState.getActiveCategory()] ?? []);
      appState.setOutfitItem(appState.getActiveCategory(), item.id);
      updateOutfitSelection();
      wardrobeUi.updateItemSelection();
      canvasRenderer.drawOutfit();
      statusController.setStatusMessage(`${item.label} selected.`);
    }

    function removeActiveCategoryItem() {
      appState.nextOutfitSelectionRequest();
      appState.setOutfitItem(appState.getActiveCategory(), null);
      updateOutfitSelection();
      wardrobeUi.updateItemSelection();
      canvasRenderer.drawOutfit();
      statusController.setStatusMessage("Item removed.");
    }

    async function selectCategory(category) {
      appState.setActiveCategory(category.id);
      wardrobeUi.renderCategories();
      wardrobeUi.clearItems();
      statusController.setStatusMessage(`Loading ${category.label.toLowerCase()}...`, { loading: true });

      try {
        const items = catalog.items.filter((entry) => entry.category === category.id);
        await Promise.all(items.map((item) => imageLoader.loadImage(item.source)));
        if (appState.getActiveCategory() !== category.id) {
          return;
        }

        wardrobeUi.renderItems();
        statusController.setStatusMessage(`${category.label} selected.`);
      } catch (error) {
        onError(error);
      }
    }

    async function selectOutfit(preset) {
      const request = appState.nextOutfitSelectionRequest();
      const missingSources = imageLoader.getMissingSourcesForPreset(preset);

      try {
        if (missingSources.length) {
          statusController.setStatusMessage(`Loading ${preset.label.toLowerCase()}...`, { loading: true });
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
        const selectedIndex = outfitPresets.findIndex((preset) =>
          String(preset.id) === outfitSelect.value
        );
        if (selectedIndex >= 0) {
          return selectedIndex;
        }
      }

      const matchingPreset = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
      if (matchingPreset) {
        return outfitPresets.findIndex((preset) => String(preset.id) === String(matchingPreset.id));
      }

      return -1;
    }

    function selectAdjacentOutfit(step) {
      if (!outfitPresets.length) {
        return;
      }

      const currentIndex = getPresetIndexByCurrentSelection();
      const nextIndex = currentIndex < 0
        ? (step > 0 ? 0 : outfitPresets.length - 1)
        : (currentIndex + step + outfitPresets.length) % outfitPresets.length;
      const preset = outfitPresets[nextIndex];
      if (preset) {
        selectOutfit(preset);
      }
    }

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

    async function startApp() {
      statusController.setStatusMessage("Loading the wardrobe...", { loading: true });
      const initialSources = new Set([
        catalog.background.source,
        catalog.base.source,
        ...catalog.items
          .filter((item) => appState.getOutfit()[item.category] === item.id)
          .map((item) => item.source),
        ...catalog.items
          .filter((item) => item.category === appState.getActiveCategory())
          .map((item) => item.source)
      ]);

      await Promise.all([...initialSources].map((source) => imageLoader.loadImage(source)));
      for (const preset of outfitPresets) {
        const option = windowObject.document.createElement("option");
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
      const selectedPreset = catalogModel.getMatchingOutfit(catalog, outfitPresets, appState.getOutfit());
      if (selectedPreset) {
        imageLoader.preloadAdjacentOutfits(selectedPreset);
      }
      imageLoader.preloadAllOutfitsInBackground();
    }

    function selectOutfitById(outfitId) {
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
      startApp
    };
  }

  windowObject.RanmaDressUpOutfitController = { createOutfitController };
}(window));
