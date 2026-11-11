import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

async function copyImages() {
  const distImagesDir = path.join(distDir, "images");
  await mkdir(distImagesDir, { recursive: true });

  await Promise.all([
    cp(path.join(rootDir, "images", "optimized"), path.join(distImagesDir, "optimized"), {
      recursive: true,
      force: true,
    }),
    cp(path.join(rootDir, "images", "thumbnails"), path.join(distImagesDir, "thumbnails"), {
      recursive: true,
      force: true,
    }),
  ]);
}

await copyImages();
