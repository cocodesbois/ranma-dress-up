// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasRenderer } from "../src/render/canvas-renderer";
import { item, manifest, placement as basePlacement } from "./fixtures";

const placement = { ...basePlacement, scale: 0.18 };

function createContext() {
  return {
    drawImage: vi.fn<CanvasRenderingContext2D["drawImage"]>(),
    clearRect: vi.fn<CanvasRenderingContext2D["clearRect"]>(),
    beginPath: vi.fn<CanvasRenderingContext2D["beginPath"]>(),
    ellipse: vi.fn<CanvasRenderingContext2D["ellipse"]>(),
    fill: vi.fn<CanvasRenderingContext2D["fill"]>(),
    setTransform: vi.fn<CanvasRenderingContext2D["setTransform"]>(),
  };
}

/**
 * Renderer whose offscreen canvases are recorded in `exports`. The visible preview is
 * deliberately a different size from any export.
 */
function setup({
  document: size = { width: 6643, height: 6507 },
  scale = 0.5,
  blob,
}: {
  document?: { width: number; height: number };
  scale?: number;
  blob?: Blob | null;
} = {}) {
  vi.unstubAllGlobals();
  const previewContext = createContext();
  const preview = document.createElement("canvas");
  preview.width = 390;
  preview.height = 382;
  // Only 2D operations used by the renderer are supplied by this test double.
  vi.spyOn(preview, "getContext").mockReturnValue(
    previewContext as unknown as CanvasRenderingContext2D,
  );
  const exports: Array<{
    width: number;
    height: number;
    context: ReturnType<typeof createContext>;
    getContext: () => ReturnType<typeof createContext>;
    toBlob: ReturnType<typeof vi.fn<(callback: BlobCallback, type?: string) => void>>;
  }> = [];
  const createElement = vi.fn(
    (): {
      width: number;
      height: number;
      context: ReturnType<typeof createContext>;
      getContext: () => ReturnType<typeof createContext> | null;
      toBlob: ReturnType<typeof vi.fn<(callback: BlobCallback, type?: string) => void>>;
    } => {
      const canvas = {
        width: 0,
        height: 0,
        context: createContext(),
        getContext() {
          return this.context;
        },
        toBlob: vi.fn((callback: BlobCallback, type?: string) =>
          callback(blob === undefined ? new Blob(["png"], { type }) : blob),
        ),
      };
      exports.push(canvas);
      return canvas;
    },
  );
  vi.stubGlobal("document", { createElement });

  const items = [
    { ...item("top-item", "tops"), source: "top.png", placement },
    { ...item("hair-item", "hair"), source: "hair.png", placement },
  ];
  const renderer = createCanvasRenderer({
    preview,
    catalog: {
      background: { source: "background.png" },
      base: { ...item("body", "base"), source: "body.png", placement },
      categories: [],
      outfits: [],
      items,
    },
    manifest: manifest(size.width, size.height, scale),
    getSprite: (item) => ({
      image: { src: item.source } as HTMLImageElement,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      scale,
    }),
    getOutfit: () => ({ tops: "top-item", hair: "hair-item" }),
    isPreviewReady: () => true,
  });
  return { renderer, previewContext, exports, createElement };
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
    const drawn = exports[0].context.drawImage.mock.calls.map(
      ([image]) => (image as HTMLImageElement).src,
    );
    expect(drawn).toEqual(["background.png", "body.png", "top.png", "hair.png"]);
    expect(exports[0].context.ellipse).toHaveBeenCalledOnce();
    expect(previewContext.drawImage).not.toHaveBeenCalled();
    expect(previewContext.setTransform).not.toHaveBeenCalled();
  });

  it("resolves with the PNG blob, or null when the browser cannot encode it", async () => {
    const png = setup();
    const blob = await png.renderer.exportPreview();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe("image/png");
    expect(png.exports[0].toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");

    const failed = setup({ blob: null });
    await expect(failed.renderer.exportPreview()).resolves.toBeNull();
  });

  it("throws when a 2D context is unavailable", () => {
    const { renderer, exports, createElement } = setup();
    createElement.mockImplementationOnce(() => ({
      width: 0,
      height: 0,
      context: createContext(),
      getContext: () => null,
      toBlob: vi.fn(),
    }));
    expect(() => renderer.exportPreview()).toThrow("This browser cannot export the preview.");
    expect(exports).toHaveLength(0);
  });
});
