import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Z36 — ffmpeg.wasm requires SharedArrayBuffer, which the browser only
// exposes in cross-origin isolated contexts. The COOP+COEP header pair
// turns that on for the dev server. Vercel deployment gets these headers
// via vercel.json.
const crossOriginIsolatedHeaders = {
  'Cross-Origin-Opener-Policy':   'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    headers: crossOriginIsolatedHeaders,
  },
  preview: {
    headers: crossOriginIsolatedHeaders,
  },
  // Exclude heavy ffmpeg.wasm core from Vite's optimize-deps scan — it's
  // dynamically imported anyway, and pre-bundling breaks the worker.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
