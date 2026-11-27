// @vitest-environment jsdom
import { createApp, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import AppView from "../src/ui/app-view.vue";
import { required } from "./fixtures";

const presets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = required(catalogModel.getDefaultOutfitLook(presets, "001"));

describe("Vue application shell", () => {
  it("owns one stable canvas and forwards actions through typed events", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const store = createStore({ defaultOutfit });
    store.setPreviewReady(true);
    const mobileWardrobe = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
    const onPreviewMounted = vi.fn();
    const onAppUnmounted = vi.fn();
    const onReset = vi.fn();
    const onDownload = vi.fn();
    const onAdjacentSelect = vi.fn();
    const app = createApp(AppView, {
      catalog,
      presets,
      store,
      mobileWardrobe,
      getSprite: () => undefined,
      onPreviewMounted,
      onAppUnmounted,
      onReset,
      onDownload,
      onAdjacentSelect,
    });
    app.mount("#app");
    const preview = required(document.querySelector<HTMLCanvasElement>("#outfit-preview"));

    expect(onPreviewMounted).toHaveBeenCalledExactlyOnceWith(preview);
    expect(document.querySelectorAll(".page-shell")).toHaveLength(1);
    expect(document.querySelector("#status-message")).not.toBeNull();
    expect(document.querySelector("#offline-status")?.hasAttribute("hidden")).toBe(true);

    store.setStatus("Updated", false, false);
    store.setOfflineStatus("Ready to use offline.");
    store.setDownloadPending(true);
    await nextTick();
    expect(document.querySelector("#outfit-preview")).toBe(preview);
    expect(document.querySelector(".offline-status")?.textContent).toContain(
      "Ready to use offline.",
    );
    expect(required(document.querySelector<HTMLButtonElement>("#download-look")).disabled).toBe(
      true,
    );
    store.setDownloadPending(false);
    await nextTick();

    required(document.querySelector<HTMLButtonElement>("#reset-look")).click();
    required(document.querySelector<HTMLButtonElement>("#download-look")).click();
    required(document.querySelector<HTMLButtonElement>("#outfit-next")).click();
    expect(onReset).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onAdjacentSelect).toHaveBeenCalledExactlyOnceWith(1);

    app.unmount();
    expect(onAppUnmounted).toHaveBeenCalledOnce();
  });
});
