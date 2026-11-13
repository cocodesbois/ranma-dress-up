/**
 * Controls responsive wardrobe visibility, dialog semantics and focus handling.
 * Depends on the store, injected DOM nodes/media query and document keyboard events;
 * exports createWardrobePanelController.
 * @module ui/wardrobe-panel-controller
 */
import type { Store } from "../core/state-store";

/**
 * Bind the mobile dialog and desktop wardrobe to their shared state.
 * @param {object} options
 * @param {import("../core/state-store").Store} options.appState
 * @param {HTMLElement} options.wardrobePanel
 * @param {HTMLButtonElement} options.wardrobeToggle
 * @param {HTMLButtonElement} options.wardrobeClose
 * @param {HTMLElement} options.wardrobeBackdrop
 * @param {MediaQueryList} options.mobileWardrobe
 */
export function createWardrobePanelController({
  appState,
  wardrobePanel,
  wardrobeToggle,
  wardrobeClose,
  wardrobeBackdrop,
  mobileWardrobe,
}: {
  appState: Store;
  wardrobePanel: HTMLElement;
  wardrobeToggle: HTMLButtonElement;
  wardrobeClose: HTMLButtonElement;
  wardrobeBackdrop: HTMLElement;
  mobileWardrobe: MediaQueryList;
}) {
  /**
   * Apply panel state and reset mobile-open state when switching to desktop.
   * @returns {void}
   */
  function syncWardrobeMode() {
    if (!mobileWardrobe.matches) {
      appState.setWardrobeOpen(false);
    }

    const isWardrobeOpen = appState.isWardrobeOpen();
    const hidden = mobileWardrobe.matches && !isWardrobeOpen;
    wardrobePanel.inert = hidden;
    wardrobePanel.setAttribute("aria-hidden", String(hidden));
    wardrobeToggle.setAttribute("aria-expanded", String(isWardrobeOpen));
    wardrobeBackdrop.inert = !isWardrobeOpen;
    document.body.classList.toggle("wardrobe-open", isWardrobeOpen);

    if (mobileWardrobe.matches) {
      wardrobePanel.setAttribute("role", "dialog");
      wardrobePanel.setAttribute("aria-modal", String(isWardrobeOpen));
    } else {
      wardrobePanel.removeAttribute("role");
      wardrobePanel.removeAttribute("aria-modal");
      wardrobePanel.removeAttribute("aria-hidden");
    }
  }

  /**
   * Open or close on mobile, moving focus to the close button or toggle.
   * @param {boolean} open
   * @param {boolean} [returnFocus=true]
   * @returns {void} No change in desktop mode.
   */
  function setWardrobeOpen(open: boolean, returnFocus = true) {
    if (!mobileWardrobe.matches) {
      return;
    }

    appState.setWardrobeOpen(open);
    syncWardrobeMode();

    if (open) {
      wardrobeClose.focus();
    } else if (returnFocus) {
      wardrobeToggle.focus();
    }
  }

  /**
   * Register panel, breakpoint and keyboard handlers once during bootstrap.
   * @returns {void}
   */
  function bindEvents() {
    wardrobeToggle.addEventListener("click", () => setWardrobeOpen(true));
    wardrobeClose.addEventListener("click", () => setWardrobeOpen(false));
    wardrobeBackdrop.addEventListener("click", () => setWardrobeOpen(false));
    mobileWardrobe.addEventListener("change", () => syncWardrobeMode());

    document.addEventListener("keydown", (event) => {
      if (!appState.isWardrobeOpen()) {
        return;
      }

      if (event.key === "Escape") {
        setWardrobeOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const focusable =
          wardrobePanel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  return {
    syncWardrobeMode,
    setWardrobeOpen,
    bindEvents,
  };
}
