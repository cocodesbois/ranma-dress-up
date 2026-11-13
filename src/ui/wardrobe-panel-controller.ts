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
 * @param {HTMLButtonElement} options.wardrobeSize
 * @param {HTMLElement} options.wardrobeBackdrop
 * @param {MediaQueryList} options.mobileWardrobe
 */
export function createWardrobePanelController({
  appState,
  wardrobePanel,
  wardrobeToggle,
  wardrobeClose,
  wardrobeSize,
  wardrobeBackdrop,
  mobileWardrobe,
}: {
  appState: Store;
  wardrobePanel: HTMLElement;
  wardrobeToggle: HTMLButtonElement;
  wardrobeClose: HTMLButtonElement;
  wardrobeSize: HTMLButtonElement;
  wardrobeBackdrop: HTMLElement;
  mobileWardrobe: MediaQueryList;
}) {
  function setExpanded(expanded: boolean) {
    document.body.classList.toggle("wardrobe-expanded", expanded);
    wardrobeSize.setAttribute("aria-expanded", String(expanded));
    wardrobeSize.textContent = expanded ? "Compact" : "Expand";
    wardrobeSize.setAttribute("aria-label", expanded ? "Use compact wardrobe" : "Expand wardrobe");
  }

  /**
   * Apply panel state and reset mobile-open state when switching to desktop.
   * @returns {void}
   */
  function syncWardrobeMode() {
    if (!mobileWardrobe.matches) {
      appState.setWardrobeOpen(false);
      setExpanded(false);
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
      wardrobePanel.setAttribute("aria-modal", "false");
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
    if (!open) {
      setExpanded(false);
    }
    syncWardrobeMode();

    if (open) {
      const categories = wardrobePanel.querySelector<HTMLElement>(".category-tabs");
      const activeCategory = categories?.querySelector<HTMLElement>(".category-tab.is-active");
      if (categories && activeCategory) {
        categories.scrollLeft +=
          activeCategory.getBoundingClientRect().left - categories.getBoundingClientRect().left;
      }
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
    wardrobeSize.addEventListener("click", () =>
      setExpanded(wardrobeSize.getAttribute("aria-expanded") !== "true"),
    );
    wardrobeBackdrop.addEventListener("click", () => setWardrobeOpen(false));
    mobileWardrobe.addEventListener("change", () => syncWardrobeMode());

    document.addEventListener("keydown", (event) => {
      if (!appState.isWardrobeOpen()) {
        return;
      }

      if (event.key === "Escape") {
        setWardrobeOpen(false);
      }
    });
  }

  return {
    syncWardrobeMode,
    setWardrobeOpen,
    bindEvents,
  };
}
