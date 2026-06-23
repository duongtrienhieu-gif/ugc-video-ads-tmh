// ── Script Shapes (P3q) ──────────────────────────────────────────────────────
// Orthogonal to AdStructure (INSTANT / LEAD which decides product reveal timing).
// AdShape decides the BODY shape — what the 4 non-hook blocks (pain/discovery/
// benefit/cta) are repurposed for. The 5-block schema is preserved so:
//   - storage, director, validator, hybrid renderer all stay back-compat
//   - only the SEMANTIC of each block shifts per shape, driven by an OVERRIDE
//     block injected into the body system prompt
// Default shape = 'narrative' (the previous-implicit behaviour). New shapes:
//   - 'listicle'   — hook is "N reasons", body is the N reasons spoken back-to-back
//   - 'comparison' — hook sets up A vs B, body tests both, reveals the winner
//   - 'journey'    — hook is a multi-day test, body walks through the days
// ─────────────────────────────────────────────────────────────────────────────

import type { ScriptShape } from '../types'

export interface ShapeConfig {
  id: ScriptShape
  labelVi: string
  descriptionVi: string
  emoji: string
  /** When non-null, this OVERRIDES the per-group blockGuides for the 4 body
   *  blocks. Each line maps a block to its NEW semantic for this shape. Pain
   *  is still ~1 line for INSTANT and longer for LEAD — shape only changes
   *  WHAT each block contains, not its weight. */
  blockOverrides: null | {
    pain: string
    discovery: string
    benefit: string
    cta: string
  }
  /** A 2-3 sentence director hint injected into the broll director prompt so
   *  scene types match the shape (e.g. listicle → numbered list closeups,
   *  comparison → split-screen, journey → date stamps). */
  directorHint: string
}

