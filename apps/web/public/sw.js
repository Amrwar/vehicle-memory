/**
 * The service worker for the shop floor.
 *
 * Scoped to /shop and nothing else. A worker registered at the root would
 * start caching the office side of the product, where a stale invoice list is
 * a great deal worse than a stale job list, and where nobody is standing under
 * a car with no signal.
 *
 * Two behaviours, chosen for what fails badly rather than for what is fastest.
 *
 * The shell is cached on install and served from the cache when the network is
 * not there. A technician in a basement gets the application rather than a
 * dinosaur.
 *
 * Everything else is network-first with a cached fallback. Stale-while-
 * revalidate would be quicker and would also mean somebody reading a job list
 * from an hour ago without knowing it. When the network answers, that answer
 * wins.
 *
 * Nothing is queued here. The outbox lives in the page, in IndexedDB, because
 * a worker that dies between a click and a flush would lose whatever it was
 * holding, and losing work is the one thing this whole feature exists to
 * prevent.
 */

const CACHE = 'carnet-shop-v1';

const SHELL = ['/shop', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // An install that fails because one URL moved would leave the worker
      // uninstalled and the technician with nothing. Cache what is there.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/shop') && url.pathname !== '/offline') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only a real answer is worth keeping. Caching a 500 would serve the
        // error back for as long as the signal stayed away.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const shell = await caches.match('/shop');
        if (shell) return shell;

        return new Response(
          '<!doctype html><meta charset="utf-8"><title>No signal</title><p>No signal, and this page has not been opened on this device before.</p>',
          { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      }),
  );
});
