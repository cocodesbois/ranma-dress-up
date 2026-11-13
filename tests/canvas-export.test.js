import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasRenderer } from "../src/render/canvas-renderer.ts";

const placement = { x: 0, y: 0, scale: 0.18, regX: 0, regY: 0 };

function createContext() {
  return {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
  };
}

/**
 * Renderer whose offscreen canvases are recorded in `exports`. The visible preview is
 * deliberately a different size from any export.
 */
function setup({ document: size = { width: 6643, height: 6507 }, scale = 0.5, blob } = {}) {
  const previewContext = createContext();
  const exports = [];
  vi.stubGlobal("document", {
    createElement: vi.fn(() => {
      const canvas = {
        width: 0,
        height: 0,
        context: createContext(),
        getContext() {
          return this.context;
        },
        toBlob: vi.fn((callback, type) =>
          callback(blob === undefined ? new Blob(["png"], { type }) : blob),
        ),
      };
      exports.push(canvas);
      return canvas;
    }),
  });

  const items = [
    { id: "top-item", category: "tops", source: "top.png", placement },
    { id: "hair-item", category: "hair", source: "hair.png", placement },
  ];
  const renderer = createCanvasRenderer({
    preview: { getContext: () => previewContext, style: {}, width: 390, height: 382 },
    catalog: {
      background: { source: "background.png" },
      base: { source: "body.png", placement },
      items,
    },
    manifest: { document: size, settings: { scale } },
    getSprite: (item) => ({
      image: item.source,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    }),
    getOutfit: () => ({ tops: "top-item", hair: "hair-item" }),
    isPreviewReady: () => true,
  });
  return { renderer, previewContext, exports };
}

afterEach(() => vi.unstubAllGlobals());

describe("fixed-size export", () => {
  it("uses a fixed width and the document aspect ratio, whatever the preview size", async () => {
    const { renderer, exports } = setup();
    await renderer.exportPreview();
    expect(exports).toHaveLength(1);
    expect(exports[0].width).toBe(2400);
    expect(exports[0].height).toBe(Math.round((2400 * 6507) / 6643));
  });

  it("honors a requested width", async () => {
    const { renderer, exports } = setup();
    await renderer.exportPreview(1000);
    expect(exports[0].width).toBe(1000);
  });

  it("never exceeds the decoded sprites' own resolution", async () => {
    const { renderer, exports } = setup({ document: { width: 1000, height: 500 }, scale: 0.5 });
    await renderer.exportPreview();
    expect(exports[0].width).toBe(500);
    expect(exports[0].height).toBe(250);
  });

  it("maps stage units onto the export canvas", async () => {
    const { renderer, exports } = setup();
    await renderer.exportPreview(2000);
    const { width, height, context } = exports[0];
    expect(context.setTransform).toHaveBeenCalledWith(
      width / (6643 * 0.18),
      0,
      0,
      height / (6507 * 0.18),
      0,
      0,
    );
  });

  it("paints the whole scene on the offscreen canvas and leaves the preview untouched", async () => {
    const { renderer, previewContext, exports } = setup();
    await renderer.exportPreview();
    const drawn = exports[0].context.drawImage.mock.calls.map(([image]) => image);
    expect(drawn).toEqual(["background.png", "body.png", "top.png", "hair.png"]);
    expect(exports[0].context.ellipse).toHaveBeenCalledOnce();
    expect(previewContext.drawImage).not.toHaveBeenCalled();
    expect(previewContext.setTransform).not.toHaveBeenCalled();
  });

  it("resolves with the PNG blob, or null when the browser cannot encode it", async () => {
    const png = setup();
    const blob = await png.renderer.exportPreview();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(png.exports[0].toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");

    const failed = setup({ blob: null });
    await expect(failed.renderer.exportPreview()).resolves.toBeNull();
  });

  it("throws when a 2D context is unavailable", () => {
    const { renderer, exports } = setup();
    document.createElement.mockImplementationOnce(() => ({ getContext: () => null }));
    expect(() => renderer.exportPreview()).toThrow("This browser cannot export the preview.");
    expect(exports).toHaveLength(0);
  });
});
