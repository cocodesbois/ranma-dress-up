/**
 * Binds page events, PNG download and preview resize/startup observation.
 * Depends on injected controls/controllers and browser document/window APIs;
 * exports createAppBootstrap, leaving dependency construction to main.
 * @module app-bootstrap
 */
import type { createOutfitController } from "./ui/outfit-controller";
import type { createStatusController } from "./ui/status-controller";
import type { createWardrobePanelController } from "./ui/wardrobe-panel-controller";
import type { createCanvasRenderer } from "./render/canvas-renderer";

/**
 * Prepare page lifecycle actions without starting or binding them yet.
 * @param {object} options
 * @param {HTMLCanvasElement} options.preview
 * @param {HTMLButtonElement} options.resetButton
 * @param {HTMLButtonElement} options.downloadButton
 * @param {HTMLSelectElement} options.outfitSelect
 * @param {HTMLButtonElement} options.outfitPreviousButton
 * @param {HTMLButtonElement} options.outfitNextButton
 * @param {ReturnType<import("./ui/outfit-controller").createOutfitController>} options.outfitController
 * @param {ReturnType<import("./ui/status-controller").createStatusController>} options.statusController
 * @param {ReturnType<import("./ui/wardrobe-panel-controller").createWardrobePanelController>} options.wardrobePanelController
 * @param {ReturnType<import("./render/canvas-renderer").createCanvasRenderer>} options.canvasRenderer
 * @param {(error: unknown) => void} options.onError
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
}: {
  preview: HTMLCanvasElement;
  resetButton: HTMLButtonElement;
  downloadButton: HTMLButtonElement;
  outfitSelect: HTMLSelectElement;
  outfitPreviousButton: HTMLButtonElement;
  outfitNextButton: HTMLButtonElement;
  outfitController: ReturnType<typeof createOutfitController>;
  statusController: ReturnType<typeof createStatusController>;
  wardrobePanelController: ReturnType<typeof createWardrobePanelController>;
  canvasRenderer: ReturnType<typeof createCanvasRenderer>;
  onError: (error: unknown) => void;
}) {
  /**
   * Save the current look as a PNG of fixed size, whatever the window size or pixel ratio.
   * @returns {Promise<void>} Export errors are forwarded to onError.
   */
  async function downloadPreview() {
    downloadButton.disabled = true;
    try {
      statusController.setStatusMessage("Preparing your look...", { loading: true });
      const blob = await canvasRenderer.exportPreview();
      if (!blob) {
        statusController.setStatusMessage("The preview could not be saved.", { isError: true });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ranma-dress-up.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      statusController.setStatusMessage("Your look has been downloaded.");
    } catch (error) {
      onError(error);
    } finally {
      downloadButton.disabled = false;
    }
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

    if (typeof ResizeObserver !== "undefined") {
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
