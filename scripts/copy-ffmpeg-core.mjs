// Copy @ffmpeg/core ESM files to public/ffmpeg/ so Vite serves them
// same-origin. ESM (not UMD) is required: @ffmpeg/ffmpeg 0.12.x spawns
// a module-type worker that loads core via `(await import(coreURL)).default`
// after the initial `importScripts()` attempt throws. UMD has no ESM
// default export — using it produces the exact production error
// "failed to import ffmpeg-core.js".
//
// Runs from prebuild + predev (see package.json). Files are gitignored.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src  = join(root, 'node_modules/@ffmpeg/core/dist/esm')
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
