// Client-side audio+video muxing via ffmpeg.wasm. Two modes:
//
//   1. `'simple'` — old behaviour. Copy video stream as-is, replace audio,
//      trim to shorter (-shortest). Use when both tracks are roughly the
//      same length (legacy ElevenLabs Dubbing audio, which is auto-fitted).
//
//   2. `'extend'` — smart-condense path. Audio is at natural speed and may
//      be slightly longer than the source video. Pad the video tail by
//      freeze-cloning the last frame (`tpad=stop_mode=clone`) so it lasts
//      as long as the audio. Requires re-encoding the video stream.
//      Output is still MP4 H.264/AAC.

import { getFFmpeg } from '../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'

export type MuxMode = 'simple' | 'extend'

export async function muxAudioIntoVideo(params: {
  videoBlob: Blob
  audioBlob: Blob
  mode?: MuxMode
  onLog?: (msg: string) => void
}): Promise<Blob> {
  const ffmpeg = await getFFmpeg({ onLog: params.onLog })
  const mode = params.mode ?? 'simple'

  const videoExt = guessExt(params.videoBlob.type, 'mp4')
  const audioExt = guessExt(params.audioBlob.type, 'mp3')
  const inputVideo = `src.${videoExt}`
  const inputAudio = `dub.${audioExt}`
  const output = 'out.mp4'

  await ffmpeg.writeFile(inputVideo, await fetchFile(params.videoBlob))
  await ffmpeg.writeFile(inputAudio, await fetchFile(params.audioBlob))

  const args = mode === 'extend'
    ? [
        '-i', inputVideo,
        '-i', inputAudio,
        // Hold last video frame indefinitely; -shortest cuts when audio ends.
        '-filter_complex', '[0:v]tpad=stop_mode=clone:stop_duration=3600[v]',
        '-map', '[v]',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        output,
      ]
    : [
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
      ]

  await ffmpeg.exec(args)

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
