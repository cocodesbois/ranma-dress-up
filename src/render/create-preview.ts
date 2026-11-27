/**
 * Constructs a canvas renderer and outfit controller for a mounted preview.
 * Depends on injected catalog, state, image loader and status controller.
 * @module render/create-preview
 */
import * as catalogModel from "../core/catalog-model";
import type { Store } from "../core/state-store";
import type { Catalog, Look, OutfitPreset, Sprite, SpriteManifest } from "../types";
import { createOutfitController } from "../ui/outfit-controller";
import type { createStatusController } from "../ui/status-controller";
import { createCanvasRenderer } from "./canvas-renderer";
import type { createImageLoader } from "./image-loader";

/** Create the renderer and controller without attaching observers or loading images. */
export function createPreview({
  preview,
  catalog,
  manifest,
  outfitPresets,
  defaultOutfit,
  appState,
  statusController,
  imageLoader,
  getSprite,
  onError,
}: {
  preview: HTMLCanvasElement;
  catalog: Catalog;
  manifest: SpriteManifest;
  outfitPresets: OutfitPreset[];
  defaultOutfit: Look;
  appState: Store;
  statusController: ReturnType<typeof createStatusController>;
  imageLoader: ReturnType<typeof createImageLoader>;
  getSprite: (item: { source: string }) => Sprite | undefined;
  onError: (error: unknown) => void;
}) {
  const renderer = createCanvasRenderer({
    preview,
    catalog,
    manifest,
    getSprite,
    getOutfit: () => appState.getOutfit(),
    isPreviewReady: () => appState.isPreviewReady(),
  });
  const controller = createOutfitController({
    catalog,
    catalogModel,
    outfitPresets,
    defaultOutfit,
    appState,
    statusController,
    imageLoader,
    canvasRenderer: renderer,
    onError,
  });
  return { renderer, controller };
}

/** Bind shared dependencies to a factory called when Vue mounts the canvas. */
export function createPreviewFactory(
  dependencies: Omit<Parameters<typeof createPreview>[0], "preview">,
) {
  return (preview: HTMLCanvasElement) => createPreview({ ...dependencies, preview });
}
