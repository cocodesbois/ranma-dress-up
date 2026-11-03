(function registerCanvasRenderer(windowObject) {
  function createCanvasRenderer({
    preview,
    catalog,
    getImage,
    getOutfit,
    isPreviewReady
  }) {
    const previewContext = preview.getContext("2d");
    const previewWidth = 960;
    const previewHeight = 1080;
    const layerOrder = [
      "underwear",
      "slips",
      "tights",
      "bodysuits",
      "pants",
      "tops",
      "shoes",
      "dresses",
      "hair",
      "hats",
      "necklace",
      "bracelets",
      "accessories"
    ];

    if (!previewContext) {
      throw new Error("This browser does not support the canvas preview.");
    }

    function drawItem(context, item, offsetX = 0) {
      const image = getImage(item);
      const { x, y, scale, regX, regY } = item.placement;
      const left = x - regX * scale + offsetX;
      const top = y - regY * scale;

      context.drawImage(image, left, top, image.naturalWidth * scale, image.naturalHeight * scale);
    }

    function drawBackground(context) {
      const image = getImage(catalog.background);
      const scale = Math.max(previewWidth / image.naturalWidth, previewHeight / image.naturalHeight);
      const sourceWidth = previewWidth / scale;
      const sourceHeight = previewHeight / scale;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) / 2;

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        previewWidth,
        previewHeight
      );
    }

    function drawOutfit() {
      const context = previewContext;
      context.clearRect(0, 0, previewWidth, previewHeight);
      drawBackground(context);

      context.fillStyle = "rgba(65, 47, 39, 0.14)";
      context.beginPath();
      context.ellipse(480, 969, 145, 17, 0, 0, Math.PI * 2);
      context.fill();

      drawItem(context, catalog.base, -480);

      const outfit = getOutfit();
      for (const category of layerOrder) {
        const selectedId = outfit[category];
        if (!selectedId) {
          continue;
        }

        const item = catalog.items.find((entry) => entry.id === selectedId);
        if (!item) {
          throw new Error(`Unknown outfit item: ${selectedId}.`);
        }

        drawItem(context, item, -480);
      }
    }

    function resizePreview() {
      const bounds = preview.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        return;
      }

      const pixelRatio = windowObject.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (preview.width !== width || preview.height !== height) {
        preview.width = width;
        preview.height = height;
      }

      previewContext.setTransform(width / previewWidth, 0, 0, height / previewHeight, 0, 0);
      if (isPreviewReady()) {
        drawOutfit();
      }
    }

    function watchDevicePixelRatio() {
      const mediaQuery = windowObject.matchMedia(`(resolution: ${windowObject.devicePixelRatio || 1}dppx)`);
      mediaQuery.addEventListener("change", () => {
        resizePreview();
        watchDevicePixelRatio();
      }, { once: true });
    }

    return {
      drawOutfit,
      resizePreview,
      watchDevicePixelRatio
    };
  }

  windowObject.RanmaDressUpCanvasRenderer = { createCanvasRenderer };
}(window));
