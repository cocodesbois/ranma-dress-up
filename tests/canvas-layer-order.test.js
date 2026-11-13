import { describe, expect, it, vi } from "vitest";
import { createCanvasRenderer } from "../src/render/canvas-renderer.ts";

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
    id: `${category}-item`,
    category,
    source: `${category}.png`,
    placement,
  }));
  const outfit = Object.fromEntries(items.map((item) => [item.category, item.id]));
  const context = {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
  };
  const renderer = createCanvasRenderer({
    preview: { getContext: () => context, style: {} },
    catalog: {
      background: { source: "background.png" },
      base: { source: "body.png", placement },
      items,
    },
    manifest: { document: { width: 100, height: 200 } },
    getSprite: (item) => ({
      image: item.source,
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    }),
    getOutfit: () => outfit,
    isPreviewReady: () => true,
  });
  const drawnImages = () => context.drawImage.mock.calls.map(([image]) => image);
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
