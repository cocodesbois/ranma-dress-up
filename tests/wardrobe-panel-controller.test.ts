// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../src/core/state-store";
import { createWardrobePanelController } from "../src/ui/wardrobe-panel-controller";
import { required } from "./fixtures";

function setup() {
  document.body.innerHTML = `
    <button id="toggle"></button>
    <button id="backdrop"></button>
    <aside id="panel">
      <button id="size"></button>
      <button id="close"></button>
      <select><option>Outfit</option></select>
      <nav class="category-tabs"><button class="category-tab is-active">Tops</button></nav>
      <button id="item">Item</button>
    </aside>
  `;
  const element = <T extends HTMLElement>(selector: string) =>
    required(document.querySelector<T>(selector));
  const appState = createStore({ defaultOutfit: {} });
  const mobileWardrobe: MediaQueryList = {
    matches: true,
    media: "(max-width: 720px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  const controller = createWardrobePanelController({
    appState,
    wardrobePanel: element("#panel"),
    wardrobeToggle: element<HTMLButtonElement>("#toggle"),
    wardrobeClose: element<HTMLButtonElement>("#close"),
    wardrobeSize: element<HTMLButtonElement>("#size"),
    wardrobeBackdrop: element("#backdrop"),
    mobileWardrobe,
  });
  controller.bindEvents();
  controller.syncWardrobeMode();
  return { appState, controller, element, mobileWardrobe };
}

beforeEach(() => {
  document.body.className = "";
});

describe("mobile wardrobe panel", () => {
  it("expands and returns to compact mode on close and reopen", () => {
    const { appState, element } = setup();
    const toggle = element<HTMLButtonElement>("#toggle");
    const size = element<HTMLButtonElement>("#size");
    toggle.click();
    expect(appState.isWardrobeOpen()).toBe(true);
    expect(document.activeElement).toBe(element("#close"));
    size.click();
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(true);
    expect(size.getAttribute("aria-expanded")).toBe("true");
    expect(size.textContent).toBe("Compact");

    element<HTMLButtonElement>("#close").click();
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
    expect(size.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    expect(size.textContent).toBe("Expand");
  });

  it("allows focus outside the non-modal dialog and closes on Escape", () => {
    const { element } = setup();
    element<HTMLButtonElement>("#toggle").click();
    expect(element("#panel").getAttribute("aria-modal")).toBe("false");
    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(element("#panel").getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(element("#toggle"));
  });

  it("clears mobile state when switching to desktop", () => {
    const { appState, controller, element, mobileWardrobe } = setup();
    element<HTMLButtonElement>("#toggle").click();
    element<HTMLButtonElement>("#size").click();
    Object.defineProperty(mobileWardrobe, "matches", { value: false });
    controller.syncWardrobeMode();
    expect(appState.isWardrobeOpen()).toBe(false);
    expect(document.body.classList.contains("wardrobe-expanded")).toBe(false);
    expect(element("#panel").hasAttribute("role")).toBe(false);
    expect(element("#panel").hasAttribute("aria-hidden")).toBe(false);
  });
});
