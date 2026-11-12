// @ts-check
/**
 * Validates raw catalog outfits and resolves them into selectable presets.
 * Depends only on shared data contracts; exports preset creation and lookup helpers.
 * @module core/catalog-model
 */

/** @typedef {import("../types.js").Catalog} Catalog */
/** @typedef {import("../types.js").Look} Look */
/** @typedef {import("../types.js").OutfitPreset} OutfitPreset */

const REQUIRED_CLOTHING_CATEGORIES = [
  "bodysuits",
  "underwear",
  "slips",
  "tights",
  "tops",
  "dresses",
  "pants",
];

/**
 * Resolve item references, fill empty categories and require hair plus clothing.
 * @param {Catalog} catalog
 * @returns {OutfitPreset[]}
 * @throws {Error} If an outfit has invalid references or is incomplete.
 */
export function createOutfitPresets(catalog) {
  const outfitCategories = new Set(catalog.categories.map((category) => category.id));
  const itemsById = new Map(catalog.items.map((item) => [item.id, item]));

  return catalog.outfits.map((outfit) => {
    if (!outfit.items || typeof outfit.items !== "object" || Array.isArray(outfit.items)) {
      throw new Error(`Outfit "${outfit.id}" must define items by category.`);
    }

    /** @type {Look} */
    const look = Object.fromEntries([...outfitCategories].map((category) => [category, null]));
    const items = [];

    for (const [category, itemId] of Object.entries(outfit.items)) {
      if (!outfitCategories.has(category)) {
        throw new Error(`Unknown category "${category}" in outfit "${outfit.id}".`);
      }

      const item = itemsById.get(itemId);
      if (!item) {
        throw new Error(`Unknown item "${itemId}" in outfit "${outfit.id}".`);
      }

      if (item.category !== category) {
        throw new Error(
          `Item "${item.id}" belongs to "${item.category}", not "${category}" in outfit "${outfit.id}".`,
        );
      }

      look[category] = item.id;
      items.push(item);
    }

    if (!look.hair || !items.some((item) => REQUIRED_CLOTHING_CATEGORIES.includes(item.category))) {
      throw new Error(`Outfit "${outfit.id}" must include hair and a clothing item.`);
    }

    return { id: outfit.id, label: outfit.label, items, look };
  });
}

/**
 * Return the preferred look, or the first preset's look if it is unavailable.
 * @param {OutfitPreset[]} outfitPresets
 * @param {string} [preferredId="005"]
 * @returns {Look | undefined} No look when the preset list is empty.
 */
export function getDefaultOutfitLook(outfitPresets, preferredId = "005") {
  return (
    outfitPresets.find((preset) => String(preset.id) === String(preferredId))?.look ??
    outfitPresets[0]?.look
  );
}

/**
 * Find a preset after normalizing its ID to a string.
 * @param {OutfitPreset[]} outfitPresets
 * @param {string | number} id
 * @returns {OutfitPreset | undefined}
 */
export function findPresetById(outfitPresets, id) {
  const normalizedId = String(id);
  return outfitPresets.find((preset) => String(preset.id) === normalizedId);
}

/**
 * Match every catalog category, including empty selections, against a live look.
 * @param {Catalog} catalog
 * @param {OutfitPreset[]} outfitPresets
 * @param {Look} outfit
 * @returns {OutfitPreset | undefined}
 */
export function getMatchingOutfit(catalog, outfitPresets, outfit) {
  return outfitPresets.find((preset) =>
    catalog.categories.every((category) => outfit[category.id] === preset.look[category.id]),
  );
}