export const SHAPE_CONFIGS: Record<ScriptShape, ShapeConfig> = {
  narrative: {
    id: 'narrative',
    labelVi: 'Kể chuyện (mặc định)',
    descriptionVi: 'Hook → pain/transition → discovery → benefit → CTA. Phù hợp đa số sản phẩm.',
    emoji: '📖',
    blockOverrides: null,   // use the structure's blockGuides as-is
    directorHint: '',       // no shape override — default scene variety
  },
  listicle: {
    id: 'listicle',
    labelVi: 'Liệt kê N lý do',
    descriptionVi: 'Hook ("3 lý do…") → từng lý do cụ thể → tóm tắt → CTA. Tốt cho sản phẩm có nhiều USP.',
    emoji: '📋',
    blockOverrides: {
      pain:
        'Pain block = 1 câu MỞ DANH SÁCH — "Lý do số 1…", "Đầu tiên là…", "Cái khiến mình mê đầu tiên…". ' +
        'KHÔNG xây pain. KHÔNG kể triệu chứng. Chỉ là phát súng mở list.',
      discovery:
        'Discovery block = ĐÚNG N lý do (theo số trong hook — 3 thường nhất). Mỗi lý do 1-2 câu ngắn, ' +
        'mỗi câu nêu 1 đặc tính/USP/cảm giác CỤ THỂ. Active verbs, present tense, sentence rhythm như ' +
        '"Số 2, … Số 3, …". TỐI THIỂU 1 sensory beat thật chen vào 1 trong các lý do.',
      benefit:
        'Benefit block = 1 câu TÓM — "Tóm lại, vì N lý do đó mà mình giữ luôn", "Đó là lý do mình ' +
        'không thèm thử brand khác". KHÔNG là 1 đoạn dài về kết quả.',
      cta:
        'CTA bình thường — mời mua + ÍT NHẤT 1 đòn bẩy (scarcity/urgency/social proof/risk reversal). ' +
        '1-2 câu.',
    },
    directorHint:
      'SHAPE = LISTICLE: the body is N (usually 3) numbered reasons spoken back-to-back. ' +
      'Visually, MOST scenes should be PRODUCT_CLOSEUP / PRODUCT_ACTION beats — one cut per reason, ' +
      'each showing the trait that reason names. Lean stickers HEAVY here (one number/spec per reason). ' +
      'Avoid a long pain scene — pain is just the "Lý do 1" transition.',
  },
  comparison: {
    id: 'comparison',
    labelVi: 'So sánh A vs B',
    descriptionVi: 'Hook (test 2 cái) → A test → B test → kết quả bất ngờ → CTA. Tốt cho sản phẩm khác hẳn đối thủ.',
    emoji: '⚖️',
    blockOverrides: {
      pain:
        'Pain block = 1 câu SETUP cái test — "Bên trái là [A], bên phải là [B]", "Cái mắc 500k, cái rẻ ' +
        '99k", "Cùng pha 1 ly, cùng đo 1 lần". KHÔNG xây pain triệu chứng.',
      discovery:
        'Discovery block = 2-3 câu TEST CỤ THỂ side-by-side. Mỗi câu mô tả 1 chỉ số/cảm giác/khoảnh khắc ' +
        'so sánh được trên cả 2 (vd "A thì… còn B thì…"). Sensory beat phải xuất hiện ở ÍT NHẤT 1 vế.',
      benefit:
        'Benefit block = REVEAL người thắng + 1 câu lý do thắng. Tone bất ngờ ("ai dè B thắng" / ' +
        '"không như mình nghĩ ban đầu"). KHÔNG kéo dài.',
      cta:
        'CTA mời mua người thắng + ÍT NHẤT 1 đòn bẩy. Có thể chốt nhẹ "thử rồi biết".',
    },
    directorHint:
      'SHAPE = COMPARISON: the body literally tests A vs B side-by-side. Visually, the discovery scenes ' +
      'should be SPLIT-SCREEN or back-to-back identical setups (left=A, right=B, same lighting, same prop). ' +
      'PRODUCT_CLOSEUP of each item with a sticker badge "RM20" vs "RM200" / "đắt" vs "rẻ". ' +
      'The benefit reveal scene must show the WINNER held up alone, with a thumbs-up. ' +
      'Mechanism3D not needed.',
  },
  journey: {
    id: 'journey',
    labelVi: 'Hành trình N ngày',
    descriptionVi: 'Hook (test N ngày) → ngày 1 → giữa hành trình → ngày cuối → CTA. Tốt cho sản phẩm cần thời gian thấy kết quả.',
    emoji: '📅',
    blockOverrides: {
      pain:
        'Pain block = SETUP ngày bắt đầu. Trạng thái xuất phát = VẤN ĐỀ/triệu chứng người mua ĐÃ CÓ TỪ ' +
        'TRƯỚC (KHI CHƯA có sản phẩm): "Trước khi có [sản phẩm], [vấn đề] vẫn dai dẳng…", "Hôm bắt đầu ' +
        'test, cổ họng vẫn rát…". 1 câu CỤ THỂ (point-of-contact đời thường). ' +
        '⛔ CẤM TUYỆT ĐỐI gán triệu chứng/khó chịu cho VIỆC DÙNG sản phẩm đích — sản phẩm đích là thứ ' +
        'ĐANG TEST để GIẢI vấn đề, KHÔNG BAO GIỜ là nguyên nhân. Cấm kiểu "từ ngày dùng [sản phẩm] tôi ' +
        'thấy mệt/chóng mặt/khó chịu" (đó là tự dìm sản phẩm mình bán). Vấn đề chỉ gán cho BỆNH hoặc CÁCH/SP CŨ.',
      discovery:
        'Discovery block = 2-3 mốc thời gian trong hành trình. "Ngày 3 thấy…", "Đến ngày 5…", "Tuần sau ' +
        'cảm giác…". Mỗi mốc 1 câu, nêu 1 thay đổi sensory/visible CỤ THỂ theo hướng CẢI THIỆN. KHÔNG mơ ' +
        'hồ "thấy khá hơn", và KHÔNG gán tác dụng xấu mới cho sản phẩm đích (journey = đường đi LÊN).',
      benefit:
        'Benefit block = REVEAL ngày cuối + state mới. "Đến ngày [N], mình…". 1-2 câu kết quả thật + ' +
        'empathy echo (so với ngày 1 trong pain block).',
      cta:
        'CTA mời mua + ÍT NHẤT 1 đòn bẩy. Có thể chốt theo journey ("còn bạn thì ngày bao nhiêu?").',
    },
    directorHint:
      'SHAPE = JOURNEY: the body walks through N days of using the product. Visually, EACH discovery ' +
      'scene is a DATE-STAMPED moment — same setting/lighting if possible, with a sticker "Day 1" / ' +
      '"Day 3" / "Day 7" / "Day 30" on each cut. The benefit reveal scene is a clean before/after or ' +
      'a clear "final day" reaction. Use creator-framing for the day stamps so we SEE progression on ' +
      'the same person/setting.',
  },
}

