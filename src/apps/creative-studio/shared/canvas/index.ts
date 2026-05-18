// ── Shared Canvas — Public Surface (P9) ─────────────────────────────────────
//
// Single import path for engines: import { createCanvas, ... } from
// '../../shared/canvas' rather than the cross-engine path used pre-P9.

export {
  createCanvas,
  loadImage,
  drawCircularAvatar,
  roundedRectPath,
  wrapText,
  drawWrappedLines,
  canvasToBlob,
  type CanvasSize,
} from './canvas'
