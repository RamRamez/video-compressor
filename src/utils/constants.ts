/**
 * Video compression constants (copied from TreeGens app)
 */

export const VIDEO_CONFIG = {
  MAX_COMPRESSED_SIZE_MB: 10,
  MAX_ALLOWED_SIZE_WITHOUT_COMPRESSION_MB: 1,
  MAX_ORIGINAL_SIZE_MB: 20,
  MAX_DURATION_SECONDS: 10,
  COMPRESSION: {
    TARGET_BITRATE: 800,
    MAX_WIDTH: 1280,
    MAX_HEIGHT: 1280,
    FRAME_RATE: 24,
    CRF: 28,
  },
} as const
