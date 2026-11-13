import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageLoader } from "../src/render/image-loader";
import type { OutfitPreset, SpriteManifest } from "../src/types";
import { item, manifest as createManifest } from "./fixtures";

const manifest: SpriteManifest = {
  ...createManifest(),
  sprites: {
    "assets/sprites/a.png": {
      file: "images/optimized/a.webp",
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      sourceHash: "a",
    },
    "assets/sprites/b.png": {
      file: "images/optimized/b.webp",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      sourceHash: "b",
    },
  },
};
const A = "assets/sprites/a.png";
const B = "assets/sprites/b.png";

/** Stand-in for the browser Image: loads are settled by hand, in creation order. */
let created: FakeImage[];
class FakeImage {
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    created.push(this);
  }
  succeed() {
    if (!this.onload) throw new Error("Missing load handler");
    this.onload();
  }
  fail() {
    if (!this.onerror) throw new Error("Missing error handler");
    this.onerror();
  }
}

beforeEach(() => {
  created = [];
  vi.stubGlobal("Image", FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  return createImageLoader({ outfitPresets: [], manifest, onError: vi.fn() });
}

describe("image loader caches", () => {
  it("always returns a promise, whether the image is new, loading or decoded", async () => {
    const loader = setup();
    const first = loader.loadImage(A);
    expect(first).toBeInstanceOf(Promise);
    created[0].succeed();
    await first;
    expect(loader.loadImage(A)).toBeInstanceOf(Promise);
    expect(await loader.loadImage(A)).toBe(created[0]);
  });

  it("never exposes a sprite until the image is decoded", async () => {
    const loader = setup();
    const promise = loader.loadImage(A);
    expect(loader.getSprite(A)).toBeUndefined();
    created[0].succeed();
    await promise;
    expect(loader.getSprite(A)).toEqual({
      image: created[0],
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      scale: 0.5,
    });
  });

  it("shares one load between concurrent requests", () => {
    const loader = setup();
    expect(loader.loadImage(A)).toBe(loader.loadImage(A));
    expect(created).toHaveLength(1);
  });

  it("reports sources still loading as missing, so callers wait instead of drawing early", async () => {
    const loader = setup();
    const preset: OutfitPreset = {
      id: "preset",
      label: "Preset",
      look: {},
      items: [
        { ...item("a", "tops"), source: A },
        { ...item("b", "hair"), source: B },
      ],
    };
    const loading = loader.loadImage(A);
    expect(loader.getMissingSourcesForPreset(preset)).toEqual([A, B]);
    created[0].succeed();
    await loading;
    expect(loader.getMissingSourcesForPreset(preset)).toEqual([B]);
  });

  it("forgets a failed load so that asking again retries it", async () => {
    const loader = setup();
    const failed = loader.loadImage(A);
    created[0].fail();
    await expect(failed).rejects.toThrow("Could not load image asset: images/optimized/a.webp");
    expect(loader.getSprite(A)).toBeUndefined();
    expect(
      loader.getMissingSourcesForPreset({
        id: "preset",
        label: "Preset",
        look: {},
        items: [{ ...item("a", "tops"), source: A }],
      }),
    ).toEqual([A]);

    const retry = loader.loadImage(A);
    expect(created).toHaveLength(2);
    created[1].succeed();
    await expect(retry).resolves.toBe(created[1]);
    expect(loader.getSprite(A)?.image).toBe(created[1]);
  });

  it("rejects a source missing from the manifest with the command to run", async () => {
    const loader = setup();
    await expect(loader.loadImage("assets/sprites/unknown.png")).rejects.toThrow(
      "No optimized sprite for assets/sprites/unknown.png. Run: python scripts/optimize-sprites.py",
    );
    expect(created).toHaveLength(0);
  });
});
