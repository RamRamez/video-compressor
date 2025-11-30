import { VIDEO_CONFIG } from './constants'

type MutableVideoConfig = {
  MAX_COMPRESSED_SIZE_MB: number
  MAX_ALLOWED_SIZE_WITHOUT_COMPRESSION_MB: number
  MAX_ORIGINAL_SIZE_MB: number
  MAX_DURATION_SECONDS: number
  COMPRESSION: {
    TARGET_BITRATE: number
    MAX_WIDTH: number
    MAX_HEIGHT: number
    FRAME_RATE: number
    CRF: number
  }
}

export type CompressionSettings = {
  maxWidth: number
  maxHeight: number
  frameRate: number
  crf: number
  targetBitrate: number
}

const mutableConfig = VIDEO_CONFIG as unknown as MutableVideoConfig

const defaultSettings: CompressionSettings = {
  maxWidth: VIDEO_CONFIG.COMPRESSION.MAX_WIDTH,
  maxHeight: VIDEO_CONFIG.COMPRESSION.MAX_HEIGHT,
  frameRate: VIDEO_CONFIG.COMPRESSION.FRAME_RATE,
  crf: VIDEO_CONFIG.COMPRESSION.CRF,
  targetBitrate: VIDEO_CONFIG.COMPRESSION.TARGET_BITRATE,
}

export const getCompressionSettings = (): CompressionSettings => ({
  maxWidth: mutableConfig.COMPRESSION.MAX_WIDTH,
  maxHeight: mutableConfig.COMPRESSION.MAX_HEIGHT,
  frameRate: mutableConfig.COMPRESSION.FRAME_RATE,
  crf: mutableConfig.COMPRESSION.CRF,
  targetBitrate: mutableConfig.COMPRESSION.TARGET_BITRATE,
})

export const applyCompressionSettings = (
  settings: Partial<CompressionSettings>,
): CompressionSettings => {
  const next = { ...getCompressionSettings(), ...settings }

  mutableConfig.COMPRESSION.MAX_WIDTH = next.maxWidth
  mutableConfig.COMPRESSION.MAX_HEIGHT = next.maxHeight
  mutableConfig.COMPRESSION.FRAME_RATE = next.frameRate
  mutableConfig.COMPRESSION.CRF = next.crf
  mutableConfig.COMPRESSION.TARGET_BITRATE = next.targetBitrate

  return next
}

export const resetCompressionSettings = (): CompressionSettings => {
  return applyCompressionSettings(defaultSettings)
}

export const getDefaultCompressionSettings = (): CompressionSettings => ({
  ...defaultSettings,
})
