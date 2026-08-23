// Kasseo Service Worker — Cache-first strategy for static assets
const CACHE_NAME = 'kasseo-v1'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/favicon-192.png',
  '/favicon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
]

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for navigation/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests (Firebase, OneSignal, Google Fonts, etc.)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // Navigation requests: network-first, fallback to cached index.html (SPA offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    )
    return
  }

  // Static assets: cache-first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache)
        })
        return response
      })
    })
  )
})
