import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createOutfitPresets } from "../src/core/catalog-model";
import { layerOrder } from "../src/data/layer-order";
import type { Catalog, SpriteManifest } from "../src/types";

/** Read-only view of the repository files, so the rules can be tested without a disk. */
export interface CatalogFiles {
  /** Whether a path relative to the repository root exists inside the repository. */
  exists(relativePath: string): boolean;
  /** File names in a directory relative to the repository root; empty if it is missing. */
  list(relativeDirectory: string): string[];
}

export interface ValidationResult {
  /** Problems that must fail the build. */
  errors: string[];
  /** Things worth a look that do not fail the build. */
  warnings: string[];
}

const SOURCE_DIRECTORY = "assets/sprites";
const THUMBNAIL_DIRECTORY = "public/images/thumbnails";
const OPTIMIZED_DIRECTORY = "public/images/optimized";
const DEFAULT_THUMBNAIL_DIRECTORY = "images/thumbnails";

/** Background variants may exist before they are wired in, so they only raise a warning. */
const isBackground = (source: string) => path.posix.basename(source).startsWith("background");

/** Read the repository files from disk, refusing paths that leave the root directory. */
export function createFileSystemFiles(rootDirectory: string): CatalogFiles {
  return {
    exists(relativePath) {
      const absolutePath = path.resolve(rootDirectory, relativePath);
      return absolutePath.startsWith(`${rootDirectory}${path.sep}`) && existsSync(absolutePath);
    },
    list(relativeDirectory) {
      const absolutePath = path.resolve(rootDirectory, relativeDirectory);
      return existsSync(absolutePath) ? readdirSync(absolutePath) : [];
    },
  };
}

