import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

function offlineAssets() {
  let outputDirectory;

  async function listFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
      }),
    );
    return files.flat();
  }

  return {
    name: "offline-assets",
    apply: "build",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      const files = (await listFiles(outputDirectory))
        .filter((file) => relative(outputDirectory, file) !== "sw.js")
        .sort();
      const hash = createHash("sha256");
      const urls = [];
      for (const file of files) {
        const path = relative(outputDirectory, file).split(sep).join("/");
        urls.push(path);
        hash.update(path);
        hash.update(await readFile(file));
      }
      const template = await readFile(new URL("./src/pwa/sw.js", import.meta.url), "utf8");
      hash.update(template);
      const worker = template
        .replace('"__CACHE_VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
        .replace('"__PRECACHE_ASSETS__"', JSON.stringify(urls));
      await writeFile(join(outputDirectory, "sw.js"), worker);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [offlineAssets()],
});
