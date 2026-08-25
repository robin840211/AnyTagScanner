const CACHE_NAME = 'tagscanner-v2';
const scopeUrl = new URL('./', self.registration.scope);
const coreAssets = [
  scopeUrl.href,
  new URL('manifest.webmanifest', scopeUrl).href,
  new URL('og.png', scopeUrl).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(coreAssets))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(scopeUrl.href)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(scopeUrl.href)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PREPARE_OFFLINE' || !Array.isArray(event.data.urls)) {
    return;
  }

  const urls = event.data.urls.filter((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === self.location.origin && url.href.startsWith(scopeUrl.href)
      );
    } catch {
      return false;
    }
  });

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urls.map((url) =>
          cache.add(url).catch(() => {
            // A failed optional asset must not block the rest of the offline cache.
          }),
        ),
      ),
    ),
  );
});
