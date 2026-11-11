export function createCanvasRenderer({
  preview,
  catalog,
  manifest,
  getSprite,
  getOutfit,
  isPreviewReady,
}) {
  const previewContext = preview.getContext("2d");
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
    "accessories",
  ];

  if (!previewContext) {
    throw new Error("This browser does not support the canvas preview.");
  }

  // The preview shows the whole Photoshop document: the background is drawn in full and
  // every sprite keeps its position on it. Drawing units are `placement.scale` times the
  // document pixels, with the document's top-left corner at (0, 0).
  const documentWidth = manifest.document.width;
  const documentHeight = manifest.document.height;
  const stageScale = catalog.base.placement.scale;
  const previewWidth = documentWidth * stageScale;
  const previewHeight = documentHeight * stageScale;
  const originX = catalog.base.placement.x - catalog.base.placement.regX * stageScale;
  const originY = catalog.base.placement.y - catalog.base.placement.regY * stageScale;
  // Soft floor shadow under the character, in document pixels.
  const shadow = { x: 3700, y: 5587, radiusX: 806, radiusY: 104 };

  preview.style.aspectRatio = `${documentWidth} / ${documentHeight}`;

  function requireSprite(item) {
    const sprite = getSprite(item);
    if (!sprite) {
      throw new Error(`Image is not loaded: ${item.source}`);
    }
    return sprite;
  }

  function drawItem(context, item) {
    const sprite = requireSprite(item);
    const { x, y, scale, regX, regY } = item.placement;
    const left = x - regX * scale + sprite.x * scale - originX;
    const top = y - regY * scale + sprite.y * scale - originY;

    context.drawImage(sprite.image, left, top, sprite.width * scale, sprite.height * scale);
  }

  function drawBackground(context) {
    context.drawImage(requireSprite(catalog.background).image, 0, 0, previewWidth, previewHeight);
  }

  function drawOutfit() {
    const context = previewContext;
    // High quality filtering avoids aliasing when the sprites are scaled down to the screen.
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, previewWidth, previewHeight);
    drawBackground(context);

    context.fillStyle = "rgba(65, 47, 39, 0.14)";
    context.beginPath();
    context.ellipse(
      shadow.x * stageScale,
      shadow.y * stageScale,
      shadow.radiusX * stageScale,
      shadow.radiusY * stageScale,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    drawItem(context, catalog.base);

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

      drawItem(context, item);
    }
  }

  function resizePreview() {
    const bounds = preview.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
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
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mediaQuery.addEventListener(
      "change",
      () => {
        resizePreview();
        watchDevicePixelRatio();
      },
      { once: true },
    );
  }

  return {
    drawOutfit,
    resizePreview,
    watchDevicePixelRatio,
  };
}
