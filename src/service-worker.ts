/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

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
    // Ignore non-GET requests (POST, PUT, DELETE should always go to network)
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    
    // Ignore third-party requests
    if (url.origin !== self.location.origin) return;

    // BYPASS CACHE FOR ALL API CALLS (Data must be fresh)
    if (url.pathname.startsWith('/api/')) {
        // By returning early, we let the browser fetch this normally.
        return; 
    }

    // Handle Navigation (HTML page loads) - Network first, fallback to offline index
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html') as Promise<Response>)
        );
        return;
    }

    // Handle UI Assets (JS, CSS, Images) - Cache first, fallback to network
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