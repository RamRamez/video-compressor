'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompressionProgress } from '@/services/videoCompressionService'
import { videoCompressionService } from '@/services/videoCompressionService'
import type { CompressionSettings } from '@/utils/videoConfigManager'
import {
  applyCompressionSettings,
  getDefaultCompressionSettings,
  resetCompressionSettings,
} from '@/utils/videoConfigManager'

type CompressionSummary = {
  file: File
  originalSize: number
  compressedSize: number
  ratio: number
}

const defaultSettings = getDefaultCompressionSettings()

const resolutionPresets = [
  {
    id: 'default',
    label: 'default',
    description: 'Balanced square ratio (1280x1280)',
    width: defaultSettings.maxWidth,
    height: defaultSettings.maxHeight,
  },
  {
    id: 'hd',
    label: 'Full HD landscape',
    description: 'Great for widescreen footage (1920x1080)',
    width: 1920,
    height: 1080,
  },
  {
    id: 'vertical',
    label: 'Vertical stories',
    description: 'Perfect for phone captures (1080x1920)',
    width: 1080,
    height: 1920,
  },
  {
    id: 'compact',
    label: 'Compact social',
    description: 'Fast uploads with smaller footprint (720x720)',
    width: 720,
    height: 720,
  },
]

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return '–'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0

  while (value >= 1000 && idx < units.length - 1) {
    value /= 1000
    idx += 1
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  const rounded =
    decimals === 0
      ? Math.round(value).toString()
      : Number(value.toFixed(decimals)).toString()

  return `${rounded} ${units[idx]}`
}

const formatDuration = (seconds?: number) => {
  if (!seconds && seconds !== 0) return '–'

  if (seconds < 60) {
    const value = Math.round(seconds)
    return `${value} ${value === 1 ? 'second' : 'seconds'}`
  }

  const toDisplayString = (value: number) =>
    value >= 10
      ? Math.round(value).toString()
      : value.toFixed(1).replace(/\.0$/, '')

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const display = toDisplayString(minutes)
    return `${display} ${minutes === 1 ? 'minute' : 'minutes'}`
  }

  const hours = Math.floor(seconds / 3600)
  const display = toDisplayString(hours)
  return `${display} ${hours === 1 ? 'hour' : 'hours'}`
}

