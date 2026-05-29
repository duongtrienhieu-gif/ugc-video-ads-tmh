// Client-side audio+video muxing via ffmpeg.wasm. Three modes — caller picks
// based on the audio-vs-video duration delta so no source content is lost:
//
//   1. `'simple'`     audio ≈ video. Copy video stream as-is, replace audio,
//                     trim to shorter (-shortest). Safe only when both tracks
//                     are within ±0.5s of each other.
//
//   2. `'extend'`     audio LONGER than video (e.g. EN→VI/JA, verbatim mode).
//                     Pad the video tail by freeze-cloning the last frame
//                     (`tpad=stop_mode=clone`) so it lasts as long as the
//                     audio. Re-encodes video.
//
//   3. `'pad-audio'`  audio SHORTER than video (e.g. MS→VI, or aggressive
//                     condense). Pad the audio tail with silence so the
//                     video plays in full to its original end. Re-encodes
//                     audio only; video stream is copied.

import { getFFmpeg } from '../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'

export type MuxMode = 'simple' | 'extend' | 'pad-audio'

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

  let args: string[]
  if (mode === 'extend') {
    // Hold last video frame indefinitely; -shortest cuts when audio ends.
    args = [
      '-i', inputVideo,
      '-i', inputAudio,
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
  } else if (mode === 'pad-audio') {
    // Append trailing silence to the audio so it lasts the full video duration.
    // `apad` extends the audio stream; without it, audio would end early and
    // -shortest would truncate the video. We DROP -shortest here — output
    // length is governed by the (padded) audio, which we cap at video length
    // by re-mapping after apad. Simpler: use video as the duration anchor.
    args = [
      '-i', inputVideo,
      '-i', inputAudio,
      '-filter_complex', '[1:a]apad[a]',
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',  // now safe: video is the shorter ⇒ output = video length
      '-y',
      output,
    ]
  } else {
    args = [
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
  }

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