export const SCRIPT_SHAPE_ORDER: ScriptShape[] = ['narrative', 'listicle', 'comparison', 'journey']

/** Build the SHAPE OVERRIDE block injected into the body system prompt. When the
 *  shape is 'narrative' (default), returns '' so the existing per-group
 *  blockGuides win unchanged — full back-compat. */
export function buildShapeOverrideBlock(shape: ScriptShape): string {
  const cfg = SHAPE_CONFIGS[shape]
  if (!cfg.blockOverrides) return ''
  const o = cfg.blockOverrides
  return [
    '',
    `*** SHAPE OVERRIDE (HARD — this OVERRIDES the per-block guide above for shape "${cfg.labelVi}") ***`,
    `- pain:      ${o.pain}`,
    `- discovery: ${o.discovery}`,
    `- benefit:   ${o.benefit}`,
    `- cta:       ${o.cta}`,
    // P4j — SHAPE PRECEDENCE. The universal rules below (empathy echo, point-of-
    // contact, "real person sharing") are written for the NARRATIVE shape and
    // otherwise pull every shape back into the same personal-confession story.
    // This makes the SHAPE the body's spine and demotes those rules to texture.
    `*** SHAPE PRECEDENCE (read this BEFORE the universal rules) ***`,
    `- This script's BODY STRUCTURE is the shape above ("${cfg.labelVi}") — it is the`,
    `  SPINE of the body and WINS over the default narrative pain→discovery→benefit arc.`,
    `- The universal EMPATHY ECHO / POINT-OF-CONTACT / "real person sharing" rules below`,
    `  still apply ONLY as texture INSIDE this shape — they must NOT turn the body back`,
    `  into a flowing personal confession that ignores the shape. Do NOT default to`,
    `  "Mình là…, mấy năm nay mình…"; execute the shape's structure from sentence 1.`,
  ].join('\n')
}

/** Director shape hint — empty when shape='narrative'. Injected after the
 *  visual-culture block inside brollDirector so scene types align with shape. */
export function buildShapeDirectorHint(shape: ScriptShape): string {
  const cfg = SHAPE_CONFIGS[shape]
  if (!cfg.directorHint) return ''
  return `\n${cfg.directorHint}\n`
}

/** Heuristic: from the product brief + chosen hook, suggest a shape. The UI
 *  highlights this so the user can accept or override. Pure regex, no LLM. */
export function suggestShapeFromContext(args: {
  productPitch?: string
  hookText?: string
}): ScriptShape {
  const txt = `${args.productPitch ?? ''} ${args.hookText ?? ''}`.toLowerCase()
  // Hook explicitly says "N reasons / N lý do / N sebab" → listicle.
  if (/\b(\d+|hai|ba|bốn|năm|dua|tiga|empat|lima)\s*(lý do|reasons?|sebab|hal)/.test(txt)) return 'listicle'
  // "vs", "compare", "lawan", "so sánh", "test paling murah", "RM\d+ vs" → comparison.
  if (/\b(vs|versus|compare|lawan|so sánh|side by side)\b|(rm\d+\s*vs\s*rm\d+)/.test(txt)) return 'comparison'
  // "N ngày / N days / N hari / 7 hari / 30 days" → journey.
  if (/\b\d+\s*(ngày|days?|hari|tuần|weeks?|minggu|tháng|months?|bulan)/.test(txt)) return 'journey'
  return 'narrative'
}
