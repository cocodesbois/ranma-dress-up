(function registerCatalogModel(windowObject) {
  const REQUIRED_CLOTHING_CATEGORIES = [
    "bodysuits",
    "underwear",
    "slips",
    "tights",
    "tops",
    "dresses",
    "pants"
  ];

  function createOutfitPresets(catalog) {
    const outfitCategories = new Set(catalog.categories.map((category) => category.id));
    const itemsById = new Map(catalog.items.map((item) => [item.id, item]));

    return catalog.outfits.map((outfit) => {
      if (!outfit.items || typeof outfit.items !== "object" || Array.isArray(outfit.items)) {
        throw new Error(`Outfit "${outfit.id}" must define items by category.`);
      }

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
            `Item "${item.id}" belongs to "${item.category}", not "${category}" in outfit "${outfit.id}".`
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

  function getDefaultOutfitLook(outfitPresets, preferredId = "005") {
    return outfitPresets.find((preset) => String(preset.id) === String(preferredId))?.look
      ?? outfitPresets[0]?.look;
  }

  function findPresetById(outfitPresets, id) {
    const normalizedId = String(id);
    return outfitPresets.find((preset) => String(preset.id) === normalizedId);
  }

  function getMatchingOutfit(catalog, outfitPresets, outfit) {
    return outfitPresets.find((preset) =>
      catalog.categories.every((category) => outfit[category.id] === preset.look[category.id])
    );
  }

  windowObject.RanmaDressUpCatalogModel = {
    createOutfitPresets,
    getDefaultOutfitLook,
    findPresetById,
    getMatchingOutfit
  };
}(window));
