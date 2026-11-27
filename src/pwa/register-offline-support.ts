/**
 * Registers the service worker after page load and publishes offline status.
 * Depends on the shared store and browser service-worker APIs.
 * @module pwa/register-offline-support
 */
import type { Store } from "../core/state-store";

/** Schedule production offline support and return a listener cleanup function. */
export function registerOfflineSupport(appState: Store) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return () => {};
  }

  let disposed = false;
  let worker: ServiceWorker | undefined;
  let workerStateListener: (() => void) | undefined;

  function clearWorkerListener() {
    if (worker && workerStateListener) {
      worker.removeEventListener("statechange", workerStateListener);
    }
    worker = undefined;
    workerStateListener = undefined;
  }

  function showOfflineError(error: unknown) {
    console.error("Could not prepare the offline app:", error);
    if (!disposed) {
      appState.setOfflineStatus("Offline setup failed. Reconnect and reload to try again.", true);
    }
  }

  function prepareOfflineAccess() {
    if (disposed) return;
    appState.setOfflineStatus("Preparing offline access...");
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        if (disposed) return;
        worker = registration.installing ?? undefined;
        if (worker && !registration.active) {
          workerStateListener = () => {
            if (worker?.state === "redundant" && !registration.active) {
              showOfflineError(new Error("Service worker installation failed."));
            }
          };
          worker.addEventListener("statechange", workerStateListener);
        }
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        clearWorkerListener();
        if (!disposed) appState.setOfflineStatus("Ready to use offline.");
      })
      .catch((error: unknown) => {
        clearWorkerListener();
        showOfflineError(error);
      });
  }

  window.addEventListener("load", prepareOfflineAccess, { once: true });
  return () => {
    disposed = true;
    window.removeEventListener("load", prepareOfflineAccess);
    clearWorkerListener();
  };
}
