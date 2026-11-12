// @ts-check
/**
 * Updates status text and preset-control availability using injected DOM nodes.
 * Exports createStatusController; does not read or mutate the outfit store.
 * @module ui/status-controller
 */

/**
 * Bind status and preset controls.
 * @param {object} options
 * @param {HTMLElement} options.statusMessage
 * @param {HTMLSelectElement} options.outfitSelect
 * @param {HTMLButtonElement} options.outfitPreviousButton
 * @param {HTMLButtonElement} options.outfitNextButton
 */
export function createStatusController({
  statusMessage,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton,
}) {
  /**
   * Replace the message and its loading/error presentation.
   * @param {string} text
   * @param {{loading?: boolean, isError?: boolean}} [options]
   * @returns {void}
   */
  function setStatusMessage(text, { loading = false, isError = false } = {}) {
    statusMessage.textContent = text;
    statusMessage.classList.toggle("is-loading", loading);
    statusMessage.classList.toggle("is-error", isError);
  }

  /**
   * Toggle the select and both adjacent-preset buttons together.
   * @param {boolean} disabled
   * @returns {void}
   */
  function setOutfitControlsDisabled(disabled) {
    outfitSelect.disabled = disabled;
    outfitPreviousButton.disabled = disabled;
    outfitNextButton.disabled = disabled;
  }

  return {
    setStatusMessage,
    setOutfitControlsDisabled,
  };
}
