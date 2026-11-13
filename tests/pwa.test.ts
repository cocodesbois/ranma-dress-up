import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const scope = "https://example.com/dress-up/";
const cacheName = `ranma-dress-up:${scope}:new`;

function createWorker() {
  const handlers = new Map<string, (event: never) => void>();
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi
      .fn()
      .mockResolvedValue([
        `ranma-dress-up:${scope}:old`,
        cacheName,
        "ranma-dress-up:https://example.com/another/:old",
      ]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue("network");
  const source = readFileSync(new URL("../src/pwa/sw.js", import.meta.url), "utf8")
    .replace('"__CACHE_VERSION__"', '"new"')
    .replace('"__PRECACHE_ASSETS__"', '["index.html","images/optimized/top001.webp"]');

  runInNewContext(source, {
    URL,
    caches,
    fetch,
    self: {
      location: new URL(scope),
      registration: { scope },
      addEventListener: (name: string, handler: (event: never) => void) =>
        handlers.set(name, handler),
    },
  });

  return { handlers, cache, caches, fetch };
}

describe("offline service worker", () => {
  it("precaches the entire build relative to its deployment scope", async () => {
    const { handlers, cache } = createWorker();
    let task: Promise<void> | undefined;
    handlers.get("install")?.({ waitUntil: (value: Promise<void>) => (task = value) } as never);
    await task;
    expect(cache.addAll).toHaveBeenCalledWith([
      `${scope}index.html`,
      `${scope}images/optimized/top001.webp`,
    ]);
  });

  it("does not activate an incomplete offline cache", async () => {
    const { handlers, cache } = createWorker();
    cache.addAll.mockRejectedValue(new Error("download failed"));
    let task: Promise<void> | undefined;
    handlers.get("install")?.({ waitUntil: (value: Promise<void>) => (task = value) } as never);
    await expect(task).rejects.toThrow("download failed");
  });

  it("removes old caches only for its own deployment", async () => {
    const { handlers, caches } = createWorker();
    let task: Promise<void> | undefined;
    handlers.get("activate")?.({ waitUntil: (value: Promise<void>) => (task = value) } as never);
    await task;
    expect(caches.delete).toHaveBeenCalledTimes(1);
    expect(caches.delete).toHaveBeenCalledWith(`ranma-dress-up:${scope}:old`);
  });

  it("serves the matching cached shell and assets without the network", async () => {
    const { handlers, cache, fetch } = createWorker();
    cache.match.mockResolvedValue("cached");
    let response: Promise<unknown> | undefined;
    const respondWith = (value: Promise<unknown>) => (response = value);
    handlers.get("fetch")?.({
      request: { url: scope, method: "GET", mode: "navigate" },
      respondWith,
    } as never);
    await expect(response).resolves.toBe("cached");
    expect(cache.match).toHaveBeenCalledWith(`${scope}index.html`);

    handlers.get("fetch")?.({
      request: { url: `${scope}images/optimized/top001.webp`, method: "GET", mode: "no-cors" },
      respondWith,
    } as never);
    await expect(response).resolves.toBe("cached");
    expect(cache.match).toHaveBeenLastCalledWith(
      { url: `${scope}images/optimized/top001.webp`, method: "GET", mode: "no-cors" },
      { ignoreVary: true },
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not intercept requests outside its scope", () => {
    const { handlers } = createWorker();
    const respondWith = vi.fn();
    handlers.get("fetch")?.({
      request: { url: "https://example.com/another/image.png", method: "GET", mode: "no-cors" },
      respondWith,
    } as never);
    expect(respondWith).not.toHaveBeenCalled();
  });
});
