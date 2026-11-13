/**
 * Shared data contracts for the catalog, store, controllers and renderer.
 * Paths identify source assets relative to the repository or public root.
 */

/** Category IDs mapped to the selected item, or null when nothing is selected. */
export type Look = Record<string, string | null>;

/** Transform in Photoshop document pixels. */
export interface Placement {
  x: number;
  y: number;
  scale: number;
  regX: number;
  regY: number;
}

/** Rectangle in Photoshop document pixels, not optimized-image pixels. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Base character or wearable layer, resolved through the sprite manifest. */
export interface Layer {
  id: string;
  label: string;
  source: string;
  placement: Placement;
}

/** Wearable catalog entry. Legacy entries may use the default thumbnail URL. */
export interface Item extends Layer {
  category: string;
  thumbnail: Crop;
  thumbnailSource?: string;
}

export interface Category {
  id: string;
  label: string;
}

/** Raw preset mapping; omitted categories are empty. Hair and clothing are required. */
export interface Outfit {
  id: string;
  label: string;
  items: Record<string, string>;
}

export interface Catalog {
  background: { source: string };
  base: Layer;
  categories: Category[];
  incompatibleCategories?: string[][];
  items: Item[];
  outfits: Outfit[];
}

/** Validated preset with resolved wearables and a complete selection map. */
export interface OutfitPreset {
  id: string;
  label: string;
  items: Item[];
  look: Look;
}

/** Generated manifest; file URLs are relative to the Vite public root. */
export interface SpriteManifest {
  version: number;
  document: { width: number; height: number };
  settings: { scale: number; quality: number; lossless: boolean };
  sprites: Record<string, Crop & { file: string; sourceHash: string }>;
}

/** Decoded image and its crop in document pixels; scale maps to decoded pixels. */
export interface Sprite extends Crop {
  image: HTMLImageElement;
  scale: number;
}
