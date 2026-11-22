/* PAPA service worker: makes the app installable and shows the offline page when there is no connection. */
const CACHE = 'papa-shell-v3'
/** Publications saved with "Save for offline" (kept until the member clears them). */
const OFFLINE_SAVED = 'papa-offline'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/logo.png', '/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OFFLINE_SAVED).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.match(req, { cacheName: OFFLINE_SAVED, ignoreSearch: false })) || caches.match(OFFLINE_URL)))
    return
  }
  const url = new URL(req.url)
  // Saved publication files open without internet
  if (url.origin === location.origin && (url.pathname.startsWith('/media/pubs') || url.pathname === '/pdf.worker.min.mjs')) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(req.url, { cacheName: OFFLINE_SAVED })) || Response.error()))
    return
  }
  if (url.origin === location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
  }
})

/* Push notifications */
self.addEventListener('push', (event) => {
  let data = { title: 'PAPA', body: 'You have a new notification', url: '/notifications' }
  try { data = { ...data, ...event.data.json() } } catch (_) { /* plain text */ }
  // Incoming calls stay on screen and vibrate like a ringing phone
  const ring = data.ring ? { requireInteraction: true, renotify: true, vibrate: [400, 200, 400, 200, 400, 1200, 400, 200, 400] } : {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-192.png', badge: '/favicon.png', tag: data.tag, data: { url: data.url }, ...ring }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/notifications'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
    return clients.openWindow(url)
  }))
})
