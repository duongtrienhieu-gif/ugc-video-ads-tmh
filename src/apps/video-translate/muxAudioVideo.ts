// Client-side audio+video muxing via ffmpeg.wasm — used by voice-only mode
// as a fallback when ElevenLabs' GET /dubbing/{id}/video/{lang} returns 404
// (happens reliably with disable_voice_cloning=true / Native voice mode).
//
// Pipeline: original video (no/old audio) + dubbed audio track → mp4 with
// new audio. Video stream is copied (no re-encode), audio is re-encoded to
// AAC for broad MP4 compatibility. Trimmed to the shorter of the two
// streams (-shortest) so we don't get trailing silence or frozen frames.

import { getFFmpeg } from '../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'

export async function muxAudioIntoVideo(params: {
  videoBlob: Blob
  audioBlob: Blob
  onLog?: (msg: string) => void
}): Promise<Blob> {
  const ffmpeg = await getFFmpeg({ onLog: params.onLog })

  const videoExt = guessExt(params.videoBlob.type, 'mp4')
  const audioExt = guessExt(params.audioBlob.type, 'mp3')
  const inputVideo = `src.${videoExt}`
  const inputAudio = `dub.${audioExt}`
  const output = 'out.mp4'

  await ffmpeg.writeFile(inputVideo, await fetchFile(params.videoBlob))
  await ffmpeg.writeFile(inputAudio, await fetchFile(params.audioBlob))

  await ffmpeg.exec([
    '-i', inputVideo,
    '-i', inputAudio,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-y',
    output,
  ])

  const data = await ffmpeg.readFile(output)
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data
  // Best-effort cleanup of in-memory FS so repeated runs don't accumulate.
  await ffmpeg.deleteFile(inputVideo).catch(() => {})
  await ffmpeg.deleteFile(inputAudio).catch(() => {})
  await ffmpeg.deleteFile(output).catch(() => {})

  return new Blob([buffer as BlobPart], { type: 'video/mp4' })
}

function guessExt(mime: string, fallback: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4'))  return 'mp4'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mov') || m.includes('quicktime')) return 'mov'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('wav'))  return 'wav'
  if (m.includes('aac'))  return 'aac'
  if (m.includes('ogg'))  return 'ogg'
  return fallback
}
