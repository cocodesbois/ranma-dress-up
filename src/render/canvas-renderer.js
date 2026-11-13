/**
 * Composes document-aligned layers, resizes the preview for device density and exports a
 * fixed-size PNG.
 * Depends on injected catalog, manifest, decoded sprites and state getters,
 * plus browser canvas/media APIs; exports createCanvasRenderer.
 * @module render/canvas-renderer
 */

/**
 * Configure the canvas geometry and fixed layer order without loading images.
 * @param {object} options
 * @param {HTMLCanvasElement} options.preview
 * @param {import("../types.js").Catalog} options.catalog
 * @param {import("../types.js").SpriteManifest} options.manifest
 * @param {(item: import("../types.js").Layer | {source: string}) => import("../types.js").Sprite | undefined} options.getSprite
 * @param {() => import("../types.js").Look} options.getOutfit
 * @param {() => boolean} options.isPreviewReady
 * @throws {Error} If a 2D context is unavailable.
 */
export function createCanvasRenderer({
  preview,
  catalog,
  manifest,
  getSprite,
  getOutfit,
  isPreviewReady,
}) {
  // Width in pixels of the image saved by the download button, whatever the screen.
  const exportWidth = 2400;
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

  const itemsById = new Map(catalog.items.map((item) => [item.id, item]));

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

  /**
   * Paint background, floor shadow, base and selected wearables in fixed order, in stage
   * units: the caller sets the context transform.
   * @param {CanvasRenderingContext2D} context
   * @returns {void}
   * @throws {Error} If a selected item is unknown or its image is not loaded.
   */
  function paintOutfit(context) {
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

      const item = itemsById.get(selectedId);
      if (!item) {
        throw new Error(`Unknown outfit item: ${selectedId}.`);
      }

      drawItem(context, item);
    }
  }

  /**
   * Draw the current look on the visible preview.
   * @returns {void}
   * @throws {Error} If a selected item is unknown or its image is not loaded.
   */
  function drawOutfit() {
    paintOutfit(previewContext);
  }

  /**
   * Render the current look on an offscreen canvas of fixed size, independent of the window
   * and pixel ratio. The width never exceeds the decoded sprites' own resolution.
   * @param {number} [width] Output width in pixels; defaults to 2400.
   * @returns {Promise<Blob | null>} PNG data, or null if the browser could not encode it.
   * @throws {Error} If a 2D context is unavailable or an image is not loaded.
   */
  function exportPreview(width = exportWidth) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(width, Math.round(documentWidth * manifest.settings.scale));
    canvas.height = Math.round((canvas.width * documentHeight) / documentWidth);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser cannot export the preview.");
    }

    context.setTransform(canvas.width / previewWidth, 0, 0, canvas.height / previewHeight, 0, 0);
    paintOutfit(context);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  /**
   * Fit the backing canvas to its CSS bounds and redraw only after startup.
   * @returns {void}
   */
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

  /**
   * Re-arm a one-shot resolution listener after each device-density change.
   * @returns {void}
   */
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
    exportPreview,
    resizePreview,
    watchDevicePixelRatio,
  };
}
