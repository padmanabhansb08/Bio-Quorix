/** @module sw.js — Enhanced Service Worker with tiered caching and offline support */
const CACHE_NAME = 'quorix-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  '/images/3d_brain_icon.png',
  '/images/3d_plant_icon.png',
  '/manifest.json'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: tiered caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Strategy 1: CacheFirst for static assets (CSS, JS, fonts, images)
  if (url.pathname.match(/\.(css|js|woff2?|ttf|png|jpg|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Serve from cache, update in background
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Strategy 2: NetworkFirst for lesson/flashcard APIs (5s timeout)
  if (url.pathname.startsWith('/api/lessons') || url.pathname.startsWith('/api/flashcards')) {
    event.respondWith(
      Promise.race([
        fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || new Response(JSON.stringify({ error: 'You are offline. Cached data shown.' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }

  // Strategy 3: NetworkFirst for HTML pages
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request) || caches.match('/'))
    );
    return;
  }

  // Default: NetworkOnly for other API calls
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(JSON.stringify({ error: 'You are offline.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );
});

// Push notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/images/3d_brain_icon.png',
      badge: data.icon || '/images/3d_brain_icon.png',
      vibrate: [100, 50, 100],
      data: { dateOfArrival: Date.now(), primaryKey: '2' }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
