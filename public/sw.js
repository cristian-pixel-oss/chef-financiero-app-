/**
 * CHEF FINANCIERO — Service Worker
 *
 * Estrategia:
 *  - Shell estático (JS, CSS, fuentes, íconos): Cache First
 *  - Peticiones a Supabase API (/rest/v1, /auth): Network First
 *  - Páginas HTML: Network First con fallback al caché
 *  - Offline fallback: si no hay red y no está en caché, responde con
 *    la página /home cacheada (si existe).
 */

const CACHE_NAME = 'chef-financiero-v1'

const PRECACHE_URLS = [
  '/',
  '/home',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

// ── Install: precachear shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── Activate: limpiar cachés viejas ───────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo interceptar peticiones del mismo origen o Supabase
  if (request.method !== 'GET') return

  // Supabase API y Auth → Network First (datos siempre frescos)
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/')
  ) {
    event.respondWith(networkFirst(request))
    return
  }

  // Assets estáticos (_next/static) → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Páginas y resto → Network First con fallback
  event.respondWith(networkFirstWithFallback(request))
})

// ── Estrategias ───────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response('{"error":"offline"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Fallback a /home si está en caché
    const fallback = await caches.match('/home')
    return fallback ?? new Response('Sin conexión. Recarga cuando tengas red.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
