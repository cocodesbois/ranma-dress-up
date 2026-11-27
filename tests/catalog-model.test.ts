import { describe, expect, it } from "vitest";
import {
  createOutfitPresets,
  findPresetById,
  getDefaultOutfitLook,
  getExcludedCategories,
  getMatchingOutfit,
} from "../src/core/catalog-model";
import catalog from "../src/data/sprite-catalog";
import type { Catalog, CategoryId } from "../src/types";
import { item, layer, required } from "./fixtures";

const clothingCategories: CategoryId[] = [
  "bodysuits",
  "jumpsuits",
  "bras",
  "slips",
  "tights",
  "tops",
  "dresses",
  "pants",
];

function createCatalog(): Catalog {
  return {
    background: { source: "background.png" },
    base: layer("body"),
    categories: (
      ["hair", ...clothingCategories, "hats", "aprons", "gloves", "bracelets"] as CategoryId[]
    ).map((id) => ({
      id,
      label: id,
    })),
    items: [
      item("shared-hair", "hair"),
      ...clothingCategories.map((category) => item(`${category}-item`, category)),
      item("hat", "hats"),
      item("apron", "aprons"),
      item("gloves-item", "gloves"),
      item("bracelets-item", "bracelets"),
    ],
    outfits: [
      { id: "005", label: "Default", items: { hair: "shared-hair", tops: "tops-item" } },
      { id: "alternate", label: "Alternate", items: { hair: "shared-hair", pants: "pants-item" } },
    ],
  };
}

describe("published catalog constraints", () => {
  it("defines nonempty, unique category, item and outfit IDs", () => {
    for (const entries of [catalog.categories, catalog.items, catalog.outfits]) {
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.id).toBeTypeOf("string");
        expect(entry.id.trim()).not.toBe("");
      }
      expect(new Set(entries.map(({ id }) => id)).size).toBe(entries.length);
    }
    expect(catalog.categories.map(({ id }) => id)).toContain("hair");
  });

  it("assigns every item to a declared category", () => {
    const categoryIds = catalog.categories.map(({ id }) => id);
    for (const item of catalog.items) {
      expect(categoryIds, item.id).toContain(item.category);
    }
  });

  it.each(catalog.outfits)("validates references, hair and clothing for outfit $id", (outfit) => {
    const categoryIds = catalog.categories.map(({ id }) => id);
    const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
    expect(outfit.items.hair).toBeTruthy();
    expect(clothingCategories.some((category) => Boolean(outfit.items[category]))).toBe(true);
    for (const [category, itemId] of Object.entries(outfit.items)) {
      expect(categoryIds).toContain(category);
      expect(itemsById.has(itemId), itemId).toBe(true);
      expect(required(itemsById.get(itemId)).category).toBe(category);
    }
  });

  it("creates every published preset and resolves the default look", () => {
    const presets = createOutfitPresets(catalog);
    expect(presets).toHaveLength(catalog.outfits.length);
    expect(getDefaultOutfitLook(presets)).toBe(required(findPresetById(presets, "001")).look);
    for (const preset of presets) {
      expect(Object.keys(preset.look).sort()).toEqual(
        catalog.categories.map(({ id }) => id).sort(),
      );
      expect(getMatchingOutfit(catalog, presets, preset.look)).toBe(preset);
    }
  });

  it.each(["006", "016"])("reclassifies outfit %s without changing its wearables", (id) => {
    const preset = required(findPresetById(createOutfitPresets(catalog), id));
    expect(preset.look.jumpsuits).toBe(`jumpsuit${id}`);
    expect(preset.look.dresses).toBeNull();
    const jumpsuit = required(preset.items.find((item) => item.category === "jumpsuits"));
    expect(jumpsuit.source).toBe(`assets/sprites/jumpsuit${id}.png`);
    expect(jumpsuit.label).toBe(`Jumpsuit ${id.slice(1)}`);
    expect(preset.items.map((item) => item.id)).toEqual(
      id === "006"
        ? ["top006", "jumpsuit006", "slip006", "hair001", "shoes006"]
        : ["jumpsuit016", "hair001", "shoes016", "bracelets016"],
    );
  });
});