const crfLabel = (crf: number) => {
  if (crf <= 20) return 'Studio'
  if (crf <= 24) return 'High'
  if (crf <= 28) return 'Balanced'
  if (crf <= 32) return 'Data saver'
  return 'Aggressive'
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<CompressionProgress | null>(null)
  const [timeline, setTimeline] = useState<CompressionProgress[]>([])
  const [summary, setSummary] = useState<CompressionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [useCustomSettings, setUseCustomSettings] = useState(false)
  const [customSettings, setCustomSettings] =
    useState<CompressionSettings>(defaultSettings)
  const [activePreset, setActivePreset] = useState('default')

  useEffect(() => {
    return () => {
      videoCompressionService.cleanup()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [downloadUrl])

  const estimatedSeconds = useMemo(() => {
    if (!selectedFile) return 0
    const sizeMB = selectedFile.size / (1024 * 1024)
    return videoCompressionService.getEstimatedCompressionTime(sizeMB)
  }, [selectedFile])

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file)
      setSummary(null)
      setError(null)
      setTimeline([])
      setProgress(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
      const nextUrl = URL.createObjectURL(file)
      setPreviewUrl(nextUrl)
      setDownloadUrl(null)
    },
    [downloadUrl, previewUrl],
  )

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile],
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      const file = event.dataTransfer.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile],
  )

  const syncSettings = useCallback(
    (settings: Partial<CompressionSettings>) => {
      setCustomSettings(prev => {
        const merged = { ...prev, ...settings }
        if (useCustomSettings) {
          applyCompressionSettings(merged)
        }
        return merged
      })
    },
    [useCustomSettings],
  )

  const toggleMode = useCallback(
    (value: boolean) => {
      setUseCustomSettings(value)
      if (value) {
        applyCompressionSettings(customSettings)
      } else {
        resetCompressionSettings()
        setCustomSettings(getDefaultCompressionSettings())
        setActivePreset('default')
      }
    },
    [customSettings],
  )

  const applyPreset = useCallback(
    (presetId: string) => {
      setActivePreset(presetId)
      const preset = resolutionPresets.find(r => r.id === presetId)
      if (!preset) return
      syncSettings({
        maxWidth: preset.width,
        maxHeight: preset.height,
      })
    },
    [syncSettings],
  )

  const downloadCompressed = useCallback(() => {
    if (!summary) return
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    const url = URL.createObjectURL(summary.file)
    setDownloadUrl(url)
    const link = document.createElement('a')
    const name = summary.file.name.replace(/(\.[\w\d_-]+)$/i, '_compressed$1')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [summary, downloadUrl])

  const startCompression = useCallback(async () => {
    if (!selectedFile) {
      setError('Choose a video before compressing.')
      return
    }

    if (useCustomSettings) {
      applyCompressionSettings(customSettings)
    } else {
      resetCompressionSettings()
    }

    setIsCompressing(true)
    setError(null)
    setSummary(null)
    setTimeline([])
    setProgress(null)

    try {
      const response = await videoCompressionService.compressVideo(
        selectedFile,
        update => {
          setProgress(update)
          setTimeline(prev => [...prev, update])
        },
      )
      if (!response.success) {
        setError(response.error ?? 'Compression failed.')
        return
      }
      setSummary({
        file: response.compressedFile,
        originalSize: response.originalSize,
        compressedSize: response.compressedSize,
        ratio: response.compressionRatio,
      })
      setProgress({
        phase: 'complete',
        progress: 100,
        message: 'Compression complete',
        originalSize: response.originalSize,
        compressedSize: response.compressedSize,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to compress video.'
      setError(message)
    } finally {
      setIsCompressing(false)
    }
  }, [selectedFile, useCustomSettings, customSettings])

  const resetSelection = useCallback(() => {
    setSelectedFile(null)
    setSummary(null)
    setProgress(null)
    setTimeline([])
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setPreviewUrl(null)
    setDownloadUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [previewUrl, downloadUrl])

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12 md:px-10 lg:px-16">
      <div className="absolute inset-0 -z-10 opacity-70 blur-3xl">
        <div className="h-64 w-64 rounded-full bg-sky-500/30" />
      </div>

      <header className="flex flex-col gap-6 text-center md:text-left">
        <div className="inline-flex items-center gap-2 self-center rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1 text-sm text-sky-200 md:self-start">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Pulse Compress · Client-side FFmpeg
        </div>
        <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
          Compress videos in your browser with studio-grade controls.
        </h1>
        <p className="text-base text-slate-300 md:text-lg">
          Upload a video, tweak the output resolution and quality, and download
          the optimized file instantly. No backend, no data ever leaves your
          device.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <label
            htmlFor="video-input"
            onDragOver={event => event.preventDefault()}
            onDrop={onDrop}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center transition hover:border-sky-400/40 hover:bg-white/10"
          >
            <div className="rounded-2xl border border-dashed border-white/20 p-6">
              <p className="text-lg font-medium text-white">
                {selectedFile ? 'Video ready to compress' : 'Drop a video'}
              </p>
              <p className="text-sm text-slate-400">
                {selectedFile
                  ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}`
                  : 'Drag & drop or click to browse (mp4, mov, webm)'}
              </p>
            </div>
            <input
              id="video-input"
              type="file"
              accept="video/*"
              onChange={onInputChange}
              className="sr-only"
              ref={fileInputRef}
            />
            {selectedFile && (
              <button
                type="button"
                onClick={resetSelection}
                className="mt-4 text-sm text-slate-300 underline-offset-4 hover:text-white hover:underline"
              >
                Choose another file
              </button>
            )}
          </label>

          {previewUrl && (
            <div className="rounded-3xl border border-white/5 bg-black/40 p-4">
              <p className="mb-2 text-sm text-slate-400">Preview</p>
              <video
                src={previewUrl}
                controls
                className="aspect-video w-full rounded-2xl border border-white/10"
              />
            </div>
          )}

          <div className="grid gap-4 rounded-3xl border border-white/5 bg-white/5 p-6 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-400">Estimated time</p>
              <p className="text-2xl font-semibold text-white">
                {selectedFile ? formatDuration(estimatedSeconds) : '–'}
              </p>
              <p className="text-xs text-slate-500">Based on file size</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Original size</p>
              <p className="text-2xl font-semibold text-white">
                {formatBytes(summary?.originalSize ?? selectedFile?.size)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Compressed size</p>
              <p className="text-2xl font-semibold text-white">
                {summary ? formatBytes(summary.compressedSize) : '–'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Compression ratio</p>
              <p className="text-2xl font-semibold text-white">
                {summary ? `${summary.ratio.toFixed(2)}×` : '–'}
              </p>
              <p className="text-xs text-slate-500">Original / Compressed</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold text-white">
                  Compression progress
                </p>
                <p className="text-sm text-slate-400">
                  {progress?.message ?? 'Awaiting file'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold text-sky-300">
                  {progress ? `${progress.progress}%` : '0%'}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 transition-all"
                style={{ width: `${progress?.progress ?? 0}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {timeline.slice(-5).map((item, idx) => (
                <li
                  key={`${item.phase}-${idx}`}
                  className="flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="capitalize">{item.phase}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {item.progress}%
                  </span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={!selectedFile || isCompressing}
              onClick={startCompression}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-4 text-lg font-semibold text-slate-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCompressing ? 'Compressing…' : 'Compress video'}
            </button>
            {summary && (
              <button
                type="button"
                onClick={downloadCompressed}
                className="w-full flex-1 rounded-2xl border border-sky-400/60 bg-slate-900/50 px-6 py-4 text-lg font-semibold text-sky-200 hover:bg-slate-900"
              >
                Download result
              </button>
            )}
          </div>

          {summary && (
            <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">
                Compression summary
              </h3>
              <dl className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <dt className="text-sm text-slate-400">Ratio</dt>
                  <dd className="text-2xl font-semibold text-sky-300">
                    {summary.ratio.toFixed(2)}x smaller
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-400">Original</dt>
                  <dd className="text-lg text-white">
                    {formatBytes(summary.originalSize)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-400">Compressed</dt>
                  <dd className="text-lg text-white">
                    {formatBytes(summary.compressedSize)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-400">
                  Controls
                </p>
                <h3 className="text-xl font-semibold text-white">
                  Output profile
                </h3>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <span>Custom</span>
                <input
                  type="checkbox"
                  className="accent-sky-400"
                  checked={useCustomSettings}
                  onChange={event => toggleMode(event.target.checked)}
                />
              </label>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              <span className="block">
                Stick with the default tuning or enable custom settings to
                override resolution, bitrate, and CRF.
              </span>
              <span className="block">
                The underlying logic stays identical to the production app.
              </span>
            </p>

            <div className="mt-6 space-y-3">
              {resolutionPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!useCustomSettings}
                  onClick={() => applyPreset(preset.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    activePreset === preset.id
                      ? 'border-sky-400 bg-sky-400/10 text-white'
                      : 'border-white/10 text-slate-300 hover:border-sky-400/40'
                  } ${!useCustomSettings ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <p className="text-sm font-semibold">{preset.label}</p>
                  <p className="text-xs text-slate-400">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Quality (CRF)</p>
                <p className="text-sm font-semibold text-white">
                  {customSettings.crf} · {crfLabel(customSettings.crf)}
                </p>
              </div>
              <input
                type="range"
                min={18}
                max={34}
                step={1}
                value={customSettings.crf}
                disabled={!useCustomSettings}
                onChange={event =>
                  syncSettings({ crf: Number(event.target.value) })
                }
                className="mt-2 w-full accent-sky-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Max width (px)
                <input
                  type="number"
                  min={320}
                  max={3840}
                  value={customSettings.maxWidth}
                  disabled={!useCustomSettings}
                  onChange={event =>
                    syncSettings({ maxWidth: Number(event.target.value) })
                  }
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-sky-400 disabled:opacity-40"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Max height (px)
                <input
                  type="number"
                  min={320}
                  max={3840}
                  value={customSettings.maxHeight}
                  disabled={!useCustomSettings}
                  onChange={event =>
                    syncSettings({ maxHeight: Number(event.target.value) })
                  }
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-sky-400 disabled:opacity-40"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Target bitrate (kbps)
              <input
                type="number"
                min={300}
                max={6000}
                value={customSettings.targetBitrate}
                disabled={!useCustomSettings}
                onChange={event =>
                  syncSettings({ targetBitrate: Number(event.target.value) })
                }
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-sky-400 disabled:opacity-40"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Frame rate (fps)
              <input
                type="number"
                min={12}
                max={60}
                value={customSettings.frameRate}
                disabled={!useCustomSettings}
                onChange={event =>
                  syncSettings({ frameRate: Number(event.target.value) })
                }
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-sky-400 disabled:opacity-40"
              />
            </label>
          </div>
        </aside>
      </section>
    </main>
  )
}
