// Basic service worker for Warlock (root scope)
// This file is intended as a minimal, extendable SW that will by default
// forward streaming endpoints (SSE/chunked responses) directly to the network
// so the page can receive streaming bodies unbuffered.

// Version string for this service worker; bumping this (or changing the file) will trigger an update.
const SW_VERSION = '20251203.003';
const CACHE_NAME = 'warlock-' + SW_VERSION;
const PRECACHE_URLS = [
	'/assets/application_backups.js',
	'/assets/application_configure.js',
	'/assets/application_install2.js',
	'/assets/application_install.js',
	'/assets/application_uninstall.js',
	'/assets/common.js',
	'/assets/dashboard.js',
	'/assets/files.js',
	'/assets/files_noserver.js',
	'/assets/firewall.js',
	'/assets/hosts.js',
	'/assets/service_configure.js',
	'/assets/service_logs.js',
	'/assets/settings.js',

	'/assets/themes.css',
	'/assets/frontend.css',
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
	// Claim clients immediately so the SW starts controlling pages
	event.waitUntil(
		(async () => {
			await self.clients.claim();
			// Optionally remove old caches that don't match current cache name
			const keys = await caches.keys();
			await Promise.all(keys.map(k => {
				if (k !== CACHE_NAME) return caches.delete(k);
				return Promise.resolve(true);
			}));
			// Broadcast activation and version to all clients so they can react
			const allClients = await self.clients.matchAll({ includeUncontrolled: true });
			for (const client of allClients) {
				client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
			}
		})()
	);
});

function shouldBypassRequest(request) {

	try {
		const url = new URL(request.url);
		// Path-based bypass for API endpoints
		if (url.pathname.startsWith('/api/')) return true;
	} catch (e) {
		// Fall back to no path-based bypass if URL parsing fails
	}

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
