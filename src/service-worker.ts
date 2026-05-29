/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

const worker = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'offline-lifeboat-v1';
const OFFLINE_URL = '/offline.html';

worker.addEventListener('install', (event) => {
    worker.skipWaiting();
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cache ONLY the static offline HTML file. Absolutely nothing else.
            await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })()
    );
});

worker.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            worker.clients.claim();
            const keys = await caches.keys();
            // Annihilate any old SvelteKit App Shell caches that might be lingering on the tablets
            await Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })()
    );
});

worker.addEventListener('fetch', (event) => {
    // Only intervene if the browser is trying to load a full HTML page
    if (event.request.mode === 'navigate') {
        event.respondWith(
            // ALWAYS fetch from the network first. No local cache check.
            fetch(event.request).catch(async () => {
                // If the network request violently fails (Wi-Fi is off/dead), 
                // serve the static offline.html file.
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(OFFLINE_URL);
                return cachedResponse || new Response('Offline', { status: 503 });
            })
        );
        return;
    }

    return;
});