/**
 * Publishes status messages to the reactive store.
 * Exports createStatusController.
 * @module ui/status-controller
 */

import type { Store } from "../core/state-store";

/** Connect status updates to the shared store. */
export function createStatusController(store: Store) {
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
    store.setStatus(text, loading, isError);
  }

  return {
    setStatusMessage,
  };
}