/** Check catalog data, preset rules, the sprite manifest and every referenced file. */
export function validateCatalog({
  catalog,
  manifest,
  files,
}: {
  catalog: Catalog;
  manifest: SpriteManifest;
  files: CatalogFiles;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  function reportMissingFile(description: string, relativePath: string) {
    if (!files.exists(relativePath)) {
      errors.push(`${description}: ${relativePath}`);
    }
  }

  function checkUniqueIds(entries: { id: string }[], description: string) {
    const ids = new Set<string>();
    for (const { id } of entries) {
      if (!id || ids.has(id)) {
        errors.push(`${description} ID is missing or duplicated: ${id || "(empty)"}`);
      }
      ids.add(id);
    }
  }

  checkUniqueIds(catalog.categories, "Category");
  checkUniqueIds(catalog.items, "Item");
  checkUniqueIds(catalog.outfits, "Outfit");

  // The catalog and the renderer must agree on the categories: one missing from the catalog
  // has no tab, one missing from the layer order would never be drawn.
  const categoryIds = new Set<string>(catalog.categories.map(({ id }) => id));
  const layerIds = new Set<string>(layerOrder);
  for (const id of layerOrder) {
    if (!categoryIds.has(id)) {
      errors.push(
        `Category "${id}" is in src/data/layer-order.ts but not in the catalog categories.`,
      );
    }
  }
  for (const id of categoryIds) {
    if (!layerIds.has(id)) {
      errors.push(`Category "${id}" is in the catalog but not in src/data/layer-order.ts.`);
    }
  }

  for (const item of catalog.items) {
    if (!categoryIds.has(item.category)) {
      errors.push(`Item "${item.id}" uses unknown category "${item.category}".`);
    }
  }
  const categoryOrder = new Map(catalog.categories.map(({ id }, index) => [id, index]));
  let previousCategoryIndex = -1;
  const lastItemByCategory = new Map<string, string>();
  for (const item of catalog.items) {
    const itemCategoryIndex = categoryOrder.get(item.category);
    if (itemCategoryIndex === undefined) {
      continue;
    }
    if (itemCategoryIndex < previousCategoryIndex) {
      errors.push(
        `Items must follow category declaration order; "${item.id}" (${item.category}) is out of order.`,
      );
    }
    const previousItemId = lastItemByCategory.get(item.category);
    if (previousItemId && item.id <= previousItemId) {
      errors.push(
        `Items in category "${item.category}" must be sorted by id; "${item.id}" comes after "${previousItemId}".`,
      );
    }
    previousCategoryIndex = itemCategoryIndex;
    lastItemByCategory.set(item.category, item.id);
  }

  try {
    createOutfitPresets(catalog);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const layers = [catalog.background, catalog.base, ...catalog.items];
  for (const layer of layers) {
    reportMissingFile(`Missing source image for "${layer.source}"`, layer.source);

    const sprite = manifest.sprites[layer.source];
    if (!sprite) {
      errors.push(`No sprite manifest entry for "${layer.source}".`);
      continue;
    }

    reportMissingFile(`Missing optimized image for "${layer.source}"`, `public/${sprite.file}`);
  }

  const { width: documentWidth, height: documentHeight } = manifest.document;
  for (const item of catalog.items) {
    const thumbnail = item.thumbnailSource ?? `${DEFAULT_THUMBNAIL_DIRECTORY}/${item.id}.png`;
    reportMissingFile(`Missing thumbnail for "${item.id}"`, `public/${thumbnail}`);

    const { x, y, width, height } = item.thumbnail;
    const isWholeRectangle = [x, y, width, height].every(Number.isInteger);
    if (!isWholeRectangle || x < 0 || y < 0 || width <= 0 || height <= 0) {
      errors.push(`Thumbnail crop of "${item.id}" must be a non-empty rectangle of whole pixels.`);
      continue;
    }
    if (x + width > documentWidth || y + height > documentHeight) {
      errors.push(
        `Thumbnail crop of "${item.id}" lies outside the ${documentWidth}x${documentHeight} document.`,
      );
      continue;
    }

    // A crop that misses the sprite's opaque area would show an empty thumbnail.
    const sprite = manifest.sprites[item.source];
    if (sprite) {
      const overlapWidth = Math.min(x + width, sprite.x + sprite.width) - Math.max(x, sprite.x);
      const overlapHeight = Math.min(y + height, sprite.y + sprite.height) - Math.max(y, sprite.y);
      if (overlapWidth <= 0 || overlapHeight <= 0) {
        errors.push(`Thumbnail crop of "${item.id}" does not overlap its sprite.`);
      }
    }
  }

  // Files that nothing refers to: usually a leftover after a rename or a removal.
  const referencedSources = new Set(layers.map(({ source }) => source));
  const reportUnused = (description: string, source: string) => {
    (isBackground(source) ? warnings : errors).push(`${description}: ${source}`);
  };

  for (const file of files.list(SOURCE_DIRECTORY).filter((name) => name.endsWith(".png"))) {
    const source = `${SOURCE_DIRECTORY}/${file}`;
    if (!referencedSources.has(source)) {
      reportUnused("Source image is not used by the catalog", source);
    }
  }
  for (const source of Object.keys(manifest.sprites)) {
    if (!referencedSources.has(source)) {
      reportUnused("Sprite manifest entry is not used by the catalog", source);
    }
  }

  const referencedThumbnails = new Set(
    catalog.items.map(({ id, thumbnailSource }) =>
      path.posix.normalize(thumbnailSource ?? `${DEFAULT_THUMBNAIL_DIRECTORY}/${id}.png`),
    ),
  );
  for (const file of files.list(THUMBNAIL_DIRECTORY).filter((name) => name.endsWith(".png"))) {
    if (!referencedThumbnails.has(`${DEFAULT_THUMBNAIL_DIRECTORY}/${file}`)) {
      errors.push(`Thumbnail is not used by any item: ${THUMBNAIL_DIRECTORY}/${file}`);
    }
  }

  const manifestFiles = new Set(Object.values(manifest.sprites).map((sprite) => sprite.file));
  for (const file of files.list(OPTIMIZED_DIRECTORY).filter((name) => name.endsWith(".webp"))) {
    if (!manifestFiles.has(`images/optimized/${file}`)) {
      errors.push(`Optimized image is not in the sprite manifest: ${OPTIMIZED_DIRECTORY}/${file}`);
    }
  }

  return { errors, warnings };
}
