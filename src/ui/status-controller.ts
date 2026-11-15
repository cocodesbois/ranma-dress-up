/**
 * Updates status text and preset-control availability using injected DOM nodes.
 * Exports createStatusController; does not read or mutate the outfit store.
 * @module ui/status-controller
 */

/** Bind status and preset controls. */
export function createStatusController({
  statusMessage,
  outfitSelect,
  outfitPreviousButton,
  outfitNextButton,
}: {
  statusMessage: HTMLElement;
  outfitSelect: HTMLSelectElement;
  outfitPreviousButton: HTMLButtonElement;
  outfitNextButton: HTMLButtonElement;
}) {
  /** Replace the message and its loading/error presentation. */
  function setStatusMessage(
    text: string,
    {
      loading = false,
      isError = false,
    }: {
      loading?: boolean;
      isError?: boolean;
    } = {},
  ) {
    statusMessage.textContent = text;
    statusMessage.classList.toggle("is-loading", loading);
    statusMessage.classList.toggle("is-error", isError);
  }

  /** Toggle the select and both adjacent-preset buttons together. */
  function setOutfitControlsDisabled(disabled: boolean) {
    outfitSelect.disabled = disabled;
    outfitPreviousButton.disabled = disabled;
    outfitNextButton.disabled = disabled;
  }

  return {
    setStatusMessage,
    setOutfitControlsDisabled,
  };
}
