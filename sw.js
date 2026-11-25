/* Community Garden Planner service worker: offline-first app shell.
   - Hashed build assets (/assets/*) and fonts: cache-first (they never change).
   - Page navigations: network-first, falling back to the cached app shell,
     so the app opens with no connection.
   - Supabase / API calls are never cached here; the app keeps its own
     per-garden offline copy and an outbox of queued writes. */
const VERSION = 'cgp-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/index.html', copy)); return res })
      .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))))
    return
  }
  const cacheable = (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname) || /\.(png|jpg|webp|svg|woff2?)$/.test(url.pathname)))
    || url.hostname.endsWith('fonts.gstatic.com') || url.hostname.endsWith('fonts.googleapis.com')
  if (!cacheable) return
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) }
    return res
  })))
})
