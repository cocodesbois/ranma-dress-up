/**
 * Connects the application shell to its preview, actions and browser lifecycle.
 * Receives services created by the composition root without making renderers reactive.
 * @module ui/use-app-preview
 */
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import type { Store } from "../core/state-store";
import type { createPreviewFactory } from "../render/create-preview";
import type { Catalog, Category, Item, OutfitPreset, Sprite } from "../types";
import type { createOutfitController } from "./outfit-controller";
import type { createStatusController } from "./status-controller";

/** Services and presentation data supplied to the application shell. */
export interface AppServices {
  catalog: Catalog;
  presets: OutfitPreset[];
  store: Store;
  mobileWardrobe: MediaQueryList;
  getSprite: (item: Item) => Sprite | undefined;
  createPreview: ReturnType<typeof createPreviewFactory>;
  statusController: ReturnType<typeof createStatusController>;
  onError: (error: unknown) => void;
}

/** Initialize one preview on mount and expose the shell's user actions. */
export function useAppPreview(services: AppServices) {
  const preview = useTemplateRef<HTMLCanvasElement>("preview");
  let renderer: ReturnType<ReturnType<typeof createPreviewFactory>>["renderer"] | undefined;
  let controller: ReturnType<typeof createOutfitController> | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let stopWatchingDevicePixelRatio: (() => void) | undefined;

  function withController(action: (controller: ReturnType<typeof createOutfitController>) => void) {
    if (!controller) {
      services.onError(new Error("The outfit preview is not ready."));
      return;
    }
    action(controller);
  }

  async function downloadPreview() {
    if (!renderer) {
      services.onError(new Error("The outfit preview is not ready to save."));
      return;
    }
    if (services.store.state.downloadPending) return;
    services.store.setDownloadPending(true);
    try {
      services.statusController.setStatusMessage("Preparing your look...", { loading: true });
      const blob = await renderer.exportPreview();
      if (!blob) {
        services.statusController.setStatusMessage("The preview could not be saved.", {
          isError: true,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ranma-dress-up.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      services.statusController.setStatusMessage("Your look has been downloaded.");
    } catch (error) {
      services.onError(error);
    } finally {
      services.store.setDownloadPending(false);
    }
  }

  onMounted(() => {
    try {
      if (!preview.value) {
        throw new Error("The outfit preview canvas did not mount.");
      }
      const setup = services.createPreview(preview.value);
      renderer = setup.renderer;
      controller = setup.controller;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(renderer.resizePreview);
        resizeObserver.observe(preview.value);
      } else {
        window.addEventListener("resize", renderer.resizePreview);
      }
      stopWatchingDevicePixelRatio = renderer.watchDevicePixelRatio();
      renderer.resizePreview();
      controller.startApp().catch(services.onError);
    } catch (error) {
      services.onError(error);
    }
  });
  onUnmounted(() => {
    resizeObserver?.disconnect();
    if (renderer) window.removeEventListener("resize", renderer.resizePreview);
    stopWatchingDevicePixelRatio?.();
  });

  return {
    downloadPreview,
    resetOutfit: () => withController((controller) => controller.resetOutfit()),
    selectCategory: (category: Category) =>
      withController((controller) => void controller.selectCategory(category)),
    selectItem: (item: Item) => withController((controller) => controller.selectItem(item)),
    removeActiveCategoryItem: () =>
      withController((controller) => controller.removeActiveCategoryItem()),
    selectOutfitById: (id: string) =>
      withController((controller) => controller.selectOutfitById(id)),
    selectAdjacentOutfit: (step: number) =>
      withController((controller) => controller.selectAdjacentOutfit(step)),
  };
}
