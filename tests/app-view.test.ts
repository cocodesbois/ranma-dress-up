// @vitest-environment jsdom
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import { createStatusController } from "../src/ui/status-controller";
import AppView from "../src/ui/app-view.vue";
import { required } from "./fixtures";

const presets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = required(catalogModel.getDefaultOutfitLook(presets, "001"));

function setup({
  exportPreview = vi.fn<() => Promise<Blob | null>>().mockResolvedValue(null),
  startApp = vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  initializationError,
  mobile = false,
}: {
  exportPreview?: () => Promise<Blob | null>;
  startApp?: () => Promise<void>;
  initializationError?: Error;
  mobile?: boolean;
} = {}) {
  document.body.innerHTML = '<div id="app"></div>';
  const store = createStore({ defaultOutfit });
  const mobileWardrobe = Object.assign(new EventTarget(), { matches: mobile }) as MediaQueryList;
  const stopWatchingDevicePixelRatio = vi.fn();
  const renderer = {
    drawOutfit: vi.fn(),
    exportPreview,
    resizePreview: vi.fn(),
    watchDevicePixelRatio: vi.fn(() => stopWatchingDevicePixelRatio),
  };
  const controller = {
    startApp,
    selectCategory: vi.fn(async () => {}),
    selectItem: vi.fn(),
    removeActiveCategoryItem: vi.fn(),
    selectOutfitById: vi.fn(),
    selectAdjacentOutfit: vi.fn(),
    resetOutfit: vi.fn(),
  };
  const createPreview = vi.fn(() => {
    if (initializationError) throw initializationError;
    return { renderer, controller };
  });
  const onError = vi.fn();
  const app = createApp(AppView, {
    services: {
      catalog,
      presets,
      store,
      mobileWardrobe,
      getSprite: () => undefined,
      createPreview,
      statusController: createStatusController(store),
      onError,
    },
  });
  app.mount("#app");
  return {
    app,
    store,
    mobileWardrobe,
    renderer,
    controller,
    createPreview,
    onError,
    stopWatchingDevicePixelRatio,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Vue application shell", () => {
  it("synchronizes layout classes and clears them on unmount in either media mode", async () => {
    const view = setup({ mobile: true });
    required(document.querySelector<HTMLButtonElement>("#wardrobe-toggle")).click();
    required(document.querySelector<HTMLButtonElement>("#wardrobe-size")).click();
    expect(document.body.classList.contains("wardrobe-open")).toBe(true);
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.classList.contains("wardrobe-open")).toBe(false);
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
    required(document.querySelector<HTMLButtonElement>("#wardrobe-toggle")).click();
    required(document.querySelector<HTMLButtonElement>("#wardrobe-size")).click();

    Object.defineProperty(view.mobileWardrobe, "matches", { value: false });
    view.mobileWardrobe.dispatchEvent(new Event("change"));
    expect(document.body.classList.contains("wardrobe-open")).toBe(false);
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
    required(document.querySelector<HTMLButtonElement>("#wardrobe-size")).click();
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(true);
    view.app.unmount();
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
    view.store.setWardrobeOpen(true);
    expect(document.body.classList.contains("wardrobe-open")).toBe(false);

    const mobileView = setup({ mobile: true });
    required(document.querySelector<HTMLButtonElement>("#wardrobe-toggle")).click();
    required(document.querySelector<HTMLButtonElement>("#wardrobe-size")).click();
    await nextTick();
    mobileView.app.unmount();
    expect(document.body.classList.contains("wardrobe-open")).toBe(false);
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
  });

  it("initializes one stable canvas, forwards actions and cleans up its observer", async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class TestResizeObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const view = setup();
    const preview = required(document.querySelector<HTMLCanvasElement>("#outfit-preview"));
    expect(view.createPreview).toHaveBeenCalledExactlyOnceWith(preview);
    expect(observe).toHaveBeenCalledExactlyOnceWith(preview);
    expect(view.renderer.watchDevicePixelRatio).toHaveBeenCalledOnce();
    expect(view.renderer.resizePreview).toHaveBeenCalledOnce();
    expect(view.controller.startApp).toHaveBeenCalledOnce();

    view.store.setStatus("Updated", false, false);
    view.store.setOfflineStatus("Ready to use offline.");
    view.store.setPreviewReady(true);
    await nextTick();
    expect(document.querySelector("#outfit-preview")).toBe(preview);
    expect(view.createPreview).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledOnce();
    expect(view.renderer.watchDevicePixelRatio).toHaveBeenCalledOnce();
    expect(view.renderer.resizePreview).toHaveBeenCalledOnce();
    expect(document.querySelector(".offline-status")?.textContent).toContain(
      "Ready to use offline.",
    );
    required(document.querySelector<HTMLButtonElement>("#reset-look")).click();
    required(document.querySelector<HTMLButtonElement>("#outfit-next")).click();
    expect(view.controller.resetOutfit).toHaveBeenCalledOnce();
    expect(view.controller.selectAdjacentOutfit).toHaveBeenCalledExactlyOnceWith(1);

    view.app.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(view.stopWatchingDevicePixelRatio).toHaveBeenCalledOnce();
  });

  it("removes the window resize fallback when unmounted", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const view = setup();
    window.dispatchEvent(new Event("resize"));
    expect(view.renderer.resizePreview).toHaveBeenCalledTimes(2);
    view.app.unmount();
    window.dispatchEvent(new Event("resize"));
    expect(view.renderer.resizePreview).toHaveBeenCalledTimes(2);
    expect(view.stopWatchingDevicePixelRatio).toHaveBeenCalledOnce();
  });

  it("reports startup failures", async () => {
    const failure = new Error("Initial image failed");
    const view = setup({ startApp: vi.fn().mockRejectedValue(failure) });
    await Promise.resolve();
    expect(view.onError).toHaveBeenCalledExactlyOnceWith(failure);
    view.app.unmount();
  });

  it("reports canvas initialization failures without leaving controls silently unusable", () => {
    const failure = new Error("Canvas unavailable");
    const view = setup({ initializationError: failure });
    expect(view.onError).toHaveBeenCalledExactlyOnceWith(failure);
    required(document.querySelector<HTMLButtonElement>("#reset-look")).click();
    expect(view.onError).toHaveBeenLastCalledWith(new Error("The outfit preview is not ready."));
    required(document.querySelector<HTMLButtonElement>("#download-look")).click();
    expect(view.onError).toHaveBeenLastCalledWith(
      new Error("The outfit preview is not ready to save."),
    );
    view.app.unmount();
  });

  it("saves a fixed-size export and blocks duplicate requests while pending", async () => {
    vi.useFakeTimers();
    let resolve!: (blob: Blob | null) => void;
    const exportPreview = vi.fn(
      () =>
        new Promise<Blob | null>((res) => {
          resolve = res;
        }),
    );
    const createObjectURL = vi.fn(() => "blob:ranma");
    class TestURL extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal("URL", TestURL);
    let clickedLink: HTMLAnchorElement | undefined;
    const clickLink = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedLink = this;
    });
    const view = setup({ exportPreview });
    const button = required(document.querySelector<HTMLButtonElement>("#download-look"));
    button.click();
    button.click();
    await nextTick();
    expect(button.disabled).toBe(true);
    expect(exportPreview).toHaveBeenCalledOnce();
    resolve(new Blob(["png"]));
    await Promise.resolve();
    expect(clickLink).toHaveBeenCalledOnce();
    await nextTick();
    expect(button.disabled).toBe(false);
    expect(clickedLink?.download).toBe("ranma-dress-up.png");
    expect(view.store.state.status.text).toBe("Your look has been downloaded.");
    vi.advanceTimersByTime(1000);
    expect(TestURL.revokeObjectURL).toHaveBeenCalledWith("blob:ranma");
    view.app.unmount();
  });

  it("reports encoding and export failures and re-enables save", async () => {
    const failure = new Error("Export failed");
    const exportPreview = vi
      .fn<() => Promise<Blob | null>>()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(failure);
    const view = setup({ exportPreview });
    const button = required(document.querySelector<HTMLButtonElement>("#download-look"));
    button.click();
    await Promise.resolve();
    expect(view.store.state.downloadPending).toBe(false);
    expect(view.store.state.status).toMatchObject({
      text: "The preview could not be saved.",
      isError: true,
    });
    await nextTick();
    button.click();
    await Promise.resolve();
    expect(view.onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(view.store.state.downloadPending).toBe(false);
    view.app.unmount();
  });
});