describe("createOutfitPresets", () => {
  it("fills unselected categories with null and reuses shared items independently of outfit IDs", () => {
    const input = createCatalog();
    const original = structuredClone(input);
    const presets = createOutfitPresets(input);
    expect(presets[0]).toEqual({
      id: "005",
      label: "Default",
      items: [input.items[0], input.items.find(({ id }) => id === "tops-item")],
      look: Object.fromEntries(
        input.categories.map(({ id }) => [
          id,
          id === "hair" ? "shared-hair" : id === "tops" ? "tops-item" : null,
        ]),
      ),
    });
    expect(presets[0].items[0]).toBe(presets[1].items[0]);
    expect(presets[0].look).not.toBe(presets[1].look);
    expect(input).toEqual(original);
  });

  it.each([undefined, null, [], "tops-item"])("rejects malformed items: %j", (items) => {
    const input = createCatalog();
    // Deliberately pass invalid external data to exercise runtime validation.
    Object.assign(input.outfits[0], { items });
    expect(() => createOutfitPresets(input)).toThrow('Outfit "005" must define items by category.');
  });

  it("rejects unknown categories", () => {
    const input = createCatalog();
    // Deliberately pass invalid external data to exercise runtime validation.
    Object.assign(input.outfits[0].items, { unknown: "tops-item" });
    expect(() => createOutfitPresets(input)).toThrow('Unknown category "unknown" in outfit "005".');
  });

  it("rejects unknown item IDs", () => {
    const input = createCatalog();
    input.outfits[0].items.tops = "missing";
    expect(() => createOutfitPresets(input)).toThrow('Unknown item "missing" in outfit "005".');
  });

  it("rejects items assigned to the wrong category", () => {
    const input = createCatalog();
    input.outfits[0].items.tops = "pants-item";
    expect(() => createOutfitPresets(input)).toThrow(
      'Item "pants-item" belongs to "pants", not "tops" in outfit "005".',
    );
  });

  it.each([
    ["missing hair", { tops: "tops-item" }],
    ["missing clothing", { hair: "shared-hair" }],
    ["accessory only", { hair: "shared-hair", hats: "hat" }],
    ["apron only", { hair: "shared-hair", aprons: "apron" }],
    ["empty look", {}],
  ])("rejects an incomplete outfit: %s", (_name, items) => {
    const input = createCatalog();
    input.outfits[0].items = items;
    expect(() => createOutfitPresets(input)).toThrow(
      'Outfit "005" must include hair and a clothing item.',
    );
  });

  it.each(clothingCategories)("accepts hair with %s as the only clothing category", (category) => {
    const input = createCatalog();
    input.outfits[0].items = { hair: "shared-hair", [category]: `${category}-item` };
    expect(createOutfitPresets(input)[0].look[category]).toBe(`${category}-item`);
  });

  it.each(["jumpsuits", "dresses", "tops"] as const)(
    "accepts an apron layered over %s",
    (category) => {
      const input = createCatalog();
      input.incompatibleCategories = catalog.incompatibleCategories;
      input.outfits[0].items = {
        hair: "shared-hair",
        [category]: `${category}-item`,
        aprons: "apron",
      };
      expect(createOutfitPresets(input)[0].look).toMatchObject(input.outfits[0].items);
    },
  );
});

describe("preset lookup", () => {
  const input = createCatalog();
  const presets = createOutfitPresets(input);

  it("resolves preferred IDs and falls back to the first preset or undefined", () => {
    expect(getDefaultOutfitLook(presets, "alternate")).toBe(presets[1].look);
    expect(getDefaultOutfitLook(presets, "missing")).toBe(presets[0].look);
    expect(getDefaultOutfitLook([])).toBeUndefined();
    const numericPreset = { ...presets[0], id: 5 };
    expect(Reflect.apply(getDefaultOutfitLook, undefined, [[numericPreset], "5"])).toBe(
      presets[0].look,
    );
  });

  it("normalizes numeric IDs without assuming filenames or dropping leading zeroes", () => {
    const numericPreset = { ...presets[0], id: 5 };
    expect(Reflect.apply(findPresetById, undefined, [[numericPreset], "5"])).toEqual(numericPreset);
    expect(findPresetById(presets, "005")).toBe(presets[0]);
    expect(findPresetById(presets, 5)).toBeUndefined();
    expect(findPresetById(presets, "missing")).toBeUndefined();
  });

  it("matches the whole look, including unselected categories", () => {
    expect(getMatchingOutfit(input, presets, { ...presets[0].look })).toBe(presets[0]);
    const omittedCategory = { ...presets[0].look };
    delete omittedCategory.hats;
    expect(getMatchingOutfit(input, presets, omittedCategory)).toBe(presets[0]);
    expect(getMatchingOutfit(input, presets, { ...presets[0].look, hats: "hat" })).toBeUndefined();
    expect(getMatchingOutfit(input, presets, { ...presets[0].look, hair: null })).toBeUndefined();
    expect(getMatchingOutfit(input, [], presets[0].look)).toBeUndefined();
  });
});

