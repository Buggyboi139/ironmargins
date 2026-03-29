const CACHE_NAME = 'ironmargins-v1';
const ASSETS =[
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
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
