## Video Compressor (Next.js + WebAssembly FFmpeg)

A browser-based video compressor that leverages [`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm) (WASM build) to process videos entirely on the client. No files ever leave the user's machine, making it ideal for privacy-first workflows and offline usage.

### Key Features
- Client-side compression powered by FFmpeg WebAssembly.
- Configurable presets (`src/utils/constants.ts`) controlling resolution, bitrate, frame rate, and size thresholds.
- Progressive status updates surfaced via `CompressionProgress`.
- FFmpeg core binaries cached directly in the browser (Cache Storage + Blob URLs) via `src/utils/ffmpegCoreUrls.ts`, eliminating the need for a service worker.
- Next.js App Router UI with drag-and-drop uploader and detailed compression summary (`src/app/page.tsx`).

## Requirements
- Node.js 18+ (Node 20+ recommended)
- npm (bundled with Node) or another package manager

## Installation
```bash
git clone https://github.com/RamRamez/video-compressor.git
cd video-compressor
npm install
```

## Common Scripts
```bash
# Launch dev server at http://localhost:3000
npm run dev

# Production build + start
npm run build
npm run start

# Type-check and lint
npm run lint
```

## Usage Guide
1. Run `npm run dev`.
2. Visit `http://localhost:3000`.
3. Drop or select an MP4 (other containers are converted to MP4 internally).
4. Track the progress bar phases (Initializing → Loading → Compressing → Finalizing → Complete).
5. Download/save the generated file once the process completes.

All compression logic lives in `src/services/videoCompressionService.ts`. It loads FFmpeg lazily, writes the input file into the virtual FS, executes a command constructed by `buildCompressionCommand`, then streams the compressed output back into a `Blob`/`File`.

## Configuration
- `VIDEO_CONFIG.MAX_ALLOWED_SIZE_WITHOUT_COMPRESSION_MB`: bypasses compression for small files.
- `VIDEO_CONFIG.COMPRESSION`: resolution, bitrate, CRF, etc.
- `VIDEO_CONFIG.MAX_DURATION_SECONDS`, `MAX_COMPRESSED_SIZE_MB`: used to estimate bitrate budgets.

Adjust these constants in `src/utils/constants.ts` and, if you need per-session overrides, use the helper in `src/utils/videoConfigManager.ts`.

## FFmpeg Asset Caching (No Service Worker)
`src/utils/ffmpegCoreUrls.ts` warms Cache Storage with the FFmpeg core JS/WASM assets, then serves them to `@ffmpeg/ffmpeg` through Blob URLs. The files stay in the browser cache between sessions without requiring a service worker. If you bump the FFmpeg version or change the CDN path, just update `FF_CORE_URLS` and the helper will refresh the stored blobs automatically.

## Troubleshooting
- **Type errors during build**: run `./node_modules/.bin/tsc --noEmit` to see full diagnostics.
- **FFmpeg load hangs**: confirm the browser allows WASM and that the CDN is reachable (service worker must be updated if URLs change).
- **Large files still huge**: lower `VIDEO_CONFIG.COMPRESSION.CRF` or reduce `MAX_WIDTH/MAX_HEIGHT`.

## Project Structure
```
src/
  app/................ Next.js UI (App Router)
  components/......... UI helpers and shared components
  services/........... Compression orchestration (FFmpeg)
  utils/.............. Shared config + FFmpeg core caching helpers
public/............... Static assets and manifest
```

## License
MIT © Ramin
