// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createCanvasRenderer } from "../src/render/canvas-renderer";
import type { Look } from "../src/types";
import { item, manifest } from "./fixtures";

const expectedOrder = [
  "underwear",
  "slips",
  "tights",
  "bodysuits",
  "pants",
  "tops",
  "shoes",
  "dresses",
  "hair",
  "hats",
  "necklace",
  "bracelets",
  "accessories",
];

function setup() {
  const placement = { x: 0, y: 0, scale: 1, regX: 0, regY: 0 };
  const items = [...expectedOrder].reverse().map((category) => ({
    ...item(`${category}-item`, category),
    source: `${category}.png`,
    placement,
  }));
  const outfit: Look = Object.fromEntries(items.map((item) => [item.category, item.id]));
  const context = {
    drawImage: vi.fn<CanvasRenderingContext2D["drawImage"]>(),
    clearRect: vi.fn<CanvasRenderingContext2D["clearRect"]>(),
    beginPath: vi.fn<CanvasRenderingContext2D["beginPath"]>(),
    ellipse: vi.fn<CanvasRenderingContext2D["ellipse"]>(),
    fill: vi.fn<CanvasRenderingContext2D["fill"]>(),
  };
  const preview = document.createElement("canvas");
  // Only the canvas operations exercised by this test are mocked.
  vi.spyOn(preview, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const renderer = createCanvasRenderer({
    preview,
    catalog: {
      background: { source: "background.png" },
      base: { ...item("body", "base"), source: "body.png", placement },
      items,
      categories: [],
      outfits: [],
    },
    manifest: manifest(),
    getSprite: (item) => ({
      image: { src: item.source } as HTMLImageElement,
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      scale: 0.5,
    }),
    getOutfit: () => outfit,
    isPreviewReady: () => true,
  });
  const drawnImages = () =>
    context.drawImage.mock.calls.map(([image]) => (image as HTMLImageElement).src);
  return { renderer, context, outfit, drawnImages };
}

describe("canvas layer order", () => {
  it("draws background, body and all layers in the fixed composition order", () => {
    const { renderer, context, drawnImages } = setup();
    renderer.drawOutfit();
    expect(drawnImages()).toEqual([
      "background.png",
      "body.png",
      ...expectedOrder.map((category) => `${category}.png`),
    ]);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 100, 200);
    expect(context.drawImage.mock.invocationCallOrder[0]).toBeLessThan(
      context.fill.mock.invocationCallOrder[0],
    );
    expect(context.fill.mock.invocationCallOrder[0]).toBeLessThan(
      context.drawImage.mock.invocationCallOrder[1],
    );
  });

  it("skips empty categories while keeping dresses above shoes and hair above dresses", () => {
    const { renderer, outfit, drawnImages } = setup();
    for (const category of expectedOrder) {
      if (!["shoes", "dresses", "hair"].includes(category)) {
        outfit[category] = null;
      }
    }
    renderer.drawOutfit();
    expect(drawnImages()).toEqual([
      "background.png",
      "body.png",
      "shoes.png",
      "dresses.png",
      "hair.png",
    ]);
  });

  it("reads the current look on every draw instead of retaining removed layers", () => {
    const { renderer, context, outfit, drawnImages } = setup();
    renderer.drawOutfit();
    context.drawImage.mockClear();
    for (const category of expectedOrder) {
      delete outfit[category];
    }
    renderer.drawOutfit();
    expect(drawnImages()).toEqual(["background.png", "body.png"]);
  });

  it("reports an unknown selected item instead of silently omitting its layer", () => {
    const { renderer, outfit } = setup();
    outfit.hair = "missing-hair";
    expect(() => renderer.drawOutfit()).toThrow("Unknown outfit item: missing-hair.");
  });
});
