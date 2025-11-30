const SW_VERSION = 'v1.0.0'
const STATIC_CACHE = `video-compressor-static-${SW_VERSION}`
const FF_CACHE = 'video-compressor-ffmpeg-core'
const FF_CORE_URLS = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
]

self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const staticCache = await caches.open(STATIC_CACHE)
            await staticCache.addAll(['/', '/manifest.json'].filter(Boolean))
            await precacheFfmegCore()
            await self.skipWaiting()
        })(),
    )
})

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys()
            await Promise.all(
                cacheNames.map(name => {
                    if (name === FF_CACHE) return Promise.resolve()
                    if (name !== STATIC_CACHE) {
                        return caches.delete(name)
                    }
                    return Promise.resolve()
                }),
            )
            await self.clients.claim()
        })(),
    )
})

self.addEventListener('fetch', event => {
    const { request } = event
    if (request.method !== 'GET') return

    const url = new URL(request.url)
    const isFFmpeg =
        url.pathname === '/ffmpeg/ffmpeg-core.js' ||
        url.pathname === '/ffmpeg/ffmpeg-core.wasm' ||
        url.href.startsWith('https://cdn.jsdelivr.net/npm/@ffmpeg/core') ||
        url.href.startsWith('https://unpkg.com/@ffmpeg/core')

    if (isFFmpeg) {
        event.respondWith(cacheFirstFFmpeg(request))
        return
    }

    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(request))
    }
})

async function precacheFfmegCore() {
    try {
        const cache = await caches.open(FF_CACHE)
        const uncached = []
        for (const url of FF_CORE_URLS) {
            const matched = await cache.match(url)
            if (!matched) {
                uncached.push(url)
            }
        }
        if (uncached.length) {
            await cache.addAll(uncached)
        }
    } catch (err) {
        console.warn('[SW] Failed to precache FFmpeg core', err)
    }
}

async function cacheFirstFFmpeg(request) {
    const cache = await caches.open(FF_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    try {
        const response = await fetch(request)
        if (response.ok) {
            cache.put(request, response.clone())
        }
        return response
    } catch (error) {
        console.warn('[SW] FFmpeg cache fetch failed', error)
        return cached || new Response('', { status: 504 })
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(STATIC_CACHE)
    const cached = await cache.match(request)
    const networkFetch = fetch(request)
        .then(response => {
            if (response && response.status === 200) {
                cache.put(request, response.clone())
            }
            return response
        })
        .catch(() => cached)

    return cached || networkFetch
}

