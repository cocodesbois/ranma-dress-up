/**
 * Binds page events, PNG download and preview resize/startup observation.
 * Depends on injected controls/controllers and browser document/window APIs;
 * exports createAppBootstrap, leaving dependency construction to main.
 * @module app-bootstrap
 */

/**
 * Prepare page lifecycle actions without starting or binding them yet.
 * @param {object} options
 * @param {HTMLCanvasElement} options.preview
 * @param {HTMLButtonElement} options.resetButton
 * @param {HTMLButtonElement} options.downloadButton
 * @param {HTMLSelectElement} options.outfitSelect
 * @param {HTMLButtonElement} options.outfitPreviousButton
 * @param {HTMLButtonElement} options.outfitNextButton
 * @param {ReturnType<import("./ui/outfit-controller.js").createOutfitController>} options.outfitController
 * @param {ReturnType<import("./ui/status-controller.js").createStatusController>} options.statusController
 * @param {ReturnType<import("./ui/wardrobe-panel-controller.js").createWardrobePanelController>} options.wardrobePanelController
 * @param {ReturnType<import("./render/canvas-renderer.js").createCanvasRenderer>} options.canvasRenderer
 * @param {(error: Error) => void} options.onError
 */
export function createAppBootstrap({
  preview,
  resetButton,
  downloadButton,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton,
  outfitController,
  statusController,
  wardrobePanelController,
  canvasRenderer,
  onError,
}) {
  function downloadPreview() {
    preview.toBlob((blob) => {
      if (!blob) {
        statusController.setStatusMessage("The preview could not be saved.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ranma-dress-up.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      statusController.setStatusMessage("Your look has been downloaded.");
    }, "image/png");
  }

  /**
   * Register page and wardrobe handlers once after dependency construction.
   * @returns {void}
   */
  function bindEvents() {
    resetButton.addEventListener("click", () => outfitController.resetOutfit());
    downloadButton.addEventListener("click", downloadPreview);
    outfitSelect.addEventListener("change", () =>
      outfitController.selectOutfitById(outfitSelect.value),
    );
    outfitPreviousButton.addEventListener("click", () => outfitController.selectAdjacentOutfit(-1));
    outfitNextButton.addEventListener("click", () => outfitController.selectAdjacentOutfit(1));
    wardrobePanelController.bindEvents();
  }

  /**
   * Synchronize layout, observe resizing and start loading the initial look.
   * @returns {void} Startup rejection is forwarded to onError.
   */
  function start() {
    wardrobePanelController.syncWardrobeMode();

    if ("ResizeObserver" in window) {
      new ResizeObserver(canvasRenderer.resizePreview).observe(preview);
    } else {
      window.addEventListener("resize", canvasRenderer.resizePreview);
    }

    canvasRenderer.watchDevicePixelRatio();
    canvasRenderer.resizePreview();
    outfitController.startApp().catch((error) => {
      onError(error);
    });
  }

  return {
    bindEvents,
    start,
  };
}
