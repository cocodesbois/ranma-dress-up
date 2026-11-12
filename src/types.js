// @ts-check
/**
 * Shared data contracts for the catalog, store, controllers and renderer.
 * Type-only module: no runtime dependencies or values are exported.
 * Import these typedefs through JSDoc import() expressions.
 * @module types
 */

/**
 * Category IDs come from Catalog.categories; runtime validation checks references.
 * Missing categories in a live look are represented by null.
 * @typedef {Record<string, string | null>} Look
 */

/**
 * Transform in Photoshop document pixels, shared by the base and wearable layers.
 * @typedef {object} Placement
 * @property {number} x
 * @property {number} y
 * @property {number} scale
 * @property {number} regX
 * @property {number} regY
 */

/**
 * Rectangle in Photoshop document pixels, not optimized-image pixels.
 * @typedef {object} Crop
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * Base character or wearable layer, resolved through the sprite manifest.
 * @typedef {object} Layer
 * @property {string} id
 * @property {string} label
 * @property {string} source Stable PNG path relative to the repository root.
 * @property {Placement} placement
 */

/**
 * Wearable catalog entry. Legacy entries may use the default thumbnail URL.
 * @typedef {Layer & {category: string, thumbnail: Crop, thumbnailSource?: string}} Item
 */

/**
 * Named wardrobe category.
 * @typedef {{id: string, label: string}} Category
 */

/**
 * Raw preset mapping; omitted categories are empty. Hair and clothing are required.
 * @typedef {object} Outfit
 * @property {string} id Independent of item IDs and image filenames.
 * @property {string} label
 * @property {Record<string, string>} items Category IDs mapped to wearable IDs.
 */

/**
 * Author-maintained data consumed by the catalog model and UI.
 * @typedef {object} Catalog
 * @property {{source: string}} background
 * @property {Layer} base
 * @property {Category[]} categories
 * @property {Item[]} items
 * @property {Outfit[]} outfits
 */

/**
 * Validated preset with resolved wearables and a complete category-to-selection map.
 * @typedef {object} OutfitPreset
 * @property {string} id
 * @property {string} label
 * @property {Item[]} items
 * @property {Look} look
 */

/**
 * Generated manifest; file URLs are relative to the Vite public root.
 * @typedef {object} SpriteManifest
 * @property {number} version
 * @property {{width: number, height: number}} document
 * @property {{scale: number, quality: number, lossless: boolean}} settings
 * @property {Record<string, Crop & {file: string, sourceHash: string}>} sprites
 */

/**
 * Decoded image and its crop in document pixels; scale maps to decoded pixels.
 * @typedef {Crop & {image: HTMLImageElement, scale: number}} Sprite
 */

export {};
