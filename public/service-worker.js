// Basic service worker for Warlock (root scope)
// This file is intended as a minimal, extendable SW that will by default
// forward streaming endpoints (SSE/chunked responses) directly to the network
// so the page can receive streaming bodies unbuffered.

const CACHE_NAME = 'warlock-static-v1';
const PRECACHE_URLS = [
  // '/assets/frontend.css',
  // '/assets/common.js',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  if (PRECACHE_URLS.length) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function shouldBypassRequest(request) {

  try {
    const bypassHeader = request.headers.get('x-bypass-service-worker');
    if (bypassHeader === '1' || bypassHeader === 'true') return true;
  } catch (e) {}

  return false;
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  if (shouldBypassRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(networkResp => {
          try {
            const respToCache = networkResp.clone();
            if (networkResp.ok && networkResp.type === 'basic') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, respToCache));
            }
          } catch (e) {}
          return networkResp;
        }).catch(err => {
          return cached || Promise.reject(err);
        });
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

