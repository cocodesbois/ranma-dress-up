(function registerImageLoader(windowObject) {
  function createImageLoader({ outfitPresets, onError = console.error } = {}) {
    const imageCache = new Map();

    function loadImage(source) {
      if (imageCache.has(source)) {
        return imageCache.get(source);
      }

      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load image asset: ${source}`));
        image.src = source;
      }).then(
        (image) => {
          imageCache.set(source, image);
          return image;
        },
        (error) => {
          imageCache.delete(source);
          throw error;
        }
      );

      imageCache.set(source, promise);
      return promise;
    }

    function getImage(source) {
      return imageCache.get(source);
    }

    function getMissingSourcesForPreset(preset) {
      const missing = [];
      for (const item of preset.items) {
        if (!imageCache.has(item.source)) {
          missing.push(item.source);
        }
      }
      return missing;
    }

    function preloadPresetAssets(preset) {
      for (const item of preset.items) {
        Promise.resolve(loadImage(item.source)).catch((error) => {
          onError(error);
        });
      }
    }

    function preloadAdjacentOutfits(preset, distance = 2) {
      const currentIndex = outfitPresets.findIndex((entry) => String(entry.id) === String(preset.id));
      if (currentIndex < 0) {
        return;
      }

      for (let step = 1; step <= distance; step++) {
        const nextIndex = (currentIndex + step) % outfitPresets.length;
        const previousIndex = (currentIndex - step + outfitPresets.length) % outfitPresets.length;
        preloadPresetAssets(outfitPresets[nextIndex]);
        preloadPresetAssets(outfitPresets[previousIndex]);
      }
    }

    function preloadAllOutfitsInBackground() {
      const allSources = [...new Set(outfitPresets.flatMap((preset) => preset.items.map((item) => item.source)))];
      let cursor = 0;
      const chunkSize = 6;
      const schedule = "requestIdleCallback" in windowObject
        ? (callback) => windowObject.requestIdleCallback(callback, { timeout: 280 })
        : (callback) => windowObject.setTimeout(callback, 0);

      const loadChunk = () => {
        const end = Math.min(cursor + chunkSize, allSources.length);
        for (; cursor < end; cursor++) {
          Promise.resolve(loadImage(allSources[cursor])).catch((error) => {
            onError(error);
          });
        }

        if (cursor < allSources.length) {
          schedule(loadChunk);
        }
      };

      schedule(loadChunk);
    }

    return {
      loadImage,
      getImage,
      getMissingSourcesForPreset,
      preloadAdjacentOutfits,
      preloadAllOutfitsInBackground
    };
  }

  windowObject.RanmaDressUpImageLoader = { createImageLoader };
}(window));
