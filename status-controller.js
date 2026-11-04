(function registerStatusController(windowObject) {
  function createStatusController({
    statusMessage,
    outfitSelect,
    outfitPreviousButton,
    outfitNextButton
  }) {
    function setStatusMessage(text, { loading = false, isError = false } = {}) {
      statusMessage.textContent = text;
      statusMessage.classList.toggle("is-loading", loading);
      statusMessage.classList.toggle("is-error", isError);
    }

    function setOutfitControlsDisabled(disabled) {
      outfitSelect.disabled = disabled;
      outfitPreviousButton.disabled = disabled;
      outfitNextButton.disabled = disabled;
    }

    return {
      setStatusMessage,
      setOutfitControlsDisabled
    };
  }

  windowObject.RanmaDressUpStatusController = { createStatusController };
}(window));
