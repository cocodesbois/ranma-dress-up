// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createStore } from "../src/core/state-store";
import { createPreviewFactory } from "../src/render/create-preview";
import { createStatusController } from "../src/ui/status-controller";
import { item, layer, manifest } from "./fixtures";

describe("preview construction", () => {
  it("connects controller selections to the shared store and canvas renderer", () => {
    const top = item("top", "tops");
    const catalog = {
      background: { source: "background.png" },
      base: layer("body"),
      categories: [{ id: "tops" as const, label: "Tops" }],
      items: [top],
      outfits: [],
    };
    const appState = createStore({ defaultOutfit: {} });
    const preview = document.createElement("canvas");
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
    };
    vi.spyOn(preview, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const imageLoader = {
      loadImage: vi.fn(async () => document.createElement("img")),
      getSprite: vi.fn(() => undefined),
      getMissingSourcesForPreset: vi.fn((): string[] => []),
      preloadAdjacentOutfits: vi.fn(),
      preloadAllOutfitsInBackground: vi.fn(),
    };
    const getSprite = vi.fn((_entry: { source: string }) => ({
      image: document.createElement("img"),
      x: 0,
      y: 0,
      width: 100,
      height: 200,
      scale: 1,
    }));
    const createPreview = createPreviewFactory({
      catalog,
      manifest: manifest(),
      outfitPresets: [],
      defaultOutfit: {},
      appState,
      statusController: createStatusController(appState),
      imageLoader,
      getSprite,
      onError: vi.fn(),
    });
    const { controller } = createPreview(preview);

    controller.selectItem(top);

    expect(appState.getOutfit().tops).toBe("top");
    expect(getSprite.mock.calls.map(([entry]) => entry.source)).toEqual([
      "background.png",
      "body.png",
      "top.png",
    ]);
    expect(context.drawImage).toHaveBeenCalledTimes(3);
    expect(appState.state.status.text).toBe("top selected.");
  });
});
