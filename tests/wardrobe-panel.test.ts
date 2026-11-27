// @vitest-environment jsdom
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import * as catalogModel from "../src/core/catalog-model";
import { createStore } from "../src/core/state-store";
import WardrobePanel from "../src/ui/wardrobe-panel.vue";
import StatusView from "../src/ui/status-view.vue";
import ResetView from "../src/ui/reset-view.vue";
import { createStatusController } from "../src/ui/status-controller";
import { required } from "./fixtures";

const presets = catalogModel.createOutfitPresets(catalog);
const defaultOutfit = required(catalogModel.getDefaultOutfitLook(presets, "001"));

function setup(mobile = true) {
  document.body.innerHTML = '<div id="view"></div><div id="status"></div><div id="reset"></div>';
  const store = createStore({ defaultOutfit });
  const media = new EventTarget();
  const mobileWardrobe = Object.assign(media, { matches: mobile }) as MediaQueryList;
  const onPresetSelect = vi.fn();
  const onAdjacentSelect = vi.fn();
  const onReset = vi.fn();
  const app = createApp(WardrobePanel, {
    catalog,
    presets,
    store,
    mobileWardrobe,
    getSprite: () => undefined,
    onCategorySelect: vi.fn(),
    onItemSelect: vi.fn(),
    onNoneSelect: vi.fn(),
    onPresetSelect,
    onAdjacentSelect,
  });
  app.mount("#view");
  const statusApp = createApp(StatusView, { store });
  statusApp.mount("#status");
  const resetApp = createApp(ResetView, { onReset });
  resetApp.mount("#reset");
  const element = <T extends HTMLElement>(selector: string) =>
    required(document.querySelector<T>(selector));
  return {
    store,
    mobileWardrobe,
    onPresetSelect,
    onAdjacentSelect,
    onReset,
    element,
    unmount: () => {
      app.unmount();
      statusApp.unmount();
      resetApp.unmount();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("Vue wardrobe controls", () => {
  it("preserves mobile dialog semantics, focus, expansion and Escape", async () => {
    const view = setup();
    await nextTick();
    const panel = view.element("#wardrobe-panel");
    const toggle = view.element<HTMLButtonElement>("#wardrobe-toggle");
    const size = view.element<HTMLButtonElement>("#wardrobe-size");
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(true);
    toggle.click();
    await nextTick();
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(view.element("#wardrobe-close"));
    size.click();
    await nextTick();
    expect(size.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(true);
    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(document.activeElement).toBe(toggle);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(size.getAttribute("aria-expanded")).toBe("false");
    view.unmount();
  });

  it("clears mobile state at the desktop breakpoint and supports desktop expansion", async () => {
    const view = setup();
    view.element<HTMLButtonElement>("#wardrobe-toggle").click();
    await nextTick();
    view.element<HTMLButtonElement>("#wardrobe-size").click();
    Object.defineProperty(view.mobileWardrobe, "matches", { value: false });
    view.mobileWardrobe.dispatchEvent(new Event("change"));
    await nextTick();
    expect(view.store.state.wardrobeOpen).toBe(false);
    expect(view.store.state.wardrobeExpanded).toBe(false);
    expect(view.element("#wardrobe-panel").hasAttribute("role")).toBe(false);
    expect(view.element("#wardrobe-panel").hasAttribute("aria-hidden")).toBe(false);
    view.element<HTMLButtonElement>("#wardrobe-size").click();
    await nextTick();
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(true);
    view.unmount();
  });

  it("closes via the backdrop and removes global handlers when unmounted", async () => {
    const view = setup();
    await nextTick();
    view.element<HTMLButtonElement>("#wardrobe-toggle").click();
    await nextTick();
    expect(view.element("#wardrobe-backdrop").hasAttribute("inert")).toBe(false);
    view.element<HTMLButtonElement>("#wardrobe-backdrop").click();
    await nextTick();
    expect(document.activeElement).toBe(view.element("#wardrobe-toggle"));
    view.unmount();
    view.store.setWardrobeOpen(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(view.store.state.wardrobeOpen).toBe(true);
    expect(document.body.classList.contains("wardrobe-open")).toBe(false);
  });

  it("renders matching, pending and custom presets and delegates controls", async () => {
    const view = setup(false);
    const select = view.element<HTMLSelectElement>("#outfit-select");
    view.store.setPreviewReady(true);
    await nextTick();
    expect(select.value).toBe("001");
    view.store.setPendingPreset(presets[1].id, true);
    await nextTick();
    expect(select.value).toBe(presets[1].id);
    expect(select.disabled).toBe(true);
    expect(view.element<HTMLButtonElement>("#outfit-next").disabled).toBe(true);
    view.store.setPendingPreset(null);
    view.store.setOutfitItem("tops", "custom");
    await nextTick();
    expect(select.value).toBe("");
    select.value = presets[1].id;
    select.dispatchEvent(new Event("change"));
    expect(view.onPresetSelect).toHaveBeenCalledWith(presets[1].id);
    view.element<HTMLButtonElement>("#outfit-previous").click();
    view.element<HTMLButtonElement>("#outfit-next").click();
    view.element<HTMLButtonElement>("#reset-look").click();
    expect(view.onAdjacentSelect.mock.calls).toEqual([[-1], [1]]);
    expect(view.onReset).toHaveBeenCalledOnce();
    view.unmount();
  });

  it("renders status loading and error transitions", async () => {
    const view = setup();
    const status = createStatusController(view.store);
    status.setStatusMessage("Loading...", { loading: true });
    await nextTick();
    expect(view.element("#status-message").classList.contains("is-loading")).toBe(true);
    status.setStatusMessage("Failed", { isError: true });
    await nextTick();
    expect(view.element("#status-message").textContent).toBe("Failed");
    expect(view.element("#status-message").classList.contains("is-error")).toBe(true);
    expect(view.element("#status-message").getAttribute("aria-live")).toBe("polite");
    view.unmount();
  });
});
