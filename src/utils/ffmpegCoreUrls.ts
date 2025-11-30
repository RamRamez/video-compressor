const FF_CORE_CACHE = 'video-compressor-ffmpeg-core'

export const FF_CORE_URLS = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
] as const

const objectUrlCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

const canUseCacheAPI = () =>
  typeof window !== 'undefined' && 'caches' in window && !!window.caches

async function fetchFromCacheOrNetwork(url: string): Promise<Response> {
  if (!canUseCacheAPI()) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    return response
  }

  const cache = await caches.open(FF_CORE_CACHE)
  const matched = await cache.match(url)
  if (matched) {
    return matched
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  await cache.put(url, response.clone())
  return response
}

async function buildObjectUrl(sourceUrl: string): Promise<string> {
  const response = await fetchFromCacheOrNetwork(sourceUrl)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  objectUrlCache.set(sourceUrl, objectUrl)
  return objectUrl
}

async function getObjectUrl(sourceUrl: string): Promise<string> {
  if (objectUrlCache.has(sourceUrl)) {
    return objectUrlCache.get(sourceUrl)!
  }

  if (inflight.has(sourceUrl)) {
    return inflight.get(sourceUrl)!
  }

  const promise = buildObjectUrl(sourceUrl).finally(() => {
    inflight.delete(sourceUrl)
  })

  inflight.set(sourceUrl, promise)
  return promise
}

export async function getFFmpegCoreSources(): Promise<{
  coreURL: string
  wasmURL: string
}> {
  const [coreURL, wasmURL] = await Promise.all(
    FF_CORE_URLS.map(url => getObjectUrl(url)),
  )
  return { coreURL, wasmURL }
}

export function releaseFFmpegCoreObjectURLs(): void {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  objectUrlCache.clear()
}
