const version = "__CACHE_VERSION__";
const assets = "__PRECACHE_ASSETS__";
const cachePrefix = `ranma-dress-up:${self.registration.scope}:`;
const cacheName = `${cachePrefix}${version}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      cache.addAll(assets.map((asset) => new URL(asset, self.registration.scope).href)),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const page = await cache.match(new URL("index.html", self.registration.scope).href);
        return page || fetch(request);
      }),
    );
    return;
  }

  event.respondWith(
    caches
      .open(cacheName)
      .then(async (cache) => (await cache.match(request, { ignoreVary: true })) || fetch(request)),
  );
});
