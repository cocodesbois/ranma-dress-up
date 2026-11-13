import type { Item, Placement, SpriteManifest } from "../src/types";

export const placement: Placement = { x: 0, y: 0, scale: 1, regX: 0, regY: 0 };

export function item(id: string, category: string, label = id): Item {
  return {
    id,
    category,
    label,
    source: `${id}.png`,
    placement,
    thumbnail: { x: 0, y: 0, width: 1, height: 1 },
  };
}

export function manifest(width = 100, height = 200, scale = 0.5): SpriteManifest {
  return {
    version: 1,
    document: { width, height },
    settings: { scale, quality: 85, lossless: false },
    sprites: {},
  };
}

export function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing test fixture");
  return value;
}
