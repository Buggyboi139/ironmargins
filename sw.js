const CACHE_NAME = 'ironmargins-v2'; // Bumped version
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/auth.js',
    '/materials.json',
    '/logo.png',
    '/logo_nb.png'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Forces the waiting service worker to become active immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    // Clean up old caches if the version changes
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// STALE-WHILE-REVALIDATE STRATEGY
self.addEventListener('fetch', event => {
    // Ignore non-GET requests (like Supabase POST/PATCH)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Only cache successful, valid responses from our origin
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback for offline usage
                return cachedResponse;
            });
            
            // Return cached response immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
