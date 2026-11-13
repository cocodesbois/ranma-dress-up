/**
 * Validates raw catalog outfits and resolves them into selectable presets.
 * Depends only on shared data contracts; exports preset creation and lookup helpers.
 * @module core/catalog-model
 */

import type { Catalog, Item, Look, OutfitPreset } from "../types";

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
 * List the categories that cannot be worn together with the given one, from the catalog's
 * `incompatibleCategories` pairs. Each pair applies in both directions.
 * @param {Catalog} catalog
 * @param {string} categoryId
 * @returns {string[]}
 */
export function getExcludedCategories(catalog: Catalog, categoryId: string): string[] {
  const excluded: string[] = [];
  for (const [first, second] of catalog.incompatibleCategories ?? []) {
    if (first === categoryId) {
      excluded.push(second);
    } else if (second === categoryId) {
      excluded.push(first);
    }
  }
  return excluded;
}

/**
 * Resolve item references, fill empty categories and require hair plus clothing.
 * Outfits must also respect the catalog's incompatible category pairs.
 * @param {Catalog} catalog
 * @returns {OutfitPreset[]}
 * @throws {Error} If an outfit has invalid references or is incomplete, or the catalog
 *   declares an incompatible pair with an unknown category.
 */
export function createOutfitPresets(catalog: Catalog): OutfitPreset[] {
  const outfitCategories = new Set(catalog.categories.map((category) => category.id));

  for (const pair of catalog.incompatibleCategories ?? []) {
    if (pair.length !== 2 || !pair.every((category) => outfitCategories.has(category))) {
      throw new Error(`Invalid incompatibleCategories entry: ${JSON.stringify(pair)}.`);
    }
  }
  const itemsById = new Map(catalog.items.map((item) => [item.id, item]));

  return catalog.outfits.map((outfit) => {
    if (!outfit.items || typeof outfit.items !== "object" || Array.isArray(outfit.items)) {
      throw new Error(`Outfit "${outfit.id}" must define items by category.`);
    }

    const look: Look = Object.fromEntries(
      [...outfitCategories].map((category) => [category, null]),
    );
    const items: Item[] = [];

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

    for (const [first, second] of catalog.incompatibleCategories ?? []) {
      if (look[first] && look[second]) {
        throw new Error(
          `Outfit "${outfit.id}" combines ${first} and ${second}, which are mutually exclusive.`,
        );
      }
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
export function getDefaultOutfitLook(
  outfitPresets: OutfitPreset[],
  preferredId = "005",
): Look | undefined {
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
export function findPresetById(
  outfitPresets: OutfitPreset[],
  id: string | number,
): OutfitPreset | undefined {
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
export function getMatchingOutfit(
  catalog: Catalog,
  outfitPresets: OutfitPreset[],
  outfit: Look,
): OutfitPreset | undefined {
  return outfitPresets.find((preset) =>
    catalog.categories.every((category) => outfit[category.id] === preset.look[category.id]),
  );
}
