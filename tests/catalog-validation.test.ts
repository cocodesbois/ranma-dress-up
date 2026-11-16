import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createFileSystemFiles,
  validateCatalog,
  type CatalogFiles,
} from "../scripts/catalog-validation";
import catalog from "../src/data/sprite-catalog";
import spriteManifest from "../src/data/sprite-manifest";
import { layerOrder } from "../src/data/layer-order";
import type { Catalog, Item, SpriteManifest } from "../src/types";
import { item, layer } from "./fixtures";

const DOCUMENT = { width: 1000, height: 2000 };
const SPRITE_CROP = { x: 100, y: 200, width: 300, height: 400 };

function sprite(name: string, crop = SPRITE_CROP) {
  return { file: `images/optimized/${name}.webp`, ...crop, sourceHash: "hash" };
}

function sourceItem(id: string, category: Item["category"]): Item {
  return {
    ...item(id, category),
    source: `assets/sprites/${id}.png`,
    thumbnail: { ...SPRITE_CROP },
  };
}

/** A small catalog that satisfies every rule; tests then break one rule at a time. */
function createFixture() {
  const hair = sourceItem("hair001", "hair");
  const top = sourceItem("top001", "tops");
  const testCatalog: Catalog = {
    background: { source: "assets/sprites/background.png" },
    base: { ...layer("body"), source: "assets/sprites/body.png" },
    categories: layerOrder.map((id) => ({ id, label: id })),
    items: [hair, top],
    outfits: [{ id: "005", label: "Default", items: { hair: hair.id, tops: top.id } }],
  };
  const testManifest: SpriteManifest = {
    version: 1,
    document: DOCUMENT,
    settings: { scale: 0.5, quality: 85, lossless: false },
    sprites: {
      "assets/sprites/background.png": sprite("background", { x: 0, y: 0, ...DOCUMENT }),
      "assets/sprites/body.png": sprite("body"),
      "assets/sprites/hair001.png": sprite("hair001"),
      "assets/sprites/top001.png": sprite("top001"),
    },
  };
  const paths = new Set<string>([
    "assets/sprites/background.png",
    "assets/sprites/body.png",
    "assets/sprites/hair001.png",
    "assets/sprites/top001.png",
    "public/images/optimized/background.webp",
    "public/images/optimized/body.webp",
    "public/images/optimized/hair001.webp",
    "public/images/optimized/top001.webp",
    "public/images/thumbnails/hair001.png",
    "public/images/thumbnails/top001.png",
  ]);
  const files: CatalogFiles = {
    exists: (relativePath) => paths.has(relativePath),
    list: (directory) =>
      [...paths]
        .filter((file) => path.posix.dirname(file) === directory)
        .map((file) => path.posix.basename(file)),
  };
  return { catalog: testCatalog, manifest: testManifest, files, paths, hair, top };
}

function validate(fixture = createFixture()) {
  return validateCatalog(fixture);
}

