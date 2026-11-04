(function registerWardrobePanelController(windowObject) {
  function createWardrobePanelController({
    appState,
    wardrobePanel,
    wardrobeToggle,
    wardrobeClose,
    wardrobeBackdrop,
    mobileWardrobe
  }) {
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
      windowObject.document.body.classList.toggle("wardrobe-open", isWardrobeOpen);

      if (mobileWardrobe.matches) {
        wardrobePanel.setAttribute("role", "dialog");
        wardrobePanel.setAttribute("aria-modal", String(isWardrobeOpen));
      } else {
        wardrobePanel.removeAttribute("role");
        wardrobePanel.removeAttribute("aria-modal");
        wardrobePanel.removeAttribute("aria-hidden");
      }
    }

    function setWardrobeOpen(open, returnFocus = true) {
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

    function bindEvents() {
      wardrobeToggle.addEventListener("click", () => setWardrobeOpen(true));
      wardrobeClose.addEventListener("click", () => setWardrobeOpen(false));
      wardrobeBackdrop.addEventListener("click", () => setWardrobeOpen(false));
      mobileWardrobe.addEventListener("change", () => syncWardrobeMode());

      windowObject.document.addEventListener("keydown", (event) => {
        if (!appState.isWardrobeOpen()) {
          return;
        }

        if (event.key === "Escape") {
          setWardrobeOpen(false);
          return;
        }

        if (event.key === "Tab") {
          const focusable = wardrobePanel.querySelectorAll("button:not(:disabled)");
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (event.shiftKey && windowObject.document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && windowObject.document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      });
    }

    return {
      syncWardrobeMode,
      setWardrobeOpen,
      bindEvents
    };
  }

  windowObject.RanmaDressUpWardrobePanelController = { createWardrobePanelController };
}(window));
