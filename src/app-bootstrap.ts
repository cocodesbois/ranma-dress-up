/**
 * Owns preview resize observation and download side effects for the mounted app.
 * Depends on injected canvas/controllers and browser APIs; exports createAppBootstrap.
 * @module app-bootstrap
 */
import type { createStatusController } from "./ui/status-controller";
import type { createCanvasRenderer } from "./render/canvas-renderer";

/** Prepare lifecycle actions after the Vue-owned preview canvas has mounted. */
export function createAppBootstrap({
  preview,
  outfitController,
  statusController,
  canvasRenderer,
  onError,
  isDownloadPending,
  setDownloadPending,
}: {
  preview: HTMLCanvasElement;
  outfitController: { startApp: () => Promise<void> };
  statusController: ReturnType<typeof createStatusController>;
  canvasRenderer: ReturnType<typeof createCanvasRenderer>;
  onError: (error: unknown) => void;
  isDownloadPending: () => boolean;
  setDownloadPending: (pending: boolean) => void;
}) {
  let started = false;
  let disposed = false;
  let resizeObserver: ResizeObserver | undefined;
  let watchingDevicePixelRatio: (() => void) | undefined;

  /**
   * Save the current look as a fixed-size PNG, independent of screen size and pixel ratio.
   * @returns Export errors are forwarded to onError.
   */
  async function downloadPreview() {
    if (isDownloadPending()) return;
    setDownloadPending(true);
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
      setDownloadPending(false);
    }
  }

  /** Observe size and density changes and begin loading the initial look once. */
  function start() {
    if (started || disposed) return;
    started = true;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(canvasRenderer.resizePreview);
      resizeObserver.observe(preview);
    } else {
      window.addEventListener("resize", canvasRenderer.resizePreview);
    }

    watchingDevicePixelRatio = canvasRenderer.watchDevicePixelRatio();
    canvasRenderer.resizePreview();
    outfitController.startApp().catch(onError);
  }

  /** Release every observer and listener registered for this mounted canvas. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    window.removeEventListener("resize", canvasRenderer.resizePreview);
    watchingDevicePixelRatio?.();
    watchingDevicePixelRatio = undefined;
  }

  return {
    start,
    dispose,
    downloadPreview,
  };
}
