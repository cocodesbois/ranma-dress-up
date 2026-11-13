import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../src/data/sprite-catalog.js";
import spriteManifest from "../src/data/sprite-manifest.js";
import { createOutfitPresets } from "../src/core/catalog-model.js";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function reportMissingFile(description, relativePath) {
  const absolutePath = path.resolve(rootDirectory, relativePath);
  if (!absolutePath.startsWith(`${rootDirectory}${path.sep}`) || !existsSync(absolutePath)) {
    errors.push(`${description}: ${relativePath}`);
  }
}

function checkUniqueIds(entries, description) {
  const ids = new Set();
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

const categoryIds = new Set(catalog.categories.map(({ id }) => id));
for (const item of catalog.items) {
  if (!categoryIds.has(item.category)) {
    errors.push(`Item "${item.id}" uses unknown category "${item.category}".`);
  }
}

try {
  createOutfitPresets(catalog);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const layers = [catalog.background, catalog.base, ...catalog.items];
for (const layer of layers) {
  reportMissingFile(`Missing source image for "${layer.source}"`, layer.source);

  const sprite = spriteManifest.sprites[layer.source];
  if (!sprite) {
    errors.push(`No sprite manifest entry for "${layer.source}".`);
    continue;
  }

  reportMissingFile(`Missing optimized image for "${layer.source}"`, `public/${sprite.file}`);
}

for (const item of catalog.items) {
  const thumbnail = item.thumbnailSource ?? `images/thumbnails/${item.id}.png`;
  reportMissingFile(`Missing thumbnail for "${item.id}"`, `public/${thumbnail}`);
}

if (errors.length > 0) {
  console.error(
    `Catalog validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`,
  );
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Catalog validation passed: ${catalog.categories.length} categories, ${catalog.items.length} items, ${catalog.outfits.length} outfits.`,
  );
}
