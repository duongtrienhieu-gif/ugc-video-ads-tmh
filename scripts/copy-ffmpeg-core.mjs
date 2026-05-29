// Copy @ffmpeg/core UMD files to public/ffmpeg/ so Vite serves them
// same-origin. UMD (not ESM) is required because ffmpeg.wasm's worker
// loads core via `importScripts()`, which is classic-script-only —
// ESM's `import.meta.url` syntax would throw inside the worker.
//
// Runs from prebuild + predev (see package.json). Files are gitignored.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src  = join(root, 'node_modules/@ffmpeg/core/dist/umd')
const dst  = join(root, 'public/ffmpeg')

if (!existsSync(src)) {
  console.error(`[ffmpeg-copy] @ffmpeg/core not installed at ${src}. Run npm install first.`)
  process.exit(1)
}

mkdirSync(dst, { recursive: true })
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  copyFileSync(join(src, f), join(dst, f))
  console.log(`[ffmpeg-copy] ${f} → public/ffmpeg/`)
}
