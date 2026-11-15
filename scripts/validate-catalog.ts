import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../src/data/sprite-catalog";
import spriteManifest from "../src/data/sprite-manifest";
import { createFileSystemFiles, validateCatalog } from "./catalog-validation";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { errors, warnings } = validateCatalog({
  catalog,
  manifest: spriteManifest,
  files: createFileSystemFiles(rootDirectory),
});

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
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
