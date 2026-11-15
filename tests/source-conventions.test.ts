import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("source conventions", () => {
  it("does not repeat TypeScript types in JSDoc tags", () => {
    // `@param {string} id` duplicates the signature and can silently drift from it.
    const typedTag: RegExp = /@(param|returns?|type|typedef|throws|property|template)\s*\{/;
    const offenders: string[] = listTypeScriptFiles("src").flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line: string, index: number) =>
          typedTag.test(line) ? [`${file}:${index + 1}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