describe("incompatible categories", () => {
  // Malformed pairs are deliberately accepted here to exercise runtime validation.
  const withPairs = (pairs: string[][]): Catalog =>
    Object.assign(createCatalog(), { incompatibleCategories: pairs });

  it("derives symmetric exclusions from the declared pairs", () => {
    const input = withPairs([
      ["tops", "pants"],
      ["tops", "dresses"],
    ]);
    expect(getExcludedCategories(input, "tops")).toEqual(["pants", "dresses"]);
    expect(getExcludedCategories(input, "pants")).toEqual(["tops"]);
    expect(getExcludedCategories(input, "dresses")).toEqual(["tops"]);
    expect(getExcludedCategories(input, "hair")).toEqual([]);
  });

  it("applies no exclusion when the catalog declares no pairs", () => {
    expect(getExcludedCategories(createCatalog(), "tops")).toEqual([]);
  });

  it("keeps the exclusions of the published catalog", () => {
    const expected: Record<string, string[]> = {
      bodysuits: ["tops", "pants", "dresses", "slips", "jumpsuits"],
      slips: ["bodysuits"],
      tops: ["bodysuits", "dresses"],
      pants: ["bodysuits", "dresses", "jumpsuits"],
      dresses: ["bodysuits", "pants", "tops", "jumpsuits"],
      jumpsuits: ["pants", "dresses", "bodysuits"],
      gloves: ["bracelets"],
      bracelets: ["gloves"],
    };
    for (const { id } of catalog.categories) {
      expect(getExcludedCategories(catalog, id).sort(), id).toEqual(
        [...(expected[id] ?? [])].sort(),
      );
    }
  });

  it("rejects an outfit that combines incompatible categories", () => {
    const input = withPairs([["tops", "pants"]]);
    input.outfits[0].items = { hair: "shared-hair", tops: "tops-item", pants: "pants-item" };
    expect(() => createOutfitPresets(input)).toThrow(
      'Outfit "005" combines tops and pants, which are mutually exclusive.',
    );
  });

  it("rejects an outfit that combines gloves and bracelets", () => {
    const input = structuredClone(catalog);
    const outfit = required(input.outfits.find(({ id }) => id === "025"));
    outfit.items.bracelets = "bracelets001";
    expect(() => createOutfitPresets(input)).toThrow("which are mutually exclusive");
  });

  it("rejects an outfit that combines tops and dresses", () => {
    const input = createCatalog();
    input.incompatibleCategories = catalog.incompatibleCategories;
    input.outfits[0].items = { hair: "shared-hair", tops: "tops-item", dresses: "dresses-item" };
    expect(() => createOutfitPresets(input)).toThrow(
      'Outfit "005" combines tops and dresses, which are mutually exclusive.',
    );
  });

  it.each(["pants", "dresses", "bodysuits"] as const)(
    "rejects a jumpsuit preset combined with %s",
    (category) => {
      const input = createCatalog();
      input.incompatibleCategories = catalog.incompatibleCategories;
      input.outfits[0].items = {
        hair: "shared-hair",
        jumpsuits: "jumpsuits-item",
        [category]: `${category}-item`,
      };
      expect(() => createOutfitPresets(input)).toThrow("which are mutually exclusive");
    },
  );

  it("accepts outfits that use only one category of a pair", () => {
    const presets = createOutfitPresets(withPairs([["tops", "pants"]]));
    expect(presets).toHaveLength(2);
  });

  it.each([[[["tops"]]], [[["tops", "pants", "hats"]]], [[["tops", "unknown"]]], [[[]]]])(
    "rejects a malformed pair declaration: %j",
    (pairs) => {
      expect(() => createOutfitPresets(withPairs(pairs))).toThrow(
        "Invalid incompatibleCategories entry",
      );
    },
  );
});
