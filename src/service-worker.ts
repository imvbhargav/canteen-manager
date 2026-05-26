/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// Override TypeScript's default Window context for 'self'
declare const self: ServiceWorkerGlobalScope;

const CACHE = `bps-canteen-cache-${version}`;

const ASSETS = [
    ...build,
    ...files
];

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
            // Removed unused 'err' parameter to satisfy ESLint
            return new Response('Network error and no cache available', { status: 408 });
        }
    }

    event.respondWith(respond());
});