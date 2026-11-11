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