describe("catalog validation", () => {
  it("accepts a consistent catalog without warnings", () => {
    expect(validate()).toEqual({ errors: [], warnings: [] });
  });

  describe("categories", () => {
    it("rejects a category of the layer order that the catalog does not declare", () => {
      const fixture = createFixture();
      fixture.catalog.categories = fixture.catalog.categories.filter(({ id }) => id !== "hats");
      expect(validate(fixture).errors).toContain(
        'Category "hats" is in src/data/layer-order.ts but not in the catalog categories.',
      );
    });

    it("rejects a catalog category that the layer order does not contain", () => {
      const fixture = createFixture();
      // Deliberately pass a category the compiler would refuse.
      Object.assign(fixture.catalog, {
        categories: [...fixture.catalog.categories, { id: "capes", label: "Capes" }],
      });
      expect(validate(fixture).errors).toContain(
        'Category "capes" is in the catalog but not in src/data/layer-order.ts.',
      );
    });
  });

  describe("existing rules", () => {
    it("rejects duplicated item IDs", () => {
      const fixture = createFixture();
      fixture.catalog.items.push({ ...fixture.top });
      expect(validate(fixture).errors).toContain("Item ID is missing or duplicated: top001");
    });

    it("reports a preset that breaks a catalog rule", () => {
      const fixture = createFixture();
      fixture.catalog.outfits[0].items = { tops: fixture.top.id };
      expect(validate(fixture).errors).toContain(
        'Outfit "005" must include hair and a clothing item.',
      );
    });

    it("reports missing source, optimized and thumbnail files", () => {
      const fixture = createFixture();
      fixture.paths.delete("assets/sprites/top001.png");
      fixture.paths.delete("public/images/optimized/top001.webp");
      fixture.paths.delete("public/images/thumbnails/top001.png");
      expect(validate(fixture).errors).toEqual([
        'Missing source image for "assets/sprites/top001.png": assets/sprites/top001.png',
        'Missing optimized image for "assets/sprites/top001.png": public/images/optimized/top001.webp',
        'Missing thumbnail for "top001": public/images/thumbnails/top001.png',
      ]);
    });

    it("reports a layer without a manifest entry", () => {
      const fixture = createFixture();
      delete fixture.manifest.sprites["assets/sprites/top001.png"];
      expect(validate(fixture).errors).toContain(
        'No sprite manifest entry for "assets/sprites/top001.png".',
      );
    });
  });

  describe("thumbnail crops", () => {
    function errorsFor(crop: Item["thumbnail"]) {
      const fixture = createFixture();
      fixture.top.thumbnail = crop;
      return validate(fixture).errors;
    }

    it("accepts a crop that is larger than the sprite or only overlaps it", () => {
      expect(errorsFor({ x: 50, y: 150, width: 500, height: 600 })).toEqual([]);
      expect(errorsFor({ x: 350, y: 550, width: 200, height: 200 })).toEqual([]);
    });

    it.each([
      [{ x: 0.5, y: 0, width: 10, height: 10 }],
      [{ x: -1, y: 0, width: 10, height: 10 }],
      [{ x: 100, y: 200, width: 0, height: 10 }],
      [{ x: 100, y: 200, width: 10, height: -5 }],
    ])("rejects an empty or fractional crop: %j", (crop) => {
      expect(errorsFor(crop)).toEqual([
        'Thumbnail crop of "top001" must be a non-empty rectangle of whole pixels.',
      ]);
    });

    it("rejects a crop that leaves the document", () => {
      expect(errorsFor({ x: 900, y: 0, width: 200, height: 10 })).toEqual([
        'Thumbnail crop of "top001" lies outside the 1000x2000 document.',
      ]);
      expect(errorsFor({ x: 0, y: 1900, width: 10, height: 200 })).toEqual([
        'Thumbnail crop of "top001" lies outside the 1000x2000 document.',
      ]);
    });

    it("rejects a crop that misses the sprite, since the thumbnail would be empty", () => {
      expect(errorsFor({ x: 800, y: 1500, width: 100, height: 100 })).toEqual([
        'Thumbnail crop of "top001" does not overlap its sprite.',
      ]);
      // Touching edges is not overlapping.
      expect(errorsFor({ x: 400, y: 200, width: 100, height: 100 })).toEqual([
        'Thumbnail crop of "top001" does not overlap its sprite.',
      ]);
    });
  });

  describe("files nothing refers to", () => {
    it("rejects an unused item image and its manifest entry", () => {
      const fixture = createFixture();
      fixture.paths.add("assets/sprites/top009.png");
      fixture.manifest.sprites["assets/sprites/top009.png"] = sprite("top009");
      expect(validate(fixture).errors).toEqual([
        "Source image is not used by the catalog: assets/sprites/top009.png",
        "Sprite manifest entry is not used by the catalog: assets/sprites/top009.png",
      ]);
    });

    it("only warns about an unused background variant", () => {
      const fixture = createFixture();
      fixture.paths.add("assets/sprites/background002.png");
      fixture.manifest.sprites["assets/sprites/background002.png"] = sprite("background002");
      expect(validate(fixture)).toEqual({
        errors: [],
        warnings: [
          "Source image is not used by the catalog: assets/sprites/background002.png",
          "Sprite manifest entry is not used by the catalog: assets/sprites/background002.png",
        ],
      });
    });

    it("rejects a thumbnail that no item uses", () => {
      const fixture = createFixture();
      fixture.paths.add("public/images/thumbnails/pants002.png");
      expect(validate(fixture).errors).toEqual([
        "Thumbnail is not used by any item: public/images/thumbnails/pants002.png",
      ]);
    });

    it("accepts a thumbnail referenced through thumbnailSource", () => {
      const fixture = createFixture();
      fixture.paths.delete("public/images/thumbnails/top001.png");
      fixture.paths.add("public/images/thumbnails/custom-name.png");
      fixture.top.thumbnailSource = "images/thumbnails/custom-name.png";
      expect(validate(fixture).errors).toEqual([]);
    });

    it("rejects an optimized image missing from the manifest", () => {
      const fixture = createFixture();
      fixture.paths.add("public/images/optimized/stale.webp");
      expect(validate(fixture).errors).toEqual([
        "Optimized image is not in the sprite manifest: public/images/optimized/stale.webp",
      ]);
    });
  });
});

describe("file system access", () => {
  const rootDirectory = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const files = createFileSystemFiles(rootDirectory);

  it("reads files inside the repository only", () => {
    expect(files.exists("package.json")).toBe(true);
    expect(files.exists("missing-file.txt")).toBe(false);
    expect(files.exists("..")).toBe(false);
    expect(files.exists("../package.json")).toBe(false);
  });

  it("lists a directory, or nothing when it is missing", () => {
    expect(files.list("public/images/thumbnails")).toContain("top001.png");
    expect(files.list("does/not/exist")).toEqual([]);
  });

  it("finds nothing wrong with the published catalog", () => {
    const { errors, warnings } = validateCatalog({ catalog, manifest: spriteManifest, files });
    expect(errors).toEqual([]);
    // Unused background variants are tolerated, but nothing else may be reported.
    expect(warnings.every((warning) => warning.includes("assets/sprites/background"))).toBe(true);
  });
});
