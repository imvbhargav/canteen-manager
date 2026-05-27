/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `bps-canteen-cache-${version}`;

const ASSETS = [...build, ...files];

self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => {
				self.skipWaiting();
			})
	);
});

self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}
			self.clients.claim();
		})
	);
});

self.addEventListener('fetch', (event: FetchEvent) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	// 1. BYPASS CACHE FOR ALL API CALLS (Data must be fresh)
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	// 2. Handle Navigation (Android Cold-Start Fix)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					// Force fetch to bypass local HTTP cache
					return await fetch(event.request.url, {
						method: 'GET',
						headers: event.request.headers,
						credentials: 'same-origin',
						cache: 'no-store',
						redirect: 'manual'
					});
				} catch {
					// Network failed (likely Android cold-start drop). Wait 500ms and retry.
					try {
						await new Promise((resolve) => setTimeout(resolve, 500));
						return await fetch(event.request.url, {
							method: 'GET',
							headers: event.request.headers,
							credentials: 'same-origin',
							cache: 'no-store',
							redirect: 'manual'
						});
					} catch {
						// Only serve offline cache if it genuinely fails twice
						const cachedFallback = await caches.match('/index.html');
						return cachedFallback || new Response('Offline', { status: 503 });
					}
				}
			})()
		);
		return;
	}

	// 3. Handle UI Assets (Cache first, fallback to network)
	async function respond() {
		const cache = await caches.open(CACHE);

		try {
			const response = await cache.match(event.request);
			if (response) {
				return response;
			}

			const networkResponse = await fetch(event.request);
			if (networkResponse.ok) {
				cache.put(event.request, networkResponse.clone());
			}
			return networkResponse;
		} catch {
			return new Response('Network error and no cache available', { status: 408 });
		}
	}

	event.respondWith(respond());
});
