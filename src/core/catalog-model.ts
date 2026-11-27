/**
 * Validates raw catalog outfits and resolves them into selectable presets.
 * Depends only on shared data contracts; exports preset creation and lookup helpers.
 * @module core/catalog-model
 */

import type { Catalog, CategoryId, Item, Look, OutfitPreset } from "../types";

const REQUIRED_CLOTHING_CATEGORIES: readonly CategoryId[] = [
  "bodysuits",
  "jumpsuits",
  "bras",
  "slips",
  "tights",
  "tops",
  "dresses",
  "pants",
];

/**
 * List the categories that cannot be worn together with the given one, from the catalog's
 * `incompatibleCategories` pairs. Each pair applies in both directions.
 */
export function getExcludedCategories(catalog: Catalog, categoryId: CategoryId): CategoryId[] {
  const excluded: CategoryId[] = [];
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
 * @throws If an outfit has invalid references or is incomplete, or the catalog
 *   declares an incompatible pair with an unknown category.
 */
export function createOutfitPresets(catalog: Catalog): OutfitPreset[] {
  const outfitCategories = new Set<string>(catalog.categories.map((category) => category.id));

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
 * @returns No look when the preset list is empty.
 */
export function getDefaultOutfitLook(
  outfitPresets: OutfitPreset[],
  preferredId = "001",
): Look | undefined {
  return (
    outfitPresets.find((preset) => String(preset.id) === String(preferredId))?.look ??
    outfitPresets[0]?.look
  );
}

/**
 * Return the preferred or first look, requiring at least one valid preset.
 * @throws If no complete outfit is available.
 */
export function requireDefaultOutfitLook(outfitPresets: OutfitPreset[], preferredId = "001"): Look {
  const look = getDefaultOutfitLook(outfitPresets, preferredId);
  if (!look) {
    throw new Error("No complete outfits with a hairstyle are available.");
  }
  return look;
}

/** Find a preset after normalizing its ID to a string. */
export function findPresetById(
  outfitPresets: OutfitPreset[],
  id: string | number,
): OutfitPreset | undefined {
  const normalizedId = String(id);
  return outfitPresets.find((preset) => String(preset.id) === normalizedId);
}

/** Match every catalog category, including empty selections, against a live look. */
export function getMatchingOutfit(
  catalog: Catalog,
  outfitPresets: OutfitPreset[],
  outfit: Readonly<Look>,
): OutfitPreset | undefined {
  return outfitPresets.find((preset) =>
    catalog.categories.every(
      (category) => (outfit[category.id] ?? null) === (preset.look[category.id] ?? null),
    ),
  );
}
