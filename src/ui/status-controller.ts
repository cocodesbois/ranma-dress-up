/**
 * Publishes status messages to the reactive store.
 * Exports createStatusController and createErrorReporter.
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

/** Report failures to the console and the shared status presentation. */
export function createErrorReporter(statusController: ReturnType<typeof createStatusController>) {
  return (error: unknown) => {
    console.error(error);
    statusController.setStatusMessage(error instanceof Error ? error.message : String(error), {
      isError: true,
    });
  };
}
