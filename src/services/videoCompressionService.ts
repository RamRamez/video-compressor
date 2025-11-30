import { FFmpeg } from '@ffmpeg/ffmpeg'
import { VIDEO_CONFIG } from '@/utils/constants'
import {
  getFFmpegCoreSources,
  releaseFFmpegCoreObjectURLs,
} from '@/utils/ffmpegCoreUrls'

export interface CompressionProgress {
  phase:
    | 'initializing'
    | 'loading'
    | 'compressing'
    | 'finalizing'
    | 'complete'
    | 'error'
  progress: number
  message: string
  originalSize?: number
  compressedSize?: number
}

export interface CompressionResult {
  compressedFile: File
  originalSize: number
  compressedSize: number
  compressionRatio: number
  success: boolean
  error?: string
}

class VideoCompressionService {
  private ffmpeg: FFmpeg | null = null
  private isLoaded = false
  private loadingPromise: Promise<void> | null = null

  private async loadFFmpeg(
    onProgress?: (progress: CompressionProgress) => void,
  ): Promise<void> {
    if (this.isLoaded && this.ffmpeg) {
      return
    }

    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = this._loadFFmpeg(onProgress)
    return this.loadingPromise
  }

  private async _loadFFmpeg(
    onProgress?: (progress: CompressionProgress) => void,
  ): Promise<void> {
    try {
      onProgress?.({
        phase: 'initializing',
        progress: 0,
        message: 'Initializing video compression...',
      })

      this.ffmpeg = new FFmpeg()

      this.ffmpeg.on('log', ({ message }) => {
        console.warn('[FFmpeg]', message)
      })

      this.ffmpeg.on('progress', ({ progress, time }) => {
        const progressPercent = Math.round(progress * 100)
        onProgress?.({
          phase: 'compressing',
          progress: Math.min(progressPercent, 95),
          message: `Compressing video... ${progressPercent}% (${(time / 1000000).toFixed(2)}s)`,
        })
      })

      onProgress?.({
        phase: 'loading',
        progress: 20,
        message: 'Loading compression engine...',
      })

      const { coreURL, wasmURL } = await getFFmpegCoreSources()

      await this.ffmpeg.load({
        coreURL,
        wasmURL,
      })

      this.isLoaded = true

      onProgress?.({
        phase: 'loading',
        progress: 50,
        message: 'Compression engine loaded successfully',
      })
    } catch (error) {
      console.error('Failed to load FFmpeg:', error)
      this.loadingPromise = null
      throw new Error(
        `Failed to initialize video compression: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )
    }
  }

  async compressVideo(
    file: File,
    onProgress?: (progress: CompressionProgress) => void,
  ): Promise<CompressionResult> {
    try {
      const originalSize = file.size
      const originalSizeMB = originalSize / (1024 * 1024)

      if (
        originalSizeMB <= VIDEO_CONFIG.MAX_ALLOWED_SIZE_WITHOUT_COMPRESSION_MB
      ) {
        return {
          compressedFile: file,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          success: true,
        }
      }

      await this.loadFFmpeg(onProgress)

      if (!this.ffmpeg) {
        throw new Error('FFmpeg not initialized')
      }

      onProgress?.({
        phase: 'compressing',
        progress: 60,
        message: 'Preparing video for compression...',
        originalSize,
      })

      const fileData = new Uint8Array(await file.arrayBuffer())
      const inputFileName = 'input.mp4'
      const outputFileName = 'output.mp4'

      await this.ffmpeg.writeFile(inputFileName, fileData)

      const compressionArgs = this.buildCompressionCommand(
        inputFileName,
        outputFileName,
      )

      await this.ffmpeg.exec(compressionArgs)

      onProgress?.({
        phase: 'finalizing',
        progress: 95,
        message: 'Finalizing compressed video...',
      })

      const compressedData = (await this.ffmpeg.readFile(
        outputFileName,
      )) as Uint8Array
      const compressedSize = compressedData.length
      const compressedSizeMB = compressedSize / (1024 * 1024)

      if (compressedSize === 0) {
        throw new Error('Compression produced empty output')
      }

      await this.ffmpeg.deleteFile(inputFileName)
      await this.ffmpeg.deleteFile(outputFileName)

      const buffer = compressedData.buffer
      if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('Unsupported buffer type returned from compression')
      }

      const payload = buffer.slice(
        compressedData.byteOffset,
        compressedData.byteOffset + compressedData.byteLength,
      )

      const compressedBlob = new Blob([payload], { type: 'video/mp4' })
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'video/mp4',
        lastModified: Date.now(),
      })

      const compressionRatio = originalSize / compressedSize

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: `Compression complete! Reduced from ${originalSizeMB.toFixed(1)}MB to ${compressedSizeMB.toFixed(1)}MB`,
        originalSize,
        compressedSize,
      })

      return {
        compressedFile,
        originalSize,
        compressedSize,
        compressionRatio,
        success: true,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown compression error'

      onProgress?.({
        phase: 'error',
        progress: 0,
        message: `Compression failed: ${errorMessage}`,
      })

      return {
        compressedFile: file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 1,
        success: false,
        error: errorMessage,
      }
    }
  }

  private buildCompressionCommand(
    inputFile: string,
    outputFile: string,
  ): string[] {
    const config = VIDEO_CONFIG.COMPRESSION
    const targetSizeMB = VIDEO_CONFIG.MAX_COMPRESSED_SIZE_MB

    const estimatedBitrate = Math.min(
      config.TARGET_BITRATE,
      Math.floor((targetSizeMB * 8192) / VIDEO_CONFIG.MAX_DURATION_SECONDS),
    )

    const args = [
      '-i',
      inputFile,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'medium',
      '-crf',
      config.CRF.toString(),
      '-maxrate',
      `${estimatedBitrate}k`,
      '-bufsize',
      `${estimatedBitrate * 2}k`,
      '-vf',
      `scale='min(${config.MAX_WIDTH},iw)':'min(${config.MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease,pad='ceil(iw/2)*2':'ceil(ih/2)*2'`,
      '-r',
      config.FRAME_RATE.toString(),
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-map_metadata',
      '-1',
      '-metadata:s:v:0',
      'rotate=0',
      '-f',
      'mp4',
      '-movflags',
      '+faststart',
      '-y',
      outputFile,
    ]

    console.warn('FFmpeg compression command:', args.join(' '))
    return args
  }

  isCompressionAvailable(): boolean {
    return typeof window !== 'undefined'
  }

  getEstimatedCompressionTime(fileSizeMB: number): number {
    return Math.max(10, Math.ceil(fileSizeMB * 3))
  }

  cleanup(): void {
    if (this.ffmpeg) {
      this.ffmpeg = null
      this.isLoaded = false
      this.loadingPromise = null
    }

    releaseFFmpegCoreObjectURLs()
  }
}

export const videoCompressionService = new VideoCompressionService()
