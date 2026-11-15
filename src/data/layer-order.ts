/**
 * Single list of wardrobe categories, from the lowest layer drawn to the highest.
 * Has no dependencies; exports the draw order and the CategoryId type derived from it.
 * @module data/layer-order
 */

/**
 * Every category the app knows, in draw order. A category missing here cannot be typed as a
 * CategoryId, so it cannot be used by an item, an outfit or an incompatible pair, and the
 * renderer cannot forget to draw it.
 */
export const layerOrder = [
  "underwear",
  "slips",
  "tights",
  "bodysuits",
  "pants",
  "tops",
  "shoes",
  "jumpsuits",
  "dresses",
  "aprons",
  "hair",
  "hats",
  "necklace",
  "bracelets",
  "accessories",
] as const;

export type CategoryId = (typeof layerOrder)[number];
